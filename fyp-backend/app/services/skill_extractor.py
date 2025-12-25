from __future__ import annotations

import csv
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from app.db import mysql as mysql_db
from app.config import is_sql_strict_mode, settings


_SKILL_URI_RE = re.compile(r"^http://data\.europa\.eu/esco/skill/[0-9a-fA-F-]{36}$")


@dataclass(frozen=True)
class NLPAssets:
    vectorizer: TfidfVectorizer
    tfidf_matrix: Any
    skill_names: list[str]
    skill_ids: list[str]


def _normalize_alt_labels(raw: str | None) -> str:
    if not raw:
        return ""
    return " ".join([p.strip() for p in re.split(r"[\n;\r\t\|,]+", raw) if p and p.strip()])


def _build_corpus(skill_rows: list[dict[str, str]]) -> tuple[list[str], list[str], list[str]]:
    names: list[str] = []
    ids: list[str] = []
    docs: list[str] = []

    for row in skill_rows:
        uri = (row.get("skill_uri") or row.get("conceptUri") or "").strip()
        name = (row.get("preferred_label") or row.get("preferredLabel") or "").strip()
        alt = row.get("alt_labels") or row.get("altLabels")

        if not uri or not name:
            continue
        if not _SKILL_URI_RE.match(uri):
            continue

        names.append(name)
        ids.append(uri)
        docs.append(f"{name} {_normalize_alt_labels(str(alt) if alt is not None else None)}")

    return names, ids, docs


def load_nlp_assets(*, skills_table: str = "skills", esco_skills_csv: Path | None = None) -> NLPAssets:
    """Load NLP skill extraction assets.

    Priority:
    1) MySQL table (skills_table) with columns: skill_uri, preferred_label, alt_labels
    2) Fallback to ESCO_skills_en.csv (file) if MySQL table is missing/unavailable

    No per-request DB hits: all data is loaded once and cached in app.state.
    """

    skill_rows: list[dict[str, str]] = []

    # Try MySQL first (legacy schema / tests).
    rows = []
    try:
        rows = mysql_db.query(f"SELECT skill_uri, preferred_label, alt_labels FROM {skills_table}")
    except Exception:
        rows = []

    if not rows:
        # Current DB schema: esco_skills(conceptUri, preferredLabel, altLabels, ...)
        try:
            rows = mysql_db.query(
                "SELECT conceptUri AS skill_uri, preferredLabel AS preferred_label, altLabels AS alt_labels FROM esco_skills"
            )
        except Exception:
            rows = []

    if rows:
        skill_rows = [
            {
                "skill_uri": str(r.get("skill_uri") or ""),
                "preferred_label": str(r.get("preferred_label") or ""),
                "alt_labels": str(r.get("alt_labels") or "") if r.get("alt_labels") is not None else "",
            }
            for r in rows
        ]

    # Fallback to CSV if needed.
    if not skill_rows:
        if is_sql_strict_mode(settings):
            raise RuntimeError(
                "SQL_STRICT is enabled (or MySQL is configured): refusing to fall back to ESCO_skills_en.csv. "
                "Populate MySQL table `esco_skills` (or legacy `skills`)."
            )
        if esco_skills_csv is None:
            esco_skills_csv = Path(__file__).resolve().parents[1] / "ml_assets" / "ESCO_skills_en.csv"
        if not esco_skills_csv.exists():
            raise RuntimeError(
                "NLP assets load failed: MySQL skills table is empty/unavailable and ESCO_skills_en.csv not found"
            )

        with esco_skills_csv.open("r", encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                skill_rows.append(row)  # keys: conceptUri, preferredLabel, altLabels, ...

    skill_names, skill_ids, docs = _build_corpus(skill_rows)
    if len(skill_names) == 0:
        raise RuntimeError("NLP assets load failed: no skills available")

    vectorizer = TfidfVectorizer(stop_words="english", max_features=20000)
    tfidf_matrix = vectorizer.fit_transform(docs)

    return NLPAssets(vectorizer=vectorizer, tfidf_matrix=tfidf_matrix, skill_names=skill_names, skill_ids=skill_ids)


def extract_skills_tfidf(
    assets: NLPAssets,
    text: str,
    *,
    top_k_candidates: int = 60,
    max_return_skills: int = 5,
) -> list[dict[str, str]]:
    if not text or not text.strip():
        return []

    vec = assets.vectorizer.transform([text])
    scores = cosine_similarity(vec, assets.tfidf_matrix)[0]
    idx_sorted = np.argsort(scores)[::-1]

    out: list[dict[str, str]] = []
    for i in idx_sorted[: max(top_k_candidates, max_return_skills)]:
        name = assets.skill_names[int(i)]
        sid = assets.skill_ids[int(i)]
        out.append({"skill_name": name, "skill_id": sid})
        if len(out) >= max_return_skills:
            break

    return out
