import { useNavigate, useLocation } from 'react-router-dom'
import {
  Home,
  Brain,
  Mic2,
  FileText,
  Info,
  RefreshCw,
  Activity,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import { patientsApi } from '../../api/patients'
import { useHealth } from '../../hooks/useHealth'
import styles from './Sidebar.module.css'

const NAV = [
  { label: 'Home', path: '/', icon: Home },
  { label: 'Brain Scan', path: '/brain', icon: Brain },
  { label: 'Speech & Language', path: '/speech', icon: Mic2 },
  { label: 'Reports', path: '/reports', icon: FileText },
  { label: 'About', path: '/about', icon: Info },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { patientCaseId, setPatientCaseId, resetPatient } = useStore()
  const { data: health, isError } = useHealth()

  const handleNewCase = async () => {
    try {
      const id = await patientsApi.newCaseId()
      resetPatient()
      setPatientCaseId(id)
    } catch {
      const fallback = `case-${Date.now()}`
      resetPatient()
      setPatientCaseId(fallback)
    }
  }

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)

  return (
    <aside className={styles.sidebar}>
      {/* Brand header */}
      <div className={styles.header}>
        <div className={styles.logoIcon}>
          <Activity size={22} />
        </div>
        <div>
          <div className={styles.appName}>AlzheimerAI</div>
          <div className={styles.appSub}>Multimodal Assistant</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className={styles.nav}>
        {NAV.map(({ label, path, icon: Icon }) => (
          <button
            key={path}
            className={`${styles.navItem} ${isActive(path) ? styles.active : ''}`}
            onClick={() => navigate(path)}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {/* Patient case box */}
      <div className={styles.patientBox}>
        <div className={styles.patientLabel}>Current Patient Case</div>
        <div className={styles.patientId}>{patientCaseId || 'No case selected'}</div>
        <button className={styles.newCaseBtn} onClick={handleNewCase}>
          <RefreshCw size={13} />
          New Case
        </button>
      </div>

      {/* System status */}
      <div className={styles.statusBox}>
        <div className={styles.statusRow}>
          <span className={styles.statusLabel}>Backend</span>
          {isError ? (
            <span className={styles.statusBad}>
              <AlertTriangle size={11} /> Offline
            </span>
          ) : health ? (
            <span className={styles.statusGood}>
              <CheckCircle2 size={11} /> Online
            </span>
          ) : (
            <span className={styles.statusPending}>
              <div className="spinner spinner-sm" style={{ width: 10, height: 10 }} /> ...
            </span>
          )}
        </div>
        {health && (
          <>
            <div className={styles.statusRow}>
              <span className={styles.statusLabel}>CNN Model</span>
              {health.models.cnn ? (
                <span className={styles.statusGood}>Ready</span>
              ) : (
                <span className={styles.statusBad}>Not ready</span>
              )}
            </div>
            <div className={styles.statusRow}>
              <span className={styles.statusLabel}>NLP Model</span>
              {health.models.nlp ? (
                <span className={styles.statusGood}>Ready</span>
              ) : (
                <span className={styles.statusBad}>Not ready</span>
              )}
            </div>
            <div className={styles.statusRow}>
              <span className={styles.statusLabel}>Database</span>
              {health.db ? (
                <span className={styles.statusGood}>Connected</span>
              ) : (
                <span className={styles.statusWarn}>Offline</span>
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  )
}
