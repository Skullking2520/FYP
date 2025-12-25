from __future__ import annotations

from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func

from app.database import Base


class RecommendationPick(Base):
    __tablename__ = "recommendation_picks"

    # MySQL: BIGINT AUTO_INCREMENT
    # SQLite tests: uses INTEGER for reliable autoincrement.
    id = Column(
        BigInteger().with_variant(Integer, "sqlite"),
        primary_key=True,
        index=True,
    )

    recommendation_id = Column(
        String(36),
        ForeignKey("recommendation_events.recommendation_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    chosen_job_id = Column(String(255), nullable=False, index=True)
    chosen_rank = Column(Integer, nullable=True)

    picked_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
