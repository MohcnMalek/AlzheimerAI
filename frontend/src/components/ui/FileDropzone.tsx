import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, FileCheck } from 'lucide-react'
import styles from './FileDropzone.module.css'

interface FileDropzoneProps {
  accept?: Record<string, string[]>
  onFile: (file: File | null) => void
  label?: string
  sublabel?: string
  file?: File | null
  disabled?: boolean
}

export default function FileDropzone({
  accept,
  onFile,
  label = 'Drop file here or click to browse',
  sublabel,
  file,
  disabled = false,
}: FileDropzoneProps) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length > 0) onFile(accepted[0])
    },
    [onFile]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    disabled: disabled || !!file,
    multiple: false,
  })

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onFile(null)
  }

  return (
    <div className={styles.wrapper}>
      <div
        {...getRootProps()}
        className={[
          styles.zone,
          isDragActive ? styles.dragging : '',
          disabled ? styles.disabled : '',
          file ? styles.hasFile : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <input {...getInputProps()} />
        {file ? (
          <div className={styles.fileInfo}>
            <FileCheck size={28} className={styles.fileIcon} />
            <div className={styles.fileDetails}>
              <div className={styles.fileName}>{file.name}</div>
              <div className={styles.fileSize}>
                {(file.size / (1024 * 1024)).toFixed(2)} MB
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.placeholder}>
            <Upload size={32} className={styles.uploadIcon} />
            <div className={styles.dropLabel}>
              {isDragActive ? 'Release to upload' : label}
            </div>
            {sublabel && <div className={styles.sublabel}>{sublabel}</div>}
          </div>
        )}
      </div>

      {file && !disabled && (
        <button
          type="button"
          className={styles.clearBtn}
          onClick={handleClear}
          aria-label="Remove selected file"
        >
          <X size={14} />
          Remove file
        </button>
      )}
    </div>
  )
}
