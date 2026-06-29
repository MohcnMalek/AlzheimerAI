from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class ReportEntry(BaseModel):
    id: Optional[int] = None
    patient_case_id: str
    analysis_id: Optional[str] = None
    analysis_type: Optional[str] = None
    report_md_path: Optional[str] = None
    report_html_path: Optional[str] = None
    report_pdf_path: Optional[str] = None
    created_at: Optional[str] = None


class PatientCase(BaseModel):
    patient_case_id: str
    patient_name: Optional[str] = None
    study_date: Optional[str] = None
    responsible_clinician: Optional[str] = None
    clinical_notes: Optional[str] = None


class CombinedReportRequest(BaseModel):
    patient_case_id: str
    analysis_id: Optional[str] = None
