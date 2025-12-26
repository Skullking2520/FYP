from __future__ import annotations

from urllib.parse import unquote

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.routes.careerpath import get_job_detail_with_major
from app.api.routes.majors import get_major_skill_gaps
from app.database import get_db
from app.models.jobs import Job as OrmJob
from app.models.user import User
from app.models.user_current_job import UserCurrentJob
from app.routers.dependencies import get_current_user
from app.schemas.careerpath import MajorSkillGapsRequest
from app.schemas.pathway_summary import (
    PathwaySummaryGap,
    PathwaySummaryJob,
    PathwaySummaryMajor,
    PathwaySummaryResponse,
    PathwaySummarySkill,
)
from app.services.profile_service import get_profile_for_user


router = APIRouter(tags=["users"])


def _normalize_job_ref(value: str | None) -> str | None:
    if value is None:
        return None
    raw = value.strip()
    if not raw:
        return None
    # Decode once (FastAPI already decodes once for path params, but this endpoint
    # sources the id from DB/profile, so be tolerant of stored encoded values).
    return unquote(raw)


@router.get("/users/me/pathway-summary", response_model=PathwaySummaryResponse)
async def get_pathway_summary(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PathwaySummaryResponse:
    profile = await get_profile_for_user(db, current_user)

    # 1) Skills (structured)
    skills_out: list[PathwaySummarySkill] = []
    for item in profile.skills:
        key = (item.skill_key or "").strip()
        if not key:
            continue
        skills_out.append(PathwaySummarySkill(skill_key=key, name=None, level=int(item.level or 0)))

    # 2) Desired job (best-effort)
    desired_job: PathwaySummaryJob | None = None

    # Prefer stored selection (if present)
    current = db.query(UserCurrentJob).filter(UserCurrentJob.user_id == current_user.id).one_or_none()
    job_ref = _normalize_job_ref(getattr(current, "job_id", None))

    # If not set, fall back to profile.target_job (may be free text)
    if not job_ref:
        job_ref = _normalize_job_ref(getattr(profile, "target_job", None))

    # Try careerpath job+major resolver first (handles ESCO URIs well)
    job_detail = None
    major_detail = None
    if job_ref:
        try:
            detail = get_job_detail_with_major(job_ref, request)
            job_detail = detail.job
            major_detail = detail.major
        except Exception:
            job_detail = None
            major_detail = None

    if job_detail is not None:
        desired_job = PathwaySummaryJob(job_id=str(job_ref), title=getattr(job_detail, "title", None))
    elif job_ref and job_ref.isdigit():
        # Fallback to legacy ORM jobs table (used by /users/me/selected-job)
        job = db.query(OrmJob).filter(OrmJob.id == int(job_ref)).one_or_none()
        if job is not None:
            desired_job = PathwaySummaryJob(job_id=str(job_ref), title=job.job_title)

    # 3) Recommended major (top-1)
    recommended_major: PathwaySummaryMajor | None = None
    if major_detail is not None:
        major_name = (getattr(major_detail, "major_name", None) or "").strip()
        if major_name:
            recommended_major = PathwaySummaryMajor(
                major_id=getattr(major_detail, "major_id", None),
                major_name=major_name,
            )

    # 4) Gaps (major-required minus user skills)
    gaps_out: list[PathwaySummaryGap] = []
    if recommended_major is not None and recommended_major.major_id is not None:
        payload = MajorSkillGapsRequest(skill_keys=[s.skill_key for s in skills_out])
        try:
            gaps = get_major_skill_gaps(int(recommended_major.major_id), payload)
            gaps_out = [
                PathwaySummaryGap(skill_key=g.skill_key, name=g.name, importance=g.importance)
                for g in gaps
                if g.skill_key
            ]
        except Exception:
            gaps_out = []

    return PathwaySummaryResponse(
        skills=skills_out,
        desired_job=desired_job,
        recommended_major=recommended_major,
        gaps=gaps_out,
    )
