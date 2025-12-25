from __future__ import annotations

from sqlalchemy import Column, Integer, String

from app.database import Base


class DatasetSkillResource(Base):
    __tablename__ = "dataset_skill_resources"

    id = Column(Integer, primary_key=True, index=True)
    skill = Column(String(255), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    url = Column(String(1024), nullable=False)
