from __future__ import annotations

from datetime import datetime, date

from pydantic import BaseModel, Field


class RecommendPickRequest(BaseModel):
    recommendation_id: str = Field(min_length=1)
    chosen_job_id: str = Field(min_length=1)
    picked_at: datetime | None = None


class RecommendPickResponse(BaseModel):
    recommendation_id: str
    chosen_job_id: str
    chosen_rank: int | None = None
    picked_at: datetime


class SkillRecoPickPoint(BaseModel):
    date: date
    total_picks: int
    top1_picks: int
    top5_picks: int
    avg_chosen_rank: float | None = None
