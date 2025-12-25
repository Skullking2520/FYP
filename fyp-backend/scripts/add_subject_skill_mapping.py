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

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.models.education_subject import EducationSubject, EducationSubjectSkillMap  # noqa: E402


def _norm(s: str) -> str:
    return (s or "").strip().lower()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Add or update a subject→skill mapping in ORM DB.")
    parser.add_argument("--stage", required=True, choices=["alevel", "olevel"])
    parser.add_argument("--subject", required=True, help="Subject name (e.g., Mathematics)")
    parser.add_argument("--skill", required=True, help="Skill key/label (e.g., math)")
    parser.add_argument("--base-level", type=int, default=0, help="Base level (0..5)")
    args = parser.parse_args(argv)

    Base.metadata.create_all(bind=engine)

    stage = args.stage
    subject_name = (args.subject or "").strip()
    skill_key = (args.skill or "").strip()
    base_level = max(0, min(5, int(args.base_level)))

    if not subject_name:
        raise SystemExit("subject is required")
    if not skill_key:
        raise SystemExit("skill is required")

    with SessionLocal() as db:
        subject_row = (
            db.query(EducationSubject)
            .filter(EducationSubject.stage == stage)
            .filter(func.lower(EducationSubject.name) == _norm(subject_name))
            .first()
        )
        if not subject_row:
            raise SystemExit(f"subject not found: stage={stage} subject={subject_name!r} (seed subjects first)")

        mapping = (
            db.query(EducationSubjectSkillMap)
            .filter(EducationSubjectSkillMap.subject_id == subject_row.id)
            .filter(func.lower(EducationSubjectSkillMap.skill_key) == _norm(skill_key))
            .first()
        )

        if mapping is None:
            mapping = EducationSubjectSkillMap(subject_id=subject_row.id, skill_key=skill_key, base_level=base_level)
            db.add(mapping)
            db.commit()
            print(f"created mapping subject={subject_row.name} skill={skill_key} base_level={base_level}")
        else:
            mapping.skill_key = skill_key
            mapping.base_level = base_level
            db.add(mapping)
            db.commit()
            print(f"updated mapping subject={subject_row.name} skill={skill_key} base_level={base_level}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
