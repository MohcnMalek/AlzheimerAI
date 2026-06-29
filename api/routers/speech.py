from __future__ import annotations

import asyncio
import uuid
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile

from api.dependencies import create_task, get_executor, update_task
from api.schemas.speech import (
    ParseResponse,
    SpeechAnalyzeRequest,
    SpeechChatRequest,
    SpeechExplainRequest,
)
from api.services.speech_service import speech_service

router = APIRouter()


# ---------------------------------------------------------------------------
# Background task helpers
# ---------------------------------------------------------------------------
async def _run_analyze(task_id: str, req: SpeechAnalyzeRequest) -> None:
    update_task(task_id, "running")
    try:
        import importlib

        _app = importlib.import_module("app_multimodal")
        analysis_id: str = _app.generate_analysis_id()

        loop = asyncio.get_event_loop()
        analysis_result: dict = await loop.run_in_executor(
            get_executor(),
            lambda: speech_service.analyze_sync(
                transcript=req.transcript,
                feature_vector=req.feature_vector,
                patient_case_id=req.patient_case_id,
                analysis_id=analysis_id,
                patient_info=req.patient_info or {},
            ),
        )

        # Persist to database (silently ignore failures)
        try:
            _db = importlib.import_module("database.db")
            result_dict = analysis_result.get("result", {})
            _db.save_patient(patient_case_id=req.patient_case_id)
            _db.save_speech_analysis(
                patient_case_id=req.patient_case_id,
                analysis_id=analysis_id,
                cleaned_transcript=req.transcript,
                result=result_dict.get("prediction"),
                confidence=result_dict.get("confidence"),
                simple_explanation=analysis_result.get("explanation"),
            )
            report_paths = analysis_result.get("report_paths", {})
            _db.save_report(
                patient_case_id=req.patient_case_id,
                analysis_id=analysis_id,
                analysis_type="Speech and Language Analysis",
                report_md_path=report_paths.get("md"),
                report_html_path=report_paths.get("html"),
                report_pdf_path=report_paths.get("pdf"),
            )
        except Exception:
            pass

        update_task(
            task_id,
            "completed",
            result={
                "analysis_id": analysis_id,
                "result": analysis_result.get("result", {}),
                "report_paths": analysis_result.get("report_paths", {}),
                "explanation": analysis_result.get("explanation", ""),
            },
        )
    except Exception as exc:
        update_task(task_id, "failed", error=str(exc))


async def _run_explain(task_id: str, req: SpeechExplainRequest) -> None:
    update_task(task_id, "running")
    try:
        loop = asyncio.get_event_loop()
        result_dict = req.result
        explanation: dict = await loop.run_in_executor(
            get_executor(),
            lambda: speech_service.explain_sync(
                transcript=req.transcript,
                prediction=str(result_dict.get("prediction", "")),
                confidence=float(result_dict.get("confidence", 0.0)),
            ),
        )
        update_task(task_id, "completed", result=explanation)
    except Exception as exc:
        update_task(task_id, "failed", error=str(exc))


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.post("/parse", response_model=ParseResponse)
async def parse_cha_file(file: UploadFile = File(...)):
    """Parse a .cha transcript file and extract features synchronously."""
    if not file.filename or not file.filename.lower().endswith(".cha"):
        raise HTTPException(
            status_code=400,
            detail="Only .cha files are accepted.",
        )
    content = await file.read()
    try:
        result = speech_service.parse_cha(content)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Failed to parse .cha file: {exc}") from exc

    return ParseResponse(**result)


@router.post("/analyze")
async def analyze_speech(req: SpeechAnalyzeRequest, background_tasks: BackgroundTasks):
    """Start a background NLP analysis task and return a task_id."""
    task_id = str(uuid.uuid4())
    create_task(task_id)
    background_tasks.add_task(_run_analyze, task_id, req)
    return {"task_id": task_id}


@router.post("/explain")
async def explain_speech(req: SpeechExplainRequest, background_tasks: BackgroundTasks):
    """Start a background RAG explanation task and return a task_id."""
    task_id = str(uuid.uuid4())
    create_task(task_id)
    background_tasks.add_task(_run_explain, task_id, req)
    return {"task_id": task_id}


@router.post("/chat")
async def chat_speech(req: SpeechChatRequest):
    """Synchronous speech Q&A via RAG (fast enough for direct response)."""
    loop = asyncio.get_event_loop()
    result: dict[str, Any] = await loop.run_in_executor(
        get_executor(),
        lambda: speech_service.chat_sync(
            message=req.message,
            nlp_result=req.nlp_result,
            transcript=req.transcript,
            history=req.history,
        ),
    )
    return result
