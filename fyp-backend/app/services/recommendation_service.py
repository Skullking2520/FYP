# recommendation_service.py
from typing import Iterable
from app.data.jobs import JobResource, load_job_resources
from app.data.programs import Program, load_programs
from app.data.universities import load_university_programs
from app.schemas.profile import UserProfile
from app.schemas.recommendation import JobRecommendation, MajorRecommendation, ProgramRecommendation
from app.services.gap_service import analyze_gaps


def _tokenize_free_text(value: str | None) -> list[str]:
    if not value:
        return []
    sanitized = value.replace("\n", " ").replace(";", " ").replace(",", " ")
    return [part.strip() for part in sanitized.split() if part and part.strip()]


def _normalize_entries(values: Iterable[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for value in values:
        normalized = value.lower().strip()
        if normalized and normalized not in seen:
            seen.add(normalized)
            result.append(normalized)
    return result


def _collect_profile_tokens_and_weights(profile: UserProfile) -> dict[str, float]:
    weights: dict[str, float] = {}

    # Skills carry level-based weights.
    for s in profile.skills:
        key = (getattr(s, "skill_key", "") or "").strip().lower()
        if not key:
            continue
        w = float(getattr(s, "level", 0) + 1)
        weights[key] = max(weights.get(key, 0.0), w)

    # Other profile signals contribute with weight=1.
    for token in profile.interests:
        t = (token or "").strip().lower()
        if t:
            weights.setdefault(t, 1.0)
    for token in profile.desired_jobs:
        t = (token or "").strip().lower()
        if t:
            weights.setdefault(t, 1.0)

    for token in _tokenize_free_text(profile.hobbies):
        weights.setdefault(token.lower(), 1.0)
    for token in _tokenize_free_text(profile.self_intro):
        weights.setdefault(token.lower(), 1.0)
    for token in _tokenize_free_text(profile.subjects_note):
        weights.setdefault(token.lower(), 1.0)
    for token in _tokenize_free_text(profile.grades_note):
        weights.setdefault(token.lower(), 1.0)
    for token in _tokenize_free_text(profile.target_job):
        weights.setdefault(token.lower(), 1.0)

    return weights


def _resolve_limit(limit: int | None, default: int = 5) -> int:
    if not limit:
        return default
    return max(1, limit)


def _score_overlap(query_weights: dict[str, float], targets: Iterable[str]) -> float:
    if not query_weights:
        return 0.0
    target_set = {item.lower().strip() for item in targets if item}
    if not target_set:
        return 0.0
    overlap_weight = 0.0
    total_weight = 0.0
    for token, weight in query_weights.items():
        total_weight += float(weight)
        if token in target_set:
            overlap_weight += float(weight)
    return overlap_weight / total_weight if total_weight else 0.0


def _reason_tags(profile: UserProfile, program: Program, overlap_score: float) -> list[str]:
    tags: list[str] = []
    if overlap_score >= 0.5:
        tags.append("skills-match")
    if profile.math_level and "math" in program.keywords:
        tags.append("math-track")
    if profile.cs_experience and "ai" in [tag.lower() for tag in program.tags]:
        tags.append("ai-interest")
    return tags or ["baseline-fit"]


async def recommend_jobs(profile: UserProfile, limit: int | None = None) -> list[JobRecommendation]:
    jobs = await load_job_resources()
    query_weights = _collect_profile_tokens_and_weights(profile)
    scored: list[tuple[JobResource, float]] = []
    for job in jobs:
        score = _score_overlap(query_weights, job.skills_required)
        if score > 0:
            scored.append((job, score * job.weight))
    scored.sort(key=lambda item: item[1], reverse=True)
    limit_value = _resolve_limit(limit)
    return [
        JobRecommendation(
            job_id=job.job_id,
            job_title=job.job_title,
            job_description=job.job_description,
            score=round(score, 3),
            reason="Skill overlap" if score >= 0.3 else None,
        )
        for job, score in scored[:limit_value]
    ]


async def recommend_programs(profile: UserProfile, limit: int | None = None) -> list[MajorRecommendation]:
    programs = await load_programs()
    universities = await load_university_programs()
    query_weights = _collect_profile_tokens_and_weights(profile)
    results: list[MajorRecommendation] = []
    for program in programs:
        overlap = _score_overlap(query_weights, program.related_skills)
        if overlap <= 0:
            continue
        related_unis = [uni for uni in universities if uni.program_id == program.id]
        for uni in related_unis:
            gap = analyze_gaps(uni.required_skills, list(query_weights.keys()))
            score = round((overlap * 0.7) + (gap.coverage_ratio * 0.3), 3)
            results.append(
                MajorRecommendation(
                    major_id=program.id,
                    major_name=program.name,
                    university_name=uni.uni_name,
                    ranking=uni.rank,
                    score=score,
                    description=program.description,
                    reason=f"Matched {len(gap.matching_skills)} required skills",
                )
            )
    results.sort(key=lambda item: item.score, reverse=True)
    limit_value = _resolve_limit(limit)
    return results[:limit_value]


async def recommend_programs_from_profile(profile: UserProfile, limit: int | None = None) -> list[ProgramRecommendation]:
    programs = await load_programs()
    query_weights = _collect_profile_tokens_and_weights(profile)
    scored: list[tuple[Program, float, list[str]]] = []
    for program in programs:
        overlap = _score_overlap(query_weights, program.related_skills or program.keywords)
        if overlap <= 0:
            continue
        tags = _reason_tags(profile, program, overlap)
        scored.append((program, overlap, tags))
    scored.sort(key=lambda item: item[1], reverse=True)
    limit_value = _resolve_limit(limit)
    return [
        ProgramRecommendation(program=program, score=round(score, 3), reason_tags=tags)
        for program, score, tags in scored[:limit_value]
    ]
