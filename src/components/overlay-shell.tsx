import { useRef, type ReactNode } from 'react'
import { useEscape, useFocusTrap, useRestoreFocus } from '../ui/overlay'

export function OverlayShell({
  label,
  children,
  onDismiss,
}: {
  label: string
  children: ReactNode
  onDismiss: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useRestoreFocus(true)
  useFocusTrap(dialogRef, true)
  useEscape(true, onDismiss)

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 pt-[16vh]"
      onMouseDown={() => onDismiss()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="nock-overlay w-[540px] overflow-hidden rounded-xl border border-line bg-lift"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
