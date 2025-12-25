"""Smoke test for ML recommend endpoint using DB metadata.

Prereqs:
- MySQL is reachable using your configured DB_URL (or the settings consumed by app.db.mysql).
- Tables exist:
  - skills(skill_uri, preferred_label, alt_labels)
  - occupations(occ_uri, preferred_label)
  - majors(major_name)
  - major_occupation_map(major_name, occ_uri)

Run:
- Windows PowerShell: python scripts/smoke_ml_recommend_db.py
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import create_app


def main() -> None:
    app = create_app()
    with TestClient(app) as client:
        payload = {
            "skills": [
                {"label": "data analysis", "weight": 1.0},
                {"label": "python", "weight": 1.0},
                {"label": "machine learning", "weight": 1.0},
                {"label": "sql", "weight": 1.0},
                {"label": "statistics", "weight": 1.0},
            ],
            "top_jobs": 10,
            "top_majors": 5,
        }
        r = client.post("/api/recommend", json=payload)
        print("status:", r.status_code)
        print(r.json())


if __name__ == "__main__":
    main()
