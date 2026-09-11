const SHORTCUTS: Array<{ keys: string; action: string }> = [
  { keys: 'C', action: 'New issue' },
  { keys: '⌘K', action: 'Command menu' },
  { keys: 'J / K', action: 'Highlight next / previous' },
  { keys: 'X', action: 'Select highlighted issue' },
  { keys: 'Space', action: 'Peek highlighted issue' },
  { keys: 'Esc', action: 'Close overlay, then selection' },
  { keys: 'F', action: 'Filters' },
  { keys: 'Shift+V', action: 'Display options' },
  { keys: '⌘B', action: 'Toggle list / board' },
  { keys: 'P / T / A', action: 'Priority / status / assignee' },
  { keys: '1 / 3', action: 'Triage accept / decline' },
  { keys: 'G then I T M A B P C', action: 'Go to a view' },
  { keys: '? or ⌘/', action: 'This overlay' },
]

export function HelpOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[12vh]"
      onMouseDown={onClose}
    >
      <div
        className="w-[480px] overflow-hidden rounded-xl border border-line bg-lift shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="text-[13px] font-medium">Keyboard shortcuts</div>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-[12px] text-mute hover:bg-hover"
            onClick={onClose}
          >
            Esc
          </button>
        </div>
        <div className="max-h-[60vh] overflow-auto py-2">
          {SHORTCUTS.map((row) => (
            <div
              key={row.keys}
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
