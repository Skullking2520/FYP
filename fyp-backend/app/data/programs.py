from functools import lru_cache
from typing import Iterable, List, Sequence
from pydantic import BaseModel, Field

from app.database import SessionLocal
from app.models.dataset_program import DatasetProgram

ProgramId = str


class Program(BaseModel):
    id: ProgramId
    name: str
    description: str
    tags: list[str] = Field(default_factory=list)
    focus_areas: list[str] = Field(default_factory=list)
    related_skills: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)

@lru_cache
def _program_cache() -> tuple[Program, ...]:
    with SessionLocal() as db:
        rows = db.query(DatasetProgram).all()
        return tuple(
            Program.model_validate(
                {
                    "id": row.program_id,
                    "name": row.name,
                    "description": row.description,
                    "tags": row.tags or [],
                    "focus_areas": row.focus_areas or [],
                    "related_skills": row.related_skills or [],
                    "keywords": row.keywords or [],
                }
            )
            for row in rows
        )


async def load_programs() -> list[Program]:
    return list(_program_cache())


def filter_programs(programs: Sequence[Program], predicate) -> list[Program]:
    return [program for program in programs if predicate(program)]


def search_programs(programs: Sequence[Program], query: str) -> list[Program]:
    needle = query.lower()
    return [
        program
        for program in programs
        if needle in program.name.lower()
        or any(needle in tag.lower() for tag in program.tags)
        or any(needle in keyword.lower() for keyword in program.keywords)
    ]


def unique_skills(programs: Iterable[Program]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for program in programs:
        for skill in program.related_skills:
            normalized = skill.lower().strip()
            if normalized and normalized not in seen:
                seen.add(normalized)
                ordered.append(normalized)
    return ordered


def get_program_by_id(programs: Sequence[Program], program_id: ProgramId) -> Program | None:
    for program in programs:
        if program.id == program_id:
            return program
    return None
