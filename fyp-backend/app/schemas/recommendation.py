# recommendation.py
from typing import Optional
from pydantic import BaseModel, Field
from app.schemas.program import Program


class RecommendationRequest(BaseModel):
    limit: int = Field(default=5, ge=1, le=20)
    interests_text: Optional[str] = None
    skills_text: Optional[str] = None
    skills: Optional[list[str]] = None


class JobRecommendationRequest(RecommendationRequest):
    pass


class MajorRecommendationRequest(RecommendationRequest):
    pass


class SkillExtractionRequest(BaseModel):
    user_text: str = Field(min_length=1)


class SkillReference(BaseModel):
    skill_name: str
    # `app.models.skills.Skill.skill_id` is a string identifier (e.g. "skill-001").
    # Keep this aligned to avoid response model validation errors.
    skill_id: str | None = None


class SkillExtractionResponse(BaseModel):
    skills: list[SkillReference] = Field(default_factory=list)


class JobRecommendation(BaseModel):
    # Dataset jobs use string ids, ORM jobs use integer PKs.
    job_id: int | str
    job_title: str
    job_description: str
    score: float
    reason: str | None = None


class MajorRecommendation(BaseModel):
    # Dataset programs use string ids, ORM majors use integer PKs.
    major_id: int | str
    major_name: str
    university_name: str
    ranking: int | None = None
    score: float
    description: str
    reason: str | None = None


class ProgramRecommendation(BaseModel):
    program: Program
    score: float
    reason_tags: list[str] = Field(default_factory=list)


class GapAnalysisResult(BaseModel):
    missing_skills: list[str]
    matching_skills: list[str]
    coverage_ratio: float
