"""
FastAPI backend for the Alzheimer Multimodal Assistant.

Bootstrap sys.path BEFORE any project imports so that all existing modules
(cnn_predictor, gradcam_3d, mri_rag_explainer, predict_nlp_model, rag_explainer,
cha_parser, app_multimodal, database.db, etc.) resolve correctly at runtime.
"""
from __future__ import annotations

import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# sys.path bootstrap — must happen before any relative imports
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parents[1]
for _p in [
    str(PROJECT_ROOT),
    str(PROJECT_ROOT / "cnn_module" / "src"),
    str(PROJECT_ROOT / "nlp_rag_module" / "src"),
    str(PROJECT_ROOT / "src"),
]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

# ---------------------------------------------------------------------------
# Silence Streamlit watcher before any Streamlit-touching imports
# ---------------------------------------------------------------------------
import os

os.environ.setdefault("STREAMLIT_SERVER_FILE_WATCHER_TYPE", "none")
os.environ.setdefault("STREAMLIT_SERVER_RUN_ON_SAVE", "false")
os.environ.setdefault("STREAMLIT_CLIENT_SHOW_ERROR_DETAILS", "type")

# ---------------------------------------------------------------------------
# Standard library / third-party
# ---------------------------------------------------------------------------
import contextlib
import importlib
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# ---------------------------------------------------------------------------
# API routers
# ---------------------------------------------------------------------------
from api.routers import brain, patients, reports, speech, tasks

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Alzheimer Multimodal Assistant API",
    description=(
        "REST API wrapping the CNN MRI analyser, GradCAM explainer, "
        "NLP speech analyser and RAG explainers for Alzheimer's disease "
        "decision-support."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Static files — serve project outputs at /files/...
# ---------------------------------------------------------------------------
app.mount(
    "/files",
    StaticFiles(directory=str(PROJECT_ROOT), html=False, check_dir=True),
    name="project_files",
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(tasks.router, prefix="/api/tasks", tags=["Tasks"])
app.include_router(brain.router, prefix="/api/brain", tags=["Brain MRI"])
app.include_router(speech.router, prefix="/api/speech", tags=["Speech"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])
app.include_router(patients.router, prefix="/api/patients", tags=["Patients"])

# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------
@app.on_event("startup")
async def startup_event() -> None:
    # Ensure upload / gradcam dirs exist
    from api.dependencies import GRADCAM_DIR, UPLOAD_DIR  # noqa: F401  (side-effect: mkdir)

    # Initialise the database schema silently (non-fatal if DB not configured)
    with contextlib.suppress(Exception):
        db = importlib.import_module("database.db")
        db.init_db()
        logger.info("Database initialised successfully.")


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/api/health", tags=["Health"])
async def health_check():
    """Return the health status of the API, database and key models."""
    db_ok = False
    with contextlib.suppress(Exception):
        db = importlib.import_module("database.db")
        db_ok = bool(db.is_database_available())

    cnn_ok = False
    with contextlib.suppress(Exception):
        importlib.import_module("cnn_predictor")
        cnn_ok = True

    nlp_ok = False
    with contextlib.suppress(Exception):
        importlib.import_module("predict_nlp_model")
        nlp_ok = True

    return {
        "status": "ok",
        "db": db_ok,
        "models": {
            "cnn": cnn_ok,
            "nlp": nlp_ok,
        },
    }
