from __future__ import annotations

from app.database import SessionLocal
from app.models.profile import UserProfileModel
from app.models.recommendation_event import RecommendationEvent
from app.models.recommendation_pick import RecommendationPick


def _register_and_login(client, email: str, password: str) -> str:
    r = client.post("/auth/register", json={"email": email, "password": password})
    assert r.status_code == 201
    r = client.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200
    return r.json()["access_token"]


def test_user_profile_put_get_supports_structured_skills(client) -> None:
    token = _register_and_login(client, "profile@example.com", "SecretPass123")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "skills": [
            {"skill_key": "http://data.europa.eu/esco/skill/2ee670aa-c687-4ff7-92eb-0abc9b57e5f2", "level": 3},
            {"skill_key": "python", "level": 1},
        ]
    }

    put_resp = client.put("/api/users/me/profile", json=payload, headers=headers)
    assert put_resp.status_code == 200

    get_resp = client.get("/api/users/me/profile", headers=headers)
    assert get_resp.status_code == 200
    body = get_resp.json()
    assert "profile" in body
    skills = body["profile"].get("skills")
    assert isinstance(skills, list)
    assert {s["skill_key"] for s in skills} == {"http://data.europa.eu/esco/skill/2ee670aa-c687-4ff7-92eb-0abc9b57e5f2", "python"}

    # Ensure it is persisted in user_profiles table.
    db = SessionLocal()
    try:
        row = db.query(UserProfileModel).first()
        assert row is not None
        assert row.profile_data.get("skills")
    finally:
        db.close()


def test_recommend_pick_allows_anonymous_and_authenticated(client) -> None:
    # Create a recommendation (no auth required). Use an explicit ESCO URI known
    # to exist in the loaded ML skill_index.
    assets = getattr(client.app.state, "ml_assets", None)
    assert assets is not None
    skill_uri = next(iter(getattr(assets, "skill_index").keys()))

    rec = client.post(
        "/api/recommend/jobs",
        json={"skills": [{"skill_key": skill_uri, "level": 0}], "top_jobs": 3},
    )
    assert rec.status_code == 200
    rec_id = rec.headers.get("X-Recommendation-Id")
    assert rec_id

    jobs = rec.json()
    assert isinstance(jobs, list) and jobs
    chosen_job_id = jobs[0]["job_id"]

    # Pick without auth (should work; user_id stays null)
    pick = client.post(
        "/api/recommend/jobs/pick",
        json={"recommendation_id": rec_id, "chosen_job_id": chosen_job_id},
    )
    assert pick.status_code == 200

    # Pick with auth (should work; user_id set)
    token = _register_and_login(client, "picker@example.com", "SecretPass123")
    headers = {"Authorization": f"Bearer {token}"}
    pick2 = client.post(
        "/api/recommend/jobs/pick",
        json={"recommendation_id": rec_id, "chosen_job_id": chosen_job_id},
        headers=headers,
    )
    assert pick2.status_code == 200

    db = SessionLocal()
    try:
        assert db.query(RecommendationEvent).count() == 1
        picks = db.query(RecommendationPick).all()
        assert len(picks) == 2
        assert any(p.user_id is None for p in picks)
        assert any(p.user_id is not None for p in picks)
    finally:
        db.close()
