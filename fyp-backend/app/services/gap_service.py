# gap_service.py
from app.schemas.recommendation import GapAnalysisResult


def analyze_gaps(required_skills: list[str], user_skills: list[str]) -> GapAnalysisResult:
    required_set = {skill.lower().strip() for skill in required_skills if skill}
    user_set = {skill.lower().strip() for skill in user_skills if skill}
    matching = sorted(required_set & user_set)
    missing = sorted(required_set - user_set)
    coverage = len(matching) / len(required_set) if required_set else 1.0
    return GapAnalysisResult(missing_skills=missing, matching_skills=matching, coverage_ratio=coverage)
