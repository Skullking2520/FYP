from __future__ import annotations

import argparse
import sys
from pathlib import Path


def _bootstrap_import_path() -> None:
    root = Path(__file__).resolve().parents[1]
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))


_bootstrap_import_path()

from sqlalchemy import func  # noqa: E402
from sqlalchemy.engine import make_url  # noqa: E402

from app.config import build_sqlalchemy_db_url, settings  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models.education_subject import EducationSubject, EducationSubjectSkillMap  # noqa: E402


def _safe_url(url: str) -> str:
    try:
        u = make_url(url)
        return str(u.set(password="***"))
    except Exception:
        return url


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Print current ORM DB info + education subject counts.")
    parser.add_argument(
        "--db-url",
        default=None,
        help="Override ORM DB URL (otherwise uses build_sqlalchemy_db_url(settings)).",
    )
    args = parser.parse_args(argv)

    url = args.db_url or build_sqlalchemy_db_url(settings)
    print("orm_db_url:", _safe_url(url))

    # NOTE: SessionLocal is bound to app.database.engine, which is created from settings.
    # If you pass --db-url, it only prints; it does not rebind SessionLocal.
    # For switching DBs, set ORM_DB_URL env var and restart uvicorn.

    with SessionLocal() as db:
        alevel = db.query(func.count(EducationSubject.id)).filter(EducationSubject.stage == "alevel").scalar() or 0
        olevel = db.query(func.count(EducationSubject.id)).filter(EducationSubject.stage == "olevel").scalar() or 0
        mappings = db.query(func.count(EducationSubjectSkillMap.id)).scalar() or 0

    print("education_subjects:")
    print("  alevel:", int(alevel))
    print("  olevel:", int(olevel))
    print("education_subject_skill_map:")
    print("  rows:", int(mappings))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
