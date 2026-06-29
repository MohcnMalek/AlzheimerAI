import styles from './ResultCard.module.css'

interface ResultCardProps {
  prediction: string
  confidence: number
  probCn?: number
  probAd?: number
}

type PredictionConfig = {
  label: string
  gradient: string
  badgeColor: string
  icon: string
}

function getPredictionConfig(prediction: string): PredictionConfig {
  switch (prediction) {
    case 'CN':
    case 'Control':
      return {
        label: prediction === 'CN' ? 'Cognitively Normal' : 'No Significant Impairment Detected',
        gradient: 'linear-gradient(135deg, #e8f8f1 0%, #d0f0e2 100%)',
        badgeColor: 'var(--emerald)',
        icon: '✓',
      }
    case 'AD':
      return {
        label: "Alzheimer's Pattern Detected",
        gradient: 'linear-gradient(135deg, #fdf0ec 0%, #fad9cf 100%)',
        badgeColor: 'var(--coral)',
        icon: '⚠',
      }
    case 'ProbableAD':
      return {
        label: "Probable Alzheimer's Pattern",
        gradient: 'linear-gradient(135deg, #fef8ec 0%, #fdecc8 100%)',
        badgeColor: 'var(--gold)',
        icon: '⚠',
      }
    default:
      return {
        label: prediction,
        gradient: 'linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%)',
        badgeColor: 'var(--muted)',
        icon: '?',
      }
  }
}

export default function ResultCard({ prediction, confidence, probCn, probAd }: ResultCardProps) {
  const config = getPredictionConfig(prediction)
  const pct = Math.round(confidence * 100)

  return (
    <div
      className={styles.resultCard}
      style={{ background: config.gradient, border: `2px solid ${config.badgeColor}33` }}
    >
      <div className={styles.topRow}>
        <div
          className={styles.iconCircle}
          style={{ background: config.badgeColor }}
        >
          {config.icon}
        </div>
        <div className={styles.textBlock}>
          <div className={styles.label} style={{ color: config.badgeColor }}>
            {prediction}
          </div>
          <div className={styles.sublabel}>{config.label}</div>
        </div>
        <div className={styles.confidenceBadge} style={{ background: config.badgeColor }}>
          {pct}% confident
        </div>
      </div>

      {(probCn !== undefined || probAd !== undefined) && (
        <div className={styles.bars}>
          {probCn !== undefined && (
            <div className={styles.barGroup}>
              <div className={styles.barLabel}>
                <span>Cognitively Normal</span>
                <span>{Math.round(probCn * 100)}%</span>
              </div>
              <div className={styles.barTrack}>
                <div
                  className={styles.barFill}
                  style={{
                    width: `${probCn * 100}%`,
                    background: 'var(--emerald)',
                  }}
                />
              </div>
            </div>
          )}
          {probAd !== undefined && (
            <div className={styles.barGroup}>
              <div className={styles.barLabel}>
                <span>Alzheimer's Pattern</span>
                <span>{Math.round(probAd * 100)}%</span>
              </div>
              <div className={styles.barTrack}>
                <div
                  className={styles.barFill}
                  style={{
                    width: `${probAd * 100}%`,
                    background: 'var(--coral)',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
