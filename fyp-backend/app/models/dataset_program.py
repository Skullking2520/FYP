from __future__ import annotations

from sqlalchemy import Column, JSON, String, Text

from app.database import Base


class DatasetProgram(Base):
    __tablename__ = "dataset_programs"

    program_id = Column(String(64), primary_key=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=False)
    tags = Column(JSON, nullable=True)
    focus_areas = Column(JSON, nullable=True)
    related_skills = Column(JSON, nullable=True)
    keywords = Column(JSON, nullable=True)
