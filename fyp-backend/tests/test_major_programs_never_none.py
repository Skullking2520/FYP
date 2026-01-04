from __future__ import annotations


def test_major_programs_returns_list_not_none(client, monkeypatch) -> None:
    from app.api.routes import majors as majors_routes

    # Avoid hitting real MySQL in unit tests.
    monkeypatch.setattr(majors_routes, "query_one", lambda *args, **kwargs: None)
    monkeypatch.setattr(majors_routes, "query", lambda *args, **kwargs: [])

    r = client.get("/api/majors/999999/programs?top_k=5")
    assert r.status_code == 200
    body = r.json()
    assert body == []
