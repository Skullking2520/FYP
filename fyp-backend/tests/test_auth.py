from sqlalchemy.orm import Session
from app.database import Base, SessionLocal, engine
from app.models.jobs import Job
from app.models.skills import Skill


def reset_database() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

def test_register_login_and_profile_flow(client) -> None:
    reset_database()
    register_payload = {
        "email": "tester@example.com",
        "password": "SecretPass123",
        "name": "Test User",
        "age": 18,
        "country": "KR",
    }
    register_response = client.post("/auth/register", json=register_payload)
    assert register_response.status_code == 201
    created_user = register_response.json()
    assert created_user["email"] == register_payload["email"]

    login_payload = {"email": register_payload["email"], "password": register_payload["password"]}
    login_response = client.post("/auth/login", json=login_payload)
    assert login_response.status_code == 200
    token_body = login_response.json()
    assert token_body["token_type"] == "bearer"

    headers = {"Authorization": f"Bearer {token_body['access_token']}"}
    profile_response = client.get("/users/me", headers=headers)
    assert profile_response.status_code == 200
    profile = profile_response.json()
    assert profile["email"] == register_payload["email"]
    assert profile["is_admin"] is False

    update_payload = {"interests_text": "I love data and AI."}
    update_response = client.put("/users/me", json=update_payload, headers=headers)
    assert update_response.status_code == 200
    updated_profile = update_response.json()
    assert updated_profile["interests_text"] == update_payload["interests_text"]
    assert updated_profile["is_admin"] is False


def test_register_ignores_admin_fields(client) -> None:
    reset_database()
    register_payload = {
        "email": "evil@example.com",
        "password": "SecretPass123",
        "is_admin": True,
        "role": "admin",
    }
    register_response = client.post("/auth/register", json=register_payload)
    assert register_response.status_code == 201

    login_payload = {"email": register_payload["email"], "password": register_payload["password"]}
    login_response = client.post("/auth/login", json=login_payload)
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]

    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/users/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["is_admin"] is False

    # Admin endpoint must remain forbidden.
    stats = client.get("/admin/stats", headers=headers)
    assert stats.status_code == 403


def test_skill_extraction_and_job_recommendations(client) -> None:
    reset_database()
    seed_jobs()
    extraction_payload = {"user_text": "I enjoy advanced data analysis."}
    extraction_response = client.post("/recommend/nlp/extract-skills", json=extraction_payload)
    assert extraction_response.status_code == 200
    extraction_body = extraction_response.json()
    assert extraction_body["skills"]

    user_email = "matcher@example.com"
    register_payload = {"email": user_email, "password": "SecretPass123"}
    register_response = client.post("/auth/register", json=register_payload)
    assert register_response.status_code == 201
    token_response = client.post("/auth/login", json=register_payload)
    assert token_response.status_code == 200
    token = token_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    client.put("/users/me", json={"skills_text": "Data analysis and visualization"}, headers=headers)
    job_response = client.post("/recommend/jobs", json={"limit": 3}, headers=headers)
    assert job_response.status_code == 200
    jobs = job_response.json()
    assert jobs


def seed_jobs() -> None:
    session: Session = SessionLocal()
    skill = Skill(skill_name="data analysis", skill_id="skill-001")
    job = Job(
        job_title="Data Analyst",
        job_description="Performs data analysis and reporting",
        skills_required=[{"skill_name": "data analysis"}],
    )
    session.add(skill)
    session.add(job)
    session.commit()
    session.close()
