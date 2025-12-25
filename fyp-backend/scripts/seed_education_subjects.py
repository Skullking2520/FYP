from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def _bootstrap_import_path() -> None:
    # Allow running as: python scripts/seed_education_subjects.py
    root = Path(__file__).resolve().parents[1]
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))


_bootstrap_import_path()

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.models.education_subject import EducationSubject  # noqa: E402


def _load_dataset(path: Path) -> dict[str, list[str]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError("dataset must be a JSON object with keys: alevel, olevel")

    def _list(key: str) -> list[str]:
        v = raw.get(key)
        if not isinstance(v, list):
            return []
        return [str(x).strip() for x in v if str(x).strip()]

    return {"alevel": _list("alevel"), "olevel": _list("olevel")}


def _db_stage(stage: str) -> str:
    # Some DBs store stages as A_LEVEL/O_LEVEL. Persist underscore form for stability.
    s = (stage or "").strip().lower()
    if s == "alevel":
        return "A_LEVEL"
    if s == "olevel":
        return "O_LEVEL"
    return stage


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Seed education subjects into ORM DB.")
    parser.add_argument(
        "--dataset",
        default=str(Path(__file__).resolve().parents[1] / "app" / "data" / "datasets" / "caie_subjects.json"),
        help="Path to caie_subjects.json",
    )
    parser.add_argument("--truncate", action="store_true", help="Delete existing subjects before seeding")
    args = parser.parse_args(argv)

    Base.metadata.create_all(bind=engine)

    dataset_path = Path(args.dataset)
    data = _load_dataset(dataset_path)

    with SessionLocal() as db:
        if args.truncate:
            db.query(EducationSubject).delete()
            db.commit()

        inserted = 0
        for stage, subjects in data.items():
            db_stage = _db_stage(stage)
            for name in subjects:
                exists = (
                    db.query(EducationSubject)
                    .filter(EducationSubject.stage == db_stage)
                    .filter(EducationSubject.name == name)
                    .first()
                )
                if exists:
                    continue
                db.add(EducationSubject(stage=db_stage, name=name))
                inserted += 1

        db.commit()

    print(f"seeded subjects inserted={inserted} dataset={dataset_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
