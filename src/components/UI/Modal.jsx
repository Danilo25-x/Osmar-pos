import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

export default function Modal({ isOpen, onClose, title, children, width = 560 }) {
  const dialogRef = useRef(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  // Foco: entra al diálogo, no sale con Tab, y al cerrar vuelve al elemento anterior.
  useEffect(() => {
    if (!isOpen) return undefined
    const dialog = dialogRef.current
    const previous = document.activeElement
    const focusables = () => (dialog ? [...dialog.querySelectorAll(FOCUSABLE)] : [])

    const target = dialog?.querySelector('[autofocus]') || focusables()[0] || dialog
    target?.focus()

    const onKey = e => {
      if (e.key === 'Escape') { onCloseRef.current?.(); return }
      if (e.key !== 'Tab' || !dialog) return
      const items = focusables()
      if (!items.length) { e.preventDefault(); return }
      const first = items[0]
      const last = items[items.length - 1]
      const inside = dialog.contains(document.activeElement)
      if (e.shiftKey && (!inside || document.activeElement === first)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && (!inside || document.activeElement === last)) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (previous && previous.focus && document.contains(previous)) previous.focus()
    }
  }, [isOpen])

  if (!isOpen) return null
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div ref={dialogRef} className="modal" style={{ maxWidth: width }} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} onClick={e => e.stopPropagation()}>
        <div className="modal__head">
          <h3 className="modal__title">{title}</h3>
          {onClose && <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>}
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  )
}
