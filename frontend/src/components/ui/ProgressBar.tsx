import styles from './ProgressBar.module.css'

interface ProgressBarProps {
  value: number
  label?: string
  color?: string
}

export default function ProgressBar({ value, label, color }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))

  return (
    <div className={styles.wrapper}>
      {label && (
        <div className={styles.labelRow}>
          <span className={styles.label}>{label}</span>
          <span className={styles.pct}>{Math.round(clamped)}%</span>
        </div>
      )}
      <div className={styles.track}>
        <div
          className={styles.fill}
          style={{
            width: `${clamped}%`,
            background: color ?? 'var(--emerald)',
          }}
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  )
}
