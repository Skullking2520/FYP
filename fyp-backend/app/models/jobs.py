# jobs.py
from sqlalchemy import Column, Integer, JSON, String, Text
from app.database import Base


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    job_title = Column(String(255), index=True, nullable=False)
    job_description = Column(Text, nullable=False)
    skills_required = Column(JSON, nullable=True)
    weight_vector = Column(JSON, nullable=True)
