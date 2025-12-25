from __future__ import annotations

from pydantic import BaseModel, Field


class SkillWithLevel(BaseModel):
    skill_key: str = Field(min_length=1, description="Normalized skill key/label")
    level: int = Field(ge=0, le=5, description="0..5 (inclusive)")

    def weight(self) -> float:
        # Spec: w = level + 1 (so level=0 still contributes)
        return float(self.level + 1)
