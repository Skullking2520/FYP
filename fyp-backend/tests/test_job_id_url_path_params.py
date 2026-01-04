from __future__ import annotations

from urllib.parse import quote


def test_job_get_accepts_occupation_uri_in_path(client) -> None:
    # Backend contract: job_id must be passed as a single encoded path segment.
    occ_uri = "http://data.europa.eu/esco/occupation/00030d09-2b3a-4efd-87cc-c4ea39d27c34"

    encoded = quote(occ_uri, safe="")
    r = client.get(f"/api/jobs/{encoded}")
    assert r.status_code == 200
    body = r.json()
    assert body.get("title")


def test_job_skills_accepts_occupation_uri_in_path(client) -> None:
    # Backend contract: job_id must be passed as a single encoded path segment.
    occ_uri = "http://data.europa.eu/esco/occupation/00030d09-2b3a-4efd-87cc-c4ea39d27c34"

    encoded = quote(occ_uri, safe="")
    r = client.get(f"/api/jobs/{encoded}/skills")
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body, list)


def test_job_get_accepts_double_encoded_job_id(client) -> None:
    occ_uri = "http://data.europa.eu/esco/occupation/00030d09-2b3a-4efd-87cc-c4ea39d27c34"
    double_encoded = quote(quote(occ_uri, safe=""), safe="")

    r = client.get(f"/api/jobs/{double_encoded}")
    assert r.status_code == 200
    body = r.json()
    assert body.get("esco_uri") == occ_uri
