from __future__ import annotations


def test_job_detail_with_major_esco_uri_returns_major_name(client):
    # In unit tests, MySQL is patched and the DB job table is usually empty.
    # We use an ESCO occupation URI so the endpoint can return a stub job,
    # and the major can be resolved via startup-cached ML metadata mapping.
    occ_uri = "http://data.europa.eu/esco/occupation/00030d09-2b3a-4efd-87cc-c4ea39d27c34"

    r = client.get(f"/api/jobs/{occ_uri}/detail")
    assert r.status_code == 200

    payload = r.json()
    assert "job" in payload
    assert "major" in payload

    assert payload["job"].get("esco_uri") == occ_uri
    assert payload["major"] is not None
    assert payload["major"].get("major_name")
