import type { ReactNode } from 'react'

export function OverlayShell({
  label,
  children,
  onDismiss,
}: {
  label: string
  children: ReactNode
  onDismiss: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 pt-[16vh]"
      onMouseDown={() => onDismiss()}
    >
      <div
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
