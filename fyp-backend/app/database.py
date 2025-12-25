# database.py
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, declarative_base, sessionmaker
from app.config import build_sqlalchemy_db_url, settings


def _build_connect_args() -> dict:
    db_url = build_sqlalchemy_db_url(settings)
    if db_url.startswith("sqlite"):
        return {"check_same_thread": False}
    return {}


def _mask_db_url(db_url: str) -> str:
    try:
        return str(make_url(db_url).set(password="***"))
    except Exception:
        return db_url


_db_url = build_sqlalchemy_db_url(settings)
engine = create_engine(_db_url, pool_pre_ping=True, future=True, connect_args=_build_connect_args())
try:
    import logging

    logging.getLogger("uvicorn.error").info("SQLAlchemy ORM db_url=%s", _mask_db_url(_db_url))
except Exception:
    # Avoid failing import on logging edge-cases.
    pass
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
