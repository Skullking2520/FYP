from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient


def pytest_configure() -> None:
    # Ensure the SQLAlchemy engine is created against sqlite for tests.
    os.environ.setdefault("DB_URL", "sqlite:///./test.db")
    os.environ["ORM_DB_URL"] = "sqlite:///./test.db"
    os.environ["ORM_USE_MYSQL"] = "false"
    os.environ.setdefault("ADMIN_EMAILS", '["admin@example.com"]')

    # Ensure local .env cannot force SQL-only behavior in tests.
    os.environ["ENVIRONMENT"] = "test"
    os.environ["SQL_STRICT"] = "false"


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch) -> Any:
    # Ensure admin check can be exercised in tests.
    monkeypatch.setenv("ADMIN_EMAILS", '["admin@example.com"]')

    # Patch MySQL metadata loader to avoid requiring a running MySQL instance in unit tests.
    # The production code still loads metadata from MySQL at startup.
    from app.database import Base, engine
    from app.main import create_app
    from app.db import mysql as mysql_db

    ml_dir = Path(__file__).resolve().parents[1] / "app" / "ml_assets"
    skill_index_path = ml_dir / "skill_index.json"
    raw_skill_index = json.loads(skill_index_path.read_text(encoding="utf-8"))
    skill_uris = list(raw_skill_index.keys()) if isinstance(raw_skill_index, dict) else list(raw_skill_index)
    skill_uris = [str(u) for u in skill_uris[:50]]

    # Load model to obtain occupation URIs for stable majors aggregation.
    try:
        import joblib

        model = joblib.load(ml_dir / "job_recommender_fast.pkl")
        classes = getattr(model, "classes_", [])
        occ_uris = [c.decode("utf-8") if isinstance(c, (bytes, bytearray)) else str(c) for c in classes]
    except Exception:
        occ_uris = ["http://data.europa.eu/esco/occupation/00030d09-2b3a-4efd-87cc-c4ea39d27c34"]

    major_name = "Computer Science"

    def fake_query(sql: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        sql_l = " ".join((sql or "").lower().split())
        if "from skills" in sql_l:
            rows: list[dict[str, Any]] = []
            for i, uri in enumerate(skill_uris[:20]):
                rows.append(
                    {
                        "skill_uri": uri,
                        "preferred_label": f"Skill {i}",
                        "alt_labels": f"Skill Alias {i};Alt{i}",
                    }
                )
            return rows

        if "from occupations" in sql_l:
            return [{"occ_uri": occ, "preferred_label": f"Occupation {i}"} for i, occ in enumerate(occ_uris)]

        if "from major_occupation_map" in sql_l:
            return [{"major_name": major_name, "occ_uri": occ} for occ in occ_uris]

        if "from majors" in sql_l:
            return [{"major_name": major_name}]

        return []

    monkeypatch.setattr(mysql_db, "query", fake_query)

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    app = create_app()
    with TestClient(app) as c:
        yield c
