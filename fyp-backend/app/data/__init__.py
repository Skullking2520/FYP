# __init__.py
from app.data.programs import Program, ProgramId, load_programs
from app.data.universities import UniversityId, UniversityProgram, load_university_programs
from app.data.resources import SkillResource, load_skill_resources
from app.data.jobs import JobResource, load_job_resources

__all__ = [
    "Program",
    "ProgramId",
    "load_programs",
    "UniversityId",
    "UniversityProgram",
    "load_university_programs",
    "SkillResource",
    "load_skill_resources",
    "JobResource",
    "load_job_resources",
]
