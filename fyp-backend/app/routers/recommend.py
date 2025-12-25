# recommend.py
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.routers.dependencies import get_current_user
from app.schemas.recommendation import (
    JobRecommendation,
    JobRecommendationRequest,
    MajorRecommendation,
    MajorRecommendationRequest,
    SkillExtractionRequest,
    SkillExtractionResponse,
    SkillReference,
)
from app.services.major_recommender import recommend_majors
from app.services.nlp_extractor import extract_skills_from_text
from app.services.skill_extractor import extract_skills_tfidf
from app.services.skill_matcher import extract_user_skills, normalize_skill_name, recommend_jobs


router = APIRouter()


@router.post("/nlp/extract-skills", response_model=SkillExtractionResponse)
def extract_skills(
    payload: SkillExtractionRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> SkillExtractionResponse:
    # Prefer startup-cached NLP assets (no per-request DB hits).
    assets = getattr(request.app.state, "nlp_assets", None)
    if assets is not None:
        skills = extract_skills_tfidf(assets, payload.user_text)
    else:
        # Backward-compatible fallback for environments where NLP assets are disabled.
        skills = extract_skills_from_text(db, payload.user_text)

    responses = [
        SkillReference(skill_name=skill.get("skill_name", ""), skill_id=skill.get("skill_id"))
        for skill in skills
    ]
    return SkillExtractionResponse(skills=responses)


@router.post("/jobs", response_model=list[JobRecommendation])
def recommend_jobs_endpoint(
    request: JobRecommendationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[JobRecommendation]:
    user_texts = _collect_user_texts(current_user, request.interests_text, request.skills_text)
    user_skills = _resolve_skill_inputs(db, user_texts, request.skills)
    if not user_skills:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No skills available for matching")
    job_matches = recommend_jobs(db, user_skills, limit=request.limit)
    return [
        JobRecommendation(
            job_id=job.id,
            job_title=job.job_title,
            job_description=job.job_description,
            score=score,
        )
        for job, score in job_matches
    ]


@router.post("/majors", response_model=list[MajorRecommendation])
def recommend_majors_endpoint(
    request: MajorRecommendationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[MajorRecommendation]:
    user_texts = _collect_user_texts(current_user, request.interests_text, request.skills_text)
    user_skills = _resolve_skill_inputs(db, user_texts, request.skills)
    if not user_skills:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No skills available for matching")
    major_matches = recommend_majors(db, user_skills, user_texts, limit=request.limit)
    return [
        MajorRecommendation(
            major_id=major.id,
            major_name=major.major_name,
            university_name=major.university_name,
            description=major.description,
            ranking=major.ranking,
            score=score,
        )
        for major, score in major_matches
    ]


def _collect_user_texts(current_user: User, request_interests: str | None, request_skills: str | None) -> list[str]:
    texts: list[str] = []
    for value in [current_user.interests_text, current_user.skills_text, request_interests, request_skills]:
        if value:
            texts.append(value)
    return texts


def _resolve_skill_inputs(db: Session, texts: list[str], explicit_skills: list[str] | None) -> list[str]:
    if explicit_skills:
        normalized = [normalize_skill_name(skill) for skill in explicit_skills if skill]
        deduplicated: list[str] = []
        seen: set[str] = set()
        for skill in normalized:
            if skill not in seen:
                seen.add(skill)
                deduplicated.append(skill)
        return deduplicated
    return extract_user_skills(db, texts)
