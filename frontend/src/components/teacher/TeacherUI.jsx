import { useState, useRef, useEffect } from 'react'

/* ─────────────────────────────────────────
   InlineEdit
   Click a title to edit it inline.
   Saves on Enter or blur.
───────────────────────────────────────── */
export function InlineEdit({ value, onSave, className = '', placeholder = 'Untitled' }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef(null)

  useEffect(() => { setDraft(value) }, [value])
  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])

  function commit() {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) onSave(trimmed)
    else setDraft(value)
    setEditing(false)
  }

  function handleKey(e) {
    if (e.key === 'Enter') commit()
    if (e.key === 'Escape') { setDraft(value); setEditing(false) }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={`inline-edit-input ${className}`}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKey}
      />
    )
  }

  return (
    <span
      className={`inline-edit-display ${className}`}
      onClick={e => { e.stopPropagation(); setEditing(true) }}
      title="Click to edit"
    >
      {value || <span className="inline-edit-placeholder">{placeholder}</span>}
      <span className="inline-edit-pencil">✎</span>
    </span>
  )
}

/* ─────────────────────────────────────────
   ConfirmButton
   First click shows confirm state, second click fires onConfirm.
───────────────────────────────────────── */
export function ConfirmButton({ onConfirm, children, confirmLabel = 'Sure?', className = '' }) {
  const [confirming, setConfirming] = useState(false)
  const timerRef = useRef(null)

  function handleClick() {
    if (confirming) {
      clearTimeout(timerRef.current)
      setConfirming(false)
      onConfirm()
    } else {
      setConfirming(true)
      timerRef.current = setTimeout(() => setConfirming(false), 3000)
    }
  }

  return (
    <button
      className={`${className} ${confirming ? 'confirming' : ''}`}
      onClick={handleClick}
    >
      {confirming ? confirmLabel : children}
    </button>
  )
}

/* ─────────────────────────────────────────
   Modal
   Simple overlay modal.
───────────────────────────────────────── */
export function Modal({ title, onClose, children, width = 560 }) {
  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: width }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────
   FormField
   Label + input wrapper.
───────────────────────────────────────── */
export function FormField({ label, error, children }) {
  return (
    <div className="form-field">
      {label && <label className="form-label">{label}</label>}
      {children}
      {error && <p className="form-error">{error}</p>}
    </div>
  )
}

/* ─────────────────────────────────────────
   StatusMessage
   Inline success/error banner.
───────────────────────────────────────── */
export function StatusMessage({ type = 'success', children, onDismiss }) {
  if (!children) return null
  return (
    <div className={`status-message status-${type}`}>
      <span>{children}</span>
      {onDismiss && (
        <button className="status-dismiss" onClick={onDismiss}>✕</button>
      )}
    </div>
  )
}
