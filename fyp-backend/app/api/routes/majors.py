from __future__ import annotations

import math
import re
from urllib.parse import unquote

from fastapi import APIRouter, Body, HTTPException, Query, Request, status

from app.db.mysql import DatabaseConnectionError, DatabaseQueryError, expand_in_clause, query, query_one
from app.schemas.careerpath import MajorProgramItem, MajorSkillGapsRequest, MajorSkillItem, RecommendMajorItem
from app.services.ml_recommender import MLAssets


router = APIRouter(tags=["majors"])


_OCC_URI_RE = re.compile(r"^https?://data\.europa\.eu/esco/occupation/[0-9a-fA-F-]{36}$")


def _ensure_job_exists(job_id: int) -> None:
    row = query_one("SELECT id FROM job WHERE id = :job_id LIMIT 1;", {"job_id": job_id})
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")


def _ensure_major_exists(major_id: int) -> None:
    row = query_one("SELECT id FROM major WHERE id = :major_id LIMIT 1;", {"major_id": major_id})
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Major not found")


def _major_exists(major_id: int) -> bool:
    row = query_one("SELECT id FROM major WHERE id = :major_id LIMIT 1;", {"major_id": major_id})
    return bool(row)


@router.get("/jobs/{job_id}/majors", response_model=list[RecommendMajorItem])
def recommend_majors_for_job(
    job_id: int,
    top_k: int = Query(default=5, ge=1, le=50),
) -> list[RecommendMajorItem]:
    """Recommend majors for a job by overlapping skills.

    Score = SUM(major_skill.importance) over matched skills.
    Ordering: score DESC, matched_skills DESC.
    """

    sql = """
    SELECT
      m.id AS major_id,
      m.major_name,
      m.field,
      m.description,
      COUNT(DISTINCT ms.skill_id) AS matched_skills,
      SUM(COALESCE(ms.importance, 1)) AS score
    FROM job_skill js
    JOIN major_skill ms ON ms.skill_id = js.skill_id
    JOIN major m ON m.id = ms.major_id
    WHERE js.job_id = :job_id
    GROUP BY m.id, m.major_name, m.field, m.description
    ORDER BY score DESC, matched_skills DESC
    LIMIT :top_k;
    """

    try:
        _ensure_job_exists(job_id)
        rows = query(sql, {"job_id": job_id, "top_k": int(top_k)})
        return [
            RecommendMajorItem.model_validate(
                {
                    "major_id": int(row.get("major_id") or 0),
                    "major_name": row.get("major_name") or "",
                    "field": row.get("field"),
                    "description": row.get("description"),
                    "matched_skills": int(row.get("matched_skills") or 0),
                    "score": float(row.get("score") or 0.0),
                }
            )
            for row in rows
        ]
    except HTTPException:
        raise
    except DatabaseConnectionError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except DatabaseQueryError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Major recommendation query failed") from exc


@router.get("/jobs/{job_ref:path}/majors", response_model=list[RecommendMajorItem])
def recommend_majors_for_job_ref(
    job_ref: str,
    request: Request,
    top_k: int = Query(default=5, ge=1, le=50),
) -> list[RecommendMajorItem]:
    """Compatibility: allow job_ref to be an ESCO occupation URI with slashes.

    Frontend may call:
      /api/jobs/http%3A//data.europa.eu/esco/occupation/<uuid>/majors?top_k=...

    If job_ref is numeric, we delegate to the existing DB-based implementation.
    If job_ref is an ESCO occupation URI, we use startup-cached ML metadata mapping.
    """

    # Accept URL-encoded job ids (including double-encoded values).
    # FastAPI decodes path params once; we decode once more to be robust.
    ref = unquote((job_ref or "").strip())
    if not ref:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="job_ref is required")

    if ref.isdigit():
        return recommend_majors_for_job(int(ref), top_k=top_k)

    if not _OCC_URI_RE.match(ref):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    assets: MLAssets | None = getattr(request.app.state, "ml_assets", None)
    if assets is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="ML assets not loaded")

    majors = assets.occ_uri_to_majors.get(ref) or []
    if not majors:
        return []

    # Rank majors by specificity (lower degree -> higher score).
    deduped: list[str] = []
    seen: set[str] = set()
    for m in majors:
        name = (m or "").strip()
        if not name or name in seen:
            continue
        seen.add(name)
        deduped.append(name)

    scored = []
    for name in deduped:
        degree = int(assets.major_degree.get(name, 1) or 1)
        score = 1.0 / math.sqrt(max(1, degree))
        scored.append((name, score))
    scored.sort(key=lambda x: x[1], reverse=True)
    top_names = [name for name, _score in scored[: int(top_k)]]

    # Option 2: only return majors that exist in the DB (so major_id is valid).
    major_rows_by_name: dict[str, dict] = {}
    try:
        sql = """
        SELECT id AS major_id, major_name, field, description
        FROM major
        WHERE major_name IN (:names)
        LIMIT 200;
        """
        sql, expanded = expand_in_clause(sql, {"names": top_names}, "names")
        rows = query(sql, expanded)
        for row in rows:
            name = (row.get("major_name") or "").strip()
            if name:
                major_rows_by_name[name] = row
    except Exception:
        # If DB lookup fails in this environment, do not return "fake" major_id.
        return []

    out: list[RecommendMajorItem] = []
    for name in top_names:
        row = major_rows_by_name.get(name)
        if not row:
            continue
        degree = int(assets.major_degree.get(name, 1) or 1)
        score = 1.0 / math.sqrt(max(1, degree))
        out.append(
            RecommendMajorItem.model_validate(
                {
                    "major_id": int(row.get("major_id") or 0),
                    "major_name": name,
                    "field": row.get("field"),
                    "description": row.get("description"),
                    "matched_skills": 0,
                    "score": float(score),
                }
            )
        )
    return out


@router.get("/majors/{major_id}/skills", response_model=list[MajorSkillItem])
def get_major_skills(major_id: int) -> list[MajorSkillItem]:
    sql = """
    SELECT
      s.id AS skill_id,
      s.skill_key,
      s.name,
      s.source,
      NULL AS dimension,
      ms.importance
    FROM major_skill ms
    JOIN skill s ON s.id = ms.skill_id
    WHERE ms.major_id = :major_id
    ORDER BY (ms.importance IS NULL), ms.importance DESC, s.name
    LIMIT 300;
    """

    try:
        if not _major_exists(major_id):
            return []

        try:
            rows = query(sql, {"major_id": major_id})
        except DatabaseQueryError:
            # Some DB roles may not have access to normalized tables.
            rows = []

        # If the normalized major_skill table is empty (common in read-only DB setups),
        # derive skills from other available sources.
        if not rows:
            # Fallback A: ESCO occupation-skill links
            derived_sql = """
            SELECT
              s.id AS skill_id,
              s.skill_key,
              s.name,
              s.source,
              NULL AS dimension,
              SUM(
                CASE
                  WHEN LOWER(COALESCE(link.relationType, '')) = 'essential' THEN 2
                  ELSE 1
                END
              ) AS importance
            FROM major_occupation_map mom
            JOIN stage_occupation_skill_links_esco link
              ON link.occupationUri = mom.occupation_uri
            JOIN skill s
              ON s.skill_key = link.skillUri
            WHERE mom.major_id = :major_id
            GROUP BY s.id, s.skill_key, s.name, s.source
            ORDER BY importance DESC, s.name
            LIMIT 300;
            """.strip()
            try:
                rows = query(derived_sql, {"major_id": major_id})
            except DatabaseQueryError:
                rows = []

        if not rows:
            # Fallback B: derive from job_skill via major_occupation_map -> job(esco_uri)
            # This path works even when ESCO link tables are not present.
            jobskill_sql = """
            SELECT
              s.id AS skill_id,
              s.skill_key,
              s.name,
              s.source,
              NULL AS dimension,
              SUM(COALESCE(js.importance, 1)) AS importance
            FROM major_occupation_map mom
            JOIN job j ON j.esco_uri = mom.occupation_uri
            JOIN job_skill js ON js.job_id = j.id
            JOIN skill s ON s.id = js.skill_id
            WHERE mom.major_id = :major_id
            GROUP BY s.id, s.skill_key, s.name, s.source
            ORDER BY importance DESC, s.name
            LIMIT 300;
            """.strip()
            rows = query(jobskill_sql, {"major_id": major_id})

        return [
            MajorSkillItem.model_validate(
                {
                    "skill_id": int(row.get("skill_id") or 0),
                    "skill_key": row.get("skill_key") or "",
                    "name": row.get("name") or "",
                    "source": row.get("source"),
                    "dimension": row.get("dimension"),
                    "importance": float(row.get("importance")) if row.get("importance") is not None else None,
                }
            )
            for row in rows
        ]
    except HTTPException:
        raise
    except DatabaseConnectionError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except DatabaseQueryError as exc:
        _ = exc
        return []


@router.post("/majors/{major_id}/gaps", response_model=list[MajorSkillItem])
def get_major_skill_gaps(
    major_id: int,
    payload: MajorSkillGapsRequest = Body(...),
) -> list[MajorSkillItem]:
    if len(payload.skill_keys) > 200:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="skill_keys exceeds max of 200")

    raw_keys = [sk for sk in payload.skill_keys if sk and sk.strip()]
    deduped: list[str] = []
    seen: set[str] = set()
    for key in raw_keys:
        if key not in seen:
            seen.add(key)
            deduped.append(key)

    try:
        if not _major_exists(major_id):
            return []

        resolved_skill_ids: list[int] = []
        if deduped:
            resolve_sql = """
            SELECT id
            FROM skill
            WHERE skill_key IN (:skill_keys)
            LIMIT 200;
            """
            resolve_sql, expanded = expand_in_clause(resolve_sql, {"skill_keys": deduped}, "skill_keys")
            resolved = query(resolve_sql, expanded)
            resolved_skill_ids = [int(r.get("id") or 0) for r in resolved if r.get("id") is not None]

        # 1) Prefer normalized major_skill table
        base_sql = """
        SELECT
                    s.id AS skill_id, s.skill_key, s.name, s.source, NULL AS dimension,
          ms.importance
        FROM major_skill ms
        JOIN skill s ON s.id = ms.skill_id
        WHERE ms.major_id = :major_id
        """
        params: dict[str, object] = {"major_id": major_id}

        if resolved_skill_ids:
            base_sql += "\n        AND ms.skill_id NOT IN (:skill_ids)\n"
            base_sql, params = expand_in_clause(base_sql, {**params, "skill_ids": resolved_skill_ids}, "skill_ids")

        base_sql += "\n        ORDER BY (ms.importance IS NULL), ms.importance DESC, s.name\n        LIMIT 300;\n"
        try:
            rows = query(base_sql, params)
        except DatabaseQueryError:
            rows = []

        # 2) Fallback: derive from ESCO occupation-skill links
        if not rows:
            derived_sql = """
            SELECT
              s.id AS skill_id,
              s.skill_key,
              s.name,
              s.source,
              NULL AS dimension,
              SUM(
                CASE
                  WHEN LOWER(COALESCE(link.relationType, '')) = 'essential' THEN 2
                  ELSE 1
                END
              ) AS importance
            FROM major_occupation_map mom
            JOIN stage_occupation_skill_links_esco link
              ON link.occupationUri = mom.occupation_uri
            JOIN skill s
              ON s.skill_key = link.skillUri
            WHERE mom.major_id = :major_id
            """
            derived_params: dict[str, object] = {"major_id": major_id}

            if resolved_skill_ids:
                derived_sql += "\n            AND s.id NOT IN (:skill_ids)\n"
                derived_sql, derived_params = expand_in_clause(
                    derived_sql,
                    {**derived_params, "skill_ids": resolved_skill_ids},
                    "skill_ids",
                )

            derived_sql += """
            GROUP BY s.id, s.skill_key, s.name, s.source
            ORDER BY importance DESC, s.name
            LIMIT 300;
            """
            try:
                rows = query(derived_sql, derived_params)
            except DatabaseQueryError:
                rows = []

        # 3) Fallback: derive from job_skill via major_occupation_map -> job(esco_uri)
        if not rows:
            jobskill_sql = """
            SELECT
              s.id AS skill_id,
              s.skill_key,
              s.name,
              s.source,
              NULL AS dimension,
              SUM(COALESCE(js.importance, 1)) AS importance
            FROM major_occupation_map mom
            JOIN job j ON j.esco_uri = mom.occupation_uri
            JOIN job_skill js ON js.job_id = j.id
            JOIN skill s ON s.id = js.skill_id
            WHERE mom.major_id = :major_id
            """.strip()
            jobskill_params: dict[str, object] = {"major_id": major_id}
            if resolved_skill_ids:
                jobskill_sql += "\n            AND s.id NOT IN (:skill_ids)\n"
                jobskill_sql, jobskill_params = expand_in_clause(
                    jobskill_sql,
                    {**jobskill_params, "skill_ids": resolved_skill_ids},
                    "skill_ids",
                )
            jobskill_sql += """
            GROUP BY s.id, s.skill_key, s.name, s.source
            ORDER BY importance DESC, s.name
            LIMIT 300;
            """
            rows = query(jobskill_sql, jobskill_params)

        return [
            MajorSkillItem.model_validate(
                {
                    "skill_id": int(row.get("skill_id") or 0),
                    "skill_key": row.get("skill_key") or "",
                    "name": row.get("name") or "",
                    "source": row.get("source"),
                    "dimension": row.get("dimension"),
                    "importance": float(row.get("importance")) if row.get("importance") is not None else None,
                }
            )
            for row in rows
        ]
    except HTTPException:
        raise
    except ValueError:
        return []
    except DatabaseConnectionError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except DatabaseQueryError as exc:
        _ = exc
        return []


@router.get("/majors/{major_id}/gaps", response_model=list[MajorSkillItem])
def get_major_skill_gaps_get(
        major_id: int,
        skill_keys: list[str] = Query(default=[]),
) -> list[MajorSkillItem]:
        """GET alias for missing-skill gaps.

        Frontend-friendly call pattern:
            /api/majors/{id}/gaps?skill_keys=python&skill_keys=sql
        """

        return get_major_skill_gaps(major_id, MajorSkillGapsRequest(skill_keys=skill_keys))


@router.get("/majors/{major_id}/programs", response_model=list[MajorProgramItem])
def get_major_programs(
    major_id: int,
    top_k: int = Query(default=10, ge=1, le=50),
    debug: bool = Query(default=False),
) -> list[MajorProgramItem]:
    """Return ranked university programs for a major.

    Primary implementation (when populated):
    - skill overlap between major_skill and program_skill
    - major_ranking.rank_position (if available) to prefer better-ranked universities

    Fallback implementation (when skill mapping tables are empty):
    - filter programs by subject_area/program_name match against the major's field/name
    - order by program_ranking.rank_position if available
    """


    # Use a derived table instead of a CTE for broader MySQL compatibility.
    sql_with_ranking = """
    SELECT
        p.id AS program_id,
        p.program_name,
        p.degree_level,
        p.subject_area,
        p.qs_subject_rank,
        u.id AS university_id,
        u.name AS university_name,
        u.country,
        COUNT(DISTINCT ps.skill_id) AS matched_skills,
        SUM(COALESCE(ps.importance, 1) * COALESCE(ms.importance, 1)) AS score,
        lr.rank_position,
        lr.rank_band,
        lr.ranking_source,
        lr.ranking_year
    FROM major_skill ms
    JOIN program_skill ps ON ps.skill_id = ms.skill_id
    JOIN program p ON p.id = ps.program_id
    JOIN university u ON u.id = p.university_id
    LEFT JOIN (
        SELECT r1.*
        FROM major_ranking r1
        JOIN (
            SELECT major_id, university_id, MAX(ranking_year) AS max_year
            FROM major_ranking
            GROUP BY major_id, university_id
        ) r2
            ON r2.major_id = r1.major_id
           AND (r2.university_id <=> r1.university_id)
           AND r2.max_year = r1.ranking_year
    ) lr
        ON lr.major_id = :major_id
       AND lr.university_id = u.id
    WHERE ms.major_id = :major_id
      AND p.is_active = 1
    GROUP BY
        p.id, p.program_name, p.degree_level, p.subject_area, p.qs_subject_rank,
        u.id, u.name, u.country,
        lr.rank_position, lr.rank_band, lr.ranking_source, lr.ranking_year
    ORDER BY
        (lr.rank_position IS NULL), lr.rank_position ASC,
        score DESC, matched_skills DESC
    LIMIT :top_k;
    """

    sql_without_ranking = """
    SELECT
        p.id AS program_id,
        p.program_name,
        p.degree_level,
        p.subject_area,
        p.qs_subject_rank,
        u.id AS university_id,
        u.name AS university_name,
        u.country,
        COUNT(DISTINCT ps.skill_id) AS matched_skills,
        SUM(COALESCE(ps.importance, 1) * COALESCE(ms.importance, 1)) AS score
    FROM major_skill ms
    JOIN program_skill ps ON ps.skill_id = ms.skill_id
    JOIN program p ON p.id = ps.program_id
    JOIN university u ON u.id = p.university_id
    WHERE ms.major_id = :major_id
      AND p.is_active = 1
    GROUP BY
        p.id, p.program_name, p.degree_level, p.subject_area, p.qs_subject_rank,
        u.id, u.name, u.country
    ORDER BY
        score DESC, matched_skills DESC
    LIMIT :top_k;
    """

    try:
        if not _major_exists(major_id):
            return []

        try:
            rows = query(sql_with_ranking, {"major_id": major_id, "top_k": int(top_k)})
        except DatabaseQueryError:
            # Environments may not have major_ranking populated (or at all). Fall back
            # to a score-only ranking instead of failing the endpoint.
            try:
                rows = query(sql_without_ranking, {"major_id": major_id, "top_k": int(top_k)})
            except DatabaseQueryError:
                # If the normalized skill mapping tables are missing columns or incompatible,
                # keep the endpoint stable and attempt the non-skill fallback below.
                rows = []

        # If there are no results, the DB may not have major_skill/program_skill populated.
        # Try a non-skill fallback using subject-area matching (and program_ranking when available).
        if not rows:
            major_rows = query(
                """
                SELECT major_name, field
                FROM major
                WHERE id = :major_id
                LIMIT 1;
                """.strip(),
                {"major_id": major_id},
            )
            major_row = major_rows[0] if major_rows else {}
            major_name = (major_row.get("major_name") or "").strip()
            major_field = (major_row.get("field") or "").strip()
            q = major_field or major_name
            if q:
                fallback_sql_with_ranking = """
                SELECT
                    p.id AS program_id,
                    p.program_name,
                    p.degree_level,
                    p.subject_area,
                    p.qs_subject_rank,
                    u.id AS university_id,
                    u.name AS university_name,
                    u.country,
                    0 AS matched_skills,
                    COALESCE(pr.computed_score, pr.score, 0) AS score,
                    pr.rank_position,
                    pr.rank_band,
                    pr.ranking_source,
                    pr.ranking_year
                FROM program p
                JOIN university u ON u.id = p.university_id
                LEFT JOIN (
                    SELECT r1.*
                    FROM program_ranking r1
                    JOIN (
                        SELECT program_id, MAX(ranking_year) AS max_year
                        FROM program_ranking
                        GROUP BY program_id
                    ) r2
                        ON r2.program_id = r1.program_id
                       AND r2.max_year = r1.ranking_year
                ) pr
                    ON pr.program_id = p.id
                WHERE p.is_active = 1
                  AND (
                        p.subject_area LIKE CONCAT('%', :q, '%')
                     OR p.program_name LIKE CONCAT('%', :q, '%')
                  )
                ORDER BY
                    (pr.rank_position IS NULL), pr.rank_position ASC,
                    (p.qs_subject_rank IS NULL), p.qs_subject_rank ASC,
                    score DESC,
                    p.program_name ASC
                LIMIT :top_k;
                """.strip()

                fallback_sql_no_ranking = """
                SELECT
                    p.id AS program_id,
                    p.program_name,
                    p.degree_level,
                    p.subject_area,
                    p.qs_subject_rank,
                    u.id AS university_id,
                    u.name AS university_name,
                    u.country,
                    0 AS matched_skills,
                    0 AS score,
                    NULL AS rank_position,
                    NULL AS rank_band,
                    NULL AS ranking_source,
                    NULL AS ranking_year
                FROM program p
                JOIN university u ON u.id = p.university_id
                WHERE p.is_active = 1
                  AND (
                        p.subject_area LIKE CONCAT('%', :q, '%')
                     OR p.program_name LIKE CONCAT('%', :q, '%')
                  )
                ORDER BY
                    (p.qs_subject_rank IS NULL), p.qs_subject_rank ASC,
                    p.program_name ASC
                LIMIT :top_k;
                """.strip()

                try:
                    rows = query(fallback_sql_with_ranking, {"q": q, "top_k": int(top_k)})
                except DatabaseQueryError:
                    rows = query(fallback_sql_no_ranking, {"q": q, "top_k": int(top_k)})

        # Final fallback: if the major has no skills and no subject-area match,
        # return globally top-ranked active programs so the frontend can still
        # render a Top-K list.
        if not rows:
            global_fallback_sql = """
            SELECT
                p.id AS program_id,
                p.program_name,
                p.degree_level,
                p.subject_area,
                p.qs_subject_rank,
                u.id AS university_id,
                u.name AS university_name,
                u.country,
                0 AS matched_skills,
                COALESCE(pr.computed_score, pr.score, 0) AS score,
                pr.rank_position,
                pr.rank_band,
                pr.ranking_source,
                pr.ranking_year
            FROM program p
            JOIN university u ON u.id = p.university_id
            LEFT JOIN (
                SELECT r1.*
                FROM program_ranking r1
                JOIN (
                    SELECT program_id, MAX(ranking_year) AS max_year
                    FROM program_ranking
                    GROUP BY program_id
                ) r2
                    ON r2.program_id = r1.program_id
                   AND r2.max_year = r1.ranking_year
            ) pr
                ON pr.program_id = p.id
            WHERE p.is_active = 1
            ORDER BY
                (pr.rank_position IS NULL), pr.rank_position ASC,
                (p.qs_subject_rank IS NULL), p.qs_subject_rank ASC,
                score DESC,
                p.program_name ASC
            LIMIT :top_k;
            """.strip()

            try:
                rows = query(global_fallback_sql, {"top_k": int(top_k)})
            except DatabaseQueryError:
                # If program_ranking is not available in this environment, fall back
                # to a simple active-program list (no ranking join).
                global_fallback_no_ranking = """
                SELECT
                    p.id AS program_id,
                    p.program_name,
                    p.degree_level,
                    p.subject_area,
                    p.qs_subject_rank,
                    u.id AS university_id,
                    u.name AS university_name,
                    u.country,
                    0 AS matched_skills,
                    0 AS score,
                    NULL AS rank_position,
                    NULL AS rank_band,
                    NULL AS ranking_source,
                    NULL AS ranking_year
                FROM program p
                JOIN university u ON u.id = p.university_id
                WHERE p.is_active = 1
                ORDER BY
                    (p.qs_subject_rank IS NULL), p.qs_subject_rank ASC,
                    p.program_name ASC
                LIMIT :top_k;
                """.strip()
                try:
                    rows = query(global_fallback_no_ranking, {"top_k": int(top_k)})
                except DatabaseQueryError:
                    rows = []

        return [
            MajorProgramItem.model_validate(
                {
                    "program_id": int(row.get("program_id") or 0),
                    "program_name": row.get("program_name") or "",
                    "university_id": int(row.get("university_id") or 0),
                    "university_name": row.get("university_name") or "",
                    "country": row.get("country"),
                    "degree_level": row.get("degree_level"),
                    "subject_area": row.get("subject_area"),
                    "qs_subject_rank": int(row.get("qs_subject_rank")) if row.get("qs_subject_rank") is not None else None,
                    "matched_skills": int(row.get("matched_skills") or 0),
                    "score": float(row.get("score") or 0.0),
                    "rank_position": int(row.get("rank_position")) if row.get("rank_position") is not None else None,
                    "rank_band": row.get("rank_band"),
                    "ranking_source": row.get("ranking_source"),
                    "ranking_year": int(row.get("ranking_year")) if row.get("ranking_year") is not None else None,
                }
            )
            for row in rows
        ]
    except HTTPException:
        raise
    except DatabaseConnectionError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except DatabaseQueryError as exc:
        if debug:
            cause = exc.__cause__
            if cause is not None:
                detail = f"{type(cause).__name__}: {cause}"
            else:
                detail = str(exc)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=detail) from exc

        # Keep the endpoint stable for the frontend: return empty list if the
        # underlying program tables aren't available in this DB yet.
        return []


@router.get("/majors/{major_id}/top-programs", response_model=list[MajorProgramItem])
def get_major_top_programs(
    major_id: int,
    top_k: int = Query(default=10, ge=1, le=50),
) -> list[MajorProgramItem]:
    """Alias for /majors/{id}/programs to match some frontend naming."""

    return get_major_programs(major_id=major_id, top_k=top_k, debug=False)


@router.get("/majors/{major_id}/missing-skills", response_model=list[MajorSkillItem])
def get_major_missing_skills(
    major_id: int,
    skill_keys: list[str] = Query(default=[]),
) -> list[MajorSkillItem]:
    """Alias for major gaps endpoint (missing skills)."""

    return get_major_skill_gaps_get(major_id=major_id, skill_keys=skill_keys)


@router.post("/majors/{major_id}/missing-skills", response_model=list[MajorSkillItem])
def post_major_missing_skills(
    major_id: int,
    payload: MajorSkillGapsRequest = Body(...),
) -> list[MajorSkillItem]:
    """POST alias for major gaps endpoint (missing skills)."""

    return get_major_skill_gaps(major_id=major_id, payload=payload)
