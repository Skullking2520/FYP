from __future__ import annotations


def test_skills_search_returns_dimension_when_available(client, monkeypatch) -> None:
    # Force the skill-table path (not ESCO fallback) and include a dimension value.
    from app.api.routes import careerpath as careerpath_routes

    def fake_query(sql: str, params=None):
        sql_l = " ".join((sql or "").lower().split())
        if "from skill s" in sql_l:
            return [
                {
                    "id": 123,
                    "skill_key": "python",
                    "name": "Python",
                    "source": "TEST",
                    "dimension": "skill/competence",
                    "category": None,
                    "description": None,
                }
            ]
        return []

    monkeypatch.setattr(careerpath_routes, "query", fake_query)

    r = client.get("/api/skills/search", params={"q": "python"})
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list) and items
    assert items[0].get("dimension") == "skill/competence"
    assert items[0].get("category") == "skill/competence"
