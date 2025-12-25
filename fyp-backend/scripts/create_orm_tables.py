from __future__ import annotations

import argparse
import sys
from pathlib import Path


def _bootstrap_import_path() -> None:
    root = Path(__file__).resolve().parents[1]
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))


_bootstrap_import_path()

from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.engine import make_url  # noqa: E402

from app.config import build_sqlalchemy_db_url, settings  # noqa: E402
from app.database import Base  # noqa: E402
import app.models  # noqa: F401,E402  # ensure all models are registered


def _safe_url(url: str) -> str:
    try:
        u = make_url(url)
        return str(u.set(password="***"))
    except Exception:
        return url


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Create SQLAlchemy ORM tables in the configured ORM DB (EXPLICIT action)."
    )
    parser.add_argument(
        "--db-url",
        default=None,
        help="Target DB URL (defaults to build_sqlalchemy_db_url(settings) from .env/env vars).",
    )
    parser.add_argument(
        "--i-understand",
        action="store_true",
        help="Required safety flag. Prevents accidental DDL against shared DBs.",
    )
    args = parser.parse_args(argv)

    if not args.i_understand:
        print("Refusing to run without --i-understand (safety).")
        return 2

    url = args.db_url or build_sqlalchemy_db_url(settings)
    print("creating ORM tables on:", _safe_url(url))

    connect_args = {"check_same_thread": False} if str(url).startswith("sqlite") else {}
    engine = create_engine(url, pool_pre_ping=True, future=True, connect_args=connect_args)
    Base.metadata.create_all(bind=engine)
    print("done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
