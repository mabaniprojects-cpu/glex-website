'use client'

import { FileText, Trash2, Upload } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type UploadedFile = { id: string; originalName: string; size: number }

/**
 * Accessible multi-file uploader.
 *
 * Drag-and-drop is an enhancement only — the underlying `<input type="file">`
 * stays reachable by keyboard and screen reader, and the drop zone is a real
 * button so it can be activated without a pointer.
 *
 * Every file is validated again on the server (`POST /api/uploads`); the client
 * checks here are purely for fast feedback.
 */
export function FileUpload({
  value,
  onChange,
  purpose,
  accept = '.pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx',
  maxFiles = 10,
}: {
  value: UploadedFile[]
  onChange: (files: UploadedFile[]) => void
  /** Storage key prefix, e.g. `supplier-documents`. */
  purpose: string
  accept?: string
  maxFiles?: number
}) {
  const common = useTranslations('common')
  const v = useTranslations('validation')

  const inputRef = React.useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return
    setError(null)

    const remaining = maxFiles - value.length
    if (remaining <= 0) return

    setBusy(true)
    const accepted: UploadedFile[] = []

    for (const file of Array.from(files).slice(0, remaining)) {
      const body = new FormData()
      body.append('file', file)
      body.append('purpose', purpose)

      try {
        const response = await fetch('/api/uploads', { method: 'POST', body })

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as {
            error?: string
            maxMb?: number
          }
          setError(
            payload.error === 'too_large'
              ? v('fileTooLarge', { max: payload.maxMb ?? 15 })
              : payload.error === 'unsupported_type'
                ? v('fileType')
                : common('errorBody')
          )
          continue
        }

        accepted.push((await response.json()) as UploadedFile)
      } catch {
        setError(common('errorBody'))
      }
    }

    if (accepted.length > 0) onChange([...value, ...accepted])
    setBusy(false)

    // Allow re-selecting the same file after a removal.
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          void upload(event.dataTransfer.files)
        }}
        className={cn(
          'rounded-xl border-2 border-dashed p-6 text-center transition-colors',
          dragging ? 'border-glex-green-600 bg-glex-green-50' : 'border-border-subtle'
        )}
      >
        <Upload className="mx-auto size-8 text-glex-green-400" aria-hidden="true" />

        <div className="mt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || value.length >= maxFiles}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? common('loading') : common('search')}
          </Button>
        </div>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          className="sr-only"
          // The visible button forwards clicks here; the input itself stays in
          // the accessibility tree so assistive tech can operate it directly.
          onChange={(event) => void upload(event.target.files)}
        />

        <p className="mt-3 text-xs text-glex-green-800/60">PDF · JPG · PNG · WEBP · DOCX · XLSX</p>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      {value.length > 0 ? (
        <ul className="mt-4 space-y-2" aria-live="polite">
          {value.map((file) => (
            <li
              key={file.id}
              className="flex items-center gap-3 rounded-lg border border-border-subtle p-3 text-sm"
            >
              <FileText className="size-4 shrink-0 text-glex-green-600" aria-hidden="true" />
              <span className="flex-1 truncate">{file.originalName}</span>
              <span className="shrink-0 text-xs text-glex-green-800/60" dir="ltr">
                {Math.max(1, Math.round(file.size / 1024))} KB
              </span>
              <button
                type="button"
                onClick={() => onChange(value.filter((f) => f.id !== file.id))}
                aria-label={`${common('delete')} — ${file.originalName}`}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
