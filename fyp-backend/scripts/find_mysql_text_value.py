from __future__ import annotations

import argparse
import sys
from pathlib import Path


def _bootstrap_import_path() -> None:
    root = Path(__file__).resolve().parents[1]
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))


_bootstrap_import_path()

from app.config import settings  # noqa: E402
from app.db.mysql import DatabaseQueryError, query  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Search MySQL schema for a text value across string-like columns.")
    parser.add_argument("--needle", required=True, help="Substring to search for (case-insensitive)")
    parser.add_argument("--schema", default=None, help="DB/schema name (defaults to settings.db_name)")
    parser.add_argument("--max", type=int, default=2000, help="Max columns to scan")
    args = parser.parse_args(argv)

    schema = args.schema or settings.db_name
    needle = args.needle
    like = f"%{needle}%"

    cols = query(
        """
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = :schema
          AND data_type IN ('varchar','char','text','mediumtext','longtext')
        ORDER BY table_name, column_name
        """,
        {"schema": schema},
    )

    matches: list[tuple[str, str]] = []
    scanned = 0

    for row in cols:
        if scanned >= int(args.max):
            break
        table = row["TABLE_NAME"]
        column = row["COLUMN_NAME"]
        scanned += 1

        # Avoid scanning huge staging tables too aggressively unless needed.
        # Still allow it, but you can raise --max.
        sql = f"SELECT 1 AS ok FROM `{table}` WHERE LOWER(CAST(`{column}` AS CHAR)) LIKE LOWER(%s) LIMIT 1;"
        try:
            hit = query(sql, [like])
        except DatabaseQueryError:
            continue
        if hit:
            matches.append((table, column))

    print(f"schema={schema}")
    print(f"needle={needle!r}")
    print(f"scanned_columns={scanned}")
    if not matches:
        print("matches=0")
        return 0

    print(f"matches={len(matches)}")
    for table, column in matches:
        print(f"- {table}.{column}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
