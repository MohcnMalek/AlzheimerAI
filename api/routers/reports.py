from __future__ import annotations

import asyncio
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse

from api.dependencies import PROJECT_ROOT, create_task, get_executor, update_task
from api.schemas.reports import CombinedReportRequest
from api.services.report_service import report_service

router = APIRouter()


# ---------------------------------------------------------------------------
# Background task helper
# ---------------------------------------------------------------------------
async def _run_combined(task_id: str, req: CombinedReportRequest) -> None:
    update_task(task_id, "running")
    try:
        loop = asyncio.get_event_loop()
        paths: dict = await loop.run_in_executor(
            get_executor(),
            lambda: report_service.generate_combined(
                patient_case_id=req.patient_case_id,
                analysis_id=req.analysis_id,
            ),
        )
        update_task(task_id, "completed", result=paths)
    except Exception as exc:
        update_task(task_id, "failed", error=str(exc))


# ---------------------------------------------------------------------------
# Endpoints — fixed routes must come before parameterised ones
# ---------------------------------------------------------------------------
@router.get("/download")
async def download_report(path: str):
    """
    Serve a report file for download.

    Query parameter `path` should be a relative path from project root
    (e.g. outputs/reports/brain_scan_report_PAT-xxx_AN-yyy.html).
    """
    resolved = report_service.resolve_path(path)
    if not resolved.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {path}")
    return FileResponse(
        path=str(resolved),
        filename=resolved.name,
        media_type="application/octet-stream",
    )


@router.post("/combined")
async def generate_combined_report(req: CombinedReportRequest, background_tasks: BackgroundTasks):
    """Start a background combined multimodal report generation task."""
    task_id = str(uuid.uuid4())
    create_task(task_id)
    background_tasks.add_task(_run_combined, task_id, req)
    return {"task_id": task_id}


@router.get("/{patient_case_id}")
async def list_reports(patient_case_id: str):
    """List all reports saved in the database for a patient case."""
    reports = report_service.get_reports_for_patient(patient_case_id)
    return {"reports": reports}
