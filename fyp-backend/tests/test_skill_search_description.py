from __future__ import annotations

import pytest


def test_skills_search_description_empty_becomes_null(client, monkeypatch: pytest.MonkeyPatch):
    # Patch the careerpath module-level query function used by the endpoint.
    from app.api.routes import careerpath as careerpath_routes

    def fake_query(sql: str, params=None):
        return [
            {
                "id": 1,
                "skill_key": "k1",
                "name": "Skill 1",
                "source": "TEST",
                "dimension": None,
                "description": "   ",
            }
        ]

    monkeypatch.setattr(careerpath_routes, "query", fake_query)

    resp = client.get("/api/skills/search", params={"q": "Skill"})
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list) and data
    assert data[0].get("description") is None
