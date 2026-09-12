import { useNock } from '../hooks/use-nock'

export function PersistBanner() {
  const store = useNock()
  const blocked = store.sync
    .pending()
    .filter((command) => command.status === 'failed' || command.status === 'conflict')
  const persistError = store.persistError
  const reconnecting = store.sync.connection === 'reconnecting'
  if (!persistError && blocked.length === 0 && !reconnecting) return null

  const message = persistError
    ? `Couldn’t save locally. ${persistError}`
    : reconnecting && blocked.length === 0
      ? 'Reconnecting… cached issues stay visible.'
      : blocked[0]?.status === 'conflict'
        ? blocked[0].error ?? 'This issue changed on another client.'
        : blocked[0]?.error ?? 'Couldn’t sync this change.'

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex items-center gap-3 rounded-lg border border-line bg-lift px-3 py-2 text-[13px]"
      >
        <span className="text-ink">{message}</span>
        {(persistError || blocked.length > 0) && (
          <button
            type="button"
            className="rounded-md px-2 py-0.5 text-[12px] text-mute hover:bg-hover hover:text-ink"
            onClick={() => {
              store.retryPersist()
              store.sync.retry()
            }}
          >
            Retry
          </button>
        )}
      </div>
    </div>
  )
}
