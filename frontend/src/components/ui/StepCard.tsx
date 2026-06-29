import styles from './StepCard.module.css'

interface StepCardProps {
  step: number
  title: string
  description?: string
}

export default function StepCard({ step, title, description }: StepCardProps) {
  return (
    <div className={`card ${styles.stepCard}`}>
      <div className={styles.stepCircle}>
        <span>{step}</span>
      </div>
      <div className={styles.content}>
        <div className={styles.title}>{title}</div>
        {description && <div className={styles.description}>{description}</div>}
      </div>
    </div>
  )
}
