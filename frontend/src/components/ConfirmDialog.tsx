import { useEffect } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Excluir',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) {
      return
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onCancel])

  if (!open) {
    return null
  }

  return (
    <div
      className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-sm border border-hairline bg-card p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="font-serif text-lg tracking-tight text-ink">{title}</h2>
        {description && (
          <p className="mt-2 text-sm text-ink-muted">{description}</p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            className="border border-hairline px-4 py-2 text-sm text-ink-muted transition hover:border-ink-muted hover:text-ink"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="bg-negative px-4 py-2 text-sm font-medium text-paper transition hover:bg-negative/90"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
