from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass
from pathlib import Path
import csv
from pathlib import Path
from typing import Any

import numpy as np

from app.db import mysql as mysql_db
from app.config import is_sql_strict_mode, settings


try:
    import joblib  # type: ignore
except Exception:  # pragma: no cover
    joblib = None


try:
    from rapidfuzz import fuzz, process  # type: ignore
except Exception as exc:  # pragma: no cover
    raise RuntimeError(
        "rapidfuzz is required for skill resolving. Install it with 'pip install rapidfuzz'."
    ) from exc


_SKILL_URI_RE = re.compile(r"^https?://data\.europa\.eu/esco/skill/[0-9a-fA-F-]{36}$")
_OCC_URI_RE = re.compile(r"^https?://data\.europa\.eu/esco/occupation/[0-9a-fA-F-]{36}$")


@dataclass(frozen=True)
class ResolvedSkill:
    input: str
    matchedLabel: str
    conceptUri: str
    score: int


@dataclass(frozen=True)
class JobResult:
    uri: str
    label: str
    score: float


@dataclass(frozen=True)
class MajorResult:
    name: str
    score: float
    supported_jobs: int


@dataclass(frozen=True)
class MLAssets:
    model: Any
    skill_index: dict[str, int]
    skills_alias_to_uri: dict[str, str]
    skills_aliases: list[str]
    occ_uri_to_label: dict[str, str]
    occ_uri_to_majors: dict[str, list[str]]
    major_degree: dict[str, int]


def _read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _load_model(path: Path) -> Any:
    if joblib is not None:
        return joblib.load(path)
    import pickle

    with path.open("rb") as f:
        return pickle.load(f)


def _build_skill_index(raw: Any) -> dict[str, int]:
    # Some builds store {uri: index}, others store [uri0, uri1, ...].
    if isinstance(raw, dict):
        out: dict[str, int] = {}
        for uri, idx in raw.items():
            if isinstance(uri, str) and isinstance(idx, int):
                out[uri] = idx
        return out
    if isinstance(raw, list):
        out = {}
        for idx, uri in enumerate(raw):
            if isinstance(uri, str):
                out[uri] = idx
        return out
    raise ValueError("Unsupported skill_index.json format")


def _split_alt_labels(value: str | None) -> list[str]:
    if not value:
        return []
    parts = re.split(r"[\n\r\t;,\|]+", value)
    return [p.strip() for p in parts if p and p.strip()]


def load_model_artifacts(ml_assets_dir: Path) -> tuple[Any, dict[str, int]]:
    model_path = ml_assets_dir / "job_recommender_fast.pkl"
    skill_index_path = ml_assets_dir / "skill_index.json"

    if not model_path.exists():
        raise FileNotFoundError(str(model_path))

    model = _load_model(model_path)
    skill_index_raw = _read_json(skill_index_path)
    skill_index = _build_skill_index(skill_index_raw)
    if not skill_index:
        raise RuntimeError("skill_index is empty; cannot run ML inference")

    return model, skill_index


def load_ml_metadata_from_db() -> tuple[
    dict[str, str],
    list[str],
    dict[str, str],
    dict[str, list[str]],
    dict[str, int],
]:
    # skills_alias_to_uri: lowercase alias -> skill_uri
    skills_alias_to_uri: dict[str, str] = {}
    skills_aliases: list[str] = []

    # Skills (try legacy table first for backward compatibility / tests)
    rows = []
    try:
        rows = mysql_db.query("SELECT skill_uri, preferred_label, alt_labels FROM skills")
    except Exception:
        rows = []
    if not rows:
        # Current DB schema uses ESCO raw columns.
        try:
            rows = mysql_db.query(
                "SELECT conceptUri AS skill_uri, preferredLabel AS preferred_label, altLabels AS alt_labels FROM esco_skills"
            )
        except Exception:
            rows = []

    # Fallback: if MySQL is unavailable or esco_skills is not populated, load from packaged CSV.
    if not rows:
        if is_sql_strict_mode(settings):
            raise RuntimeError(
                "SQL_STRICT is enabled (or MySQL is configured): refusing to fall back to ESCO_skills_en.csv. "
                "Populate MySQL table `esco_skills` (or legacy `skills`)."
            )
        csv_path = Path(__file__).resolve().parents[1] / "ml_assets" / "ESCO_skills_en.csv"
        if csv_path.exists():
            with csv_path.open("r", encoding="utf-8", newline="") as f:
                reader = csv.DictReader(f)
                for r in reader:
                    rows.append(
                        {
                            "skill_uri": r.get("conceptUri") or "",
                            "preferred_label": r.get("preferredLabel") or "",
                            "alt_labels": r.get("altLabels") or "",
                        }
                    )
    for row in rows:
        uri = (row.get("skill_uri") or "").strip()
        if not _SKILL_URI_RE.match(uri):
            continue
        preferred = (row.get("preferred_label") or "").strip()
        alt = row.get("alt_labels")
        candidates: list[str] = []
        if preferred:
            candidates.append(preferred)
        if alt:
            candidates.extend(_split_alt_labels(str(alt)))

        for alias in candidates:
            key = alias.lower()
            if not key:
                continue
            if key in skills_alias_to_uri:
                continue
            skills_alias_to_uri[key] = uri
            skills_aliases.append(alias)

    occ_uri_to_label: dict[str, str] = {}
    # Occupations
    rows = []
    try:
        rows = mysql_db.query("SELECT occ_uri, preferred_label FROM occupations")
    except Exception:
        rows = []
    if not rows:
        # ESCO occupations staging table
        try:
            rows = mysql_db.query(
                "SELECT conceptUri AS occ_uri, preferredLabel AS preferred_label FROM stage_esco_occupations"
            )
        except Exception:
            rows = []
    if not rows:
        # Master table variant
        rows = mysql_db.query(
            "SELECT esco_uri AS occ_uri, title AS preferred_label FROM stage_occupations_master WHERE esco_uri IS NOT NULL"
        )
    for row in rows:
        occ_uri = (row.get("occ_uri") or "").strip()
        if not _OCC_URI_RE.match(occ_uri):
            continue
        label = (row.get("preferred_label") or "").strip()
        if label:
            occ_uri_to_label[occ_uri] = label

    occ_uri_to_majors: dict[str, list[str]] = {}
    majors_to_occs: dict[str, set[str]] = {}
    # Major ↔ occupation mapping
    rows = []
    try:
        rows = mysql_db.query("SELECT major_name, occ_uri FROM major_occupation_map")
    except Exception:
        rows = []
    if not rows:
        # Current DB schema stores major_id + occupation_uri
        rows = mysql_db.query(
            """
            SELECT m.major_name AS major_name, mm.occupation_uri AS occ_uri
            FROM major_occupation_map mm
            JOIN major m ON m.id = mm.major_id
            WHERE mm.occupation_uri IS NOT NULL
            """.strip()
        )
    for row in rows:
        major = (row.get("major_name") or "").strip()
        occ_uri = (row.get("occ_uri") or "").strip()
        if not major or not _OCC_URI_RE.match(occ_uri):
            continue
        occ_uri_to_majors.setdefault(occ_uri, []).append(major)
        majors_to_occs.setdefault(major, set()).add(occ_uri)

    # Fallback: if DB mapping is empty in current environment, load from packaged CSV.
    if not occ_uri_to_majors:
        if is_sql_strict_mode(settings):
            raise RuntimeError(
                "SQL_STRICT is enabled (or MySQL is configured): refusing to fall back to major_occ_map.csv. "
                "Populate MySQL major↔occupation mapping tables."
            )
        csv_path = Path(__file__).resolve().parents[1] / "ml_assets" / "major_occ_map.csv"
        if csv_path.exists():
            with csv_path.open("r", encoding="utf-8", newline="") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    major = (row.get("major") or "").strip()
                    occ_uri = (row.get("occ_uri") or "").strip()
                    if not major or not _OCC_URI_RE.match(occ_uri):
                        continue
                    occ_uri_to_majors.setdefault(occ_uri, []).append(major)
                    majors_to_occs.setdefault(major, set()).add(occ_uri)

    major_degree = {major: len(occs) for major, occs in majors_to_occs.items()}

    if not skills_aliases:
        raise RuntimeError("MySQL metadata load failed: skills alias index is empty")
    if not occ_uri_to_majors:
        raise RuntimeError(
            "ML metadata load failed: major↔occupation mapping is empty in DB and CSV fallback"
        )

    return skills_alias_to_uri, skills_aliases, occ_uri_to_label, occ_uri_to_majors, major_degree


def build_ml_assets(*, model: Any, skill_index: dict[str, int], metadata: tuple[
    dict[str, str],
    list[str],
    dict[str, str],
    dict[str, list[str]],
    dict[str, int],
]) -> MLAssets:
    skills_alias_to_uri, skills_aliases, occ_uri_to_label, occ_uri_to_majors, major_degree = metadata
    return MLAssets(
        model=model,
        skill_index=skill_index,
        skills_alias_to_uri=skills_alias_to_uri,
        skills_aliases=skills_aliases,
        occ_uri_to_label=occ_uri_to_label,
        occ_uri_to_majors=occ_uri_to_majors,
        major_degree=major_degree,
    )


def resolve_skill_labels(
    assets: MLAssets,
    skills: list[tuple[str, float]],
    *,
    threshold: int = 70,
) -> list[ResolvedSkill]:
    resolved: list[ResolvedSkill] = []
    for label, _weight in skills:
        text = (label or "").strip()
        if not text:
            continue
        match = process.extractOne(
            text,
            assets.skills_aliases,
            scorer=fuzz.token_set_ratio,
            processor=str.lower,
        )
        if not match:
            continue
        matched_label, score, idx = match
        if score < threshold:
            continue

        key = str(matched_label).lower()
        concept_uri = assets.skills_alias_to_uri.get(key)
        if not concept_uri:
            continue
        # Enforce UUID URIs only.
        if not _SKILL_URI_RE.match(concept_uri):
            continue
        resolved.append(
            ResolvedSkill(
                input=text,
                matchedLabel=str(matched_label),
                conceptUri=concept_uri,
                score=int(score),
            )
        )
    return resolved


def build_feature_vector(skill_index: dict[str, int], skill_uris: dict[str, float]) -> np.ndarray:
    x = np.zeros((len(skill_index),), dtype=np.float32)
    for uri, weight in skill_uris.items():
        if uri in skill_index:
            i = skill_index[uri]
            w = float(weight)
            if w > x[i]:
                x[i] = w
    return x


def recommend_jobs(assets: MLAssets, skill_uris: dict[str, float], *, top_jobs: int) -> list[JobResult]:
    x = build_feature_vector(assets.skill_index, skill_uris)
    probs = assets.model.predict_proba([x])[0]
    classes = getattr(assets.model, "classes_", None)
    if classes is None:
        raise RuntimeError("Model has no classes_; cannot map probabilities to occupation URIs")

    classes_list = [c.decode("utf-8") if isinstance(c, (bytes, bytearray)) else str(c) for c in classes]
    top_jobs = max(1, int(top_jobs))
    k = min(top_jobs, len(classes_list))
    top_idx = np.argsort(probs)[::-1][:k]

    out: list[JobResult] = []
    for i in top_idx:
        uri = classes_list[int(i)]
        if not _OCC_URI_RE.match(uri):
            continue
        label = assets.occ_uri_to_label.get(uri, uri)
        out.append(JobResult(uri=uri, label=label, score=float(probs[int(i)])))
    return out


def recommend_majors(
    assets: MLAssets,
    jobs: list[JobResult],
    *,
    top_majors: int,
) -> list[MajorResult]:
    major_scores: dict[str, float] = {}
    major_supported_jobs: dict[str, set[str]] = {}

    for job in jobs:
        majors = assets.occ_uri_to_majors.get(job.uri)
        if not majors:
            continue
        for major in majors:
            degree = assets.major_degree.get(major, 1)
            denom = math.sqrt(max(1, int(degree)))
            major_scores[major] = major_scores.get(major, 0.0) + (job.score / denom)
            major_supported_jobs.setdefault(major, set()).add(job.uri)

    top_majors = max(1, int(top_majors))
    sorted_majors = sorted(major_scores.items(), key=lambda kv: kv[1], reverse=True)[:top_majors]

    return [
        MajorResult(
            name=major,
            score=float(score),
            supported_jobs=len(major_supported_jobs.get(major, set())),
        )
        for major, score in sorted_majors
    ]
