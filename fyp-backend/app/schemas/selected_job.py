from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class SelectedJobUpdateRequest(BaseModel):
    job_id: str = Field(min_length=1)
    job_title: str | None = None
    # Optional: if the user picked from a skill-based recommendation list,
    # frontend can pass the recommendation_id to enable admin analytics.
    recommendation_id: str | None = None


class SelectedJobUpdateResponse(BaseModel):
    job_id: str
    match_score: float
    updated_at: datetime
    matched_skill_count: int | None = None
