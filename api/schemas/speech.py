from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class ParseResponse(BaseModel):
    transcript: str
    cleaned_transcript: str
    features: dict   # the 9 extracted features
    feature_vector: list[float]


class SpeechAnalyzeRequest(BaseModel):
    patient_case_id: str
    transcript: str
    feature_vector: list[float]
    patient_info: Optional[dict] = None  # name, study_date, etc.


class NLPResult(BaseModel):
    prediction: str
    confidence: float


class SpeechAnalyzeResult(BaseModel):
    analysis_id: str
    result: NLPResult
    report_paths: dict
    explanation: str


class SpeechExplainRequest(BaseModel):
    patient_case_id: str
    analysis_id: str
    transcript: str
    result: dict
    feature_vector: list[float]


class SpeechChatRequest(BaseModel):
    message: str
    nlp_result: dict
    transcript: str
    history: list[dict] = []
