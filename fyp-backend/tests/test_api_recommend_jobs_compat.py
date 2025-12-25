from __future__ import annotations

import re


_SKILL_URI_RE = re.compile(r"^https?://data\.europa\.eu/esco/skill/[0-9a-fA-F-]{36}$")


def test_api_recommend_jobs_compat_ok(client) -> None:
    payload = {
        "skills": [
            {"skill_key": "Skill 0", "level": 4},
            {"skill_key": "Alt1", "level": 1},
        ],
        "top_jobs": 5,
    }
    r = client.post("/api/recommend/jobs", json=payload)
    assert r.status_code == 200

    body = r.json()
    assert isinstance(body, list)
    assert body, "expected at least one job result"

    item = body[0]
    assert set(["job_id", "title", "score"]).issubset(item.keys())
    assert isinstance(item["job_id"], str)
    assert isinstance(item["title"], str)
    assert isinstance(item["score"], (int, float))

    # Optional fields
    if "source" in item and item["source"] is not None:
        assert isinstance(item["source"], str)
    if "matched_skills" in item and item["matched_skills"] is not None:
        assert isinstance(item["matched_skills"], list)
        assert all(isinstance(s, str) for s in item["matched_skills"])
        assert any(_SKILL_URI_RE.match(s) for s in item["matched_skills"])


def test_api_recommend_jobs_compat_empty_skill_keys_400(client) -> None:
    r = client.post("/api/recommend/jobs", json={"skill_keys": []})
    assert r.status_code == 400


def test_api_recommend_jobs_compat_legacy_skill_keys_ok(client) -> None:
    # Legacy payload is still accepted for backward compatibility.
    payload = {"skill_keys": ["Skill 0", "Alt1"], "top_jobs": 5}
    r = client.post("/api/recommend/jobs", json=payload)
    assert r.status_code == 200
