import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { cn } from '../lib/cn'
import type { Tone } from './display'

export type ToastMessage = {
  id: string
  title: string
  tone?: Tone
}

type ToastContextValue = {
  toasts: ToastMessage[]
  push: (input: { title: string; tone?: Tone }) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const push = useCallback((input: { title: string; tone?: Tone }) => {
    const id = crypto.randomUUID()
    setToasts((current) => [...current, { id, ...input }])
  }, [])
  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])
  const value = useMemo(() => ({ toasts, push, dismiss }), [dismiss, push, toasts])
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[var(--z-toast)] flex flex-col items-center gap-2"
        aria-live="polite"
        aria-relevant="additions"
      >
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext)
  if (!value) throw new Error('[nock] ToastProvider missing')
  return value
}

function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastMessage
  onDismiss: () => void
}) {
  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto flex items-center gap-3 rounded-lg border border-line bg-elevated px-3 py-2 text-[13px] text-fg shadow-[var(--shadow-md)]',
      )}
    >
      <span>{toast.title}</span>
      <button
        type="button"
        className="rounded-md px-1.5 text-[12px] text-secondary hover:bg-hover"
        onClick={onDismiss}
      >
        Dismiss
      </button>
    </div>
  )
}
