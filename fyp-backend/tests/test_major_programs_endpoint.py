import app.api.routes.majors as majors_routes

from app.db.mysql import DatabaseQueryError


def test_major_programs_returns_list_when_empty(client, monkeypatch) -> None:
    # Avoid hitting MySQL in tests; just validate handler always returns a list.
    monkeypatch.setattr(majors_routes, "_major_exists", lambda _major_id: True)
    monkeypatch.setattr(majors_routes, "query", lambda _sql, _params=None: [])

    r = client.get("/api/majors/10/programs", params={"top_k": 3})
    assert r.status_code == 200
    assert r.json() == []


def test_major_programs_returns_list_on_query_error(client, monkeypatch) -> None:
    monkeypatch.setattr(majors_routes, "_major_exists", lambda _major_id: True)

    def _boom(_sql, _params=None):
        raise DatabaseQueryError("boom")

    monkeypatch.setattr(majors_routes, "query", _boom)

    r = client.get("/api/majors/10/programs", params={"top_k": 3})
    assert r.status_code == 200
    assert r.json() == []
