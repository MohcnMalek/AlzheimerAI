import type { GradCAMImage } from '../../types'
import styles from './GradCAMGrid.module.css'

interface GradCAMGridProps {
  images: GradCAMImage[]
  displayMode?: string
}

export default function GradCAMGrid({ images, displayMode = 'overlay' }: GradCAMGridProps) {
  if (!images || images.length === 0) return null

  const isMultiAxis = images.length === 1

  return (
    <div className={isMultiAxis ? styles.singleWrapper : styles.grid}>
      {images.map((img, i) => (
        <figure key={i} className={`${styles.figure} ${isMultiAxis ? styles.figureFull : ''}`}>
          <div className={styles.imgWrapper}>
            <img
              src={img.image_url}
              alt={img.caption || `GradCAM ${img.orientation}`}
              className={styles.img}
              style={{ filter: displayMode === 'heatmap' ? 'saturate(1.6)' : 'none' }}
            />
          </div>
          {img.caption && (
            <figcaption className={styles.caption}>
              {img.caption}
              {img.orientation && img.orientation !== img.caption && (
                <span className={styles.orientation}> · {img.orientation}</span>
              )}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  )
}
