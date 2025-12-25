from datetime import datetime, timezone

from fastapi import APIRouter
from pydantic import BaseModel

from sqlalchemy import text
from sqlalchemy.engine import make_url

from app.database import engine
from app.config import build_sqlalchemy_db_url, settings
from app.db.mysql import DatabaseConnectionError, DatabaseQueryError, query_one


router = APIRouter(prefix="/health", tags=["health"])


class HealthStatus(BaseModel):
    status: str
    timestamp: datetime


class DBHealthStatus(BaseModel):
    mysql: str
    orm: str
    orm_use_mysql: bool
    orm_db_url: str
    timestamp: datetime


@router.get("/", response_model=HealthStatus, summary="API heartbeat")
def health_check() -> HealthStatus:
    return HealthStatus(status="ok", timestamp=datetime.now(timezone.utc))


@router.get("/db", response_model=DBHealthStatus, summary="DB connectivity checks")
def db_health_check() -> DBHealthStatus:
    now = datetime.now(timezone.utc)

    # 1) Raw MySQL (careerpath) connectivity
    mysql_status = "ok"
    try:
        query_one("SELECT 1 AS ok;")
    except (DatabaseConnectionError, DatabaseQueryError):
        mysql_status = "error"

    # 2) SQLAlchemy ORM connectivity
    orm_status = "ok"
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:
        orm_status = "error"

    orm_url = build_sqlalchemy_db_url(settings)
    try:
        masked = str(make_url(orm_url).set(password="***"))
    except Exception:
        masked = orm_url

    return DBHealthStatus(
        mysql=mysql_status,
        orm=orm_status,
        orm_use_mysql=bool(getattr(settings, "orm_use_mysql", False)),
        orm_db_url=masked,
        timestamp=now,
    )


@router.get("/config", summary="Debug: show selected runtime config")
def config_debug():
    if not settings.debug:
        # Avoid exposing runtime config in production.
        return {"detail": "Not Found"}

    health_module_file = __file__

    orm_url = build_sqlalchemy_db_url(settings)
    try:
        masked = str(make_url(orm_url).set(password="***"))
    except Exception:
        masked = orm_url

    mysql_user = None
    mysql_db = None
    derived_major10_skills = None
    program_rows = None
    university_rows = None
    major_skill_rows = None
    program_skill_exists = None
    try:
        mysql_user = (query_one("SELECT CURRENT_USER() AS u") or {}).get("u")
        mysql_db = (query_one("SELECT DATABASE() AS d") or {}).get("d")
        derived_major10_skills = (
            query_one(
                """
                SELECT COUNT(DISTINCT link.skillUri) AS c
                FROM major_occupation_map mom
                JOIN stage_occupation_skill_links_esco link
                  ON link.occupationUri = mom.occupation_uri
                WHERE mom.major_id = 10
                """.strip()
            )
            or {}
        ).get("c")

        program_rows = (query_one("SELECT COUNT(*) AS c FROM program") or {}).get("c")
        university_rows = (query_one("SELECT COUNT(*) AS c FROM university") or {}).get("c")
        major_skill_rows = (query_one("SELECT COUNT(*) AS c FROM major_skill") or {}).get("c")
        program_skill_exists = bool(
            (query_one(
                """
                SELECT 1 AS ok
                FROM information_schema.tables
                WHERE table_schema = DATABASE()
                  AND table_name = 'program_skill'
                LIMIT 1
                """.strip()
            ))
        )
    except Exception:
        # Best-effort diagnostics only.
        pass

    return {
        "debug_marker": "health-config-v2",
        "environment": settings.environment,
        "debug": settings.debug,
        "api_prefix": settings.api_prefix,
        "orm_use_mysql": bool(getattr(settings, "orm_use_mysql", False)),
        "orm_db_url": masked,
        "health_module_file": health_module_file,
        "mysql_current_user": mysql_user,
        "mysql_database": mysql_db,
        "diag_major10_distinct_skillUri": derived_major10_skills,
        "diag_program_rows": program_rows,
        "diag_university_rows": university_rows,
        "diag_major_skill_rows": major_skill_rows,
        "diag_program_skill_exists": program_skill_exists,
    }
