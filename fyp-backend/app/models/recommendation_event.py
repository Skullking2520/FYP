from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.sql import func

from app.database import Base


class RecommendationEvent(Base):
    __tablename__ = "recommendation_events"

    # UUID string
    recommendation_id = Column(String(36), primary_key=True)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    source = Column(String(32), nullable=False, index=True)

    # Stored as list[{job_id, rank, score}]
    results = Column(JSON, nullable=False)

    # Optional: list[{skill_key, level}]
    skills = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
