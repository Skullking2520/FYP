from functools import lru_cache
from typing import Sequence
from pydantic import BaseModel, Field

from app.database import SessionLocal
from app.models.dataset_job import DatasetJob


class JobResource(BaseModel):
    job_id: str
    job_title: str
    job_description: str
    skills_required: list[str] = Field(default_factory=list)
    weight: float = 1.0

@lru_cache
def _job_cache() -> tuple[JobResource, ...]:
    with SessionLocal() as db:
        rows = db.query(DatasetJob).all()
        return tuple(
            JobResource.model_validate(
                {
                    "job_id": row.job_id,
                    "job_title": row.job_title,
                    "job_description": row.job_description,
                    "skills_required": row.skills_required or [],
                    "weight": float(row.weight or 1.0),
                }
            )
            for row in rows
        )


async def load_job_resources() -> list[JobResource]:
    return list(_job_cache())


def get_job_by_id(jobs: Sequence[JobResource], job_id: str) -> JobResource | None:
    for job in jobs:
        if job.job_id == job_id:
            return job
    return None
