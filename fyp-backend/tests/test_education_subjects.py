from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database import SessionLocal
from app.models.education_subject import EducationSubject, EducationSubjectSkillMap


def _seed(db: Session) -> None:
    subj = EducationSubject(stage="alevel", name="Mathematics")
    db.add(subj)
    db.commit()
    db.refresh(subj)
    db.add(EducationSubjectSkillMap(subject_id=subj.id, skill_key="math", base_level=0))
    db.add(EducationSubjectSkillMap(subject_id=subj.id, skill_key="problem solving", base_level=1))
    db.commit()


def test_list_subjects_no_query(client) -> None:
    with SessionLocal() as db:
        _seed(db)

    r = client.get("/api/education/subjects", params={"stage": "alevel"})
    assert r.status_code == 200
    body = r.json()
    assert "items" in body
    assert isinstance(body["items"], list)
    assert any(isinstance(x, str) and x for x in body["items"])


def test_search_subjects_query(client) -> None:
    with SessionLocal() as db:
        _seed(db)

    r = client.get("/api/education/subjects", params={"q": "math", "stage": "alevel"})
    assert r.status_code == 200
    items = r.json()["items"]
    assert any("math" in x.lower() for x in items)


def test_subjects_stage_filter(client) -> None:
    with SessionLocal() as db:
        _seed(db)

    r = client.get("/api/education/subjects", params={"stage": "alevel"})
    assert r.status_code == 200
    items = r.json()["items"]
    assert "Mathematics" in items


def test_subjects_limit(client) -> None:
    with SessionLocal() as db:
        _seed(db)

    r = client.get("/api/education/subjects", params={"stage": "alevel", "limit": 1})
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) == 1


def test_subject_mapped_skills_from_grade(client) -> None:
    with SessionLocal() as db:
        _seed(db)

    r = client.get(
        "/api/education/subjects/mapped-skills",
        params={"stage": "alevel", "subject": "Mathematics", "grade": "A*"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["stage"] == "alevel"
    assert body["subject"] == "Mathematics"
    assert body["level"] == 5
    assert any(s["skill_key"] == "math" for s in body["skills"])


def test_subject_mapped_skills_missing_mapping_table_returns_503(client) -> None:
    with SessionLocal() as db:
        subj = EducationSubject(stage="alevel", name="Mathematics")
        db.add(subj)
        db.commit()

        # Simulate a schema drift: mapping table has been dropped/renamed.
        db.execute(text("DROP TABLE education_subject_skill_map"))
        db.commit()

    r = client.get(
        "/api/education/subjects/mapped-skills",
        params={"stage": "alevel", "subject": "Mathematics", "grade": "A"},
    )
    assert r.status_code == 503
    assert "education_subject_skill_map" in r.text
