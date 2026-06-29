import styles from './Note.module.css'

interface NoteProps {
  message: string
  variant?: 'info' | 'success' | 'warning' | 'error'
}

const ICONS: Record<string, string> = {
  info: 'ℹ',
  success: '✓',
  warning: '⚠',
  error: '✕',
}

export default function Note({ message, variant = 'info' }: NoteProps) {
  return (
    <div className={`${styles.note} ${styles[variant]}`} role="alert">
      <span className={styles.icon} aria-hidden="true">{ICONS[variant]}</span>
      <span className={styles.message}>{message}</span>
    </div>
  )
}
