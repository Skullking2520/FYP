from __future__ import annotations

from sqlalchemy import Column, Integer, JSON, String

from app.database import Base


class DatasetUniversityProgram(Base):
    __tablename__ = "dataset_university_programs"

    id = Column(Integer, primary_key=True, index=True)
    uni_id = Column(String(64), nullable=False, index=True)
    uni_name = Column(String(255), nullable=False, index=True)
    program_id = Column(String(64), nullable=False, index=True)
    program_url = Column(String(1024), nullable=False)
    rank = Column(Integer, nullable=True)
    required_skills = Column(JSON, nullable=True)
    entry_requirements = Column(JSON, nullable=True)
    country = Column(String(100), nullable=True)
    subject_strength = Column(String(255), nullable=True)
