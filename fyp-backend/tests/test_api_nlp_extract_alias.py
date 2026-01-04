from __future__ import annotations


def test_api_nlp_extract_skills_alias(client) -> None:
    r = client.post("/api/recommend/nlp/extract-skills", json={"user_text": "I enjoy data analysis"})
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body.get("skills"), list)
