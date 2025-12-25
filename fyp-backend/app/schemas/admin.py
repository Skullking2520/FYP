from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.schemas.reco_tracking import SkillRecoPickPoint


class AdminStatKV(BaseModel):
    key: str
    label: str
    count: int


class AdminBucket(BaseModel):
    label: str
    count: int


class AdminStatsResponse(BaseModel):
    generated_at: datetime
    accounts_total: int
    accounts_with_profile: int
    job_selections_total: int
    top_jobs: list[AdminStatKV]
    top_skills: list[AdminStatKV]
    match_score_avg: float
    match_score_buckets: list[AdminBucket]
    skill_reco_picks_series: list[SkillRecoPickPoint] | None = None
