import styles from './TimelineItem.module.css'

interface TimelineItemProps {
  analysisType: string
  analysisId: string
  result: string
  confidence: number
  createdAt: string
}

const ANALYSIS_LABELS: Record<string, string> = {
  brain: 'Brain MRI',
  speech: 'Speech & Language',
  brain_mri: 'Brain MRI',
  speech_nlp: 'Speech & Language',
}

function getResultStyle(result: string): { bg: string; text: string; dot: string } {
  const lower = result.toLowerCase()
  if (lower === 'cn' || lower === 'control') {
    return { bg: 'rgba(47,175,112,0.1)', text: 'var(--emerald)', dot: 'var(--emerald)' }
  }
  if (lower === 'ad') {
    return { bg: 'rgba(224,92,58,0.1)', text: 'var(--coral)', dot: 'var(--coral)' }
  }
  if (lower === 'probablead') {
    return { bg: 'rgba(232,160,32,0.12)', text: 'var(--gold)', dot: 'var(--gold)' }
  }
  return { bg: 'rgba(107,140,130,0.1)', text: 'var(--muted)', dot: 'var(--muted)' }
}

export default function TimelineItem({
  analysisType,
  analysisId,
  result,
  confidence,
  createdAt,
}: TimelineItemProps) {
  const label = ANALYSIS_LABELS[analysisType] ?? analysisType
  const pct = Math.round(confidence * 100)
  const style = getResultStyle(result)

  return (
    <div className={styles.item}>
      <div className={styles.dotCol}>
        <div className={styles.dot} style={{ background: style.dot }} />
        <div className={styles.line} />
      </div>
      <div className={styles.body}>
        <div className={styles.topRow}>
          <div className={styles.typeLabel}>{label}</div>
          <span
            className={styles.resultBadge}
            style={{ background: style.bg, color: style.text }}
          >
            {result}
          </span>
        </div>
        <div className={styles.idRow}>
          <code className={styles.id}>{analysisId}</code>
          <span className={styles.confidence}>{pct}% confidence</span>
        </div>
        <div className={styles.date}>
          {new Date(createdAt).toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </div>
      </div>
    </div>
  )
}
