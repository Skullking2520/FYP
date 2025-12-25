from __future__ import annotations

"""Populate `major_skill` from ESCO occupation-skill links.

This is a read/write script (it modifies MySQL) intended to fix empty results for:
- POST /api/majors/{major_id}/gaps
- GET  /api/majors/{major_id}/skills

It derives major->skill associations by:
major_occupation_map (major_id -> ESCO occupation_uri)
  JOIN stage_occupation_skill_links_esco (occupationUri -> skillUri)
  JOIN skill (skill_key == skillUri)

Usage:
  python scripts/build_major_skill_from_esco.py --truncate

Notes:
- `program`/`program_skill` are not populated by this script.
- It is safe to run repeatedly with --truncate (idempotent).
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


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--truncate", action="store_true", help="DELETE FROM major_skill before inserting")
    parser.add_argument("--source", default="DERIVED", help="Value for major_skill.source")
    args = parser.parse_args(argv)

    # Basic sanity checks
    required_tables = [
        "major_skill",
        "major_occupation_map",
        "stage_occupation_skill_links_esco",
        "skill",
    ]
    for t in required_tables:
        try:
            db.query_one(f"SELECT COUNT(*) AS c FROM {t}")
        except Exception as exc:  # noqa: BLE001
            print(f"ERROR: cannot access table {t}: {type(exc).__name__}: {exc}")
            return 2

    if args.truncate:
        print("Truncating major_skill...")
        db.query("DELETE FROM major_skill")

    print("Inserting derived major_skill rows...")

    insert_sql = """
    INSERT INTO major_skill (major_id, skill_id, importance, selected_occ_count, source)
    SELECT
      mom.major_id AS major_id,
      s.id AS skill_id,
      SUM(
        CASE
          WHEN LOWER(COALESCE(link.relationType, '')) = 'essential' THEN 2
          ELSE 1
        END
      ) AS importance,
      COUNT(DISTINCT mom.occupation_uri) AS selected_occ_count,
      :source AS source
    FROM major_occupation_map mom
    JOIN stage_occupation_skill_links_esco link
      ON link.occupationUri = mom.occupation_uri
    JOIN skill s
      ON s.skill_key = link.skillUri
    GROUP BY mom.major_id, s.id;
    """.strip()

    db.query(insert_sql, {"source": str(args.source)})

    total = db.query_one("SELECT COUNT(*) AS c FROM major_skill") or {}
    print("major_skill total rows:", int(total.get("c") or 0))

    sample = db.query(
        """
        SELECT major_id, COUNT(*) AS c
        FROM major_skill
        GROUP BY major_id
        ORDER BY c DESC
        LIMIT 5;
        """.strip()
    )
    print("top majors by skill rows:")
    for r in sample:
        print(r)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
