# skills.py
from pydantic import BaseModel, Field


class ExtractSkillsRequest(BaseModel):
    text: str = Field(min_length=1)


class ExtractedSkill(BaseModel):
    skill_name: str
    source: str | None = None


class ExtractSkillsResponse(BaseModel):
    skills: list[ExtractedSkill]
