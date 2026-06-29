import { FileCode, FileText, File } from 'lucide-react'
import { reportsApi } from '../../api/reports'
import Button from '../ui/Button'
import Card from '../ui/Card'
import styles from './ReportCard.module.css'

interface ReportCardProps {
  analysisType: string
  analysisId?: string | null
  createdAt?: string | null
  htmlPath?: string | null
  mdPath?: string | null
  pdfPath?: string | null
}

const ANALYSIS_LABELS: Record<string, string> = {
  brain: 'Brain MRI Analysis',
  speech: 'Speech & Language Analysis',
  brain_mri: 'Brain MRI Analysis',
  speech_nlp: 'Speech & Language Analysis',
}

export default function ReportCard({
  analysisType,
  analysisId,
  createdAt,
  htmlPath,
  mdPath,
  pdfPath,
}: ReportCardProps) {
  const hasAny = htmlPath || mdPath || pdfPath
  const label = ANALYSIS_LABELS[analysisType] ?? analysisType

  const open = (path: string) => {
    window.open(reportsApi.downloadUrl(path), '_blank', 'noopener,noreferrer')
  }

  const isBrain = analysisType.toLowerCase().includes('brain')
  const accentColor = isBrain ? 'var(--deep)' : 'var(--violet)'

  return (
    <Card className={styles.card} style={{ borderLeft: `4px solid ${accentColor}` }}>
      <div className={styles.topRow}>
        <div className={styles.meta}>
          <div className={styles.analysisType}>{label}</div>
          {analysisId && (
            <div className={styles.analysisId}>{analysisId}</div>
          )}
          {createdAt && (
            <div className={styles.date}>
              {new Date(createdAt).toLocaleString('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </div>
          )}
        </div>
        <span className={styles.badge} style={{ color: accentColor, background: `${accentColor}18` }}>
          Report
        </span>
      </div>

      {hasAny ? (
        <div className={styles.buttons}>
          {htmlPath && (
            <button className={styles.dlBtn} onClick={() => open(htmlPath)}>
              <FileCode size={14} />
              View HTML
            </button>
          )}
          {mdPath && (
            <button className={styles.dlBtn} onClick={() => open(mdPath)}>
              <FileText size={14} />
              Markdown
            </button>
          )}
          {pdfPath && (
            <button className={styles.dlBtn} onClick={() => open(pdfPath)}>
              <File size={14} />
              PDF
            </button>
          )}
        </div>
      ) : (
        <p className={styles.noFiles}>No report files available.</p>
      )}
    </Card>
  )
}
