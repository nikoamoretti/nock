import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react'
import type { NockStore } from '../lib/store'

const StoreContext = createContext<NockStore | null>(null)
const Provider = StoreContext.Provider

export function StoreProvider({
  store,
  children,
}: {
  store: NockStore
  children: ReactNode
}) {
  return <Provider value={store}>{children}</Provider>
}

export function useNock(): NockStore {
  const store = useContext(StoreContext)
  if (!store) throw new Error('[nock] store missing from tree')
  useSyncExternalStore(store.subscribe, () => store.version)
  return store
}
