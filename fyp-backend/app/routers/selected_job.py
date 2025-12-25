from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.jobs import Job
from app.models.user import User
from app.models.user_current_job import UserCurrentJob
from app.models.user_selected_job_match import UserSelectedJobMatch
from app.models.recommendation_event import RecommendationEvent
from app.models.recommendation_pick import RecommendationPick
from app.routers.dependencies import get_current_user
from app.schemas.selected_job import SelectedJobUpdateRequest, SelectedJobUpdateResponse
from app.services.skill_matcher import extract_user_skills
from app.services.match_score_service import compute_match_score


router = APIRouter(prefix="/users", tags=["users"])


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


@router.put("/me/selected-job", response_model=SelectedJobUpdateResponse)
def update_selected_job(
    payload: SelectedJobUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SelectedJobUpdateResponse:
    # Validate job exists in our jobs table.
    job = db.query(Job).filter(Job.id == int(payload.job_id)).first() if payload.job_id.isdigit() else None
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    user_texts = [current_user.skills_text or "", current_user.interests_text or ""]
    user_skills = extract_user_skills(db, user_texts)

    result = compute_match_score(db, user_skills=user_skills, job=job)

    # If this selection originated from a skill-based recommendation list,
    # store a pick event linked to the recommendation_id.
    if payload.recommendation_id:
        event = (
            db.query(RecommendationEvent)
            .filter(RecommendationEvent.recommendation_id == payload.recommendation_id)
            .filter(RecommendationEvent.source == "skills")
            .one_or_none()
        )
        if event is not None:
            chosen_rank: int | None = None
            results = event.results or []
            if isinstance(results, list):
                for item in results:
                    try:
                        if str(item.get("job_id")) == str(payload.job_id):
                            r = item.get("rank")
                            chosen_rank = int(r) if r is not None else None
                            break
                    except Exception:
                        continue

            db.add(
                RecommendationPick(
                    recommendation_id=str(payload.recommendation_id),
                    user_id=current_user.id,
                    chosen_job_id=str(payload.job_id),
                    chosen_rank=chosen_rank,
                )
            )

    current = db.query(UserCurrentJob).filter(UserCurrentJob.user_id == current_user.id).one_or_none()
    if current is None:
        current = UserCurrentJob(user_id=current_user.id, job_id=str(payload.job_id), job_title=payload.job_title)
        db.add(current)
    else:
        current.job_id = str(payload.job_id)
        current.job_title = payload.job_title

    match = db.query(UserSelectedJobMatch).filter(UserSelectedJobMatch.user_id == current_user.id).one_or_none()
    if match is None:
        match = UserSelectedJobMatch(
            user_id=current_user.id,
            job_id=str(payload.job_id),
            match_score=result.match_score,
            matched_skill_count=result.matched_skill_count,
        )
        match.set_matched_skills(result.matched_skills)
        db.add(match)
    else:
        match.job_id = str(payload.job_id)
        match.match_score = result.match_score
        match.matched_skill_count = result.matched_skill_count
        match.set_matched_skills(result.matched_skills)

    db.commit()

    # Refresh updated_at
    db.refresh(match)

    return SelectedJobUpdateResponse(
        job_id=str(payload.job_id),
        match_score=float(match.match_score),
        matched_skill_count=int(match.matched_skill_count),
        updated_at=match.updated_at or _utc_now(),
    )
