from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.sql import func

from app.database import Base


class UserCurrentJob(Base):
    __tablename__ = "user_current_job"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Frontend may send string ids; we store as string to be robust.
    job_id = Column(String(64), nullable=False, index=True)
    job_title = Column(String(255), nullable=True)

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", name="uq_user_current_job_user_id"),
    )
