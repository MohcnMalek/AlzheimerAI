from __future__ import annotations

import contextlib
import importlib
import io
from pathlib import Path
from typing import Any, Optional

from api.dependencies import PROJECT_ROOT, GRADCAM_DIR


def _run_quietly(fn, *args, **kwargs):
    """Suppress stdout/stderr from model inference code."""
    buf_out, buf_err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(buf_out), contextlib.redirect_stderr(buf_err):
        return fn(*args, **kwargs)


def _abs_path_to_url(abs_path: str | Path) -> str:
    """Convert an absolute filesystem path to a /files/... URL."""
    try:
        rel = Path(abs_path).resolve().relative_to(PROJECT_ROOT).as_posix()
        return f"/files/{rel}"
    except ValueError:
        return f"/files/{Path(abs_path).name}"


class BrainService:
    """Wraps CNN predictor, GradCAM generator and MRI RAG explainer."""

    # ------------------------------------------------------------------
    # CNN analysis
    # ------------------------------------------------------------------
    def analyze_sync(self, file_path: Path, age: float, sex: str) -> dict[str, Any]:
        """Run CNN prediction synchronously (call via executor)."""
        cnn_predictor = importlib.import_module("cnn_predictor")
        raw: dict = _run_quietly(cnn_predictor.predict_mri, str(file_path), age=age, sex=sex)
        return {
            "prediction": str(raw.get("prediction", "")),
            "confidence": float(raw.get("confidence", 0.0)),
            "prob_cn": float(raw.get("prob_cn", 0.0)),
            "prob_ad": float(raw.get("prob_ad", 0.0)),
            "clinical_age": age,
            "clinical_sex": sex,
        }

    # ------------------------------------------------------------------
    # GradCAM
    # ------------------------------------------------------------------
    def generate_gradcam_sync(
        self,
        file_path: Path,
        orientation: str = "multi",
        display_mode: str = "overlay",
        age: float = 72.0,
        sex: str = "F",
    ) -> list[dict[str, Any]]:
        """Run GradCAM slice generation synchronously (call via executor)."""
        # Normalise display_mode to the values expected by gradcam_3d
        mode = "overlay" if display_mode.lower().startswith("overlay") else "heatmap"
        # Encode sex matching st_2_multimodal.py convention: F=1.0, M=0.0
        s = str(sex).strip().upper()
        sex_encoded = 1.0 if s in ("F", "FEMALE", "WOMAN") else (0.0 if s in ("M", "MALE", "MAN") else 0.5)

        gradcam_3d = importlib.import_module("gradcam_3d")

        slices: list = _run_quietly(
            gradcam_3d.generate_gradcam_slices,
            str(file_path),
            orientation=orientation,
            num_slices=5,
            display_mode=mode,
            output_dir=GRADCAM_DIR,
            alpha=0.60,
            threshold=0.48,
            percentile=88.0,
            colormap="turbo",
            age=float(age),
            sex=sex_encoded,
        )

        images: list[dict[str, Any]] = []
        for item in slices or []:
            if isinstance(item, dict):
                raw_path = item.get("image_path") or item.get("path") or ""
                abs_path = Path(str(raw_path)) if raw_path else None

                if abs_path and abs_path.exists():
                    try:
                        rel = abs_path.resolve().relative_to(PROJECT_ROOT).as_posix()
                    except ValueError:
                        rel = abs_path.name

                    images.append({
                        "image_path": rel,
                        "image_url": f"/files/{rel}",
                        "caption": str(item.get("caption") or ""),
                        "orientation": str(item.get("orientation") or orientation),
                    })
        return images

    # ------------------------------------------------------------------
    # RAG explanation / chat
    # ------------------------------------------------------------------
    def explain_sync(
        self,
        cnn_result: dict,
        gradcam_info: Optional[dict] = None,
        question: Optional[str] = None,
    ) -> dict[str, Any]:
        """Run MRI RAG explanation synchronously (call via executor)."""
        mri_rag = importlib.import_module("mri_rag_explainer")

        raw: dict = _run_quietly(
            mri_rag.generate_mri_explanation_with_rag,
            cnn_result,
            gradcam_info=gradcam_info,
            question=question,
        )
        return {
            "answer": str(raw.get("answer") or ""),
            "sources": list(raw.get("sources") or []),
        }

    def chat_sync(
        self,
        message: str,
        cnn_result: dict,
        gradcam_info: Optional[dict] = None,
        history: Optional[list[dict]] = None,
    ) -> dict[str, Any]:
        """Answer a free-form chat question about a brain scan result."""
        # history is available for future streaming; pass message as question
        return self.explain_sync(cnn_result, gradcam_info=gradcam_info, question=message)


brain_service = BrainService()
