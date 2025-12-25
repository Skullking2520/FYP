from __future__ import annotations

import re
import zlib
from datetime import datetime, timezone
from urllib.parse import unquote
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.db.mysql import DatabaseConnectionError, DatabaseQueryError, expand_in_clause, query, query_one
from app.models.recommendation_event import RecommendationEvent
from app.models.recommendation_pick import RecommendationPick
from app.schemas.careerpath import (
    DBStats,
    JobDetail,
    JobSkillItem,
    SkillResourceItem,
    RecommendJobItem,
    RecommendJobsRequest,
    SkillSearchItem,
)

from app.schemas.reco_tracking import RecommendPickRequest, RecommendPickResponse

from app.schemas.ml_recommend import RecommendJobsCompatItem
from app.services.ml_recommender import recommend_jobs as ml_recommend_jobs
from app.services.ml_recommender import resolve_skill_labels


router = APIRouter(tags=["careerpath"])


_SKILL_URI_RE = re.compile(r"^https?://data\.europa\.eu/esco/skill/[0-9a-fA-F-]{36}$")
_OCC_URI_RE = re.compile(r"^https?://data\.europa\.eu/esco/occupation/[0-9a-fA-F-]{36}$")


def _stable_int_id(value: str) -> int:
    return int(zlib.crc32(value.encode("utf-8")) & 0xFFFFFFFF)


def _resolve_job_pk(job_ref: str) -> int:
    ref = unquote((job_ref or "").strip())
    if not ref:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="job_id is required")

    if ref.isdigit():
        return int(ref)

    row = query_one(
        """
        SELECT id
        FROM job
        WHERE esco_uri = :ref OR occupation_uid = :ref OR onet_soc_code = :ref
        LIMIT 1;
        """.strip(),
        {"ref": ref},
    )
    if row and row.get("id") is not None:
        return int(row["id"])

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")


@router.get("/skills/search", response_model=list[SkillSearchItem])
def search_skills(q: str = Query(default="", min_length=0)) -> list[SkillSearchItem]:
    if not q.strip():
        return []

    # Primary: careerpath normalized table (skill)
    sql = """
    SELECT DISTINCT
      s.id AS id,
      s.skill_key,
      s.name,
      s.source,
      NULL AS dimension
    FROM skill s
    LEFT JOIN skill_alias a ON a.skill_id = s.id
    WHERE s.name LIKE CONCAT('%', :q, '%')
       OR a.alias_key LIKE CONCAT('%', :q, '%')
    ORDER BY s.name
    LIMIT 50;
    """

    # Fallback: ESCO raw table (esco_skills)
    # We synthesize an integer id using CRC32(conceptUri) for stable UI keys.
    fallback_sql = """
    SELECT
      CRC32(conceptUri) AS id,
      conceptUri AS skill_key,
      preferredLabel AS name,
      'ESCO' AS source,
      NULL AS dimension
    FROM esco_skills
    WHERE preferredLabel LIKE CONCAT('%', :q, '%')
       OR altLabels LIKE CONCAT('%', :q, '%')
    ORDER BY preferredLabel
    LIMIT 50;
    """

    try:
        rows = query(sql, {"q": q})
        return [SkillSearchItem.model_validate(row) for row in rows]
    except DatabaseConnectionError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except DatabaseQueryError as exc:
        # DB schema may not have `skill` table (or it may be empty). Try ESCO fallback.
        try:
            rows = query(fallback_sql, {"q": q})
            return [SkillSearchItem.model_validate(row) for row in rows]
        except DatabaseConnectionError as exc2:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc2)) from exc2
        except DatabaseQueryError as exc2:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Skill search query failed",
            ) from exc2


@router.get("/skills/{skill_key}/resources", response_model=list[SkillResourceItem])
def get_skill_resources(skill_key: str, top_k: int = Query(default=10, ge=1, le=50)) -> list[SkillResourceItem]:
    """Return learning resources for a given skill_key.

    Uses `skill_resource_map` as the canonical source (source='CANONICAL_1perSkill'):
    - VERIFIED rows: resource_id present, may join to `skill_resource` for extra fields.
    - CONCEPTUAL_ONLY rows: resource_id NULL; return `guidance_text` for UI fallback.
    """

    sql = """
    SELECT
      m.resource_id AS resource_id,
      COALESCE(m.title, sr.title, CASE WHEN m.verification_status = 'CONCEPTUAL_ONLY' THEN 'Learning guide' ELSE '' END) AS title,
      COALESCE(m.provider, sr.provider, '') AS provider,
      COALESCE(sr.type, '') AS type,
      COALESCE(sr.difficulty, '') AS difficulty,
      COALESCE(m.estimated_hours, sr.estimated_hours) AS estimated_hours,
      COALESCE(m.url, sr.url, '') AS url,
      sr.description AS description,
      m.verification_status,
      m.guidance_text,
      m.priority,
      m.difficulty_level
    FROM skill_resource_map m
    LEFT JOIN skill_resource sr ON sr.id = m.resource_id
    WHERE m.skill_key = :skill_key
      AND m.source = 'CANONICAL_1perSkill'
    ORDER BY
      CASE WHEN m.verification_status = 'VERIFIED' THEN 0 ELSE 1 END,
      m.priority ASC,
      m.id ASC
    LIMIT :top_k;
    """

    try:
        rows = query(sql, {"skill_key": skill_key, "top_k": int(top_k)})
        return [SkillResourceItem.model_validate(r) for r in rows]
    except (DatabaseConnectionError, DatabaseQueryError):
        # Do not break UI flow if this optional dataset isn't available.
        return []


@router.get("/jobs/{job_id}", response_model=JobDetail)
def get_job(job_id: str, request: Request) -> JobDetail:
    sql = """
    SELECT
      id, occupation_uid, source, onet_soc_code, esco_uri, title,
            short_description, short_description AS description, isco_group, isco_code, job_zone
    FROM job
    WHERE id = :job_id
    LIMIT 1;
    """

    sql_ref = """
    SELECT
      id, occupation_uid, source, onet_soc_code, esco_uri, title,
            short_description, short_description AS description, isco_group, isco_code, job_zone
    FROM job
    WHERE esco_uri = :ref OR occupation_uid = :ref OR onet_soc_code = :ref
    LIMIT 1;
    """

    try:
        ref = unquote((job_id or "").strip())
        if not ref:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="job_id is required")

        if ref.isdigit():
            row = query_one(sql, {"job_id": int(ref)})
        else:
            row = query_one(sql_ref, {"ref": ref})

        if not row:
            # UX fallback: if the frontend is using ML job URIs but the MySQL job table isn't populated,
            # return a minimal stub instead of failing the whole page.
            if _OCC_URI_RE.match(ref):
                assets = getattr(request.app.state, "ml_assets", None)
                label = None
                try:
                    label = (assets.occ_uri_to_label.get(ref) if assets is not None else None)  # type: ignore[attr-defined]
                except Exception:
                    label = None
                if isinstance(label, str) and label.strip():
                    return JobDetail(
                        id=_stable_int_id(ref),
                        esco_uri=ref,
                        title=label.strip(),
                        source="ml",
                        short_description=None,
                        description=None,
                    )

            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
        return JobDetail.model_validate(row)
    except HTTPException:
        raise
    except DatabaseConnectionError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except DatabaseQueryError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Job detail query failed") from exc


@router.get("/jobs/{job_id}/skills", response_model=list[JobSkillItem])
def get_job_skills(job_id: str, request: Request) -> list[JobSkillItem]:
    sql = """
    SELECT
            s.id AS skill_id, s.skill_key, s.name, s.source, NULL AS dimension,
      js.source AS link_source, js.relation_type, js.importance, js.skill_type
    FROM job_skill js
    JOIN skill s ON s.id = js.skill_id
    WHERE js.job_id = :job_id
    ORDER BY (js.importance IS NULL), js.importance DESC, s.name
    LIMIT 300;
    """

    try:
        try:
            resolved_job_id = _resolve_job_pk(job_id)
        except HTTPException as exc:
            ref = unquote((job_id or "").strip())
            if exc.status_code == status.HTTP_404_NOT_FOUND and _OCC_URI_RE.match(ref):
                # If we don't have the job in MySQL, we also won't have job_skill rows.
                # Return empty list to avoid failing the UI.
                _ = request
                return []
            raise
        rows = query(sql, {"job_id": resolved_job_id})
        return [
            JobSkillItem.model_validate(
                {
                    "skill_id": row.get("skill_id"),
                    "skill_key": row.get("skill_key"),
                    "name": row.get("name"),
                    "dimension": row.get("dimension"),
                    "link_source": row.get("link_source"),
                    "relation_type": row.get("relation_type"),
                    "importance": row.get("importance"),
                    "skill_type": row.get("skill_type"),
                }
            )
            for row in rows
        ]
    except HTTPException:
        raise
    except DatabaseConnectionError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except DatabaseQueryError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Job skills query failed") from exc


@router.post("/recommend/jobs", response_model=list[RecommendJobsCompatItem])
def recommend_jobs(
    payload: RecommendJobsRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> list[RecommendJobsCompatItem]:
    # Compatibility adapter: frontend calls POST /api/recommend/jobs
    # Preferred (v2): { skills: [{ skill_key, level(0..5) }] }
    # Legacy (v1): { skill_keys: string[] } (may contain duplicates as a weight hack)
    assets = getattr(request.app.state, "ml_assets", None)
    if assets is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="ML assets not loaded")

    weighted_inputs: dict[str, float] = {}
    if payload.skills:
        for item in payload.skills:
            key = (item.skill_key or "").strip()
            if not key:
                continue
            w = float(item.level + 1)
            weighted_inputs[key] = max(weighted_inputs.get(key, 0.0), w)
    else:
        # Legacy: derive weights from duplicates (typically level+1 repeats)
        for raw in payload.skill_keys or []:
            key = (raw or "").strip()
            if not key:
                continue
            weighted_inputs[key] = float(weighted_inputs.get(key, 0.0) + 1.0)
        # Clamp to the intended 1..6 range to avoid accidental runaway weights.
        for key, w in list(weighted_inputs.items()):
            weighted_inputs[key] = float(min(w, 6.0))

    if not weighted_inputs:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="skills (preferred) or skill_keys (legacy) is required")
    if len(weighted_inputs) > 200:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="skills/skill_keys exceeds max of 200")

    explicit_uris: dict[str, float] = {}
    label_inputs: list[tuple[str, float]] = []
    for key, weight in weighted_inputs.items():
        if _SKILL_URI_RE.match(key):
            explicit_uris[key] = max(explicit_uris.get(key, 0.0), float(weight))
        else:
            label_inputs.append((key, float(weight)))

    resolved = resolve_skill_labels(assets, label_inputs, threshold=70) if label_inputs else []

    # Convert resolved label matches into skill_uris (best match per input)
    resolved_uri_weights: dict[str, float] = {}
    for raw_label, w in label_inputs:
        candidates = [r for r in resolved if r.input == raw_label]
        if not candidates:
            continue
        best = max(candidates, key=lambda r: r.score)
        resolved_uri_weights[best.conceptUri] = max(resolved_uri_weights.get(best.conceptUri, 0.0), float(w))

    final_skill_uris: dict[str, float] = dict(resolved_uri_weights)
    for uri, w in explicit_uris.items():
        final_skill_uris[str(uri)] = float(w)

    used_skill_uris = [uri for uri in final_skill_uris.keys() if uri in assets.skill_index]
    if not used_skill_uris:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "matched_skill_count == 0",
                "resolved": [r.__dict__ for r in resolved],
                "matched_skill_count": 0,
            },
        )

    # matched_skills: return the resolved skill URIs actually used by the model
    matched_skills: list[str] = []
    used_seen: set[str] = set()
    for uri in used_skill_uris:
        if uri not in used_seen:
            used_seen.add(uri)
            matched_skills.append(uri)

    jobs = ml_recommend_jobs(assets, final_skill_uris, top_jobs=int(payload.top_jobs or 5))

    # Log recommendation event for admin analytics.
    # Keep backward-compatible response body (still a list), expose id via header.
    recommendation_id = str(uuid4())

    skills_payload: list[dict[str, int | str]] | None = None
    if payload.skills:
        skills_payload = [
            {"skill_key": (s.skill_key or "").strip(), "level": int(s.level)}
            for s in payload.skills
            if (s.skill_key or "").strip()
        ]
    elif payload.skill_keys:
        # Legacy: infer level from weight (w = repeats clamped 1..6 => level=w-1)
        inferred: list[dict[str, int | str]] = []
        for key, w in weighted_inputs.items():
            lvl = int(max(0.0, min(5.0, float(w) - 1.0)))
            inferred.append({"skill_key": str(key), "level": lvl})
        skills_payload = inferred or None

    results_payload = [
        {"job_id": str(j.uri), "rank": int(i + 1), "score": float(j.score)}
        for i, j in enumerate(jobs)
    ]

    try:
        db.add(
            RecommendationEvent(
                recommendation_id=recommendation_id,
                user_id=None,
                source="skills",
                results=results_payload,
                skills=skills_payload,
            )
        )
        db.commit()
        response.headers["X-Recommendation-Id"] = recommendation_id
    except Exception:
        # Do not fail the user request if analytics tables are not deployed yet.
        db.rollback()

    return [
        RecommendJobsCompatItem(
            job_id=j.uri,
            title=j.label,
            score=float(j.score),
            source="ml",
            matched_skills=matched_skills,
        )
        for j in jobs
    ]


@router.post("/recommend/jobs/pick", response_model=RecommendPickResponse)
def pick_recommended_job(
    payload: RecommendPickRequest,
    db: Session = Depends(get_db),
) -> RecommendPickResponse:
    event = (
        db.query(RecommendationEvent)
        .filter(RecommendationEvent.recommendation_id == payload.recommendation_id)
        .filter(RecommendationEvent.source == "skills")
        .one_or_none()
    )
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="recommendation_id not found")

    chosen_rank: int | None = None
    results = event.results or []
    for item in results if isinstance(results, list) else []:
        try:
            if str(item.get("job_id")) == str(payload.chosen_job_id):
                r = item.get("rank")
                chosen_rank = int(r) if r is not None else None
                break
        except Exception:
            continue

    picked_at = payload.picked_at or datetime.now(timezone.utc)
    pick = RecommendationPick(
        recommendation_id=payload.recommendation_id,
        chosen_job_id=str(payload.chosen_job_id),
        chosen_rank=chosen_rank,
        picked_at=picked_at,
    )
    db.add(pick)
    db.commit()

    return RecommendPickResponse(
        recommendation_id=str(payload.recommendation_id),
        chosen_job_id=str(payload.chosen_job_id),
        chosen_rank=chosen_rank,
        picked_at=picked_at,
    )


@router.get("/db/stats", response_model=DBStats)
def db_stats() -> DBStats:
    try:
        job = query_one("SELECT COUNT(*) AS c FROM job;")
        skill = query_one("SELECT COUNT(*) AS c FROM skill;")
        job_skill = query_one("SELECT COUNT(*) AS c FROM job_skill;")
        skill_tag = query_one("SELECT COUNT(*) AS c FROM skill_tag;")
        return DBStats(
            job=int((job or {}).get("c") or 0),
            skill=int((skill or {}).get("c") or 0),
            job_skill=int((job_skill or {}).get("c") or 0),
            skill_tag=int((skill_tag or {}).get("c") or 0),
        )
    except DatabaseConnectionError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except DatabaseQueryError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="DB stats query failed") from exc
