from __future__ import annotations

import argparse
import json
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


def _norm(value: str) -> str:
    return (value or "").strip().lower()


def _norm_stage(value: str) -> str:
    # Normalize to 'alevel'/'olevel' even if DB stores 'A_LEVEL'/'O_LEVEL'.
    return _norm(value).replace("_", "")


def _load_dataset(path: Path) -> dict[str, dict[str, list[dict]]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError("dataset must be a JSON object")

    out: dict[str, dict[str, list[dict]]] = {}
    for stage, subjects in raw.items():
        if stage not in {"alevel", "olevel"}:
            continue
        if not isinstance(subjects, dict):
            continue
        stage_map: dict[str, list[dict]] = {}
        for subject, skills in subjects.items():
            if not isinstance(subject, str) or not subject.strip():
                continue
            if not isinstance(skills, list):
                continue
            cleaned: list[dict] = []
            for item in skills:
                if not isinstance(item, dict):
                    continue
                skill_key = str(item.get("skill_key") or "").strip()
                if not skill_key:
                    continue
                base_level = item.get("base_level", 0)
                try:
                    base_level_i = max(0, min(5, int(base_level)))
                except Exception:
                    base_level_i = 0
                cleaned.append({"skill_key": skill_key, "base_level": base_level_i})
            if cleaned:
                stage_map[subject.strip()] = cleaned
        if stage_map:
            out[stage] = stage_map

    return out


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Seed education subject→skill mappings into ORM DB.")
    parser.add_argument(
        "--dataset",
        default=str(Path(__file__).resolve().parents[1] / "app" / "data" / "datasets" / "caie_subject_skill_map.json"),
        help="Path to caie_subject_skill_map.json",
    )
    parser.add_argument(
        "--truncate",
        action="store_true",
        help="Delete existing mappings before seeding (keeps subjects).",
    )
    args = parser.parse_args(argv)

    Base.metadata.create_all(bind=engine)

    dataset_path = Path(args.dataset)
    data = _load_dataset(dataset_path)

    with SessionLocal() as db:
        if args.truncate:
            db.query(EducationSubjectSkillMap).delete()
            db.commit()

        inserted = 0
        updated = 0
        skipped_missing_subject = 0

        for stage, subjects in data.items():
            for subject_name, skills in subjects.items():
                subject_row = (
                    db.query(EducationSubject)
                    .filter(func.replace(func.lower(EducationSubject.stage), "_", "") == _norm_stage(stage))
                    .filter(func.lower(EducationSubject.name) == _norm(subject_name))
                    .first()
                )
                if not subject_row:
                    skipped_missing_subject += 1
                    continue

                for item in skills:
                    skill_key = str(item.get("skill_key") or "").strip()
                    base_level = max(0, min(5, int(item.get("base_level", 0))))

                    mapping = (
                        db.query(EducationSubjectSkillMap)
                        .filter(EducationSubjectSkillMap.subject_id == subject_row.id)
                        .filter(func.lower(EducationSubjectSkillMap.skill_key) == _norm(skill_key))
                        .first()
                    )
                    if mapping is None:
                        db.add(
                            EducationSubjectSkillMap(
                                subject_id=subject_row.id,
                                skill_key=skill_key,
                                base_level=base_level,
                            )
                        )
                        inserted += 1
                    else:
                        if int(mapping.base_level or 0) != base_level:
                            mapping.base_level = base_level
                            db.add(mapping)
                            updated += 1

        db.commit()

    print(
        f"seeded subject_skill_map inserted={inserted} updated={updated} missing_subjects={skipped_missing_subject} dataset={dataset_path}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
