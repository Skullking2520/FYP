from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


EducationStage = Literal["alevel", "olevel"]


class SubjectListResponse(BaseModel):
    items: list[str]
