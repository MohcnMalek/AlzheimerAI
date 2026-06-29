from __future__ import annotations

import asyncio
import uuid
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile, File

from api.dependencies import (
    PROJECT_ROOT,
    UPLOAD_DIR,
    create_task,
    get_executor,
    get_task,
    update_task,
)
from api.schemas.brain import (
    AnalyzeRequest,
    ChatRequest,
    ExplainRequest,
    GradCAMRequest,
    UploadResponse,
)
from api.services.brain_service import brain_service

router = APIRouter()


# ---------------------------------------------------------------------------
# Upload MRI file
# ---------------------------------------------------------------------------
@router.post("/upload", response_model=UploadResponse)
async def upload_mri(file: UploadFile = File(...)):
    """Upload an MRI NIfTI file and receive a file_id for subsequent requests."""
    file_id = uuid.uuid4().hex
    dest_dir = UPLOAD_DIR / file_id
    dest_dir.mkdir(parents=True, exist_ok=True)

    filename = file.filename or "upload.nii"
    dest_path = dest_dir / filename
    content = await file.read()
    dest_path.write_bytes(content)

    return UploadResponse(
        file_id=file_id,
        filename=filename,
        size=len(content),
    )


# ---------------------------------------------------------------------------
# Background task helpers
# ---------------------------------------------------------------------------
def _resolve_mri_path(file_id: str) -> Path:
    """Find the uploaded MRI file for a given file_id."""
    file_dir = UPLOAD_DIR / file_id
    if not file_dir.exists():
        raise HTTPException(status_code=404, detail=f"File ID '{file_id}' not found.")
    candidates = list(file_dir.iterdir())
    if not candidates:
        raise HTTPException(status_code=404, detail=f"No file found for ID '{file_id}'.")
    return candidates[0]


async def _run_analyze(task_id: str, req: AnalyzeRequest) -> None:
    update_task(task_id, "running")
    try:
        file_path = _resolve_mri_path(req.file_id)
        loop = asyncio.get_event_loop()
        cnn_result: dict = await loop.run_in_executor(
            get_executor(),
            lambda: brain_service.analyze_sync(file_path, req.age, req.sex),
        )

        # Generate analysis_id and report
        import importlib
        _app = importlib.import_module("app_multimodal")
        analysis_id: str = _app.generate_analysis_id()

        report_paths_raw: dict = await loop.run_in_executor(
            get_executor(),
            lambda: _app.save_brain_scan_reports(
                result=cnn_result,
                patient_case_id=req.patient_case_id,
                analysis_id=analysis_id,
                gradcam_paths=None,
                gradcam_orientation=None,
                mri_preview_path=None,
                mri_source_name=file_path.name,
                mri_rag_explanation=None,
                mri_rag_sources=None,
            ),
        )

        # Save to database (silently ignore failures)
        try:
            import importlib as _il
            _db = _il.import_module("database.db")
            _db.save_patient(patient_case_id=req.patient_case_id)
            _db.save_brain_analysis(
                patient_case_id=req.patient_case_id,
                analysis_id=analysis_id,
                uploaded_file_name=file_path.name,
                mri_file_path=str(file_path),
                result=cnn_result.get("prediction"),
                confidence=cnn_result.get("confidence"),
                prob_cn=cnn_result.get("prob_cn"),
                prob_ad=cnn_result.get("prob_ad"),
                simple_explanation=_app.brain_scan_simple_explanation(
                    cnn_result.get("prediction", "")
                ),
            )
            _db.save_report(
                patient_case_id=req.patient_case_id,
                analysis_id=analysis_id,
                analysis_type="Brain Scan Analysis",
                report_md_path=report_paths_raw.get("md"),
                report_html_path=report_paths_raw.get("html"),
                report_pdf_path=report_paths_raw.get("pdf"),
            )
        except Exception:
            pass

        # Serialise Path objects
        report_paths: dict[str, Optional[str]] = {}
        for key in ("md", "html", "pdf"):
            val = report_paths_raw.get(key)
            report_paths[key] = str(val) if val else None

        update_task(
            task_id,
            "completed",
            result={
                "analysis_id": analysis_id,
                "result": cnn_result,
                "report_paths": report_paths,
            },
        )
    except Exception as exc:
        update_task(task_id, "failed", error=str(exc))


async def _run_gradcam(task_id: str, req: GradCAMRequest) -> None:
    update_task(task_id, "running")
    try:
        file_path = _resolve_mri_path(req.file_id)
        loop = asyncio.get_event_loop()
        images: list[dict] = await loop.run_in_executor(
            get_executor(),
            lambda: brain_service.generate_gradcam_sync(
                file_path,
                orientation=req.orientation,
                display_mode=req.display_mode,
                age=req.age,
                sex=req.sex,
            ),
        )

        # Regenerate the brain report so GradCAM images are embedded as base64
        try:
            import importlib as _il
            _db = _il.import_module("database.db")
            row = _db.get_brain_analysis_by_id(req.patient_case_id, req.analysis_id)
            if row:
                cnn_result = {
                    "prediction": row.get("result", ""),
                    "confidence": float(row.get("confidence") or 0.0),
                    "prob_cn": float(row.get("prob_cn") or 0.0),
                    "prob_ad": float(row.get("prob_ad") or 0.0),
                }
                # Use absolute paths so _image_data_uri can read the files
                abs_gradcam = [
                    {**img, "image_path": str(PROJECT_ROOT / img["image_path"])}
                    for img in images
                    if img.get("image_path")
                ]
                _app = _il.import_module("app_multimodal")
                report_paths_raw = await loop.run_in_executor(
                    get_executor(),
                    lambda: _app.save_brain_scan_reports(
                        result=cnn_result,
                        patient_case_id=req.patient_case_id,
                        analysis_id=req.analysis_id,
                        gradcam_paths=abs_gradcam,
                        gradcam_orientation=req.orientation,
                        mri_source_name=row.get("uploaded_file_name"),
                    ),
                )
                _db.save_report(
                    patient_case_id=req.patient_case_id,
                    analysis_id=req.analysis_id,
                    analysis_type="Brain Scan Analysis",
                    report_md_path=report_paths_raw.get("md"),
                    report_html_path=report_paths_raw.get("html"),
                    report_pdf_path=report_paths_raw.get("pdf"),
                )
        except Exception:
            pass  # report update is best-effort; images are still returned to frontend

        update_task(task_id, "completed", result={"images": images})
    except Exception as exc:
        update_task(task_id, "failed", error=str(exc))


async def _run_explain(task_id: str, req: ExplainRequest) -> None:
    update_task(task_id, "running")
    try:
        loop = asyncio.get_event_loop()
        explanation: dict = await loop.run_in_executor(
            get_executor(),
            lambda: brain_service.explain_sync(
                cnn_result=req.result,
                gradcam_info=req.gradcam_info,
                question=req.question,
            ),
        )
        update_task(task_id, "completed", result=explanation)
    except Exception as exc:
        update_task(task_id, "failed", error=str(exc))


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.post("/analyze")
async def analyze_brain(req: AnalyzeRequest, background_tasks: BackgroundTasks):
    """Start a background CNN analysis task and return a task_id."""
    task_id = str(uuid.uuid4())
    create_task(task_id)
    background_tasks.add_task(_run_analyze, task_id, req)
    return {"task_id": task_id}


@router.post("/gradcam")
async def generate_gradcam(req: GradCAMRequest, background_tasks: BackgroundTasks):
    """Start a background GradCAM generation task and return a task_id."""
    task_id = str(uuid.uuid4())
    create_task(task_id)
    background_tasks.add_task(_run_gradcam, task_id, req)
    return {"task_id": task_id}


@router.post("/explain")
async def explain_brain(req: ExplainRequest, background_tasks: BackgroundTasks):
    """Start a background RAG explanation task and return a task_id."""
    task_id = str(uuid.uuid4())
    create_task(task_id)
    background_tasks.add_task(_run_explain, task_id, req)
    return {"task_id": task_id}


@router.post("/chat")
async def chat_brain(req: ChatRequest):
    """Synchronous brain-scan Q&A via RAG (fast enough for direct response)."""
    loop = asyncio.get_event_loop()
    result: dict[str, Any] = await loop.run_in_executor(
        get_executor(),
        lambda: brain_service.chat_sync(
            message=req.message,
            cnn_result=req.cnn_result,
            gradcam_info=req.gradcam_info,
            history=req.history,
        ),
    )
    return result


@router.get("/report/{patient_case_id}/{analysis_id}")
async def get_report_urls(patient_case_id: str, analysis_id: str):
    """Return /files/... URLs for the brain scan report associated with an analysis."""
    import importlib
    _db = importlib.import_module("database.db")
    rows: list[dict] = _db.get_reports(patient_case_id)

    for row in rows:
        if str(row.get("analysis_id") or "") == analysis_id:
            def _to_url(p: Any) -> Optional[str]:
                if not p:
                    return None
                try:
                    rel = Path(str(p)).resolve().relative_to(PROJECT_ROOT).as_posix()
                    return f"/files/{rel}"
                except ValueError:
                    return None

            return {
                "md_url": _to_url(row.get("report_md_path")),
                "html_url": _to_url(row.get("report_html_path")),
                "pdf_url": _to_url(row.get("report_pdf_path")),
            }

    raise HTTPException(
        status_code=404,
        detail=f"No report found for patient '{patient_case_id}' / analysis '{analysis_id}'.",
    )
