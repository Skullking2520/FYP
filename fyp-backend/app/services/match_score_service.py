from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models.jobs import Job
from app.services.skill_matcher import normalize_skill_name, score_job_fit, _extract_job_skills


@dataclass(frozen=True)
class MatchScoreResult:
    match_score: float
    matched_skill_count: int
    matched_skills: list[str]


def compute_match_score(db: Session, *, user_skills: list[str], job: Job) -> MatchScoreResult:
    # Reuse existing scoring logic.
    score = float(score_job_fit(user_skills, job))

    user_set = {normalize_skill_name(s) for s in user_skills if s}
    job_set = _extract_job_skills(job)
    matched = sorted(user_set & job_set)

    return MatchScoreResult(match_score=score, matched_skill_count=len(matched), matched_skills=matched)
