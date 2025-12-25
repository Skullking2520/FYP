from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.recommendation import SkillExtractionRequest, SkillExtractionResponse, SkillReference
from app.services.nlp_extractor import extract_skills_from_text
from app.services.skill_extractor import extract_skills_tfidf


router = APIRouter(tags=["recommend-legacy"])


@router.post("/recommend/nlp/extract-skills", response_model=SkillExtractionResponse)
def extract_skills_api(
    payload: SkillExtractionRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> SkillExtractionResponse:
    # Mirror app.routers.recommend.extract_skills, but under /api prefix.
    assets = getattr(request.app.state, "nlp_assets", None)
    if assets is not None:
        skills = extract_skills_tfidf(assets, payload.user_text)
    else:
        skills = extract_skills_from_text(db, payload.user_text)

    responses = [
        SkillReference(skill_name=skill.get("skill_name", ""), skill_id=skill.get("skill_id"))
        for skill in skills
    ]
    return SkillExtractionResponse(skills=responses)
