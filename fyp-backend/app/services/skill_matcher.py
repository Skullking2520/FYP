# skill_matcher.py
from typing import Sequence, Tuple
from sqlalchemy.orm import Session
from app.models.jobs import Job
from app.services.nlp_extractor import extract_skills_from_text


def normalize_skill_name(value: str) -> str:
    return value.strip().lower()


def tokenize_text(text: str) -> list[str]:
    if not text:
        return []
    tokens: list[str] = []
    current = []
    for char in text.lower():
        if char.isalnum() or char in {" ", "-"}:
            current.append(char if char != "-" else " ")
        else:
            current.append(" ")
    collapsed = "".join(current)
    for token in collapsed.split():
        cleaned = token.strip()
        if cleaned:
            tokens.append(cleaned)
    return tokens


def extract_user_skills(db: Session, texts: Sequence[str]) -> list[str]:
    skills: list[str] = []
    for text in texts:
        if not text:
            continue
        matches = extract_skills_from_text(db, text)
        for match in matches:
            name = match.get("skill_name")
            if name:
                normalized = normalize_skill_name(name)
                if normalized not in skills:
                    skills.append(normalized)
    if not skills:
        for text in texts:
            for token in tokenize_text(text):
                normalized = normalize_skill_name(token)
                if normalized not in skills:
                    skills.append(normalized)
    return skills


def compute_jaccard_score(first: set[str], second: set[str]) -> float:
    if not first or not second:
        return 0.0
    intersection = len(first & second)
    union = len(first | second)
    return intersection / union if union else 0.0


def score_job_fit(user_skills: list[str], job: Job) -> float:
    user_set = {normalize_skill_name(skill) for skill in user_skills if skill}
    job_skills = _extract_job_skills(job)
    return compute_jaccard_score(user_set, job_skills)


def recommend_jobs(db: Session, user_skills: list[str], limit: int = 5) -> list[Tuple[Job, float]]:
    jobs = db.query(Job).all()
    scored: list[Tuple[Job, float]] = []
    for job in jobs:
        score = score_job_fit(user_skills, job)
        if score > 0:
            scored.append((job, score))
    scored.sort(key=lambda item: item[1], reverse=True)
    return scored[:limit]


def _extract_job_skills(job: Job) -> set[str]:
    job_skills: set[str] = set()
    data = job.skills_required or []
    if isinstance(data, list):
        for entry in data:
            if isinstance(entry, dict):
                value = entry.get("skill_name") or entry.get("name")
            else:
                value = str(entry)
            if value:
                job_skills.add(normalize_skill_name(value))
    elif isinstance(data, dict):
        for value in data.values():
            if isinstance(value, str):
                job_skills.add(normalize_skill_name(value))
    if not job_skills and job.job_description:
        job_skills.update(normalize_skill_name(token) for token in tokenize_text(job.job_description))
    return job_skills
