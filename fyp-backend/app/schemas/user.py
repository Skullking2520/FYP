# user.py
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator


class UserBase(BaseModel):
    email: str
    name: Optional[str] = None
    age: Optional[int] = None
    country: Optional[str] = None

    @field_validator("email")
    @classmethod
    def _validate_email_like(cls, v: str) -> str:
        value = (v or "").strip()
        if "@" not in value:
            raise ValueError("email must contain '@'")
        left, right = value.split("@", 1)
        if not left or not right:
            raise ValueError("email must have text before and after '@'")
        return value


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def _validate_email_like(cls, v: str) -> str:
        value = (v or "").strip()
        if "@" not in value:
            raise ValueError("email must contain '@'")
        left, right = value.split("@", 1)
        if not left or not right:
            raise ValueError("email must have text before and after '@'")
        return value


class UserRead(UserBase):
    id: int
    is_admin: bool = False
    interests_text: Optional[str] = None
    skills_text: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class UserUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    country: Optional[str] = None
    interests_text: Optional[str] = None
    skills_text: Optional[str] = None


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    user_id: int
