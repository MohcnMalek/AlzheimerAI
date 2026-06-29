from __future__ import annotations

import contextlib
import importlib
import io
import os
from pathlib import Path
from typing import Any, Optional

from api.dependencies import PROJECT_ROOT


def _run_quietly(fn, *args, **kwargs):
    """Suppress stdout/stderr from helper code."""
    buf_out, buf_err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(buf_out), contextlib.redirect_stderr(buf_err):
        return fn(*args, **kwargs)


def _import_db():
    return importlib.import_module("database.db")


def _import_combined():
    return importlib.import_module("src.combined_report_generator")


def _import_app():
    os.environ.setdefault("STREAMLIT_SERVER_FILE_WATCHER_TYPE", "none")
    os.environ.setdefault("STREAMLIT_SERVER_RUN_ON_SAVE", "false")
    os.environ.setdefault("STREAMLIT_CLIENT_SHOW_ERROR_DETAILS", "type")
    return importlib.import_module("app_multimodal")


def _path_to_str(val: Any) -> Optional[str]:
    return str(val) if val else None


class ReportService:
    """Wraps database queries and combined report generation."""

    # ------------------------------------------------------------------
    # Reports
    # ------------------------------------------------------------------
    def get_reports_for_patient(self, patient_case_id: str) -> list[dict]:
        db = _import_db()
        rows = db.get_reports(patient_case_id)
        result = []
        for row in rows:
            cleaned: dict[str, Any] = {}
            for k, v in row.items():
                if hasattr(v, "isoformat"):
                    cleaned[k] = v.isoformat()
                elif v is None:
                    cleaned[k] = None
                else:
                    cleaned[k] = str(v)
            result.append(cleaned)
        return result

    # ------------------------------------------------------------------
    # Patient history
    # ------------------------------------------------------------------
    def get_patient_history(self, patient_case_id: str) -> list[dict]:
        db = _import_db()
        rows = db.get_patient_history(patient_case_id)
        result = []
        for row in rows:
            cleaned: dict[str, Any] = {}
            for k, v in row.items():
                if hasattr(v, "isoformat"):
                    cleaned[k] = v.isoformat()
                elif v is None:
                    cleaned[k] = None
                else:
                    cleaned[k] = str(v)
            result.append(cleaned)
        return result

    # ------------------------------------------------------------------
    # Recent cases
    # ------------------------------------------------------------------
    def get_recent_cases(self, limit: int = 20) -> list[dict]:
        db = _import_db()
        rows = db.get_recent_patient_cases(limit=limit)
        result = []
        for row in rows:
            cleaned: dict[str, Any] = {}
            for k, v in row.items():
                if hasattr(v, "isoformat"):
                    cleaned[k] = v.isoformat()
                elif v is None:
                    cleaned[k] = None
                else:
                    cleaned[k] = str(v)
            result.append(cleaned)
        return result

    # ------------------------------------------------------------------
    # Save patient info
    # ------------------------------------------------------------------
    def save_patient_info(
        self,
        patient_case_id: str,
        patient_name: Optional[str] = None,
        study_date: Optional[str] = None,
        responsible_clinician: Optional[str] = None,
        clinical_notes: Optional[str] = None,
    ) -> bool:
        db = _import_db()
        try:
            return bool(
                db.save_patient(
                    patient_case_id=patient_case_id,
                    patient_name=patient_name,
                    study_date=study_date,
                    responsible_clinician=responsible_clinician,
                    clinical_notes=clinical_notes,
                )
            )
        except Exception:
            return False

    # ------------------------------------------------------------------
    # Combined multimodal report
    # ------------------------------------------------------------------
    def generate_combined(
        self,
        patient_case_id: str,
        analysis_id: Optional[str] = None,
    ) -> dict[str, Optional[str]]:
        combined = _import_combined()

        case_data = _run_quietly(
            combined.build_combined_case_data,
            patient_case_id,
        )
        summary = _run_quietly(combined.generate_combined_rag_summary, case_data)

        saved = _run_quietly(
            combined.save_combined_multimodal_report,
            case_data,
            summary,
        )

        if isinstance(saved, dict):
            return {
                "md": _path_to_str(saved.get("md")),
                "html": _path_to_str(saved.get("html")),
                "pdf": _path_to_str(saved.get("pdf")),
            }

        # If saved is a Path, derive siblings
        if saved:
            saved_path = Path(str(saved))
            app = _import_app()
            siblings = app.report_sibling_files(saved_path)
            return {
                "md": _path_to_str(siblings.get("md")),
                "html": _path_to_str(siblings.get("html")),
                "pdf": _path_to_str(siblings.get("pdf")),
            }

        return {"md": None, "html": None, "pdf": None}

    # ------------------------------------------------------------------
    # Absolute path from a stored relative path
    # ------------------------------------------------------------------
    def resolve_path(self, rel_path: str) -> Path:
        p = Path(rel_path)
        if p.is_absolute():
            return p
        return PROJECT_ROOT / p


report_service = ReportService()
