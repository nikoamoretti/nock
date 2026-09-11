import { useNock } from '../hooks/use-nock'

export function PersistBanner() {
  const store = useNock()
  if (!store.persistError) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-3 rounded-lg border border-line bg-lift px-3 py-2 text-[13px]">
        <span className="text-ink">Couldn’t save locally. {store.persistError}</span>
        <button
          type="button"
          className="rounded-md px-2 py-0.5 text-[12px] text-mute hover:bg-hover hover:text-ink"
          onClick={() => store.retryPersist()}
        >
          Retry
        </button>
      </div>
    </div>
  )
}
