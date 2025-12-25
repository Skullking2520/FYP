from __future__ import annotations

"""Inspect MySQL tables used by /majors/{id}/programs and /majors/{id}/gaps.

Read-only diagnostic script.

Usage:
  python scripts/inspect_major_program_tables.py --major-id 10

It prints:
- row counts for major/skill/program mapping tables
- whether major_id exists
- how many major_skill rows exist
- how many programs match via program_skill
"""

import argparse
import sys
from pathlib import Path


def _bootstrap_import_path() -> None:
    root = Path(__file__).resolve().parents[1]
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))


_bootstrap_import_path()

from app.db import mysql as db  # noqa: E402


def count(table: str) -> int | str:
    try:
        row = db.query_one(f"SELECT COUNT(*) AS c FROM {table}") or {}
        return int(row.get("c") or 0)
    except Exception as exc:  # noqa: BLE001
        return f"ERROR:{type(exc).__name__}:{exc}"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--major-id", type=int, default=10)
    args = parser.parse_args()

    major_id = int(args.major_id)

    tables = [
        "major",
        "skill",
        "major_skill",
        "program",
        "program_skill",
        "university",
        "major_ranking",
        # Likely upstream sources
        "stage_major_skill",
        "dataset_university_programs",
        "dataset_programs",
    ]

    print("Row counts:")
    for t in tables:
        print(f"- {t}: {count(t)}")

    try:
        major_row = db.query_one("SELECT id, major_name, field FROM major WHERE id = :id", {"id": major_id})
    except Exception as exc:  # noqa: BLE001
        print(f"\nmajor lookup ERROR: {type(exc).__name__}: {exc}")
        major_row = None

    print("\nmajor:")
    print(major_row)

    # Stage/source availability checks
    try:
        stage = db.query_one(
            "SELECT COUNT(*) AS c FROM stage_major_skill WHERE major_id = :id",
            {"id": major_id},
        ) or {}
        print(f"\nstage_major_skill rows for major_id={major_id}: {int(stage.get('c') or 0)}")
    except Exception as exc:  # noqa: BLE001
        print(f"\nstage_major_skill count ERROR: {type(exc).__name__}: {exc}")

    try:
        ds = db.query_one("SELECT COUNT(*) AS c FROM dataset_university_programs") or {}
        print(f"dataset_university_programs total rows: {int(ds.get('c') or 0)}")
    except Exception as exc:  # noqa: BLE001
        print(f"dataset_university_programs count ERROR: {type(exc).__name__}: {exc}")

    try:
        ms = db.query_one("SELECT COUNT(*) AS c FROM major_skill WHERE major_id = :id", {"id": major_id}) or {}
        print(f"\nmajor_skill rows for major_id={major_id}: {int(ms.get('c') or 0)}")
    except Exception as exc:  # noqa: BLE001
        print(f"\nmajor_skill count ERROR: {type(exc).__name__}: {exc}")

    # How many distinct programs match via shared skills?
    try:
        prog = db.query_one(
            """
            SELECT COUNT(DISTINCT ps.program_id) AS c
            FROM major_skill ms
            JOIN program_skill ps ON ps.skill_id = ms.skill_id
            JOIN program p ON p.id = ps.program_id
            WHERE ms.major_id = :id
              AND p.is_active = 1
            """.strip(),
            {"id": major_id},
        ) or {}
        print(f"matching active programs via skills: {int(prog.get('c') or 0)}")
    except Exception as exc:  # noqa: BLE001
        print(f"matching programs ERROR: {type(exc).__name__}: {exc}")

    # Sample top programs query (same as endpoint, simplified)
    try:
        rows = db.query(
            """
            SELECT p.id AS program_id, p.program_name, u.name AS university_name,
                   COUNT(DISTINCT ps.skill_id) AS matched_skills,
                   SUM(COALESCE(ps.importance, 1) * COALESCE(ms.importance, 1)) AS score
            FROM major_skill ms
            JOIN program_skill ps ON ps.skill_id = ms.skill_id
            JOIN program p ON p.id = ps.program_id
            JOIN university u ON u.id = p.university_id
            WHERE ms.major_id = :id
              AND p.is_active = 1
            GROUP BY p.id, p.program_name, u.name
            ORDER BY score DESC, matched_skills DESC
            LIMIT 5;
            """.strip(),
            {"id": major_id},
        )
        print("\nSample top 5 programs:")
        for r in rows:
            print(r)
    except Exception as exc:  # noqa: BLE001
        print(f"\nSample programs ERROR: {type(exc).__name__}: {exc}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
