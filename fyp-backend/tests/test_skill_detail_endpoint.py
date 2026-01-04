from __future__ import annotations

from urllib.parse import quote


def test_skill_detail_endpoint_returns_category_dimension_description(client, monkeypatch) -> None:
    from app.api.routes import careerpath as careerpath_routes

    def fake_query_one(sql: str, params=None):
        sql_l = " ".join((sql or "").lower().split())
        if "from skill s" in sql_l:
            return {
                "id": 1,
                "skill_key": "python",
                "name": "Python",
                "source": "TEST",
                "dimension": "skill/competence",
                "category": None,
                "description": "",
            }
        return None

    monkeypatch.setattr(careerpath_routes, "query_one", fake_query_one)

    r = client.get("/api/skills/python")
    assert r.status_code == 200
    body = r.json()
    assert "category" in body
    assert "dimension" in body
    assert "description" in body
    assert body["category"] == "skill/competence"
    assert body["dimension"] == "skill/competence"
    assert body["description"] is None


def test_skill_detail_endpoint_accepts_esco_skill_uri_in_path(client, monkeypatch) -> None:
    from app.api.routes import careerpath as careerpath_routes

    uri = "http://data.europa.eu/esco/skill/2ee670aa-c687-4ff7-92eb-0abc9b57e5f2"

    def fake_query_one(sql: str, params=None):
        sql_l = " ".join((sql or "").lower().split())
        if "from skill s" in sql_l:
            return None
        if "from esco_skills" in sql_l:
            return {
                "id": 123,
                "skill_key": uri,
                "name": "Machine learning",
                "source": "ESCO",
                "dimension": "skill/competence",
                "category": "skill/competence",
                "description": "A short description",
            }
        return None

    monkeypatch.setattr(careerpath_routes, "query_one", fake_query_one)

    encoded = quote(uri, safe="")
    r = client.get(f"/api/skills/{encoded}")
    assert r.status_code == 200
    body = r.json()
    assert body["skill_key"] == uri
    assert body.get("category")
    assert body.get("dimension")
    assert body.get("description")


def test_skill_detail_query_endpoint_accepts_esco_skill_uri(client, monkeypatch) -> None:
    from app.api.routes import careerpath as careerpath_routes

    uri = "http://data.europa.eu/esco/skill/2ee670aa-c687-4ff7-92eb-0abc9b57e5f2"

    def fake_query_one(sql: str, params=None):
        sql_l = " ".join((sql or "").lower().split())
        if "from skill s" in sql_l:
            return None
        if "from esco_skills" in sql_l:
            return {
                "id": 123,
                "skill_key": uri,
                "name": "Machine learning",
                "source": "ESCO",
                "dimension": "skill/competence",
                "category": None,
                "description": "A short description",
            }
        return None

    monkeypatch.setattr(careerpath_routes, "query_one", fake_query_one)

    encoded = quote(uri, safe="")
    r = client.get(f"/api/skills/detail?skill_ref={encoded}")
    assert r.status_code == 200
    body = r.json()
    assert body["skill_key"] == uri
    assert body.get("category") == "skill/competence"
    assert body.get("dimension") == "skill/competence"
    assert body.get("description")


def test_legacy_skill_get_endpoint_accepts_esco_uri(client, monkeypatch) -> None:
    from app.api.routes import careerpath as careerpath_routes

    uri = "http://data.europa.eu/esco/skill/2ee670aa-c687-4ff7-92eb-0abc9b57e5f2"

    def fake_query_one(sql: str, params=None):
        sql_l = " ".join((sql or "").lower().split())
        if "from skill s" in sql_l:
            return None
        if "from esco_skills" in sql_l:
            return {
                "id": 123,
                "skill_key": uri,
                "name": "Machine learning",
                "source": "ESCO",
                "dimension": "skill/competence",
                "category": "skill/competence",
                "description": "A short description",
            }
        return None

    monkeypatch.setattr(careerpath_routes, "query_one", fake_query_one)

    encoded = quote(uri, safe="")
    r = client.get(f"/api/legacy/skills/get?skill_key={encoded}")
    assert r.status_code == 200
    body = r.json()
    assert body["skill_key"] == uri
    assert body.get("category")
    assert body.get("dimension")


def test_legacy_skill_detail_endpoint_accepts_esco_uri(client, monkeypatch) -> None:
    from app.api.routes import careerpath as careerpath_routes

    uri = "http://data.europa.eu/esco/skill/2ee670aa-c687-4ff7-92eb-0abc9b57e5f2"

    def fake_query_one(sql: str, params=None):
        sql_l = " ".join((sql or "").lower().split())
        if "from skill s" in sql_l:
            return None
        if "from esco_skills" in sql_l:
            return {
                "id": 123,
                "skill_key": uri,
                "name": "Machine learning",
                "source": "ESCO",
                "dimension": "skill/competence",
                "category": None,
                "description": "A short description",
            }
        return None

    monkeypatch.setattr(careerpath_routes, "query_one", fake_query_one)

    encoded = quote(uri, safe="")
    r = client.get(f"/api/legacy/skills/detail?skill_key={encoded}")
    assert r.status_code == 200
    body = r.json()
    assert body["skill_key"] == uri
    assert body.get("category") == "skill/competence"
