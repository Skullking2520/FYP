from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.education_subject import EducationSubject, EducationSubjectSkillMap
from app.schemas.education import EducationStage, SubjectListResponse
from app.schemas.skill_level import SkillWithLevel


router = APIRouter(tags=["education"])


@router.get("/education/_debug")
def education_debug():
    import os
    import app.config as cfg

    return {
        "api_prefix": settings.api_prefix,
        "orm_use_mysql": bool(getattr(settings, "orm_use_mysql", False)),
        "env_API_PREFIX": os.getenv("API_PREFIX"),
        "env_ORM_USE_MYSQL": os.getenv("ORM_USE_MYSQL"),
        "config_file": getattr(cfg, "__file__", None),
    }


def _norm(value: str) -> str:
    return (value or "").strip().lower()


def _collapse_ws(value: str) -> str:
    # Normalize whitespace to reduce accidental 404s due to double spaces, etc.
    return " ".join((value or "").split())


def _grade_to_level(grade: str | None) -> int:
    # Accept either raw 0..5, or common CAIE-like grade letters.
    if grade is None:
        return 0
    g = _norm(grade)
    if not g:
        return 0

    # numeric already
    if g.isdigit():
        try:
            return max(0, min(5, int(g)))
        except Exception:
            return 0

    # normalize variations
    if g in {"a*", "a-star", "astar"}:
        return 5
    mapping = {
        "a": 4,
        "b": 3,
        "c": 2,
        "d": 1,
        "e": 1,
        "f": 0,
        "g": 0,
        "u": 0,
    }
    return mapping.get(g, 0)


@router.get("/education/subjects", response_model=SubjectListResponse)
def list_education_subjects(
    stage: EducationStage | None = Query(default=None, description="Filter by exam stage: alevel or olevel"),
    q: str | None = Query(default=None, description="Case-insensitive substring search"),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> SubjectListResponse:
    query = db.query(EducationSubject)
    if stage:
        # DB may store stage as 'A_LEVEL'/'O_LEVEL' (or similar). Keep API contract
        # ('alevel'/'olevel') by matching case-insensitively and ignoring underscores.
        query = query.filter(func.replace(func.lower(EducationSubject.stage), "_", "") == _norm(stage))
    if q and q.strip():
        qn = f"%{_norm(q)}%"
        query = query.filter(func.lower(EducationSubject.name).like(qn))

    rows = query.order_by(func.lower(EducationSubject.name).asc()).limit(int(limit)).all()
    return SubjectListResponse(items=[row.name for row in rows])


@router.get("/education/subjects/mapped-skills")
def get_subject_mapped_skills(
    stage: EducationStage = Query(..., description="alevel or olevel"),
    subject: str = Query(..., min_length=1, description="Subject name"),
    grade: str | None = Query(default=None, description="Grade (e.g., A*, A, B, ... or 0..5)"),
    level: int | None = Query(default=None, ge=0, le=5, description="Explicit 0..5 (overrides grade)"),
    db: Session = Depends(get_db),
):
    subj_name = _collapse_ws(subject)
    if not subj_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="subject is required")

    subject_row = (
        db.query(EducationSubject)
        .filter(func.replace(func.lower(EducationSubject.stage), "_", "") == _norm(stage))
        .filter(func.lower(EducationSubject.name) == _norm(subj_name))
        .first()
    )
    if not subject_row:
        # Fallback: tolerate whitespace differences (e.g., multiple spaces).
        # Works on both sqlite and MySQL.
        needle = _norm(subj_name).replace(" ", "")
        candidates = (
            db.query(EducationSubject)
            .filter(func.replace(func.lower(EducationSubject.stage), "_", "") == _norm(stage))
            .filter(func.replace(func.lower(EducationSubject.name), " ", "") == needle)
            .all()
        )
        if len(candidates) == 1:
            subject_row = candidates[0]
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Subject not found (stage={stage}, subject={subj_name})",
            )

    requested_level = int(level) if level is not None else _grade_to_level(grade)

    mappings = (
        db.query(EducationSubjectSkillMap)
        .filter(EducationSubjectSkillMap.subject_id == subject_row.id)
        .order_by(func.lower(EducationSubjectSkillMap.skill_key).asc())
    )
    try:
        mappings = mappings.all()
    except DBAPIError as exc:
        # MySQL: (1146, "Table '...education_subject_skill_map' doesn't exist")
        # SQLite: "no such table: education_subject_skill_map"
        code = None
        try:
            code = int(getattr(getattr(exc, "orig", None), "args", [None])[0])
        except Exception:
            code = None

        msg = str(getattr(exc, "orig", exc)).lower()
        if code == 1146 or "no such table" in msg or "doesn't exist" in msg:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    "education_subject_skill_map table is missing in the configured DB. "
                    "Create/seed it (e.g. scripts/create_education_tables_mysql.py and "
                    "scripts/seed_education_subject_skill_map.py) or update the backend to the new schema."
                ),
            ) from exc
        raise

    skills = [
        SkillWithLevel(
            skill_key=m.skill_key,
            level=max(0, min(5, max(int(m.base_level or 0), requested_level))),
        )
        for m in mappings
    ]

    return {
        "stage": stage,
        "subject": subject_row.name,
        "level": requested_level,
        "skills": [s.model_dump() for s in skills],
    }
