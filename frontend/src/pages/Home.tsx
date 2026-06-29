import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, Mic, FileText } from 'lucide-react'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import StepCard from '../components/ui/StepCard'
import PatientCaseCard from '../components/domain/PatientCaseCard'
import { useStore } from '../store/useStore'
import { useHealth } from '../hooks/useHealth'
import { patientsApi } from '../api/patients'

const FEATURES = [
  {
    icon: Activity,
    title: 'Brain Scan Analysis',
    description: 'Upload an MRI scan for 3D CNN analysis',
    path: '/brain',
    color: 'var(--primary)',
  },
  {
    icon: Mic,
    title: 'Speech & Language',
    description: 'Upload a CHAT transcript for NLP analysis',
    path: '/speech',
    color: 'var(--emerald, #22c55e)',
  },
  {
    icon: FileText,
    title: 'My Reports',
    description: 'Access your analysis history and reports',
    path: '/reports',
    color: 'var(--gold, #f59e0b)',
  },
]

const HOW_IT_WORKS = [
  { step: 1, title: 'Start Case', description: 'Create a new patient case from the sidebar.' },
  { step: 2, title: 'Upload Data', description: 'Upload a brain MRI scan or a CHAT speech transcript.' },
  { step: 3, title: 'Run Analysis', description: 'AI models analyze the data using CNN and NLP.' },
  { step: 4, title: 'Download Report', description: 'Review results and download reports for clinical review.' },
]

export default function Home() {
  const navigate = useNavigate()
  const { patientCaseId, setPatientCaseId } = useStore()
  const { data: health } = useHealth()

  useEffect(() => {
    if (!patientCaseId) {
      patientsApi.newCaseId().then(setPatientCaseId).catch(() => {/* silent — backend may be offline */})
    }
  }, [patientCaseId, setPatientCaseId])

  const dbConnected = health?.db ?? false

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Hero */}
      <Card
        style={{
          background: 'linear-gradient(135deg, var(--primary-light, #e0e7ff) 0%, #f0f4ff 100%)',
          borderLeft: '4px solid var(--primary)',
          padding: '28px 32px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            <h1 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 800 }}>
              Alzheimer Multimodal Assistant
            </h1>
            <p style={{ margin: 0, color: 'var(--muted)', maxWidth: 520, lineHeight: 1.6 }}>
              AI-powered brain scan and speech analysis for cognitive assessment support.
            </p>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              borderRadius: 20,
              background: dbConnected
                ? 'var(--emerald-light, #d1fae5)'
                : 'var(--error-light, #fee2e2)',
              color: dbConnected ? 'var(--emerald, #059669)' : 'var(--coral, #dc2626)',
              fontSize: 13,
              fontWeight: 600,
              border: `1px solid ${dbConnected ? 'var(--emerald, #059669)33' : 'var(--coral, #dc2626)33'}`,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: dbConnected ? 'var(--emerald, #059669)' : 'var(--coral, #dc2626)',
                display: 'inline-block',
              }}
            />
            {dbConnected ? 'Database connected' : 'Database offline'}
          </div>
        </div>
      </Card>

      {/* Feature cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {FEATURES.map(({ icon: Icon, title, description, path, color }) => (
          <Card
            key={path}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              cursor: 'pointer',
              transition: 'box-shadow 0.15s',
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: color + '1a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color,
              }}
            >
              <Icon size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{title}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>{description}</div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(path)}
              fullWidth
            >
              Open
            </Button>
          </Card>
        ))}
      </div>

      {/* Patient case card */}
      <PatientCaseCard />

      {/* How it works */}
      <div>
        <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>How It Works</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 12,
          }}
        >
          {HOW_IT_WORKS.map(({ step, title, description }) => (
            <StepCard key={step} step={step} title={title} description={description} />
          ))}
        </div>
      </div>

      {/* Medical disclaimer */}
      <Card
        style={{
          borderLeft: '4px solid var(--gold, #f59e0b)',
          background: 'var(--gold-light, #fffbeb)',
        }}
      >
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--gold, #92400e)' }}>Medical Disclaimer: </strong>
          For research and educational purposes only. Not a diagnostic tool. Results must be
          interpreted by qualified healthcare professionals.
        </p>
      </Card>
    </div>
  )
}
