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

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.models.dataset_job import DatasetJob  # noqa: E402
from app.models.dataset_program import DatasetProgram  # noqa: E402
from app.models.dataset_skill_resource import DatasetSkillResource  # noqa: E402
from app.models.dataset_university_program import DatasetUniversityProgram  # noqa: E402


def _load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Seed app/data/datasets/*.json into ORM tables.")
    parser.add_argument(
        "--datasets-dir",
        default=str(Path(__file__).resolve().parents[1] / "app" / "data" / "datasets"),
    )
    parser.add_argument("--truncate", action="store_true")
    args = parser.parse_args(argv)

    Base.metadata.create_all(bind=engine)

    datasets_dir = Path(args.datasets_dir)
    jobs_path = datasets_dir / "jobs.json"
    programs_path = datasets_dir / "programs.json"
    universities_path = datasets_dir / "universities.json"
    skills_path = datasets_dir / "skills.json"

    with SessionLocal() as db:
        if args.truncate:
            db.query(DatasetUniversityProgram).delete()
            db.query(DatasetProgram).delete()
            db.query(DatasetJob).delete()
            db.query(DatasetSkillResource).delete()
            db.commit()

        inserted = {"jobs": 0, "programs": 0, "universities": 0, "skills": 0}

        if jobs_path.exists():
            for item in _load_json(jobs_path):
                job_id = str(item.get("job_id") or "").strip()
                if not job_id:
                    continue
                if db.query(DatasetJob).filter(DatasetJob.job_id == job_id).first():
                    continue
                db.add(
                    DatasetJob(
                        job_id=job_id,
                        job_title=str(item.get("job_title") or "").strip(),
                        job_description=str(item.get("job_description") or "").strip(),
                        skills_required=item.get("skills_required") or [],
                        weight=float(item.get("weight") or 1.0),
                    )
                )
                inserted["jobs"] += 1

        if programs_path.exists():
            for item in _load_json(programs_path):
                program_id = str(item.get("id") or "").strip()
                if not program_id:
                    continue
                if db.query(DatasetProgram).filter(DatasetProgram.program_id == program_id).first():
                    continue
                db.add(
                    DatasetProgram(
                        program_id=program_id,
                        name=str(item.get("name") or "").strip(),
                        description=str(item.get("description") or "").strip(),
                        tags=item.get("tags") or [],
                        focus_areas=item.get("focus_areas") or [],
                        related_skills=item.get("related_skills") or [],
                        keywords=item.get("keywords") or [],
                    )
                )
                inserted["programs"] += 1

        if universities_path.exists():
            for item in _load_json(universities_path):
                uni_id = str(item.get("uni_id") or "").strip()
                program_id = str(item.get("program_id") or "").strip()
                program_url = str(item.get("program_url") or "").strip()
                if not uni_id or not program_id or not program_url:
                    continue
                db.add(
                    DatasetUniversityProgram(
                        uni_id=uni_id,
                        uni_name=str(item.get("uni_name") or "").strip(),
                        program_id=program_id,
                        program_url=program_url,
                        rank=int(item.get("rank")) if item.get("rank") is not None else None,
                        required_skills=item.get("required_skills") or [],
                        entry_requirements=item.get("entry_requirements") or [],
                        country=item.get("country"),
                        subject_strength=item.get("subject_strength"),
                    )
                )
                inserted["universities"] += 1

        if skills_path.exists():
            for item in _load_json(skills_path):
                skill = str(item.get("skill") or "").strip()
                title = str(item.get("title") or "").strip()
                url = str(item.get("url") or "").strip()
                if not skill or not title or not url:
                    continue
                db.add(DatasetSkillResource(skill=skill, title=title, url=url))
                inserted["skills"] += 1

        db.commit()

    print("seeded", inserted, "from", datasets_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
