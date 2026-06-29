from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel


class UploadResponse(BaseModel):
    file_id: str
    filename: str
    size: int


class AnalyzeRequest(BaseModel):
    file_id: str
    patient_case_id: str
    age: float = 72.0
    sex: str = "F"


class CNNResult(BaseModel):
    prediction: str
    confidence: float
    prob_cn: float
    prob_ad: float
    clinical_age: Optional[float] = None
    clinical_sex: Optional[str] = None


class AnalyzeResult(BaseModel):
    analysis_id: str
    result: CNNResult
    report_paths: dict  # {md: str, html: str, pdf: Optional[str]}


class GradCAMRequest(BaseModel):
    file_id: str
    patient_case_id: str
    analysis_id: str
    orientation: str = "multi"
    display_mode: str = "overlay"
    age: float = 72.0
    sex: str = "F"


class GradCAMImage(BaseModel):
    image_path: str   # relative path from project root
    image_url: str    # /files/... URL
    caption: str
    orientation: str


class GradCAMResult(BaseModel):
    images: list[GradCAMImage]


class ExplainRequest(BaseModel):
    patient_case_id: str
    analysis_id: str
    result: dict
    gradcam_info: Optional[dict] = None
    question: Optional[str] = None


class ExplainResult(BaseModel):
    answer: str
    sources: list[dict]


class ChatRequest(BaseModel):
    message: str
    cnn_result: dict
    gradcam_info: Optional[dict] = None
    history: list[dict] = []
