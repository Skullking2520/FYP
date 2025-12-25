from __future__ import annotations

from pydantic import BaseModel, Field


class SkillLabelWeight(BaseModel):
    label: str = Field(..., min_length=1)
    weight: float = Field(default=1.0, ge=0.0)


class RecommendRequest(BaseModel):
    skills: list[SkillLabelWeight] = Field(default_factory=list)
    skill_uris: dict[str, float] = Field(default_factory=dict)
    top_jobs: int = Field(default=50, ge=1)
    top_majors: int = Field(default=10, ge=1)


class ResolvedSkillOut(BaseModel):
    input: str
    matchedLabel: str
    conceptUri: str
    score: int


class JobOut(BaseModel):
    uri: str
    label: str
    score: float


class MajorOut(BaseModel):
    name: str
    score: float
    supported_jobs: int


class RecommendResponse(BaseModel):
    resolved: list[ResolvedSkillOut]
    matched_skill_count: int
    jobs: list[JobOut]
    majors: list[MajorOut]


class RecommendJobsCompatRequest(BaseModel):
    skill_keys: list[str] = Field(default_factory=list)
    top_jobs: int = Field(default=50, ge=1)


class RecommendJobsCompatItem(BaseModel):
    job_id: str
    title: str
    score: float
    source: str | None = None
    matched_skills: list[str] | None = None
