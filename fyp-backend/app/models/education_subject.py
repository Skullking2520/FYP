from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class EducationSubject(Base):
    __tablename__ = "education_subjects"

    id = Column(Integer, primary_key=True, index=True)
    stage = Column(String(16), nullable=False, index=True)  # alevel | olevel
    name = Column(String(255), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    skills = relationship(
        "EducationSubjectSkillMap",
        back_populates="subject",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        UniqueConstraint("stage", "name", name="uq_education_subject_stage_name"),
    )


class EducationSubjectSkillMap(Base):
    __tablename__ = "education_subject_skill_map"

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("education_subjects.id", ondelete="CASCADE"), nullable=False, index=True)
    skill_key = Column(String(255), nullable=False, index=True)
    base_level = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    subject = relationship("EducationSubject", back_populates="skills")

    __table_args__ = (
        UniqueConstraint("subject_id", "skill_key", name="uq_education_subject_skill"),
    )
