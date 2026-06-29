from __future__ import annotations

import contextlib
import importlib
import io
import os
from pathlib import Path
from typing import Any, Optional

from api.dependencies import PROJECT_ROOT


def _run_quietly(fn, *args, **kwargs):
    """Suppress stdout/stderr from model inference code."""
    buf_out, buf_err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(buf_out), contextlib.redirect_stderr(buf_err):
        return fn(*args, **kwargs)


def _import_app_multimodal():
    """Import app_multimodal without triggering Streamlit runtime errors."""
    os.environ.setdefault("STREAMLIT_SERVER_FILE_WATCHER_TYPE", "none")
    os.environ.setdefault("STREAMLIT_SERVER_RUN_ON_SAVE", "false")
    os.environ.setdefault("STREAMLIT_CLIENT_SHOW_ERROR_DETAILS", "type")
    return importlib.import_module("app_multimodal")


class SpeechService:
    """Wraps CHA parser, NLP predictor and NLP RAG explainer."""

    # ------------------------------------------------------------------
    # CHA file parsing
    # ------------------------------------------------------------------
    def parse_cha(self, content: bytes) -> dict[str, Any]:
        """
        Parse raw .cha file bytes and return transcript, features, and vector.
        """
        cha_parser = importlib.import_module("cha_parser")

        cha_text = content.decode("utf-8", errors="replace")

        features: dict = _run_quietly(cha_parser.extract_speech_features_from_cha, cha_text)
        transcript: str = _run_quietly(cha_parser.extract_participant_transcript, cha_text)
        cleaned_transcript: str = _run_quietly(cha_parser.clean_cha_transcript, transcript)
        feature_vector: list[float] = _run_quietly(cha_parser.build_feature_vector_from_cha, features)

        return {
            "transcript": transcript,
            "cleaned_transcript": cleaned_transcript,
            "features": features,
            "feature_vector": feature_vector,
        }

    # ------------------------------------------------------------------
    # NLP prediction + report generation
    # ------------------------------------------------------------------
    def analyze_sync(
        self,
        transcript: str,
        feature_vector: list[float],
        patient_case_id: str,
        analysis_id: str,
        patient_info: Optional[dict] = None,
    ) -> dict[str, Any]:
        """Run NLP prediction and generate speech report synchronously."""
        predict_nlp = importlib.import_module("predict_nlp_model")

        prediction_str, confidence_float = _run_quietly(
            predict_nlp.predict_patient,
            transcript,
            feature_vector,
        )

        result_dict = {
            "prediction": str(prediction_str),
            "confidence": float(confidence_float),
        }

        # Generate explanation text for the report
        app = _import_app_multimodal()
        llm_explanation = _run_quietly(
            app.required_nlp_explanation,
            result_dict["prediction"],
            result_dict["confidence"],
        )

        # Build report
        report_paths_raw: dict = _run_quietly(
            app.save_speech_language_reports,
            result=result_dict,
            patient_case_id=patient_case_id,
            analysis_id=analysis_id,
            transcript=transcript,
            analysis_features=patient_info or {},
            patient_info=patient_info or {},
            llm_explanation=llm_explanation,
        )

        # Convert Path objects to strings
        report_paths: dict[str, Optional[str]] = {}
        for key in ("md", "html", "pdf"):
            val = report_paths_raw.get(key)
            report_paths[key] = str(val) if val else None

        return {
            "result": result_dict,
            "report_paths": report_paths,
            "explanation": llm_explanation,
        }

    # ------------------------------------------------------------------
    # NLP RAG explanation
    # ------------------------------------------------------------------
    def explain_sync(
        self,
        transcript: str,
        prediction: str,
        confidence: float,
    ) -> dict[str, Any]:
        """Run NLP RAG explainer synchronously (call via executor)."""
        rag_explainer = importlib.import_module("rag_explainer")

        raw: dict = _run_quietly(
            rag_explainer.explain_prediction_with_rag,
            transcript,
            prediction,
            confidence,
        )
        return {
            "explanation": str(raw.get("explanation") or ""),
            "sources": list(raw.get("sources") or []),
        }

    def chat_sync(
        self,
        message: str,
        nlp_result: dict,
        transcript: str,
        history: Optional[list[dict]] = None,
    ) -> dict[str, Any]:
        """Answer a free-form chat question about a speech analysis result."""
        rag_explainer = importlib.import_module("rag_explainer")

        # Pass message as the question; many rag_explainer implementations
        # accept an optional `question` kwarg – fall back gracefully.
        try:
            raw: dict = _run_quietly(
                rag_explainer.explain_prediction_with_rag,
                transcript,
                nlp_result.get("prediction", ""),
                float(nlp_result.get("confidence", 0.0)),
                question=message,
            )
        except TypeError:
            # If the function doesn't accept `question`, call without it
            raw = _run_quietly(
                rag_explainer.explain_prediction_with_rag,
                transcript,
                nlp_result.get("prediction", ""),
                float(nlp_result.get("confidence", 0.0)),
            )

        return {
            "answer": str(raw.get("explanation") or raw.get("answer") or ""),
            "sources": list(raw.get("sources") or []),
        }


speech_service = SpeechService()
