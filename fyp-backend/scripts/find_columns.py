from __future__ import annotations

import json
import os
import sys

# Ensure app/ is importable when running as a script.
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from app.db.mysql import query  # noqa: E402


def main() -> None:
    sql = """
    SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND (
        COLUMN_NAME LIKE '%url%'
        OR COLUMN_NAME LIKE '%link%'
        OR COLUMN_NAME LIKE '%resource%'
        OR COLUMN_NAME LIKE '%title%'
        OR COLUMN_NAME LIKE '%method%'
      )
    ORDER BY TABLE_NAME, COLUMN_NAME;
    """
    rows = query(sql)
    print(json.dumps(rows, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
