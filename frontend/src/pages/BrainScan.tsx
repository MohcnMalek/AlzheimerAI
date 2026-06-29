import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { brainApi } from '../api/brain'
import { usePollTask } from '../hooks/usePollTask'
import type { BrainAnalyzeResult, GradCAMResult, ExplainResult } from '../types'

import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import StepCard from '../components/ui/StepCard'
import MetricCard from '../components/ui/MetricCard'
import ResultCard from '../components/ui/ResultCard'
import Spinner from '../components/ui/Spinner'
import Note from '../components/ui/Note'
import Accordion from '../components/ui/Accordion'
import FileDropzone from '../components/ui/FileDropzone'
import ChatPanel from '../components/domain/ChatPanel'
import GradCAMGrid from '../components/domain/GradCAMGrid'
import ColorLegend from '../components/domain/ColorLegend'
import ReportCard from '../components/domain/ReportCard'

const ORIENTATIONS = ['Multi-view', 'Axial', 'Sagittal', 'Coronal']
const DISPLAY_MODES = ['Overlay', 'Heatmap only']

export default function BrainScan() {
  const {
    patientCaseId,
    brainFileId,
    brainFileName,
    brainAge,
    brainSex,
    brainAnalysisId,
    brainResult,
    brainReportPaths,
    gradcamImages,
    brainExplanation,
    brainSources,
    brainMessages,
    setBrainFile,
    setBrainAge,
    setBrainSex,
    setBrainResult,
    setGradcam,
    setBrainExplanation,
    addBrainMessage,
  } = useStore()

  const [uploadError, setUploadError] = useState<string | null>(null)
  const [analyzeTaskId, setAnalyzeTaskId] = useState<string | null>(null)
  const [gradcamTaskId, setGradcamTaskId] = useState<string | null>(null)
  const [explainTaskId, setExplainTaskId] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [selectedOrientation, setSelectedOrientation] = useState('Multi-view')
  const [selectedDisplayMode, setSelectedDisplayMode] = useState('Overlay')

  const analyzeTask = usePollTask<BrainAnalyzeResult>(analyzeTaskId)
  const gradcamTask = usePollTask<GradCAMResult>(gradcamTaskId)
  const explainTask = usePollTask<ExplainResult>(explainTaskId)

  // Handle analyze task completion
  useEffect(() => {
    if (analyzeTask.data?.status === 'completed' && analyzeTask.data.result) {
      const { analysis_id, result, report_paths } = analyzeTask.data.result
      setBrainResult(analysis_id, result, report_paths)
      setAnalyzeTaskId(null)
    }
    if (analyzeTask.data?.status === 'failed') {
      setUploadError(analyzeTask.data.error || 'Analysis failed')
      setAnalyzeTaskId(null)
    }
  }, [analyzeTask.data, setBrainResult])

  // Handle gradcam task completion
  useEffect(() => {
    if (gradcamTask.data?.status === 'completed' && gradcamTask.data.result) {
      const { images } = gradcamTask.data.result
      const orient = selectedOrientation === 'Multi-view' ? 'multi' : selectedOrientation.toLowerCase()
      const mode = selectedDisplayMode === 'Overlay' ? 'overlay' : 'heatmap'
      setGradcam(images, orient, mode)
      setGradcamTaskId(null)
    }
    if (gradcamTask.data?.status === 'failed') {
      setUploadError(gradcamTask.data.error || 'GradCAM generation failed')
      setGradcamTaskId(null)
    }
  }, [gradcamTask.data, setGradcam, selectedOrientation, selectedDisplayMode])

  // Handle explain task completion
  useEffect(() => {
    if (explainTask.data?.status === 'completed' && explainTask.data.result) {
      const { answer, sources } = explainTask.data.result
      setBrainExplanation(answer, sources)
      setExplainTaskId(null)
    }
    if (explainTask.data?.status === 'failed') {
      setUploadError(explainTask.data.error || 'Explanation generation failed')
      setExplainTaskId(null)
    }
  }, [explainTask.data, setBrainExplanation])

  const handleUpload = async (file: File | null) => {
    if (!file) {
      setBrainFile('', '')
      return
    }
    setIsUploading(true)
    setUploadError(null)
    try {
      const { file_id, filename } = await brainApi.upload(file)
      setBrainFile(file_id, filename)
    } catch {
      setUploadError('Upload failed. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  const handleAnalyze = async () => {
    if (!brainFileId) return
    setUploadError(null)
    try {
      const { task_id } = await brainApi.analyze(brainFileId, patientCaseId, brainAge, brainSex)
      setAnalyzeTaskId(task_id)
    } catch {
      setUploadError('Failed to start analysis. Please try again.')
    }
  }

  const handleGradcam = async () => {
    if (!brainFileId || !brainAnalysisId) return
    setUploadError(null)
    try {
      const orient = selectedOrientation === 'Multi-view' ? 'multi' : selectedOrientation.toLowerCase()
      const mode = selectedDisplayMode === 'Overlay' ? 'overlay' : 'heatmap'
      const { task_id } = await brainApi.gradcam(brainFileId, patientCaseId, brainAnalysisId, orient, mode, brainAge, brainSex)
      setGradcamTaskId(task_id)
    } catch {
      setUploadError('Failed to start GradCAM generation.')
    }
  }

  const handleExplain = async () => {
    if (!brainAnalysisId || !brainResult) return
    setUploadError(null)
    try {
      const gradcamInfo = gradcamImages.length > 0 ? { images: gradcamImages } : undefined
      const { task_id } = await brainApi.explain(
        patientCaseId,
        brainAnalysisId,
        brainResult,
        gradcamInfo
      )
      setExplainTaskId(task_id)
    } catch {
      setUploadError('Failed to generate explanation.')
    }
  }

  const handleBrainChat = async (message: string) => {
    if (!brainResult) return
    addBrainMessage({ role: 'user', content: message })
    setIsChatLoading(true)
    try {
      const gradcamInfo = gradcamImages.length > 0 ? { images: gradcamImages } : undefined
      const resp = await brainApi.chat(message, brainResult, gradcamInfo, brainMessages)
      addBrainMessage({ role: 'assistant', content: resp.answer })
    } catch {
      addBrainMessage({ role: 'assistant', content: 'Sorry, I could not process your question. Please try again.' })
    } finally {
      setIsChatLoading(false)
    }
  }

  const isAnalyzing =
    analyzeTask.data?.status === 'pending' || analyzeTask.data?.status === 'running'
  const isGeneratingGradcam =
    gradcamTask.data?.status === 'pending' || gradcamTask.data?.status === 'running'
  const isGeneratingExplanation =
    explainTask.data?.status === 'pending' || explainTask.data?.status === 'running'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Brain Scan Analysis</h1>

      {uploadError && <Note message={uploadError} variant="error" />}

      {/* Step 1: Upload */}
      <StepCard
        step={1}
        title="Upload MRI File"
        description="Select a .nii or .nii.gz NIfTI brain scan file."
      />
      <FileDropzone
        accept={{ 'application/octet-stream': ['.nii', '.gz'] }}
        onFile={handleUpload}
        label="Drag & drop your MRI file (.nii, .nii.gz)"
        sublabel="Supports NIfTI format (.nii, .nii.gz)"
        file={brainFileName ? new File([], brainFileName) : null}
        disabled={isUploading}
      />
      {isUploading && <Spinner message="Uploading file..." />}

      {/* Step 2: Patient Information (visible after file uploaded) */}
      {brainFileId && (
        <>
          <StepCard step={2} title="Patient Information" description="Enter demographic details to improve analysis accuracy." />
          <Card>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>
                  Age (years)
                </label>
                <input
                  type="number"
                  min={40}
                  max={100}
                  value={brainAge}
                  onChange={(e) => setBrainAge(Number(e.target.value))}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border, #ddd)',
                    fontSize: 14,
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>Sex</label>
                <select
                  value={brainSex}
                  onChange={(e) => setBrainSex(e.target.value as 'F' | 'M')}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border, #ddd)',
                    fontSize: 14,
                    width: '100%',
                    boxSizing: 'border-box',
                    background: '#fff',
                  }}
                >
                  <option value="F">Female</option>
                  <option value="M">Male</option>
                </select>
              </div>
            </div>
          </Card>

          {/* Step 3: Analyze */}
          <StepCard
            step={3}
            title="Analyze Brain Scan"
            description="Run the 3D CNN model on the uploaded scan."
          />
          <Button
            variant="primary"
            fullWidth
            disabled={!brainFileId || isAnalyzing}
            loading={isAnalyzing}
            onClick={handleAnalyze}
          >
            Analyze Brain Scan
          </Button>
          {isAnalyzing && (
            <Spinner message="Analyzing brain scan... This may take 30-60 seconds" />
          )}
        </>
      )}

      {/* Results */}
      {brainResult && (
        <>
          <h2 style={{ margin: '8px 0 0', fontSize: 18, fontWeight: 700 }}>Analysis Results</h2>

          <ResultCard
            prediction={brainResult.prediction}
            confidence={brainResult.confidence}
            probCn={brainResult.prob_cn}
            probAd={brainResult.prob_ad}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <MetricCard
              label="Confidence"
              value={`${(brainResult.confidence * 100).toFixed(1)}%`}
              highlight={brainResult.confidence > 0.8}
            />
            <MetricCard
              label="Prob. Normal"
              value={`${(brainResult.prob_cn * 100).toFixed(1)}%`}
            />
            <MetricCard
              label="Prob. AD"
              value={`${(brainResult.prob_ad * 100).toFixed(1)}%`}
            />
          </div>

          {/* Visual Explanation GradCAM */}
          <Accordion title="Visual Explanation (GradCAM)" defaultOpen={false}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Orientation selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>
                  Orientation
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {ORIENTATIONS.map((o) => (
                    <label
                      key={o}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        cursor: 'pointer',
                        fontSize: 14,
                        padding: '4px 12px',
                        borderRadius: 20,
                        border: `1px solid ${selectedOrientation === o ? 'var(--primary)' : 'var(--border, #ddd)'}`,
                        background: selectedOrientation === o ? 'var(--primary-light, #e0e7ff)' : 'transparent',
                        color: selectedOrientation === o ? 'var(--primary)' : 'inherit',
                        fontWeight: selectedOrientation === o ? 600 : 400,
                        userSelect: 'none',
                      }}
                    >
                      <input
                        type="radio"
                        name="orientation"
                        value={o}
                        checked={selectedOrientation === o}
                        onChange={() => setSelectedOrientation(o)}
                        style={{ display: 'none' }}
                      />
                      {o}
                    </label>
                  ))}
                </div>
              </div>

              {/* Display mode selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>
                  Display Mode
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {DISPLAY_MODES.map((m) => (
                    <label
                      key={m}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        cursor: 'pointer',
                        fontSize: 14,
                        padding: '4px 12px',
                        borderRadius: 20,
                        border: `1px solid ${selectedDisplayMode === m ? 'var(--primary)' : 'var(--border, #ddd)'}`,
                        background: selectedDisplayMode === m ? 'var(--primary-light, #e0e7ff)' : 'transparent',
                        color: selectedDisplayMode === m ? 'var(--primary)' : 'inherit',
                        fontWeight: selectedDisplayMode === m ? 600 : 400,
                        userSelect: 'none',
                      }}
                    >
                      <input
                        type="radio"
                        name="displayMode"
                        value={m}
                        checked={selectedDisplayMode === m}
                        onChange={() => setSelectedDisplayMode(m)}
                        style={{ display: 'none' }}
                      />
                      {m}
                    </label>
                  ))}
                </div>
              </div>

              <Button
                variant="secondary"
                onClick={handleGradcam}
                loading={isGeneratingGradcam}
                disabled={isGeneratingGradcam || !brainAnalysisId}
              >
                Generate Visual Explanation
              </Button>

              {isGeneratingGradcam && (
                <Spinner message="Generating visual explanation..." />
              )}

              {gradcamImages.length > 0 && (
                <>
                  <GradCAMGrid
                    images={gradcamImages}
                    displayMode={selectedDisplayMode === 'Overlay' ? 'overlay' : 'heatmap'}
                  />
                  <ColorLegend />
                </>
              )}
            </div>
          </Accordion>

          {/* Detailed Medical Explanation */}
          <Accordion title="Detailed Medical Explanation" defaultOpen={false}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Button
                variant="secondary"
                onClick={handleExplain}
                loading={isGeneratingExplanation}
                disabled={isGeneratingExplanation || !brainAnalysisId}
              >
                Generate Explanation
              </Button>

              {isGeneratingExplanation && (
                <Spinner message="Retrieving medical evidence..." />
              )}

              {brainExplanation && (
                <div
                  style={{
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.7,
                    fontSize: 14,
                    color: 'var(--text)',
                    background: 'var(--surface-2, #f9f9f9)',
                    borderRadius: 8,
                    padding: '12px 16px',
                  }}
                >
                  {brainExplanation}
                </div>
              )}

              {brainSources.length > 0 && (
                <div>
                  <strong style={{ fontSize: 13 }}>Sources:</strong>
                  <div
                    style={{
                      marginTop: 6,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    {brainSources.map((s, i) => (
                      <div key={i} style={{ fontSize: 13, color: 'var(--muted)' }}>
                        &bull; {s.source}
                        {s.page !== undefined && s.page !== '' && ` (p. ${s.page})`}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Accordion>

          {/* Chat section */}
          <Accordion title="Ask About Your Results" defaultOpen={false}>
            <ChatPanel
              messages={brainMessages}
              onSend={handleBrainChat}
              isLoading={isChatLoading}
              placeholder="Ask a question about the brain scan results..."
            />
          </Accordion>

          {/* Report */}
          {brainReportPaths && (
            <ReportCard
              analysisType="Brain Scan Analysis"
              analysisId={brainAnalysisId}
              htmlPath={brainReportPaths.html}
              mdPath={brainReportPaths.md}
              pdfPath={brainReportPaths.pdf}
            />
          )}
        </>
      )}
    </div>
  )
}
