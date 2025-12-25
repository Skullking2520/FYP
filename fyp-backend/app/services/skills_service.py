# skills_service.py
import re
from typing import Iterable
from app.data.resources import SkillResource, load_skill_resources
from app.schemas.skills import ExtractedSkill


async def extract_skills_from_text(text: str) -> list[ExtractedSkill]:
    corpus = text.lower()
    resources = await load_skill_resources()
    matches: list[ExtractedSkill] = []
    for resource in resources:
        if resource.skill.lower() in corpus:
            matches.append(ExtractedSkill(skill_name=resource.skill, source=resource.title))
    if matches:
        return matches
    fallback = _tokenize(corpus)
    return [ExtractedSkill(skill_name=token) for token in fallback]


def build_skill_summary(resources: Iterable[SkillResource], selected: list[str]) -> list[ExtractedSkill]:
    lookup = {item.skill.lower(): item for item in resources}
    summary: list[ExtractedSkill] = []
    for skill in selected:
        normalized = skill.lower()
        if normalized in lookup:
            entry = lookup[normalized]
            summary.append(ExtractedSkill(skill_name=entry.skill, source=entry.title))
        else:
            summary.append(ExtractedSkill(skill_name=skill))
    return summary


def _tokenize(text: str) -> list[str]:
    tokens = re.findall(r"[a-zA-Z][a-zA-Z0-9+]+", text)
    seen: set[str] = set()
    ordered: list[str] = []
    for token in tokens:
        normalized = token.lower()
        if normalized not in seen:
            seen.add(normalized)
            ordered.append(normalized)
    return ordered[:5]
