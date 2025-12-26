"""Inspect DB tables that could support:

- job -> major (1:1 or mapping)
- major -> programs top-K (pre-ranked)

This script prints candidate table names, their columns, and small row counts.

Usage:
  python scripts/inspect_major_program_ranking_tables.py
  python scripts/inspect_major_program_ranking_tables.py --major-id 10 --limit 5
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Allow running this script from any working directory without needing PYTHONPATH.
_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from app.db.mysql import DatabaseConnectionError, DatabaseQueryError, query, query_one


def _list_tables() -> list[str]:
    sql = """
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND (
        table_name LIKE '%job%'
        OR table_name LIKE '%major%'
        OR table_name LIKE '%program%'
        OR table_name LIKE '%ranking%'
        OR table_name LIKE '%rank%'
        OR table_name LIKE '%map%'
      )
    ORDER BY table_name
    LIMIT 500;
    """.strip()
    out: list[str] = []
    for r in query(sql):
        name = r.get("table_name") or r.get("TABLE_NAME")
        if isinstance(name, str) and name:
            out.append(name)
    return out


def _list_columns(table_name: str) -> list[dict]:
    sql = """
    SELECT column_name, data_type, is_nullable, column_key
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = :t
    ORDER BY ordinal_position;
    """.strip()
    return query(sql, {"t": table_name})


def _count_rows(table_name: str) -> int | None:
    try:
        row = query_one(f"SELECT COUNT(*) AS c FROM `{table_name}`")
        if row and row.get("c") is not None:
            return int(row["c"])
    except Exception:
        return None
    return None


def _safe_sample(table_name: str, limit: int) -> list[dict]:
    try:
        return query(f"SELECT * FROM `{table_name}` LIMIT {int(limit)}")
    except Exception:
        return []


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--major-id", type=int, default=10)
    parser.add_argument("--limit", type=int, default=3)
    args = parser.parse_args()

    try:
        print("database:", (query_one("SELECT DATABASE() AS d") or {}).get("d"))
        print("current_user:", (query_one("SELECT CURRENT_USER() AS u") or {}).get("u"))

        tables = _list_tables()
        print("\nmatched tables:", len(tables))
        for t in tables:
            print(" -", t)

        job_major_tables = [t for t in tables if ("job" in t.lower() and "major" in t.lower())]
        major_program_tables = [t for t in tables if ("major" in t.lower() and "program" in t.lower())]

        # Also show common tables used elsewhere.
        for must in ("job", "major", "major_occupation_map", "major_ranking", "program", "university"):
            if must in tables and must not in major_program_tables and must not in job_major_tables:
                pass

        def show_tables(title: str, names: list[str]) -> None:
            print(f"\n{title}: {len(names)}")
            for t in names:
                print(f"  - {t} (rows={_count_rows(t)})")
                cols = _list_columns(t)
                col_names = ", ".join([
                    (c.get("column_name") or c.get("COLUMN_NAME") or "")
                    for c in cols
                    if (c.get("column_name") or c.get("COLUMN_NAME"))
                ])
                print(f"    columns: {col_names}")
                sample = _safe_sample(t, args.limit)
                if sample:
                    print("    sample:")
                    for r in sample:
                        print("     ", r)

        show_tables("job->major candidate tables", job_major_tables)
        show_tables("major->program candidate tables", major_program_tables)

        # Quick checks for likely schemas
        print("\nquick checks:")
        # 1) Does job have major_id?
        try:
            cols = _list_columns("job")
            colset = {
                str(c.get("column_name") or c.get("COLUMN_NAME") or "").lower()
                for c in cols
            }
            print("job columns include major_id:", "major_id" in colset)
        except Exception:
            print("job table not readable")

        # 2) Can we find programs for a major via any major->program candidate?
        for t in major_program_tables:
            cols = _list_columns(t)
            colset = {
                str(c.get("column_name") or c.get("COLUMN_NAME") or "").lower()
                for c in cols
            }
            if "major_id" in colset:
                try:
                    sql = f"SELECT COUNT(*) AS c FROM `{t}` WHERE major_id = :m"
                    c = (query_one(sql, {"m": int(args.major_id)}) or {}).get("c")
                    print(f"{t}: rows for major_id={args.major_id} -> {c}")
                except Exception:
                    pass

        return 0

    except (DatabaseConnectionError, DatabaseQueryError) as exc:
        print("DB error:", type(exc).__name__, str(exc))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
