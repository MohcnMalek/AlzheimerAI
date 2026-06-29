import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { reportsApi } from '../api/reports'
import { patientsApi } from '../api/patients'
import { usePollTask } from '../hooks/usePollTask'
import type { ReportEntry, HistoryEntry } from '../types'

import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import Note from '../components/ui/Note'
import ReportCard from '../components/domain/ReportCard'
import TimelineItem from '../components/domain/TimelineItem'

export default function Reports() {
  const { patientCaseId } = useStore()

  const [inputId, setInputId] = useState(patientCaseId)
  const [loadedId, setLoadedId] = useState('')
  const [reports, setReports] = useState<ReportEntry[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [combinedTaskId, setCombinedTaskId] = useState<string | null>(null)

  const combinedTask = usePollTask<{ md?: string; html?: string; pdf?: string }>(combinedTaskId)

  // Auto-load when the store's active case changes
  useEffect(() => {
    if (patientCaseId) {
      setInputId(patientCaseId)
      loadReports(patientCaseId)
    }
  }, [patientCaseId])

  useEffect(() => {
    if (combinedTask.data?.status === 'completed') {
      setCombinedTaskId(null)
      loadReports(loadedId)
    }
    if (combinedTask.data?.status === 'failed') {
      setError(combinedTask.data.error || 'Combined report generation failed.')
      setCombinedTaskId(null)
    }
  }, [combinedTask.data, loadedId])

  const loadReports = async (caseId: string) => {
    const id = caseId.trim()
    if (!id) return
    setIsLoading(true)
    setError(null)
    try {
      const [reportsData, historyData] = await Promise.all([
        reportsApi.list(id),
        patientsApi.getHistory(id),
      ])
      setReports(reportsData)
      setHistory(historyData)
      setLoadedId(id)
    } catch {
      setError('Failed to load reports. Please check the patient case ID.')
      setReports([])
      setHistory([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = () => loadReports(inputId)

  const handleGenerateCombined = async () => {
    if (!loadedId) return
    setError(null)
    try {
      const { task_id } = await reportsApi.generateCombined(loadedId)
      setCombinedTaskId(task_id)
    } catch {
      setError('Failed to start combined report generation.')
    }
  }

  const isGeneratingCombined =
    combinedTask.data?.status === 'pending' || combinedTask.data?.status === 'running'

  const hasResults = reports.length > 0 || history.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Reports & History</h1>

      {error && <Note message={error} variant="error" />}

      {/* Patient case selector */}
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>
            Patient Case ID
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={inputId}
              onChange={(e) => setInputId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="PAT-XXXX-YYYY"
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--border, #ddd)',
                fontSize: 14,
                fontFamily: 'inherit',
              }}
            />
            <Button
              variant="primary"
              onClick={handleSearch}
              disabled={!inputId.trim() || isLoading}
              loading={isLoading}
            >
              Load
            </Button>
          </div>
        </div>
      </Card>

      {isLoading && <Spinner message="Loading reports..." />}

      {/* Reports list */}
      {!isLoading && reports.length > 0 && (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
              Reports ({reports.length})
            </h2>
            <Button
              variant="secondary"
              onClick={handleGenerateCombined}
              loading={isGeneratingCombined}
              disabled={isGeneratingCombined}
            >
              Generate Combined Report
            </Button>
          </div>

          {isGeneratingCombined && (
            <Spinner message="Generating combined multimodal report..." />
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {reports.map((report, i) => (
              <ReportCard
                key={report.id ?? i}
                analysisType={report.analysis_type || 'report'}
                analysisId={report.analysis_id}
                createdAt={report.created_at}
                htmlPath={report.report_html_path}
                mdPath={report.report_md_path}
                pdfPath={report.report_pdf_path}
              />
            ))}
          </div>
        </>
      )}

      {/* Analysis history timeline */}
      {!isLoading && history.length > 0 && (
        <>
          <h2 style={{ margin: '8px 0 0', fontSize: 18, fontWeight: 700 }}>
            Analysis History
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {history.map((item, i) => (
              <TimelineItem
                key={i}
                analysisType={item.analysis_type}
                analysisId={item.analysis_id}
                result={item.result}
                confidence={item.confidence}
                createdAt={item.created_at}
              />
            ))}
          </div>
        </>
      )}

      {/* Empty state */}
      {!isLoading && loadedId && !hasResults && !error && (
        <Card>
          <div
            style={{
              textAlign: 'center',
              padding: '32px 0',
              color: 'var(--muted)',
              fontSize: 14,
            }}
          >
            No reports or analyses found for <strong>{loadedId}</strong>.
          </div>
        </Card>
      )}
    </div>
  )
}
