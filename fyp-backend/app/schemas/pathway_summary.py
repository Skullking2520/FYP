from __future__ import annotations

from pydantic import BaseModel, Field


class PathwaySummarySkill(BaseModel):
    skill_key: str = Field(min_length=1)
    name: str | None = None
    level: int = Field(default=0, ge=0, le=5)


class PathwaySummaryJob(BaseModel):
    job_id: str = Field(min_length=1)
    title: str | None = None


class PathwaySummaryMajor(BaseModel):
    major_id: int | None = None
    major_name: str = Field(min_length=1)


class PathwaySummaryGap(BaseModel):
    skill_key: str = Field(min_length=1)
    name: str | None = None
    importance: float | None = None


class PathwaySummaryResponse(BaseModel):
    skills: list[PathwaySummarySkill] = Field(default_factory=list)
    desired_job: PathwaySummaryJob | None = None
    recommended_major: PathwaySummaryMajor | None = None
    gaps: list[PathwaySummaryGap] = Field(default_factory=list)
