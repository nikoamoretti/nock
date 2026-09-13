import { useParams } from 'react-router-dom'
import { useNock } from '../hooks/use-nock'

export function DocumentPage() {
  const store = useNock()
  const { documentId } = useParams()
  const doc = documentId ? store.documentById(documentId) : undefined

  if (!doc) {
    return (
      <div
        className="flex flex-1 items-center justify-center text-[13px] text-mute"
        data-testid="document-missing"
      >
        Document not found
      </div>
    )
  }

  return (
    <article
      data-testid="document-page"
      className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col overflow-auto px-8 py-8"
    >
      <h1 data-testid="document-title" className="text-[22px] font-medium tracking-tight">
        {doc.title}
      </h1>
      <p
        data-testid="document-body"
        className="mt-4 whitespace-pre-wrap text-[14px] leading-6 text-secondary"
      >
        {doc.body}
      </p>
    </article>
  )
}

export function ScopeUnavailable({
  reason,
}: {
  reason: 'workspace' | 'team'
}) {
  return (
    <div
      className="flex flex-1 items-center justify-center px-6 text-center text-[13px] text-mute"
      data-testid="scope-unavailable"
    >
      {reason === 'workspace'
        ? 'This workspace is not available in the loaded database.'
        : 'This team is not in the current workspace.'}
    </div>
  )
}
