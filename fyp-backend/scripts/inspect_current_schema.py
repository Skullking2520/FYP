from __future__ import annotations

"""Inspect current MySQL schema (read-only).

This avoids PowerShell quoting issues by running as a script.

Usage:
  python scripts/inspect_current_schema.py

It prints:
- key table row counts
- key table columns (information_schema)
- sample rows for education tables
"""

import sys
from pathlib import Path


def _bootstrap_import_path() -> None:
    root = Path(__file__).resolve().parents[1]
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))


_bootstrap_import_path()

from app.db import mysql as db


def count(table: str) -> int | str:
    try:
        r = db.query_one(f"SELECT COUNT(*) AS c FROM {table}") or {}
        return int(r.get("c") or 0)
    except Exception as exc:  # noqa: BLE001
        return f"ERROR:{type(exc).__name__}:{exc}"


def main() -> int:
    print("Matching tables (education*/ *skill*):")
    try:
        matching = db.query(
            """
            SELECT TABLE_NAME AS table_name
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
              AND (table_name LIKE 'education%%' OR table_name LIKE '%%skill%%')
            ORDER BY table_name
            """.strip()
        )
        print([row.get("table_name") for row in matching])
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR listing tables: {type(exc).__name__}: {exc}")

    print("Matching tables (*subject*):")
    try:
        matching_subject = db.query(
            """
            SELECT TABLE_NAME AS table_name
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
              AND table_name LIKE '%%subject%%'
            ORDER BY table_name
            """.strip()
        )
        print([row.get("table_name") for row in matching_subject])
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR listing subject tables: {type(exc).__name__}: {exc}")

    print("Tables containing column 'subject_id':")
    try:
        subject_id_tables = db.query(
            """
            SELECT TABLE_NAME AS table_name
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND COLUMN_NAME = 'subject_id'
            GROUP BY TABLE_NAME
            ORDER BY TABLE_NAME
            """.strip()
        )
        print([row.get("table_name") for row in subject_id_tables])
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR listing subject_id tables: {type(exc).__name__}: {exc}")

    print("Tables with any column like '%subject%':")
    try:
        subject_like_tables = db.query(
            """
            SELECT DISTINCT TABLE_NAME AS table_name
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND LOWER(COLUMN_NAME) LIKE '%%subject%%'
            ORDER BY table_name
            """.strip()
        )
        print([row.get("table_name") for row in subject_like_tables])
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR listing subject-like columns: {type(exc).__name__}: {exc}")

    tables = [
        "education_subjects",
        "education_subject_skill_map",
        "student_subject",
        "student_skill",
        "edu_status_skill_level_rule",
        "major",
        "major_occupation_map",
        "occupations",
        "skills",
        "esco_skills",
        "stage_esco_occupations",
        "stage_occupations_master",
    ]

    print("Row counts:")
    for t in tables:
        print(f"- {t}: {count(t)}")

    cols = db.query(
        """
        SELECT
          TABLE_NAME AS table_name,
          COLUMN_NAME AS column_name,
          COLUMN_TYPE AS column_type,
          IS_NULLABLE AS is_nullable,
          COLUMN_KEY AS column_key,
          EXTRA AS extra
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
        ORDER BY TABLE_NAME, ORDINAL_POSITION
        """.strip()
    )

    by: dict[str, list[dict]] = {}
    for r in cols:
        by.setdefault(str(r.get("table_name")), []).append(r)

    print("\nColumns:")
    for t in tables:
        if t not in by:
            print(f"\nMISSING {t}")
            continue
        print(f"\n{t}")
        for c in by[t]:
            print(
                " ",
                c.get("column_name"),
                c.get("column_type"),
                c.get("is_nullable"),
                c.get("column_key"),
                c.get("extra"),
            )

    print("\nSample rows:")
    for t in [
        "education_subjects",
        "education_subject_skill_map",
        "student_subject",
        "student_skill",
        "edu_status_skill_level_rule",
    ]:
        try:
            try:
                rows = db.query(f"SELECT * FROM {t} ORDER BY id LIMIT 3")
            except Exception:
                rows = db.query(f"SELECT * FROM {t} LIMIT 3")
        except Exception as exc:  # noqa: BLE001
            print(f"--- {t}: ERROR {type(exc).__name__}: {exc}")
            continue
        print(f"--- {t}")
        for r in rows:
            print(r)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
