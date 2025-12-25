from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, status

from app.schemas.ml_recommend import (
    MajorOut,
    RecommendRequest,
    RecommendResponse,
    ResolvedSkillOut,
    JobOut,
)
from app.services.ml_recommender import recommend_jobs, recommend_majors, resolve_skill_labels


router = APIRouter(tags=["ml-recommend"])


@router.post("/recommend", response_model=RecommendResponse)
def recommend_endpoint(payload: RecommendRequest, request: Request) -> RecommendResponse:
    assets = getattr(request.app.state, "ml_assets", None)
    if assets is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="ML assets not loaded")

    # 1) Resolve label skills (if provided)
    skills_for_resolve = [(s.label.strip(), s.weight) for s in payload.skills if s.label and s.label.strip()]
    resolved = resolve_skill_labels(assets, skills_for_resolve, threshold=70) if skills_for_resolve else []

    resolved_uri_weights: dict[str, float] = {}
    for s in payload.skills:
        raw_label = (s.label or "").strip()
        if not raw_label:
            continue
        # Pick the best resolved match for this input label.
        candidates = [r for r in resolved if r.input == raw_label]
        if not candidates:
            continue
        best = max(candidates, key=lambda r: r.score)
        resolved_uri_weights[best.conceptUri] = max(resolved_uri_weights.get(best.conceptUri, 0.0), float(s.weight))

    # 2) Merge with explicit URIs (explicit URIs take precedence)
    final_skill_uris: dict[str, float] = dict(resolved_uri_weights)
    for uri, weight in payload.skill_uris.items():
        final_skill_uris[str(uri)] = float(weight)

    used_skill_uris = {uri for uri in final_skill_uris.keys() if uri in assets.skill_index}
    matched_skill_count = len(used_skill_uris)
    if matched_skill_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "matched_skill_count == 0",
                "resolved": [r.__dict__ for r in resolved],
                "matched_skill_count": matched_skill_count,
            },
        )

    jobs = recommend_jobs(assets, final_skill_uris, top_jobs=payload.top_jobs)
    majors = recommend_majors(assets, jobs, top_majors=payload.top_majors)

    return RecommendResponse(
        resolved=[ResolvedSkillOut(**r.__dict__) for r in resolved],
        matched_skill_count=matched_skill_count,
        jobs=[JobOut(**j.__dict__) for j in jobs],
        majors=[MajorOut(**m.__dict__) for m in majors],
    )
