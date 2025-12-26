from __future__ import annotations


def test_job_search_empty_returns_empty_list(client) -> None:
    r = client.get("/api/jobs/search", params={"q": ""})
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body, list)
    assert body == []


def test_job_search_by_title_returns_ids(client) -> None:
    r = client.get("/api/jobs/search", params={"q": "software", "top_k": 10})
    assert r.status_code == 200
    body = r.json()

    assert isinstance(body, list)
    assert body, "expected at least one job result"

    item = body[0]
    assert set(["job_id", "title", "job_ref"]).issubset(item.keys())
    assert isinstance(item["job_id"], int)
    assert isinstance(item["title"], str)
    assert isinstance(item["job_ref"], str)
    assert item["job_ref"], "job_ref should not be empty"


def test_job_search_supports_name_param_alias(client) -> None:
    r = client.get("/api/jobs/search", params={"name": "analyst"})
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body, list)
    assert body, "expected at least one job result"
