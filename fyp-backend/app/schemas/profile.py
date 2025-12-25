# profile.py
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.skill_level import SkillWithLevel


EducationStage = Literal[
    "alevel_in_progress",
    "alevel_done",
    "olevel_in_progress",
    "olevel_done",
]


class UserProfile(BaseModel):
    # New onboarding fields (v2)
    education_stage: EducationStage | None = None
    subjects_note: str | None = None
    grades_note: str | None = None
    hobbies: str | None = None
    self_intro: str | None = None
    target_job: str | None = None

    # Skills now include level (0..5). Legacy list[str] is accepted and coerced.
    skills: list[SkillWithLevel] = Field(default_factory=list)

    @field_validator("skills", mode="before")
    @classmethod
    def _coerce_legacy_skills(cls, v):
        if v is None:
            return []
        if isinstance(v, list):
            if not v:
                return []
            # Legacy: ["python", "sql"]
            if all(isinstance(item, str) for item in v):
                return [SkillWithLevel(skill_key=item, level=0) for item in v if item and item.strip()]
        return v

    @field_validator("hobbies", mode="before")
    @classmethod
    def _coerce_legacy_hobbies(cls, v):
        # Legacy schema used hobbies: list[str]
        if v is None:
            return None
        if isinstance(v, list):
            items = [str(item).strip() for item in v if str(item).strip()]
            return ", ".join(items) if items else None
        return v

    # Legacy profile fields kept for backward compatibility
    interests: list[str] = Field(default_factory=list)
    desired_jobs: list[str] = Field(default_factory=list)
    math_level: str | None = None
    cs_experience: str | None = None
    country: str | None = None
    age: int | None = None
    subject_strengths: dict[str, int] = Field(default_factory=dict)
    subject_interests: dict[str, int] = Field(default_factory=dict)
    preferred_learning_style: str | None = None
    free_text: str | None = None


class UserProfileUpdate(UserProfile):
    pass


class UserProfileResponse(BaseModel):
    profile: UserProfile
    metadata: dict[str, Any] = Field(default_factory=dict)
