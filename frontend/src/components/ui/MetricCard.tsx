import styles from './MetricCard.module.css'

interface MetricCardProps {
  label: string
  value: string | number
  unit?: string
  highlight?: boolean
}

export default function MetricCard({ label, value, unit, highlight = false }: MetricCardProps) {
  return (
    <div className={`card ${styles.metricCard} ${highlight ? styles.highlight : ''}`}>
      <div className={styles.label}>{label}</div>
      <div className={styles.valueRow}>
        <span className={styles.value}>{value}</span>
        {unit && <span className={styles.unit}>{unit}</span>}
      </div>
    </div>
  )
}
