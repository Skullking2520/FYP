# skills.py
from sqlalchemy import Column, Integer, String
from app.database import Base


class Skill(Base):
    __tablename__ = "skills"

    id = Column(Integer, primary_key=True, index=True)
    skill_name = Column(String(255), index=True, nullable=False)
    skill_id = Column(String(255), unique=True, nullable=True)
    category = Column(String(255), nullable=True)
