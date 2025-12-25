from __future__ import annotations

import json
import os
import sys

from fastapi.testclient import TestClient

# Ensure app/ is importable when running as a script.
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from app.main import app


def main() -> int:
    client = TestClient(app)

    # 1) /api/db/stats
    r = client.get("/api/db/stats")
    print("GET /api/db/stats ->", r.status_code)
    print(json.dumps(r.json(), indent=2, ensure_ascii=False))
    if r.status_code != 200:
        return 1

    # 2) /api/skills/search?q=data
    r2 = client.get("/api/skills/search", params={"q": "data"})
    print("\nGET /api/skills/search?q=data ->", r2.status_code)
    payload = r2.json()
    if r2.status_code != 200:
        print(json.dumps(payload, indent=2, ensure_ascii=False))
        return 1

    skills = payload
    print("count=", len(skills))
    print(json.dumps(skills[:5], indent=2, ensure_ascii=False))

    # 3) pick skill_key and call /api/recommend/jobs
    if skills:
        skill_key = skills[0]["skill_key"]
            r3 = client.post(
                "/api/recommend/jobs",
                json={"skills": [{"skill_key": skill_key, "level": 2}]},
            )
        print(f"\nPOST /api/recommend/jobs (skill_key={skill_key}) ->", r3.status_code)
        recs_payload = r3.json()
        print(json.dumps(recs_payload, indent=2, ensure_ascii=False))
        if r3.status_code != 200:
            return 1
        print("count=", len(recs_payload))
        if len(recs_payload) == 0:
            return 2
    else:
        print("No skills found for q=data; cannot test recommend.")
        return 2

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
