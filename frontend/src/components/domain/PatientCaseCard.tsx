import { useState } from 'react'
import { Copy, CheckCheck, RefreshCw } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { patientsApi } from '../../api/patients'
import Card from '../ui/Card'
import styles from './PatientCaseCard.module.css'

export default function PatientCaseCard() {
  const { patientCaseId, setPatientCaseId, resetPatient, brainFileName, speechFileName } = useStore()
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!patientCaseId) return
    await navigator.clipboard.writeText(patientCaseId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleReset = async () => {
    const id = await patientsApi.newCaseId()
    setPatientCaseId(id)
    resetPatient()
  }

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.title}>Current Patient Case</h3>
        {patientCaseId ? (
          <span className={styles.badgeActive}>Active</span>
        ) : (
          <span className={styles.badgeNone}>No Case</span>
        )}
      </div>

      {patientCaseId ? (
        <>
          <div className={styles.idRow}>
            <code className={styles.caseId}>{patientCaseId}</code>
            <button
              className={styles.iconBtn}
              onClick={handleCopy}
              title="Copy case ID"
              aria-label="Copy case ID"
            >
              {copied ? <CheckCheck size={15} color="var(--emerald)" /> : <Copy size={15} />}
            </button>
          </div>

          <div className={styles.divider} />

          <div className={styles.fileRow}>
            <div className={styles.fileItem}>
              <span className={styles.fileLabel}>Brain scan</span>
              <span className={`${styles.fileValue} ${brainFileName ? styles.fileSet : styles.fileEmpty}`}>
                {brainFileName || 'Not uploaded'}
              </span>
            </div>
            <div className={styles.fileItem}>
              <span className={styles.fileLabel}>Speech file</span>
              <span className={`${styles.fileValue} ${speechFileName ? styles.fileSet : styles.fileEmpty}`}>
                {speechFileName || 'Not uploaded'}
              </span>
            </div>
          </div>

          <button className={styles.resetBtn} onClick={handleReset}>
            <RefreshCw size={13} />
            New Case
          </button>
        </>
      ) : (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>
            No active patient case. Click "New Case" to start a new session.
          </p>
          <button className={styles.createBtn} onClick={handleReset}>
            <RefreshCw size={14} />
            Create New Case
          </button>
        </div>
      )}
    </Card>
  )
}
