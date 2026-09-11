import { useNock } from '../hooks/use-nock'

export function BulkBar() {
  const store = useNock()
  const count = store.ui.selectedIssueIds.length
  if (count < 2) return null
  const commands = store.commands

  return (
    <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-line bg-lift px-3 py-2 shadow-2xl">
      <span className="pr-2 text-[12px] text-mute">{count} selected</span>
      <button
        type="button"
        className="rounded-md px-2 py-1 text-[12px] hover:bg-hover"
        onClick={() => commands.run('issue.setStatus')}
      >
        Status
      </button>
      <button
        type="button"
        className="rounded-md px-2 py-1 text-[12px] hover:bg-hover"
        onClick={() => commands.run('issue.setAssignee')}
      >
        Assignee
      </button>
      <button
        type="button"
        className="rounded-md px-2 py-1 text-[12px] hover:bg-hover"
        onClick={() => commands.run('issue.setPriority')}
      >
        Priority
      </button>
      <button
        type="button"
        className="rounded-md px-2 py-1 text-[12px] hover:bg-hover"
        onClick={() => commands.run('issue.addLabel')}
      >
        Labels
      </button>
      <button
        type="button"
        className="rounded-md px-2 py-1 text-[12px] hover:bg-hover"
        onClick={() => commands.run('issue.setProject')}
      >
        Project
      </button>
      <button
        type="button"
        className="rounded-md px-2 py-1 text-[12px] hover:bg-hover"
        onClick={() => commands.run('issue.archive')}
      >
        Archive
      </button>
      <button
        type="button"
        className="rounded-md px-2 py-1 text-[12px] text-mute hover:bg-hover"
        onClick={() => commands.run('selection.clear')}
      >
        Clear
      </button>
    </div>
  )
}
