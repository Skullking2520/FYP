"""Inspect MySQL schema for ML/NLP metadata (read-only).

Prints:
- Current database
- Tables
- Column lists for candidate tables
- Row counts for required tables if present

Run:
  python scripts/inspect_mysql_ml_tables.py

This does NOT modify the database.
"""

from __future__ import annotations

import sys
from pathlib import Path


_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from app.db import mysql as mysql_db  # noqa: E402


REQUIRED = {
    "skills": {"skill_uri", "preferred_label", "alt_labels"},
    "occupations": {"occ_uri", "preferred_label"},
    "major_occupation_map": {"major_name", "occ_uri"},
}


def main() -> int:
    db = mysql_db.query_one("SELECT DATABASE() AS db")
    print("database:", (db or {}).get("db"))

    tables = mysql_db.query("SHOW TABLES")
    if not tables:
        print("No tables visible to current user")
        return 2

    # SHOW TABLES returns dict with varying key name.
    table_names = [str(next(iter(row.values()))) for row in tables]
    print("tables:")
    for t in sorted(table_names):
        print(" -", t)

    # Try to find candidates with required columns.
    for logical, cols in REQUIRED.items():
        print(f"\nlooking for {logical} with columns {sorted(cols)}")
        candidates = mysql_db.query(
            """
            SELECT table_name
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
            GROUP BY table_name
            HAVING SUM(column_name IN (%s,%s,%s,%s,%s)) >= %s
            """.strip(),
            [
                "skill_uri",
                "preferred_label",
                "alt_labels",
                "occ_uri",
                "major_name",
                len(cols),
            ],
        )
        cand_names = [str(r.get("table_name")) for r in candidates]
        # Filter to those that contain ALL cols
        good: list[str] = []
        for t in cand_names:
            c = mysql_db.query(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = DATABASE() AND table_name = %s
                """.strip(),
                [t],
            )
            found = {str(r.get("column_name")) for r in c}
            if cols.issubset(found):
                good.append(t)
        if good:
            for t in sorted(set(good)):
                print("  candidate:", t)
        else:
            print("  no candidates found")

    # Row counts (best effort)
    for t in ["skills", "occupations", "major_occupation_map"]:
        try:
            c = mysql_db.query_one(f"SELECT COUNT(*) AS c FROM {t}")
            print(f"count {t}:", (c or {}).get("c"))
        except Exception as exc:
            print(f"count {t}: ERROR ({type(exc).__name__}: {exc})")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
