# nlp_extractor.py
import time
from typing import Any
from sqlalchemy.orm import Session
from app.models.skills import Skill


MAX_ATTEMPTS = 3
INITIAL_DELAY_SECONDS = 0.5


def extract_skills_from_text(db: Session, text: str) -> list[dict[str, Any]]:
    delay = INITIAL_DELAY_SECONDS
    last_error: Exception | None = None
    for attempt in range(MAX_ATTEMPTS):
        try:
            return _match_local_skills(db, text)
        except Exception as exc:
            last_error = exc
            if attempt == MAX_ATTEMPTS - 1:
                break
            time.sleep(delay)
            delay *= 2
    if last_error:
        raise last_error
    return []


def _match_local_skills(db: Session, text: str) -> list[dict[str, Any]]:
    if not text:
        return []
    normalized_text = text.lower()
    skills = db.query(Skill).all()
    matches: list[dict[str, Any]] = []
    for skill in skills:
        name = skill.skill_name or ""
        if name.lower() in normalized_text:
            matches.append({"skill_name": skill.skill_name, "skill_id": skill.skill_id})
    return matches
