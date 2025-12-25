from __future__ import annotations

import json

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.sql import func

from app.database import Base


class UserSelectedJobMatch(Base):
    __tablename__ = "user_selected_job_match"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    job_id = Column(String(64), nullable=False, index=True)
    match_score = Column(Float, nullable=False, default=0.0)
    matched_skill_count = Column(Integer, nullable=False, default=0)

    # Store matched skills for admin aggregation (JSON list of strings).
    matched_skills_json = Column(Text, nullable=True)

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", name="uq_user_selected_job_match_user_id"),
    )

    def set_matched_skills(self, skills: list[str]) -> None:
        self.matched_skills_json = json.dumps(skills, ensure_ascii=False)

    def get_matched_skills(self) -> list[str]:
        if not self.matched_skills_json:
            return []
        try:
            value = json.loads(self.matched_skills_json)
            if isinstance(value, list):
                return [str(x) for x in value if x]
        except Exception:
            return []
        return []
