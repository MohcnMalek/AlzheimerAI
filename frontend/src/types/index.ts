// Tasks
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed'
export interface TaskResponse<T = unknown> {
  task_id: string
  status: TaskStatus
  result?: T
  error?: string
}

// Brain scan
export interface CNNResult {
  prediction: 'CN' | 'AD' | string
  confidence: number
  prob_cn: number
  prob_ad: number
  clinical_age?: number
  clinical_sex?: string
}
export interface GradCAMImage {
  image_path: string
  image_url: string
  caption: string
  orientation: string
}
export interface RAGSource {
  source: string
  page: string | number
}
export interface ExplainResult {
  answer: string
  sources: RAGSource[]
}
export interface BrainAnalyzeResult {
  analysis_id: string
  result: CNNResult
  report_paths: ReportPaths
}
export interface GradCAMResult {
  images: GradCAMImage[]
}

// Speech
export interface SpeechFeatures {
  n_filled_pauses: number
  n_phon_fragments: number
  n_paralinguistic: number
  n_retracings: number
  n_unintelligible: number
  n_pauses: number
  entryage: number
  sex: number
  educ: number
}
export interface ParseResult {
  transcript: string
  cleaned_transcript: string
  features: SpeechFeatures
  feature_vector: number[]
}
export interface NLPResult {
  prediction: 'Control' | 'ProbableAD' | string
  confidence: number
}
export interface SpeechAnalyzeResult {
  analysis_id: string
  result: NLPResult
  report_paths: ReportPaths
  explanation: string
}
export interface PatientInfo {
  name?: string
  study_date?: string
  responsible_clinician?: string
  clinical_notes?: string
}

// Reports
export interface ReportPaths {
  md?: string
  html?: string
  pdf?: string | null
}
export interface ReportEntry {
  id?: number
  patient_case_id: string
  analysis_id?: string
  analysis_type?: string
  report_md_path?: string
  report_html_path?: string
  report_pdf_path?: string
  created_at?: string
}
export interface PatientCase {
  patient_case_id: string
  patient_name?: string
  study_date?: string
  responsible_clinician?: string
  clinical_notes?: string
  created_at?: string
  updated_at?: string
}
export interface HistoryEntry {
  analysis_type: string
  analysis_id: string
  result: string
  confidence: number
  created_at: string
}
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}
