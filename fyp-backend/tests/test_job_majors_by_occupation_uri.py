from __future__ import annotations


def test_job_majors_by_occupation_uri_path_param(client, monkeypatch) -> None:
    # In unit tests there is no real MySQL; monkeypatch majors.query to simulate `major` table lookup.
    from app.api.routes import majors as majors_routes

    def fake_query(sql: str, params=None):
        sql_l = " ".join((sql or "").lower().split())
        if "from major" in sql_l and "where major_name in" in sql_l:
            # conftest ML metadata uses this major name
            return [
                {
                    "major_id": 1,
                    "major_name": "Computer Science",
                    "field": None,
                    "description": None,
                }
            ]
        return []

    monkeypatch.setattr(majors_routes, "query", fake_query)

    # Use ML recommend to obtain a real occupation URI with slashes.
    r = client.post(
        "/api/recommend",
        json={"skills": [{"label": "Skill 0", "weight": 1.0}], "top_jobs": 1, "top_majors": 1},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["jobs"], "expected at least one job from ML recommend"

    occ_uri = body["jobs"][0]["uri"]
    majors = client.get(f"/api/jobs/{occ_uri}/majors?top_k=1")
    assert majors.status_code == 200
    items = majors.json()
    assert isinstance(items, list)
    assert items, "expected at least one major"
    assert "major_name" in items[0]
    assert items[0].get("major_id") == 1
