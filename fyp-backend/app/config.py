from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


# Load project-root .env early so both pydantic-settings and any direct os.getenv access
# see consistent values, even if the process CWD is not the repo root.
_ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
_IN_TEST = (os.getenv("ENVIRONMENT") or "").lower() == "test" or bool(os.getenv("PYTEST_CURRENT_TEST"))
if _ENV_PATH.exists() and not _IN_TEST:
    # In this project we treat the repo-root .env as the source of truth for local runs.
    # Using override=True avoids confusing mismatches when tasks/shells have stale env vars.
    load_dotenv(dotenv_path=_ENV_PATH, override=True)


def _normalize_email(value: str) -> str:
    return (value or "").strip().lower()


def _parse_admin_emails(raw: Any) -> list[str]:
    if raw is None:
        return []

    items: list[Any]
    if isinstance(raw, (list, tuple, set)):
        items = list(raw)
    elif isinstance(raw, str):
        s = raw.strip()
        if not s:
            return []

        # Support JSON array string or comma-separated string.
        if s.startswith("["):
            try:
                parsed = json.loads(s)
                items = parsed if isinstance(parsed, list) else [parsed]
            except Exception:
                items = [p.strip() for p in s.split(",")]
        else:
            items = [p.strip() for p in s.split(",")]
    else:
        items = [raw]

    emails: list[str] = []
    for item in items:
        if item is None:
            continue
        email = _normalize_email(str(item))
        if email:
            emails.append(email)
    return emails


class Settings(BaseSettings):
    app_name: str = Field(default="FYP Backend")
    api_prefix: str = Field(default="/api")
    version: str = Field(default="0.1.0")
    environment: str = Field(default="development")
    debug: bool = Field(default=True)

    # Database configuration
    # Prefer discrete MySQL env vars for production (requested by spec).
    # DB_URL is still supported for local/dev and backwards compatibility.
    db_url: str | None = Field(default=None, validation_alias="DB_URL")
    # SQLAlchemy(ORM) DB URL can be configured separately from MySQL raw-query DB.
    # This avoids coupling auth/users tables to the careerpath MySQL schema.
    orm_db_url: str | None = Field(default=None, validation_alias="ORM_DB_URL")

    # Convenience switch: in development, allow ORM to use the same MySQL DB_* settings
    # without having to duplicate credentials into ORM_DB_URL.
    orm_use_mysql: bool = Field(default=False, validation_alias="ORM_USE_MYSQL")
    db_host: str = Field(default="localhost", validation_alias="DB_HOST")
    db_port: int = Field(default=3306, validation_alias="DB_PORT")
    db_name: str = Field(default="fyp_careerpath", validation_alias="DB_NAME")
    db_user: str = Field(default="root", validation_alias="DB_USER")
    db_password: str = Field(default="password", validation_alias="DB_PASSWORD")
    db_charset: str = Field(default="utf8mb4", validation_alias="DB_CHARSET")
    jwt_secret: str = Field(default="change-me")
    jwt_algorithm: str = Field(default="HS256")
    access_token_expire_minutes: int = Field(default=60)
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000", "http://127.0.0.1:3000"],
        validation_alias="CORS_ORIGINS",
    )

    # Admin access control
    # - JSON array string: ADMIN_EMAILS=["admin@example.com","ops@example.com"]
    # - Comma-separated:   ADMIN_EMAILS=admin@example.com,ops@example.com
    admin_emails: list[str] = Field(default_factory=list, validation_alias="ADMIN_EMAILS")

    # Admin access control (single email)
    # Preferred by spec: ADMIN_EMAIL=admin@example.com
    admin_email: str | None = Field(default=None, validation_alias="ADMIN_EMAIL")

    # Backwards-compat / convenience: some deployments may set this
    # (originally intended for frontend). We accept it server-side as fallback.
    next_public_admin_email: str | None = Field(default=None, validation_alias="NEXT_PUBLIC_ADMIN_EMAIL")

    # If true, read ADMIN_EMAILS from the process environment on each check.
    # If false, values are loaded once at startup via pydantic-settings.
    admin_emails_reload: bool = Field(default=False, validation_alias="ADMIN_EMAILS_RELOAD")

    # Data-source enforcement
    # If enabled, the app will refuse to load runtime data from local JSON/CSV fallbacks
    # when DB lookups fail (e.g., ML/NLP metadata). This is useful to guarantee MySQL is the
    # single source of truth in environments where the DB is expected to be populated.
    #
    # Defaults to False but is auto-enabled when MySQL is configured (see is_sql_strict_mode).
    sql_strict: bool = Field(default=False, validation_alias="SQL_STRICT")

    @field_validator("admin_emails", mode="before")
    @classmethod
    def _validate_admin_emails(cls, v: Any) -> list[str]:
        return _parse_admin_emails(v)

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()


def build_sqlalchemy_db_url(settings: Settings) -> str:
    # Prefer a dedicated ORM URL if provided.
    if settings.orm_db_url:
        return settings.orm_db_url

    # Backwards compatibility: allow DB_URL to configure the ORM directly.
    # This is especially important in deployments that only set DB_URL but do not
    # set ORM_DB_URL/ORM_USE_MYSQL; we should not silently fall back to sqlite.
    if settings.db_url:
        return settings.db_url

    # In development, default ORM to sqlite unless explicitly configured.
    # If ORM_USE_MYSQL=true, reuse the same MySQL DB_* settings as the raw-query layer.
    if settings.environment.lower() == "development":
        if settings.orm_use_mysql:
            return (
                f"mysql+pymysql://{settings.db_user}:{settings.db_password}"
                f"@{settings.db_host}:{settings.db_port}/{settings.db_name}"
                f"?charset={settings.db_charset}"
            )
        return "sqlite:///./dev.db"

    # Production fallback: use discrete DB_* components.
    # NOTE: password may include special chars; pymysql/sqlalchemy will handle URL parsing,
    # but safest is to rely on DB_URL for complex passwords.
    return (
        f"mysql+pymysql://{settings.db_user}:{settings.db_password}"
        f"@{settings.db_host}:{settings.db_port}/{settings.db_name}"
        f"?charset={settings.db_charset}"
    )


def get_admin_allowlist(*, reload: bool | None = None) -> set[str]:
    do_reload = settings.admin_emails_reload if reload is None else reload
    if do_reload:
        emails: set[str] = set(_parse_admin_emails(os.environ.get("ADMIN_EMAILS")))
        emails.update(_parse_admin_emails(os.environ.get("ADMIN_EMAIL")))
        emails.update(_parse_admin_emails(os.environ.get("NEXT_PUBLIC_ADMIN_EMAIL")))
        return set(_normalize_email(e) for e in emails)

    emails: set[str] = set(_normalize_email(e) for e in (settings.admin_emails or []))
    emails.update(_parse_admin_emails(settings.admin_email))
    emails.update(_parse_admin_emails(settings.next_public_admin_email))
    return set(_normalize_email(e) for e in emails)


def is_admin_email(email: str) -> bool:
    return _normalize_email(email) in get_admin_allowlist()


def is_sql_strict_mode(settings: Settings) -> bool:
    """Return True if runtime must not fall back to local JSON/CSV.

    We auto-enable strict mode when MySQL is configured (ORM or raw DB URL), unless running
    under tests.
    """

    if (settings.environment or "").lower() == "test":
        return False

    mysql_configured = False
    if settings.orm_use_mysql:
        mysql_configured = True
    if settings.orm_db_url and settings.orm_db_url.startswith("mysql"):
        mysql_configured = True
    if settings.db_url and settings.db_url.startswith("mysql"):
        mysql_configured = True

    return bool(settings.sql_strict or mysql_configured)
