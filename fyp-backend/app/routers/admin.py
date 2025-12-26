from __future__ import annotations

from collections import Counter
from datetime import date, datetime, timedelta, timezone
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.config import is_admin_email
from app.database import get_db
from app.models.user import User
from app.models.user_current_job import UserCurrentJob
from app.models.recommendation_event import RecommendationEvent
from app.models.recommendation_pick import RecommendationPick
from app.models.user_selected_job_match import UserSelectedJobMatch
from app.routers.dependencies import get_current_user
from app.schemas.admin import AdminBucket, AdminStatKV, AdminStatsResponse
from app.schemas.reco_tracking import SkillRecoPickPoint


router = APIRouter(prefix="/admin", tags=["admin"])

logger = logging.getLogger(__name__)


def _require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not is_admin_email(current_user.email):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


def _require_admin_stats(current_user: User = Depends(get_current_user)) -> User:
    email = (current_user.email or "").strip()
    is_admin = is_admin_email(email)

    # Diagnostic log (non-sensitive): email + boolean only.
    logger.info("admin.stats email=%s is_admin=%s", email, is_admin)

    if not is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


def _iso_now() -> datetime:
    return datetime.now(timezone.utc)


def _date_utc(dt: datetime) -> date:
    if dt.tzinfo is None:
        return dt.date()
    return dt.astimezone(timezone.utc).date()


def _build_skill_reco_picks_series(db: Session, *, days: int = 14) -> list[SkillRecoPickPoint]:
    now = _iso_now()
    today = _date_utc(now)
    start_day = today - timedelta(days=days - 1)
    start_dt = datetime.combine(start_day, datetime.min.time(), tzinfo=timezone.utc)

    day_expr = func.date(RecommendationPick.picked_at)

    rows = (
        db.query(
            day_expr.label("d"),
            func.count(RecommendationPick.id).label("total"),
            func.sum(case((RecommendationPick.chosen_rank == 1, 1), else_=0)).label("top1"),
            func.sum(case((RecommendationPick.chosen_rank <= 5, 1), else_=0)).label("top5"),
            func.avg(RecommendationPick.chosen_rank).label("avg_rank"),
        )
        .join(
            RecommendationEvent,
            RecommendationPick.recommendation_id == RecommendationEvent.recommendation_id,
        )
        .filter(RecommendationEvent.source == "skills")
        .filter(RecommendationPick.picked_at >= start_dt)
        .group_by(day_expr)
        .all()
    )

    by_day: dict[date, SkillRecoPickPoint] = {}
    for d_raw, total, top1, top5, avg_rank in rows:
        # func.date may return date (mysql) or string (sqlite)
        if isinstance(d_raw, date):
            d = d_raw
        else:
            d = date.fromisoformat(str(d_raw))

        by_day[d] = SkillRecoPickPoint(
            date=d,
            total_picks=int(total or 0),
            top1_picks=int(top1 or 0),
            top5_picks=int(top5 or 0),
            avg_chosen_rank=float(avg_rank) if avg_rank is not None else None,
        )

    series: list[SkillRecoPickPoint] = []
    for i in range(days):
        d = start_day + timedelta(days=i)
        series.append(
            by_day.get(
                d,
                SkillRecoPickPoint(
                    date=d,
                    total_picks=0,
                    top1_picks=0,
                    top5_picks=0,
                    avg_chosen_rank=None,
                ),
            )
        )

    # If everything is empty, allow frontend to show "no data" message.
    if all(p.total_picks == 0 for p in series):
        return []
    return series


@router.get("/stats", response_model=AdminStatsResponse)
def get_admin_stats(
    db: Session = Depends(get_db),
    _admin: User = Depends(_require_admin_stats),
) -> AdminStatsResponse:
    accounts_total = int(db.query(func.count(User.id)).scalar() or 0)

    accounts_with_profile = (
        db.query(func.count(User.id))
        .filter(
            (User.interests_text.isnot(None) & (User.interests_text != ""))
            | (User.skills_text.isnot(None) & (User.skills_text != ""))
        )
        .scalar()
        or 0
    )
    accounts_with_profile = int(accounts_with_profile)

    job_selections_total = int(db.query(func.count(UserCurrentJob.id)).scalar() or 0)

    top_jobs_rows = (
        db.query(
            UserCurrentJob.job_id,
            UserCurrentJob.job_title,
            func.count(UserCurrentJob.id).label("c"),
        )
        .group_by(UserCurrentJob.job_id, UserCurrentJob.job_title)
        .order_by(func.count(UserCurrentJob.id).desc())
        .limit(10)
        .all()
    )
    top_jobs = [
        AdminStatKV(
            key=str(job_id),
            label=str(job_title or job_id),
            count=int(c),
        )
        for job_id, job_title, c in top_jobs_rows
    ]

    # Top skills: aggregated from stored matched skill keys.
    skill_counter: Counter[str] = Counter()
    for row in db.query(UserSelectedJobMatch).all():
        for skill_key in row.get_matched_skills():
            skill_counter[skill_key] += 1

    top_skills = [
        AdminStatKV(key=k, label=k.title(), count=int(v))
        for k, v in skill_counter.most_common(10)
    ]

    scores = [float(s) for (s,) in db.query(UserSelectedJobMatch.match_score).all() if s is not None]
    match_score_avg = float(sum(scores) / len(scores)) if scores else 0.0

    buckets = [
        (0.0, 0.2, "0.0–0.2"),
        (0.2, 0.4, "0.2–0.4"),
        (0.4, 0.6, "0.4–0.6"),
        (0.6, 0.8, "0.6–0.8"),
        (0.8, 1.0000001, "0.8–1.0"),
    ]
    bucket_counts = {label: 0 for *_r, label in buckets}
    for s in scores:
        for lo, hi, label in buckets:
            if lo <= s < hi:
                bucket_counts[label] += 1
                break

    match_score_buckets = [AdminBucket(label=label, count=count) for label, count in bucket_counts.items()]

    skill_reco_picks_series = _build_skill_reco_picks_series(db, days=14)

    return AdminStatsResponse(
        generated_at=_iso_now(),
        accounts_total=accounts_total,
        accounts_with_profile=accounts_with_profile,
        job_selections_total=job_selections_total,
        top_jobs=top_jobs,
        top_skills=top_skills,
        match_score_avg=match_score_avg,
        match_score_buckets=match_score_buckets,
        skill_reco_picks_series=skill_reco_picks_series if skill_reco_picks_series else None,
    )
