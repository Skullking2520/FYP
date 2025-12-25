def test_ml_recommend_startup_and_endpoint_smoke(client) -> None:
    assets = client.app.state.ml_assets
    assert assets.skills_aliases
    assert assets.skills_alias_to_uri

    payload = {
        "skills": [{"label": f"Skill {i}", "weight": 1.0} for i in range(5)],
        "top_jobs": 20,
        "top_majors": 5,
    }
    r = client.post("/api/recommend", json=payload)
    assert r.status_code == 200
    body = r.json()
    assert body["matched_skill_count"] > 0
    assert body["jobs"]
    assert body["majors"]
