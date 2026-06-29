import Card from '../components/ui/Card'

const HOW_TO = [
  {
    step: 1,
    title: 'Identify Patient',
    desc: 'A patient case ID is generated automatically at startup. It persists across browser sessions. Use the sidebar to create a new case at any time.',
  },
  {
    step: 2,
    title: 'Brain Scan Analysis',
    desc: 'Go to Brain Scan, upload a NIfTI (.nii / .nii.gz) file, enter age and sex, then click Analyze. The 3D CNN runs in the background (30–60 s).',
  },
  {
    step: 3,
    title: 'Visual Explanation',
    desc: 'After analysis, open Visual Explanation to generate GradCAM heatmaps showing which brain regions influenced the prediction.',
  },
  {
    step: 4,
    title: 'Speech Analysis',
    desc: 'Go to Speech, upload a CHAT (.cha) transcript. The NLP model extracts linguistic biomarkers and classifies cognitive status.',
  },
  {
    step: 5,
    title: 'Reports',
    desc: 'All reports are saved and accessible by patient case ID. You can download HTML, Markdown, or PDF reports, or generate a combined multimodal report.',
  },
]

const MODELS = [
  {
    name: '3D CNN',
    detail: 'Volumetric convolutional network trained on ADNI MRI scans. Outputs CN / AD classification with probability scores.',
  },
  {
    name: 'GradCAM',
    detail: 'Gradient-weighted Class Activation Mapping. Produces slice-level saliency overlays across axial, sagittal, and coronal views.',
  },
  {
    name: 'NLP Classifier',
    detail: 'Feature-based machine learning model. Extracts filled pauses, retracings, and other DementiaBank speech markers from CHAT transcripts.',
  },
  {
    name: 'MRI RAG',
    detail: 'Retrieval-augmented generation pipeline. Grounds explanations in indexed neuroscience literature using semantic search.',
  },
  {
    name: 'Speech RAG',
    detail: 'RAG explainer for NLP predictions. Cites peer-reviewed dementia speech research to contextualise classification outcomes.',
  },
]

const STACK = [
  { label: 'Frontend', value: 'React 18 + TypeScript (Vite)' },
  { label: 'State management', value: 'Zustand + TanStack Query' },
  { label: 'Backend API', value: 'FastAPI + Uvicorn' },
  { label: 'ML framework', value: 'PyTorch · Scikit-learn' },
  { label: 'Explainability', value: 'GradCAM · RAG (LangChain)' },
  { label: 'Database', value: 'PostgreSQL (SQLAlchemy)' },
]

export default function About() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>About</h1>

      {/* System description */}
      <Card>
        <h2 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 700 }}>
          Alzheimer Multimodal Assistant
        </h2>
        <p style={{ margin: 0, lineHeight: 1.75, fontSize: 14, color: 'var(--text)' }}>
          A clinical decision-support tool for Alzheimer's disease screening that combines
          structural MRI analysis with speech and language biomarkers. The system runs
          a 3D CNN on NIfTI brain scans and an NLP classifier on CHAT transcripts,
          then explains each prediction through GradCAM visualisation and
          retrieval-augmented generation grounded in peer-reviewed literature.
        </p>
      </Card>

      {/* How to use */}
      <div>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>How to Use</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {HOW_TO.map(({ step, title, desc }) => (
            <div key={step} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div
                style={{
                  minWidth: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'var(--primary, #4f6ef7)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {step}
              </div>
              <div style={{ paddingTop: 5 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{title}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.65 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI models */}
      <div>
        <h2 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700 }}>AI Models</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {MODELS.map(({ name, detail }) => (
            <Card key={name}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{name}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.65 }}>{detail}</div>
            </Card>
          ))}
        </div>
      </div>

      {/* Tech stack */}
      <Card>
        <h2 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700 }}>Technology Stack</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px' }}>
          {STACK.map(({ label, value }) => (
            <div key={label}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 2,
                }}
              >
                {label}
              </div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{value}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Disclaimer */}
      <Card>
        <div
          style={{
            fontSize: 13,
            color: 'var(--muted)',
            lineHeight: 1.7,
            borderLeft: '3px solid var(--gold, #e8a020)',
            paddingLeft: 12,
          }}
        >
          <strong style={{ color: 'var(--gold, #e8a020)' }}>Research use only.</strong>{' '}
          This tool is intended for research and educational purposes. It is not a validated
          medical device and must not replace professional clinical assessment by a qualified
          neurologist or physician.
        </div>
      </Card>
    </div>
  )
}
