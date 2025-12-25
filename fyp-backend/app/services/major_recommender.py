# major_recommender.py
from typing import Sequence, Tuple
from sqlalchemy.orm import Session
from app.models.majors import Major
from app.services.skill_matcher import compute_jaccard_score, normalize_skill_name, tokenize_text


def build_user_terms(skills: list[str], texts: Sequence[str]) -> set[str]:
    terms: set[str] = set(normalize_skill_name(skill) for skill in skills if skill)
    for text in texts:
        for token in tokenize_text(text):
            terms.add(normalize_skill_name(token))
    return terms


def recommend_majors(db: Session, skills: list[str], texts: Sequence[str], limit: int = 5) -> list[Tuple[Major, float]]:
    user_terms = build_user_terms(skills, texts)
    majors = db.query(Major).all()
    scored: list[Tuple[Major, float]] = []
    for major in majors:
        score = _score_major(user_terms, major)
        if score > 0:
            scored.append((major, score))
    scored.sort(key=lambda item: item[1], reverse=True)
    return scored[:limit]


def _score_major(user_terms: set[str], major: Major) -> float:
    major_terms = set()
    major_terms.update(normalize_skill_name(token) for token in tokenize_text(major.description or ""))
    major_terms.update(normalize_skill_name(token) for token in tokenize_text(major.keywords or ""))
    base_score = compute_jaccard_score(user_terms, major_terms)
    ranking_bonus = 0.0
    if major.ranking and major.ranking > 0:
        ranking_bonus = 1 / major.ranking
    return base_score * 0.7 + ranking_bonus * 0.3
