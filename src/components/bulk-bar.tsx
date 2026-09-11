import { useNock } from '../hooks/use-nock'

export function BulkBar() {
  const store = useNock()
  const count = store.ui.selectedIssueIds.length
  if (count < 2) return null

  return (
    <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-line bg-lift px-3 py-2 shadow-2xl">
      <span className="pr-2 text-[12px] text-mute">{count} selected</span>
      <button
        type="button"
        className="rounded-md px-2 py-1 text-[12px] hover:bg-hover"
        onClick={() => store.openPropertyMenu('status')}
      >
        Status
      </button>
      <button
        type="button"
        className="rounded-md px-2 py-1 text-[12px] hover:bg-hover"
        onClick={() => store.openPropertyMenu('assignee')}
      >
        Assignee
      </button>
      <button
        type="button"
        className="rounded-md px-2 py-1 text-[12px] hover:bg-hover"
        onClick={() => store.openPropertyMenu('priority')}
      >
        Priority
      </button>
      <button
        type="button"
        className="rounded-md px-2 py-1 text-[12px] text-mute hover:bg-hover"
        onClick={() => store.clearSelection()}
      >
        Clear
      </button>
    </div>
  )
}
