# auth.py
from pydantic import BaseModel, field_validator


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str | None = None
    age: int | None = None
    country: str | None = None

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


class LoginRequest(BaseModel):
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


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
