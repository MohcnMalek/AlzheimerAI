from __future__ import annotations

import importlib

from fastapi import APIRouter, HTTPException

from api.schemas.reports import PatientCase
from api.services.report_service import report_service

router = APIRouter()


@router.get("/new-case-id")
async def new_case_id():
    """Generate a fresh Patient Case ID."""
    _app = importlib.import_module("app_multimodal")
    return {"case_id": _app.generate_patient_case_id()}


@router.get("/new-analysis-id")
async def new_analysis_id():
    """Generate a fresh Analysis ID."""
    _app = importlib.import_module("app_multimodal")
    return {"analysis_id": _app.generate_analysis_id()}


@router.get("/cases")
async def list_recent_cases(limit: int = 20):
    """Return recent patient cases from the database."""
    cases = report_service.get_recent_cases(limit=limit)
    return {"cases": cases}


@router.get("/{patient_case_id}/history")
async def get_patient_history(patient_case_id: str):
    """Return all analyses for a given patient case."""
    history = report_service.get_patient_history(patient_case_id)
    return {"history": history}


@router.post("/")
async def create_patient(body: PatientCase):
    """Create or update a patient record in the database."""
    saved = report_service.save_patient_info(
        patient_case_id=body.patient_case_id,
        patient_name=body.patient_name,
        study_date=body.study_date,
        responsible_clinician=body.responsible_clinician,
        clinical_notes=body.clinical_notes,
    )
    if not saved:
        raise HTTPException(
            status_code=503,
            detail="Database is unavailable or patient could not be saved.",
        )
    return {"saved": True, "patient_case_id": body.patient_case_id}
