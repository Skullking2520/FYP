# Backend requests (as of 2025-12-26)

This document captures backend-side changes that would make the UI reliable and reduce frontend workarounds.

## 1) Fix: job_id containing URLs must work (avoid double-encoding issues)

**Problem**

- The UI uses ESCO/ONET identifiers that can be full URLs (e.g. `http://data.europa.eu/esco/occupation/...`).
- These identifiers must be passed through HTTP paths as a single encoded segment.
- If the backend route expects the raw URL but receives a partially/incorrectly encoded value, it returns `404`.

**Request**

- Ensure endpoints below accept a URL-encoded `job_id` path parameter and correctly decode it once.

**Endpoints**

- `GET /api/jobs/{job_id}` → returns job title + description fields.
- `GET /api/jobs/{job_id}/skills` → returns skills for the job.
- `GET /api/jobs/{job_id}/majors?top_k=...` → returns majors linked to the job.

**Expected shapes (frontend already coded to these)**

- Job detail: `{ title, short_description?, description?, source?, ... }`
- Job skills: `[{ skill_key, name?, skill_name?, importance?, relation_type?, skill_type?, ... }]`
- Job majors: `[{ major_id, major_name, matched_skills, score }]`

## 2) Provide a stable “job detail” contract

**Problem**

- Some deployments expose job endpoints under different prefixes (`/api/...` vs `/<...>`).
- The frontend currently includes fallback calls, but this is fragile.

**Request**

- Make `/api/jobs/...` the single stable contract for job detail + skills + majors.

## 3) Provide a single endpoint for the Profile “summary”

**Problem**

- Today, the UI derives profile summary from localStorage (selected skills/job/major) + multiple backend calls.
- This is not shareable across devices and can drift from server truth.

**Request (recommended)**

- Add a backend endpoint that returns all of:
  - user’s selected skills (structured)
  - desired job (structured)
  - recommended major (top-1) for that job
  - gap skills for that major given current user skills

**Suggested endpoint**

- `GET /api/users/me/pathway-summary`

**Suggested response**

```json
{
  "skills": [{ "skill_key": "python", "name": "Python", "level": 3 }],
  "desired_job": { "job_id": "...", "title": "Data Scientist" },
  "recommended_major": { "major_id": 10, "major_name": "Computer Science" },
  "gaps": [{ "skill_key": "ml", "name": "Machine Learning", "importance": 0.8 }]
}
```

## 4) Ensure “major programs” endpoint never returns None

**Problem**

- We previously observed `GET /api/majors/{id}/programs` returning `None` causing FastAPI `ResponseValidationError`.

**Request**

- Always return an array. If no programs exist, return `[]`.

## 5) NLP skill extraction endpoint should be available under /api

**Problem**

- Current extractor is reachable at `/recommend/nlp/extract-skills` (no `/api` prefix).
- Frontend must use `/api/legacy/...` proxy which is easy to misconfigure.

**Request**

- Provide: `POST /api/recommend/nlp/extract-skills` (or alias) that calls the same logic.

**Expected request/response**

- Request: `{ "user_text": "..." }`
- Response: `{ "skills": [{"skill_name":"machine learning","skill_id":"..."}] }`
