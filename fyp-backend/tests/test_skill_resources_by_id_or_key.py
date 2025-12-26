from __future__ import annotations


def test_skill_resources_accepts_numeric_skill_id(client) -> None:
    r = client.get("/api/skills/6452/resources", params={"top_k": 10})
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body, list)
    assert body, "expected at least one resource"


def test_skill_resources_accepts_esco_uri_path(client) -> None:
    # Ensure encoded URI (with slashes) is accepted by {skill_ref:path}
    uri = "http://data.europa.eu/esco/skill/2ee670aa-c687-4ff7-92eb-0abc9b57e5f2"
    r = client.get(f"/api/skills/{uri}/resources", params={"top_k": 10})
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body, list)
    assert body, "expected at least one resource"
