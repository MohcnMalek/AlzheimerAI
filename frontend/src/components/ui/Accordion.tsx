import { useState, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import styles from './Accordion.module.css'

interface AccordionProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}

export default function Accordion({ title, children, defaultOpen = false }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const contentRef = useRef<HTMLDivElement>(null)

  return (
    <div className={`card ${styles.accordion}`}>
      <button
        className={styles.header}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className={styles.title}>{title}</span>
        <ChevronDown
          size={18}
          className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
        />
      </button>
      <div
        className={styles.body}
        style={{
          maxHeight: open ? (contentRef.current?.scrollHeight ?? 2000) + 'px' : '0px',
        }}
      >
        <div ref={contentRef} className={styles.inner}>
          {children}
        </div>
      </div>
    </div>
  )
}
