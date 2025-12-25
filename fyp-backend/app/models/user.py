# user.py
from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password = Column(String(255), nullable=False)
    name = Column(String(255), nullable=True)
    age = Column(Integer, nullable=True)
    country = Column(String(100), nullable=True)
    interests_text = Column(Text, nullable=True)
    skills_text = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
