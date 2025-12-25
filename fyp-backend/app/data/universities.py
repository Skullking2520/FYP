from functools import lru_cache
from typing import Sequence
from pydantic import BaseModel, Field

from app.database import SessionLocal
from app.models.dataset_university_program import DatasetUniversityProgram

UniversityId = str


class UniversityProgram(BaseModel):
    uni_id: UniversityId
    uni_name: str
    program_id: str
    program_url: str
    rank: int | None = None
    required_skills: list[str] = Field(default_factory=list)
    entry_requirements: list[str] = Field(default_factory=list)
    country: str | None = None
    subject_strength: str | None = None

@lru_cache
def _university_cache() -> tuple[UniversityProgram, ...]:
    with SessionLocal() as db:
        rows = db.query(DatasetUniversityProgram).all()
        return tuple(
            UniversityProgram.model_validate(
                {
                    "uni_id": row.uni_id,
                    "uni_name": row.uni_name,
                    "program_id": row.program_id,
                    "program_url": row.program_url,
                    "rank": row.rank,
                    "required_skills": row.required_skills or [],
                    "entry_requirements": row.entry_requirements or [],
                    "country": row.country,
                    "subject_strength": row.subject_strength,
                }
            )
            for row in rows
        )


async def load_university_programs() -> list[UniversityProgram]:
    return list(_university_cache())


def get_universities_by_program_id(universities: Sequence[UniversityProgram], program_id: str) -> list[UniversityProgram]:
    return [item for item in universities if item.program_id == program_id]


def get_university_by_id(universities: Sequence[UniversityProgram], uni_id: UniversityId) -> UniversityProgram | None:
    for item in universities:
        if item.uni_id == uni_id:
            return item
    return None
