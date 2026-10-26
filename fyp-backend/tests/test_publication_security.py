from __future__ import annotations

import secrets
from datetime import timedelta

import pytest
from jose import jwt
from fastapi import HTTPException


@pytest.mark.parametrize("value", ["", "change-me", "short-key", " " * 40, " " + "a" * 40, "a" * 20 + " " + "a" * 20])
def test_unsafe_jwt_settings_rejected(value, monkeypatch):
    monkeypatch.setenv("JWT_SECRET", secrets.token_urlsafe(32))
    from app.config import Settings
    with pytest.raises(ValueError, match="JWT_SECRET") as exc:
        Settings(_env_file=None, JWT_SECRET=value)
    assert "input_value" not in str(exc.value)


def test_missing_jwt_setting_rejected(monkeypatch):
    monkeypatch.delenv("JWT_SECRET", raising=False)
    from app.config import Settings
    with pytest.raises(ValueError, match="JWT_SECRET"):
        Settings(_env_file=None)


def test_valid_token_roundtrip_and_forgery_rejected(monkeypatch):
    from app.utils import jwt_handler
    monkeypatch.setattr(jwt_handler.settings, "jwt_secret", secrets.token_urlsafe(32))
    token = jwt_handler.create_access_token({"sub": "example-user"}, timedelta(minutes=1))
    assert jwt_handler.decode_access_token(token)["sub"] == "example-user"
    forged = jwt.encode({"sub": "example-user"}, "change-me", algorithm="HS256")
    with pytest.raises(HTTPException) as exc:
        jwt_handler.decode_access_token(forged)
    assert exc.value.status_code == 401

def test_expired_token_rejected(monkeypatch):
    from app.utils import jwt_handler
    monkeypatch.setattr(jwt_handler.settings, "jwt_secret", secrets.token_urlsafe(32))
    token = jwt_handler.create_access_token({"sub": "example-user"}, timedelta(seconds=-1))
    with pytest.raises(HTTPException) as exc:
        jwt_handler.decode_access_token(token)
    assert exc.value.status_code == 401
