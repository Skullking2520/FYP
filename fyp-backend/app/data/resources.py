from functools import lru_cache
from typing import Sequence
from pydantic import BaseModel

from app.database import SessionLocal
from app.models.dataset_skill_resource import DatasetSkillResource


class SkillResource(BaseModel):
    skill: str
    title: str
    url: str

@lru_cache
def _skill_cache() -> tuple[SkillResource, ...]:
    with SessionLocal() as db:
        rows = db.query(DatasetSkillResource).all()
        return tuple(
            SkillResource.model_validate({"skill": row.skill, "title": row.title, "url": row.url})
            for row in rows
        )


async def load_skill_resources() -> list[SkillResource]:
    return list(_skill_cache())


def get_skill_titles(resources: Sequence[SkillResource], skill_names: list[str]) -> list[SkillResource]:
    lookup = {item.skill.lower(): item for item in resources}
    result: list[SkillResource] = []
    for skill in skill_names:
        key = skill.lower()
        if key in lookup:
            result.append(lookup[key])
    return result
