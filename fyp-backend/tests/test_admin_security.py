from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi import HTTPException

from app.config import settings
from app.routers import auth, admin
from app.schemas.user import UserCreate


@pytest.fixture(autouse=True)
def reserved_admin(monkeypatch):
    monkeypatch.setattr(settings, "admin_emails", ["owner@example.com"])
    monkeypatch.setattr(settings, "admin_email", None)
    monkeypatch.setattr(settings, "next_public_admin_email", None)
    monkeypatch.setattr(settings, "admin_emails_reload", False)


@pytest.mark.parametrize("email", ["owner@example.com", "OWNER@example.com"])
def test_public_registration_cannot_claim_reserved_admin(email):
    db = Mock()
    with pytest.raises(HTTPException) as error:
        auth.register_user(UserCreate(email=email, password="test-only-password"), db)
    assert error.value.status_code == 403
    db.query.assert_not_called()
    db.add.assert_not_called()
    db.commit.assert_not_called()


def test_regular_user_has_no_admin_access():
    with pytest.raises(HTTPException) as error:
        admin._require_admin(SimpleNamespace(id=1, email="person@example.com"))
    assert error.value.status_code == 403


def test_provisioned_admin_retains_access():
    user = SimpleNamespace(id=2, email="owner@example.com")
    assert admin._require_admin(user) is user


def test_malformed_database_url_never_echoes_input():
    assert admin._mask_db_url("PRIVATE_CONNECTION_VALUE") == "<invalid database URL>"
