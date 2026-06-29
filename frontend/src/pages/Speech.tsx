import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { speechApi } from '../api/speech'
import { usePollTask } from '../hooks/usePollTask'
import type { SpeechAnalyzeResult } from '../types'

import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import StepCard from '../components/ui/StepCard'
import ResultCard from '../components/ui/ResultCard'
import Spinner from '../components/ui/Spinner'
import Note from '../components/ui/Note'
import Accordion from '../components/ui/Accordion'
import FileDropzone from '../components/ui/FileDropzone'
import ChatPanel from '../components/domain/ChatPanel'
import FeatureGrid from '../components/domain/FeatureGrid'
import ReportCard from '../components/domain/ReportCard'

export default function Speech() {
  const {
    patientCaseId,
    speechFileName,
    speechTranscript,
    speechCleanedTranscript,
    speechFeatures,
    speechFeatureVector,
    speechAnalysisId,
    speechResult,
    speechReportPaths,
    speechExplanation,
    speechMessages,
    patientInfo,
    setSpeechFile,
    setSpeechResult,
    setSpeechExplanation,
    addSpeechMessage,
    setPatientInfo,
  } = useStore()

  const [parseError, setParseError] = useState<string | null>(null)
  const [analyzeTaskId, setAnalyzeTaskId] = useState<string | null>(null)
  const [explainTaskId, setExplainTaskId] = useState<string | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isChatLoading, setIsChatLoading] = useState(false)

  const analyzeTask = usePollTask<SpeechAnalyzeResult>(analyzeTaskId)
  const explainTask = usePollTask<{ answer: string }>(explainTaskId)

  // Handle analyze task completion
  useEffect(() => {
    if (analyzeTask.data?.status === 'completed' && analyzeTask.data.result) {
      const { analysis_id, result, report_paths, explanation } = analyzeTask.data.result
      setSpeechResult(analysis_id, result, report_paths, explanation)
      setAnalyzeTaskId(null)
    }
    if (analyzeTask.data?.status === 'failed') {
      setParseError(analyzeTask.data.error || 'Analysis failed')
      setAnalyzeTaskId(null)
    }
  }, [analyzeTask.data, setSpeechResult])

  // Handle explain task completion
  useEffect(() => {
    if (explainTask.data?.status === 'completed' && explainTask.data.result) {
      setSpeechExplanation(explainTask.data.result.answer)
      setExplainTaskId(null)
    }
    if (explainTask.data?.status === 'failed') {
      setParseError(explainTask.data.error || 'Explanation generation failed')
      setExplainTaskId(null)
    }
  }, [explainTask.data, setSpeechExplanation])

  const handleParse = async (file: File | null) => {
    if (!file) {
      setSpeechFile('', '', '', { n_filled_pauses: 0, n_phon_fragments: 0, n_paralinguistic: 0, n_retracings: 0, n_unintelligible: 0, n_pauses: 0, entryage: 0, sex: 0, educ: 0 }, [])
      return
    }
    setIsParsing(true)
    setParseError(null)
    try {
      const result = await speechApi.parse(file)
      setSpeechFile(file.name, result.transcript, result.cleaned_transcript, result.features, result.feature_vector)
    } catch {
      setParseError('Failed to parse CHAT file. Please ensure it is a valid .cha file.')
    } finally {
      setIsParsing(false)
    }
  }

  const handleAnalyze = async () => {
    if (!speechTranscript) return
    setParseError(null)
    try {
      const { task_id } = await speechApi.analyze(
        patientCaseId,
        speechTranscript,
        speechFeatureVector,
        patientInfo
      )
      setAnalyzeTaskId(task_id)
    } catch {
      setParseError('Failed to start analysis. Please try again.')
    }
  }

  const handleRegenExplain = async () => {
    if (!speechAnalysisId || !speechResult) return
    setParseError(null)
    try {
      const { task_id } = await speechApi.explain(
        patientCaseId,
        speechAnalysisId,
        speechTranscript,
        speechResult,
        speechFeatureVector
      )
      setExplainTaskId(task_id)
    } catch {
      setParseError('Failed to regenerate explanation.')
    }
  }

  const handleSpeechChat = async (message: string) => {
    if (!speechResult) return
    addSpeechMessage({ role: 'user', content: message })
    setIsChatLoading(true)
    try {
      const resp = await speechApi.chat(message, speechResult, speechTranscript, speechMessages)
      addSpeechMessage({ role: 'assistant', content: resp.answer })
    } catch {
      addSpeechMessage({ role: 'assistant', content: 'Sorry, I could not process your question. Please try again.' })
    } finally {
      setIsChatLoading(false)
    }
  }

  const isAnalyzing =
    analyzeTask.data?.status === 'pending' || analyzeTask.data?.status === 'running'
  const isGeneratingExplanation =
    explainTask.data?.status === 'pending' || explainTask.data?.status === 'running'

  const wordCount = speechTranscript
    ? speechTranscript.split(/\s+/).filter(Boolean).length
    : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Speech & Language Analysis</h1>

      {parseError && <Note message={parseError} variant="error" />}

      {/* Step 1: Patient Information */}
      <StepCard
        step={1}
        title="Patient Information"
        description="Enter optional patient details to include in the report."
      />
      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>
              Patient Name
            </label>
            <input
              type="text"
              placeholder="Patient Name"
              value={patientInfo.name || ''}
              onChange={(e) => setPatientInfo({ ...patientInfo, name: e.target.value })}
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
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>
              Study Date
            </label>
            <input
              type="date"
              value={patientInfo.study_date || ''}
              onChange={(e) => setPatientInfo({ ...patientInfo, study_date: e.target.value })}
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
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>
              Responsible Clinician
            </label>
            <input
              type="text"
              placeholder="Responsible Clinician"
              value={patientInfo.responsible_clinician || ''}
              onChange={(e) =>
                setPatientInfo({ ...patientInfo, responsible_clinician: e.target.value })
              }
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
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>
              Clinical Notes
            </label>
            <textarea
              placeholder="Clinical Notes"
              value={patientInfo.clinical_notes || ''}
              onChange={(e) =>
                setPatientInfo({ ...patientInfo, clinical_notes: e.target.value })
              }
              rows={3}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--border, #ddd)',
                fontSize: 14,
                resize: 'vertical',
                fontFamily: 'inherit',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      </Card>

      {/* Step 2: Upload CHAT File */}
      <StepCard
        step={2}
        title="Upload CHAT Transcript (.cha)"
        description="Select a CHAT format transcript file from the DementiaBank or similar dataset."
      />
      <FileDropzone
        accept={{ 'text/plain': ['.cha'] }}
        onFile={handleParse}
        label="Drag & drop your CHAT transcript (.cha)"
        sublabel="CHAT format transcript files only"
        file={speechFileName ? new File([], speechFileName) : null}
        disabled={isParsing}
      />
      {isParsing && <Spinner message="Parsing CHAT file..." />}

      {/* Step 3: Transcript Preview (after parse) */}
      {speechTranscript && (
        <>
          <StepCard
            step={3}
            title="Transcript Preview"
            description="Review the parsed transcript before analysis."
          />
          <Accordion title="Patient Speech (cleaned)" defaultOpen={false}>
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                fontSize: 13,
                lineHeight: 1.6,
                margin: 0,
                fontFamily: 'monospace',
                color: 'var(--text)',
              }}
            >
              {speechCleanedTranscript || speechTranscript}
            </pre>
          </Accordion>
          <div
            style={{
              fontSize: 13,
              color: 'var(--muted)',
              padding: '4px 0',
            }}
          >
            Word count: <strong>{wordCount}</strong> words
          </div>

          {/* Step 4: Feature Extraction */}
          <StepCard
            step={4}
            title="Extracted Speech Features"
            description="Linguistic and clinical features extracted from the transcript."
          />
          {speechFeatures && <FeatureGrid features={speechFeatures} />}

          {/* Step 5: Analyze */}
          <StepCard
            step={5}
            title="Analyze Speech"
            description="Run the HybridRoBERTa model on the transcript and features."
          />
          <Button
            variant="primary"
            fullWidth
            disabled={!speechTranscript || isAnalyzing}
            loading={isAnalyzing}
            onClick={handleAnalyze}
          >
            Analyze Speech Pattern
          </Button>
          {isAnalyzing && <Spinner message="Analyzing speech pattern..." />}
        </>
      )}

      {/* Results */}
      {speechResult && (
        <>
          <h2 style={{ margin: '8px 0 0', fontSize: 18, fontWeight: 700 }}>Analysis Results</h2>

          <ResultCard
            prediction={speechResult.prediction}
            confidence={speechResult.confidence}
          />

          {/* Medical Explanation */}
          <Accordion title="Medical Explanation" defaultOpen>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {speechExplanation ? (
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
                  {speechExplanation}
                </div>
              ) : (
                <Note message="No explanation generated yet." variant="info" />
              )}

              {isGeneratingExplanation && <Spinner message="Generating explanation..." />}

              <Button
                variant="secondary"
                size="sm"
                onClick={handleRegenExplain}
                loading={isGeneratingExplanation}
                disabled={isGeneratingExplanation || !speechAnalysisId}
              >
                Regenerate Explanation
              </Button>
            </div>
          </Accordion>

          {/* Chat */}
          <Accordion title="Ask About Your Results" defaultOpen={false}>
            <ChatPanel
              messages={speechMessages}
              onSend={handleSpeechChat}
              isLoading={isChatLoading}
              placeholder="Ask a question about the speech analysis results..."
            />
          </Accordion>

          {/* Report */}
          {speechReportPaths && (
            <ReportCard
              analysisType="Speech & Language Analysis"
              analysisId={speechAnalysisId}
              htmlPath={speechReportPaths.html}
              mdPath={speechReportPaths.md}
              pdfPath={speechReportPaths.pdf}
            />
          )}
        </>
      )}
    </div>
  )
}
