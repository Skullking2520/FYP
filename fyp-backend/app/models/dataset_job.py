from __future__ import annotations

from sqlalchemy import Column, Float, JSON, String, Text

from app.database import Base


class DatasetJob(Base):
    __tablename__ = "dataset_jobs"

    job_id = Column(String(64), primary_key=True)
    job_title = Column(String(255), nullable=False, index=True)
    job_description = Column(Text, nullable=False)
    skills_required = Column(JSON, nullable=True)
    weight = Column(Float, nullable=False, default=1.0)
