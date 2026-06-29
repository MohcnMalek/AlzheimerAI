import styles from './Spinner.module.css'

interface SpinnerProps {
  message?: string
  size?: 'sm' | 'md' | 'lg'
}

const SIZE_MAP = { sm: 20, md: 36, lg: 56 }
const BORDER_MAP = { sm: 2, md: 3, lg: 4 }

export default function Spinner({ message, size = 'md' }: SpinnerProps) {
  const px = SIZE_MAP[size]
  const border = BORDER_MAP[size]

  return (
    <div className={styles.wrapper}>
      <div
        className={styles.ring}
        style={{
          width: px,
          height: px,
          borderWidth: border,
        }}
        role="status"
        aria-label={message ?? 'Loading…'}
      />
      {message && <p className={styles.message}>{message}</p>}
    </div>
  )
}
