from __future__ import annotations

from app.database import SessionLocal
from app.models.jobs import Job
from app.models.recommendation_event import RecommendationEvent


def _register(client, *, email: str, password: str = "SecretPass123") -> None:
    r = client.post("/auth/register", json={"email": email, "password": password})
    assert r.status_code == 201


def _login(client, *, email: str, password: str = "SecretPass123") -> str:
    r = client.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200
    return r.json()["access_token"]


def test_admin_stats_requires_admin(client) -> None:
    _register(client, email="user@example.com")
    token = _login(client, email="user@example.com")
    r = client.get("/admin/stats", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 403


def test_selected_job_updates_stats(client) -> None:
    # Create admin user
    _register(client, email="admin@example.com")
    admin_token = _login(client, email="admin@example.com")

    # Create normal user
    _register(client, email="student@example.com")
    token = _login(client, email="student@example.com")

    # Create a job directly in the ORM DB so selection endpoint can validate it.
    with SessionLocal() as db:
        job = Job(
            job_title="Test Job",
            job_description="Looking for python and sql skills",
            skills_required=[{"skill_name": "python"}, {"skill_name": "sql"}],
        )
        db.add(job)
        db.commit()
        db.refresh(job)

    job_id = str(job.id)

    r = client.put(
        "/users/me/selected-job",
        json={"job_id": job_id, "job_title": "Selected"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200

    stats = client.get("/admin/stats", headers={"Authorization": f"Bearer {admin_token}"})
    assert stats.status_code == 200
    body = stats.json()
    assert "accounts_total" in body
    assert "job_selections_total" in body
    assert "top_jobs" in body
    assert "match_score_avg" in body
    assert "skill_reco_picks_series" in body

    assert body["job_selections_total"] == 1


def test_admin_skill_reco_picks_series_from_selected_job(client) -> None:
    _register(client, email="admin@example.com")
    admin_token = _login(client, email="admin@example.com")

    _register(client, email="student@example.com")
    token = _login(client, email="student@example.com")

    # Create a job directly in ORM DB (selection endpoint validation)
    with SessionLocal() as db:
        job = Job(
            job_title="Reco Pick Job",
            job_description="test",
            skills_required=[{"skill_name": "python"}],
        )
        db.add(job)
        db.commit()
        db.refresh(job)

        job_id = str(job.id)

        reco_id = "00000000-0000-0000-0000-000000000001"
        db.add(
            RecommendationEvent(
                recommendation_id=reco_id,
                user_id=None,
                source="skills",
                results=[
                    {"job_id": job_id, "rank": 1, "score": 0.9},
                    {"job_id": "999", "rank": 2, "score": 0.8},
                ],
                skills=[{"skill_key": "python", "level": 4}],
            )
        )
        db.commit()

    r = client.put(
        "/users/me/selected-job",
        json={"job_id": job_id, "job_title": "Selected", "recommendation_id": reco_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200

    stats = client.get("/admin/stats", headers={"Authorization": f"Bearer {admin_token}"})
    assert stats.status_code == 200
    body = stats.json()
    series = body.get("skill_reco_picks_series")
    assert isinstance(series, list)
    assert len(series) >= 1

    totals = sum(int(p.get("total_picks") or 0) for p in series)
    top1 = sum(int(p.get("top1_picks") or 0) for p in series)
    top5 = sum(int(p.get("top5_picks") or 0) for p in series)
    assert totals >= 1
    assert top1 >= 1
    assert top5 >= 1