# main.py
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

# Ensure repo-root .env is loaded for the running server process.
# This avoids confusing situations where scripts see .env but uvicorn doesn't.
load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env", override=True)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.config import build_sqlalchemy_db_url
from app.database import Base, engine
from app.models import Job, Major, Skill, User
from app.api.routes.careerpath import router as careerpath_router
from app.api.routes.education import router as education_router
from app.api.routes.health import router as health_router
from app.api.routes.legacy_recommend import router as legacy_recommend_router
from app.api.routes.majors import router as majors_router
from app.api.routes.recommend import router as ml_recommend_router
from app.routers.admin import router as admin_router
from app.routers import auth, recommend, recommendations, users
from app.routers.selected_job import router as selected_job_router
from app.services.ml_recommender import build_ml_assets, load_ml_metadata_from_db, load_model_artifacts
from app.services.skill_extractor import load_nlp_assets


def create_app() -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        ml_dir = Path(__file__).resolve().parent / "ml_assets"
        model, skill_index = load_model_artifacts(ml_dir)
        metadata = load_ml_metadata_from_db()
        app.state.ml_assets = build_ml_assets(model=model, skill_index=skill_index, metadata=metadata)

        # NLP skill extractor assets (TF-IDF) - loaded once, no per-request DB hits.
        # Prefer MySQL skills table; falls back to ESCO_skills_en.csv if needed.
        app.state.nlp_assets = load_nlp_assets()
        yield

    application = FastAPI(
        title=settings.app_name,
        version=settings.version,
        debug=settings.debug,
        lifespan=lifespan,
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Health endpoints (do not depend on API_PREFIX)
    application.include_router(health_router)

    application.include_router(auth.router, prefix="/auth", tags=["auth"])
    application.include_router(users.router, prefix="/users", tags=["users"])
    application.include_router(selected_job_router)
    application.include_router(recommend.router, prefix="/recommend", tags=["recommend"])
    application.include_router(recommendations.router)
    application.include_router(admin_router)
    application.include_router(careerpath_router, prefix=settings.api_prefix)
    application.include_router(education_router, prefix=settings.api_prefix)
    application.include_router(majors_router, prefix=settings.api_prefix)
    application.include_router(ml_recommend_router, prefix=settings.api_prefix)
    application.include_router(legacy_recommend_router, prefix=settings.api_prefix)

    # Avoid accidental schema changes in shared MySQL databases.
    # For local/test sqlite usage, auto-create ORM tables is still convenient.
    db_url = build_sqlalchemy_db_url(settings)
    if db_url.startswith("sqlite"):
        Base.metadata.create_all(bind=engine)
    return application


app = create_app()
