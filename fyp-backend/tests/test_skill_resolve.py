from __future__ import annotations


def test_skill_resolve_get_accepts_numeric_id(client) -> None:
    r = client.get("/api/skills/resolve", params={"skill_key": "6452"})
    assert r.status_code == 200
    body = r.json()
    assert body["skill_key"]
    assert "resolved" in body
    assert "skill_name" in body


def test_skill_resolve_get_accepts_esco_uri(client) -> None:
    uri = "http://data.europa.eu/esco/skill/2ee670aa-c687-4ff7-92eb-0abc9b57e5f2"
    r = client.get("/api/skills/resolve", params={"skill_key": uri})
    assert r.status_code == 200
    body = r.json()
    assert body["skill_key"]
    assert "resolved" in body
    assert "skill_name" in body


def test_skill_resolve_post_batch(client) -> None:
    uri = "http://data.europa.eu/esco/skill/2ee670aa-c687-4ff7-92eb-0abc9b57e5f2"
    r = client.post("/api/skills/resolve", json={"skill_keys": ["6452", uri, ""]})
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body.get("items"), list)
    assert len(body["items"]) == 3
    assert all("skill_key" in it and "resolved" in it and "skill_name" in it for it in body["items"])
