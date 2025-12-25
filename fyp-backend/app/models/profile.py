# profile.py
from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, func
from sqlalchemy.orm import relationship
from app.database import Base


class UserProfileModel(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    profile_data = Column(JSON, nullable=False, default=dict)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", backref="profile_record")
