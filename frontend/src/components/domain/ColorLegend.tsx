import styles from './ColorLegend.module.css'

export default function ColorLegend() {
  return (
    <div className={styles.wrapper}>
      <span className={styles.heading}>Activation:</span>
      <div className={styles.legendBody}>
        <div className={styles.gradient} />
        <div className={styles.labels}>
          <span>Low</span>
          <span>Moderate</span>
          <span>High</span>
        </div>
      </div>
    </div>
  )
}
