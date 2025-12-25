from __future__ import annotations

"""Print columns for given MySQL tables (read-only).

Usage:
  python scripts/inspect_table_columns.py stage_major_skill program_skill program university major_skill
"""

import sys
from pathlib import Path


def _bootstrap_import_path() -> None:
    root = Path(__file__).resolve().parents[1]
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))


_bootstrap_import_path()

from app.db import mysql as db  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    if not argv:
        print("usage: python scripts/inspect_table_columns.py <table> [table...] ")
        return 2

    for table in argv:
        print("\n===", table, "===")
        try:
            cols = db.query(
                """
                SELECT COLUMN_NAME AS name, COLUMN_TYPE AS type, IS_NULLABLE AS nullable, COLUMN_KEY AS col_key, EXTRA AS extra
                FROM information_schema.columns
                WHERE table_schema = DATABASE() AND table_name = :t
                ORDER BY ORDINAL_POSITION
                """.strip(),
                {"t": table},
            )
        except Exception as exc:  # noqa: BLE001
            print(f"ERROR reading columns: {type(exc).__name__}: {exc}")
            continue

        if not cols:
            print("(no columns found or table missing)")
            continue

        for c in cols:
            print(
                " -",
                c.get("name"),
                c.get("type"),
                "NULL" if c.get("nullable") == "YES" else "NOT NULL",
                c.get("col_key") or "",
                c.get("extra") or "",
            )

        try:
            sample = db.query(f"SELECT * FROM {table} LIMIT 2")
            print("sample rows:")
            for r in sample:
                print(r)
        except Exception as exc:  # noqa: BLE001
            print(f"sample ERROR: {type(exc).__name__}: {exc}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
