# program.py
from pydantic import ConfigDict
from app.data.programs import Program as ProgramRecord
from app.data.resources import SkillResource as SkillResourceRecord
from app.data.universities import UniversityProgram as UniversityProgramRecord


class Program(ProgramRecord):
    model_config = ConfigDict(from_attributes=True)


class UniversityProgram(UniversityProgramRecord):
    model_config = ConfigDict(from_attributes=True)


class SkillResource(SkillResourceRecord):
    model_config = ConfigDict(from_attributes=True)
