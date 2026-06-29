import type { SpeechFeatures } from '../../types'
import MetricCard from '../ui/MetricCard'
import styles from './FeatureGrid.module.css'

interface FeatureGridProps {
  features: SpeechFeatures
}

const FEATURE_LABELS: Record<keyof SpeechFeatures, { label: string; unit?: string }> = {
  n_filled_pauses:   { label: 'Filled Pauses' },
  n_phon_fragments:  { label: 'Phonological Fragments' },
  n_paralinguistic:  { label: 'Paralinguistic Markers' },
  n_retracings:      { label: 'Retracings' },
  n_unintelligible:  { label: 'Unintelligible Words' },
  n_pauses:          { label: 'Silent Pauses' },
  entryage:          { label: 'Entry Age', unit: 'yrs' },
  sex:               { label: 'Sex (0=F 1=M)' },
  educ:              { label: 'Education', unit: 'yrs' },
}

// Highlight clinical features that are most relevant to AD detection
const HIGHLIGHTED_KEYS: (keyof SpeechFeatures)[] = ['n_filled_pauses', 'n_retracings', 'n_unintelligible']

export default function FeatureGrid({ features }: FeatureGridProps) {
  const keys = Object.keys(FEATURE_LABELS) as (keyof SpeechFeatures)[]

  return (
    <div className={styles.grid}>
      {keys.map((key) => {
        const meta = FEATURE_LABELS[key]
        return (
          <MetricCard
            key={key}
            label={meta.label}
            value={features[key]}
            unit={meta.unit}
            highlight={HIGHLIGHTED_KEYS.includes(key)}
          />
        )
      })}
    </div>
  )
}
