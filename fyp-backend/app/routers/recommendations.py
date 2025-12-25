# recommendations.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.routers.dependencies import get_current_user
from app.schemas.profile import UserProfile
from app.schemas.recommendation import (
    JobRecommendation,
    MajorRecommendation,
    ProgramRecommendation,
    RecommendationRequest,
)
from app.services import profile_service, recommendation_service


router = APIRouter(prefix="/recommendations", tags=["recommendations"])


async def _build_profile(payload: RecommendationRequest, user: User, db: Session) -> UserProfile:
    base_profile = await profile_service.get_profile_for_user(db=db, user=user)
    profile = await profile_service.get_user_profile_for_recommendations(
        base_profile=base_profile,
        extra_interests=payload.interests_text,
        extra_skills_text=payload.skills_text,
        extra_skills_list=payload.skills,
    )
    return profile


@router.post("/jobs", response_model=list[JobRecommendation])
async def recommend_jobs_endpoint(
    payload: RecommendationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[JobRecommendation]:
    profile = await _build_profile(payload, current_user, db)
    recommendations = await recommendation_service.recommend_jobs(profile=profile, limit=payload.limit)
    return recommendations


@router.post("/majors", response_model=list[MajorRecommendation])
async def recommend_majors_endpoint(
    payload: RecommendationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[MajorRecommendation]:
    profile = await _build_profile(payload, current_user, db)
    recommendations = await recommendation_service.recommend_programs(profile=profile, limit=payload.limit)
    return recommendations


@router.post("/programs", response_model=list[ProgramRecommendation])
async def recommend_programs_endpoint(
    payload: RecommendationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ProgramRecommendation]:
    profile = await _build_profile(payload, current_user, db)
    recommendations = await recommendation_service.recommend_programs_from_profile(profile=profile, limit=payload.limit)
    return recommendations
