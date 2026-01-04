from __future__ import annotations


def _register_and_login(client, email: str, password: str) -> str:
    r = client.post("/auth/register", json={"email": email, "password": password})
    assert r.status_code == 201
    r = client.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200
    return r.json()["access_token"]


def test_pathway_summary_available_under_api_prefix(client) -> None:
    token = _register_and_login(client, "pathway@example.com", "SecretPass123")
    headers = {"Authorization": f"Bearer {token}"}

    # Store structured skills first.
    put_resp = client.put(
        "/api/users/me/profile",
        json={"skills": [{"skill_key": "python", "level": 3}]},
        headers=headers,
    )
    assert put_resp.status_code == 200

    r = client.get("/api/users/me/pathway-summary", headers=headers)
    assert r.status_code == 200
    body = r.json()

    assert "skills" in body
    assert isinstance(body["skills"], list)
    assert body["skills"][0]["skill_key"] == "python"
    assert "desired_job" in body
    assert "recommended_major" in body
    assert "gaps" in body
    assert isinstance(body["gaps"], list)
