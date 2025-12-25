# profile_service.py
from typing import Any, Iterable
from sqlalchemy.orm import Session
from app.models.profile import UserProfileModel
from app.models.user import User
from app.schemas.profile import UserProfile
from app.schemas.skill_level import SkillWithLevel


def build_user_profile(raw: dict[str, Any] | UserProfile | None) -> UserProfile:
    if isinstance(raw, UserProfile):
        return raw
    if not raw:
        return UserProfile()
    return UserProfile(**raw)


def get_user_profile(db: Session, user_id: int) -> UserProfile | None:
    record = db.query(UserProfileModel).filter(UserProfileModel.user_id == user_id).first()
    if not record:
        return None
    return build_user_profile(record.profile_data)


def save_user_profile(db: Session, user_id: int, profile: UserProfile) -> UserProfile:
    payload = profile.model_dump()
    record = db.query(UserProfileModel).filter(UserProfileModel.user_id == user_id).first()
    if record:
        record.profile_data = payload
    else:
        record = UserProfileModel(user_id=user_id, profile_data=payload)
        db.add(record)
    db.commit()
    db.refresh(record)
    return build_user_profile(record.profile_data)


def merge_profiles(base: UserProfile | None, overrides: UserProfile) -> UserProfile:
    origin = base or UserProfile()
    merged = origin.model_copy(update=overrides.model_dump(exclude_unset=True))
    return merged


def _tokenize_text(value: str | None) -> list[str]:
    if not value:
        return []
    sanitized = value.replace("\n", ",").replace(";", ",")
    parts = [part.strip() for part in sanitized.split(",") if part and part.strip()]
    if len(parts) <= 1:
        parts = [part.strip() for part in value.split() if part and part.strip()]
    return [part for part in parts if part]


def _merge_unique(existing: Iterable[str], additions: Iterable[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for item in list(existing) + list(additions):
        normalized = item.strip()
        if not normalized:
            continue
        key = normalized.lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(normalized)
    return result


def _normalize_skill_key(value: str) -> str:
    return (value or "").strip()


def _skills_from_strings(values: Iterable[str]) -> list[SkillWithLevel]:
    result: list[SkillWithLevel] = []
    for value in values:
        key = _normalize_skill_key(value)
        if not key:
            continue
        result.append(SkillWithLevel(skill_key=key, level=0))
    return result


def _merge_skills(existing: Iterable[SkillWithLevel], additions: Iterable[SkillWithLevel]) -> list[SkillWithLevel]:
    merged: list[SkillWithLevel] = []
    by_key: dict[str, SkillWithLevel] = {}
    order: list[str] = []

    for item in list(existing) + list(additions):
        key = _normalize_skill_key(getattr(item, "skill_key", ""))
        if not key:
            continue
        norm = key.lower()
        level = int(getattr(item, "level", 0) or 0)
        level = max(0, min(5, level))
        if norm not in by_key:
            order.append(norm)
            by_key[norm] = SkillWithLevel(skill_key=key, level=level)
        else:
            # Keep the highest level for the same skill.
            if level > by_key[norm].level:
                by_key[norm] = SkillWithLevel(skill_key=by_key[norm].skill_key, level=level)

    for norm in order:
        merged.append(by_key[norm])
    return merged


async def get_profile_for_user(db: Session, user: User) -> UserProfile:
    stored = get_user_profile(db, user.id)
    if stored:
        return stored
    fallback = UserProfile(
        interests=_tokenize_text(user.interests_text),
        skills=_skills_from_strings(_tokenize_text(user.skills_text)),
        country=user.country,
        age=user.age,
    )
    return fallback


async def get_user_profile_for_recommendations(
    base_profile: UserProfile,
    extra_interests: str | None,
    extra_skills_text: str | None,
    extra_skills_list: list[str] | None,
) -> UserProfile:
    interests = _merge_unique(base_profile.interests, _tokenize_text(extra_interests))
    inferred_skills = _skills_from_strings(_tokenize_text(extra_skills_text))
    explicit_skills = _skills_from_strings(extra_skills_list or [])
    skills = _merge_skills(base_profile.skills, inferred_skills + explicit_skills)
    return base_profile.model_copy(update={"interests": interests, "skills": skills})
