# FYP FastAPI Backend

Production-style FastAPI backend for the AI-driven career counseling project. It currently supports user registration/login, protected profile management, NLP-driven skill extraction, and recommendation endpoints for jobs and majors.

## Tech Stack

- Python 3.11+
- FastAPI
- SQLAlchemy ORM + MySQL (PyMySQL driver)
- Passlib[bcrypt] for password hashing
- python-jose for JWT handling

## Environment Configuration

Copy `.env.example` to `.env` and adjust the values:

```env
APP_NAME=FYP Backend
ENVIRONMENT=development
DEBUG=true
DB_HOST=localhost
DB_PORT=3306
DB_NAME=fyp_careerpath
DB_USER=root
DB_PASSWORD=root
DB_CHARSET=utf8mb4

# Optional (legacy):
# DB_URL=mysql+pymysql://root:password@localhost:3306/fyp_careerpath?charset=utf8mb4
JWT_SECRET=change-me
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

The app expects an existing MySQL schema for the careerpath dataset (job/skill/job_skill/skill_tag).

Note:

- The careerpath dataset uses MySQL via the `DB_*` settings above (raw-query access).
- The SQLAlchemy ORM (auth/users/admin tables) defaults to a local sqlite file in development (`dev.db`).
  If you want ORM tables in MySQL, either set `ORM_DB_URL=mysql+pymysql://...` explicitly,
  or set `ORM_USE_MYSQL=true` to reuse the same `DB_*` MySQL credentials.

## Local Development

### 0) MySQL (권장: Docker)

워크스페이스 루트에 있는 `docker-compose.yml`로 MySQL을 바로 띄울 수 있습니다.

```bash
cd ..
docker compose up -d mysql
```

기본값:

- MySQL: `localhost:3306`
- `root/root`
- DB: `fyp_careerpath`

초기 스키마(빈 테이블)는 자동으로 생성됩니다: `fyp-db/init/*.sql`

1. Create and activate a virtual environment.

   ```bash
   python -m venv .venv
   .venv\Scripts\activate
   ```

2. Install dependencies.

   ```bash
   pip install -r requirements.txt
   ```

3. Apply database migrations (for now the app auto-creates tables, so ensure the configured database user has DDL permissions).

   - ORM tables are auto-created only when using sqlite (development default).
   - For MySQL, provide a migrated schema (or switch ORM to sqlite via the default `dev.db`).

4. Launch the API server.

   ```bash
   uvicorn app.main:app --reload --port 8002
   ```

5. Quick checks

- API heartbeat: `GET http://127.0.0.1:8002/health/`
- DB connectivity: `GET http://127.0.0.1:8002/health/db`

## Frontend (Next.js) Integration

Backend base URL (local):

- `http://127.0.0.1:8002`

Frontend must define the API base URL (example: `.env.local` in your Next.js project):

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8002
```

If this env var is missing, the frontend cannot send login/recommendation requests and will show an error.

### CORS

For local development, the backend allows these origins by default:

- `http://localhost:3000`
- `http://127.0.0.1:3000`

To override allowed origins, set `CORS_ORIGINS` in `.env` as a JSON array:

```env
CORS_ORIGINS=["http://localhost:3000","http://127.0.0.1:3000"]
```

## API Overview

- `POST /auth/register` — Create a new user account.
- `POST /auth/login` — Obtain a JWT bearer token.
- `GET /users/me` — Fetch the authenticated user profile (includes `is_admin`).
- `PUT /users/me` — Update profile fields (name, location, free-text interests/skills).
- `POST /recommend/nlp/extract-skills` — Extract structured skills from user-provided text.
- `POST /recommend/jobs` — Return scored job matches for the authenticated user.
- `POST /recommend/majors` — Return ranked majors for the authenticated user.

Admin:

- `GET /admin/stats` — Admin analytics. Access is granted by setting `ADMIN_EMAILS` (allowlist) in `.env`.
  - JSON array: `ADMIN_EMAILS=["admin@example.com","ops@example.com"]`
  - Comma-separated: `ADMIN_EMAILS=admin@example.com,ops@example.com`
  - Comparison is `trim + lowercase`.

To create an admin user locally:

```bash
python scripts/create_admin.py --email admin@example.com
```

Careerpath (existing MySQL dataset):

- `GET /api/skills/search?q=...` — Search up to 50 skills by name.
- `GET /api/jobs/{job_id}` — Fetch job detail.
- `GET /api/jobs/{job_id}/skills` — Fetch up to 300 skills linked to a job.
- `POST /api/recommend/jobs` — Recommend up to 5 jobs from skills. Preferred payload: `skills: [{ skill_key, level(0..5) }]` (legacy `skill_keys` is still accepted temporarily). Returns `X-Recommendation-Id` header for analytics.
- `POST /api/recommend/jobs/pick` — Log a pick from a recommendation list (body: `{ recommendation_id, chosen_job_id }`). Server computes chosen_rank.
- `GET /api/skills/{skill_key}/resources` — Learning resources (optional table `skill_resource`; returns [] if not configured).
- `GET /api/db/stats` — Row counts for key tables.

## Testing

For convenience you can point the tests to a local SQLite file by setting `DB_URL` before running pytest:

```bash
set DB_URL=sqlite:///./test.db
pytest
```

## Share via ZIP (친구에게 테스트용 전달)

PowerShell에서 아래를 실행하면, 가상환경/캐시/.env 및 (기본값) 대용량 모델 폴더(`app/nlp`)를 제외한 ZIP을 생성합니다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/make_zip.ps1
```

출력 ZIP 위치: `dist/`

모델까지 포함해야 하면:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/make_zip.ps1 -IncludeModels
```

## Project Layout

```
app/
  config.py
  database.py
  main.py
  models/
  routers/
  schemas/
  services/
  utils/
.env.example
pyproject.toml
requirements.txt
README.md
```
