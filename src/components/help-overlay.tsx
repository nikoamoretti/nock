import { useNock } from '../hooks/use-nock'

export function HelpOverlay({ onClose }: { onClose: () => void }) {
  const store = useNock()
  const rows = store.commands.helpRows()

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[12vh]"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-overlay-title"
        className="nock-overlay w-[480px] overflow-hidden rounded-xl border border-line bg-lift"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div id="help-overlay-title" className="text-[13px] font-medium">Keyboard shortcuts</div>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-[12px] text-mute hover:bg-hover"
            onClick={onClose}
          >
            Esc
          </button>
        </div>
        <div className="max-h-[60vh] overflow-auto py-2">
          {rows.map((row) => (
            <div
              key={`${row.action}-${row.keys}`}
              className="flex items-center justify-between gap-4 px-4 py-1.5 text-[13px]"
            >
              <span className="text-ink">{row.action}</span>
              <span className="shrink-0 rounded border border-line px-1.5 py-0.5 font-mono text-[11px] text-mute">
                {row.keys}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
