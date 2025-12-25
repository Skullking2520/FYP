from __future__ import annotations

import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
if str(root) not in sys.path:
    sys.path.insert(0, str(root))

from app.db.mysql import query  # noqa: E402


def main() -> int:
    major_id = 10
    sql = """
    SELECT
      s.id AS skill_id,
      s.skill_key,
      s.name,
      s.source,
      NULL AS dimension,
      SUM(
        CASE
          WHEN LOWER(COALESCE(link.relationType, '')) = 'essential' THEN 2
          ELSE 1
        END
      ) AS importance
    FROM major_occupation_map mom
    JOIN stage_occupation_skill_links_esco link
      ON link.occupationUri = mom.occupation_uri
    JOIN skill s
      ON s.skill_key = link.skillUri
    WHERE mom.major_id = :major_id
    GROUP BY s.id, s.skill_key, s.name, s.source
    ORDER BY importance DESC, s.name
    LIMIT 5;
    """
    rows = query(sql, {"major_id": major_id})
    print("rows", len(rows))
    for r in rows:
        print(r)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
