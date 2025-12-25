# majors.py
from sqlalchemy import Column, Integer, String, Text
from app.database import Base


class Major(Base):
    __tablename__ = "majors"

    id = Column(Integer, primary_key=True, index=True)
    major_name = Column(String(255), index=True, nullable=False)
    description = Column(Text, nullable=False)
    keywords = Column(Text, nullable=False)
    university_name = Column(String(255), nullable=False)
    ranking = Column(Integer, nullable=True)
