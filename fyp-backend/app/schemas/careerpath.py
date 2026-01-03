from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.skill_level import SkillWithLevel


class SkillSearchItem(BaseModel):
    id: int
    skill_key: str
    name: str
    source: str | None = None
    dimension: str | None = None
    description: str | None = None


class JobDetail(BaseModel):
    id: int
    occupation_uid: str | None = None
    source: str | None = None
    onet_soc_code: str | None = None
    esco_uri: str | None = None
    title: str | None = None
    short_description: str | None = None
    description: str | None = None
    isco_group: str | None = None
    isco_code: str | None = None
    job_zone: int | None = None


class JobSearchItem(BaseModel):
    job_id: int
    title: str
    job_ref: str
    source: str | None = None
    esco_uri: str | None = None
    occupation_uid: str | None = None
    onet_soc_code: str | None = None


class LinkedMajor(BaseModel):
    # major_id can be None when we only have a name (e.g., ML/ESCO mapping but major table lookup not available).
    major_id: int | None = None
    major_name: str
    field: str | None = None
    description: str | None = None


class JobDetailWithMajor(BaseModel):
    job: JobDetail
    major: LinkedMajor | None = None


class JobSkillItem(BaseModel):
    skill_id: int = Field(description="skill.id")
    skill_key: str
    name: str
    dimension: str | None = None
    link_source: str | None = None
    relation_type: str | None = None
    importance: float | None = None
    skill_type: str | None = None


class RecommendJobsRequest(BaseModel):
    # Preferred (v2): include levels.
    skills: list[SkillWithLevel] = Field(default_factory=list, max_length=200)
    # Legacy (v1): string list (may include duplicates as a weight hack).
    skill_keys: list[str] = Field(default_factory=list, max_length=200)
    top_jobs: int = Field(default=5, ge=1, le=50)


class RecommendJobItem(BaseModel):
    job_id: int
    title: str | None = None
    source: str | None = None
    matched_skills: int
    score: float


class DBStats(BaseModel):
    job: int
    skill: int
    job_skill: int
    skill_tag: int


class RecommendMajorItem(BaseModel):
    major_id: int
    major_name: str
    field: str | None = None
    description: str | None = None
    matched_skills: int
    score: float


class MajorSkillItem(BaseModel):
    skill_id: int = Field(description="skill.id")
    skill_key: str
    name: str
    source: str | None = None
    dimension: str | None = None
    importance: float | None = None


class MajorSkillGapsRequest(BaseModel):
    # Preferred: skill_keys
    skill_keys: list[str] = Field(default_factory=list, max_length=200)
    # Legacy/compat: some clients send `skills: string[]`
    skills: list[str] = Field(default_factory=list, max_length=200)

    @classmethod
    def _clean_keys(cls, values: list[str]) -> list[str]:
        out: list[str] = []
        seen: set[str] = set()
        for v in values or []:
            key = (v or "").strip()
            if not key:
                continue
            k = key.lower()
            if k in seen:
                continue
            seen.add(k)
            out.append(key)
        return out

    def model_post_init(self, __context):
        # If the caller provided legacy `skills` but not `skill_keys`, map it across.
        if not self.skill_keys and self.skills:
            self.skill_keys = self._clean_keys(self.skills)
        else:
            self.skill_keys = self._clean_keys(self.skill_keys)


class MajorProgramItem(BaseModel):
    program_id: int
    program_name: str
    university_id: int
    university_name: str
    country: str | None = None
    degree_level: str | None = None
    subject_area: str | None = None
    qs_subject_rank: int | None = None
    matched_skills: int
    score: float
    rank_position: int | None = None
    rank_band: str | None = None
    ranking_source: str | None = None
    ranking_year: int | None = None


class SkillResourceItem(BaseModel):
    # Keep this schema compatible with the frontend's `BackendSkillResource` type.
    resource_id: int | None = None
    title: str
    provider: str = ""
    type: str = ""
    difficulty: str = ""
    estimated_hours: int | None = None
    url: str
    description: str | None = None

    # Extended fields (optional; used by new skill_resource_map contract)
    verification_status: str | None = None
    guidance_text: str | None = None
    priority: int | None = None
    difficulty_level: float | None = None


class SkillResolveItem(BaseModel):
    skill_key: str
    skill_name: str | None = None
    skill_description: str | None = None
    resolved: bool


class SkillResolveRequest(BaseModel):
    skill_keys: list[str] = Field(default_factory=list, max_length=500)


class SkillResolveResponse(BaseModel):
    items: list[SkillResolveItem]
