from __future__ import annotations

import json
import os
import sys

# Ensure app/ is importable when running as a script.
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from app.db.mysql import expand_in_clause, query, query_one  # noqa: E402


def main() -> int:
    print("Verifying MySQL connectivity using DB_* env vars...\n")

    stats = {
        "job": query_one("SELECT COUNT(*) AS c FROM job;") or {},
        "skill": query_one("SELECT COUNT(*) AS c FROM skill;") or {},
        "job_skill": query_one("SELECT COUNT(*) AS c FROM job_skill;") or {},
        "skill_tag": query_one("SELECT COUNT(*) AS c FROM skill_tag;") or {},
    }
    counts = {k: int(v.get("c") or 0) for k, v in stats.items()}
    print("Counts:")
    print(json.dumps(counts, indent=2))

    rows = query(
        """
        SELECT id, skill_key, name, source, dimension
        FROM skill
        WHERE name LIKE CONCAT('%', :q, '%')
        ORDER BY name
        LIMIT 5;
        """,
        {"q": "data"},
    )
    print("\nSample /skills/search?q=data (top 5):")
    print(json.dumps(rows, indent=2, ensure_ascii=False))

    if rows:
        sample_skill_key = rows[0]["skill_key"]
        sql = """
        SELECT
          j.id AS job_id, j.title, j.source,
          COUNT(*) AS matched_skills,
          SUM(COALESCE(js.importance, 1)) AS score
        FROM skill s
        JOIN job_skill js ON js.skill_id = s.id
        JOIN job j ON j.id = js.job_id
        WHERE s.skill_key IN (:skill_keys)
        GROUP BY j.id, j.title, j.source
        ORDER BY score DESC, matched_skills DESC
        LIMIT 5;
        """
        sql, params = expand_in_clause(sql, {"skill_keys": [sample_skill_key]}, "skill_keys")
        recs = query(sql, params)
        print(f"\nSample recommendation for skill_key={sample_skill_key}:")
        print(json.dumps(recs, indent=2, ensure_ascii=False))

    print("\nOK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
