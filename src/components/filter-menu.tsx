import { FilterBuilder } from './filters/filter-builder'
import { useNock } from '../hooks/use-nock'

export function FilterMenu() {
  const store = useNock()
  if (!store.ui.filterMenuOpen) return null

  return (
    <div className="fixed inset-0 z-40" onMouseDown={() => store.toggleFilterMenu()}>
      <FilterBuilder onClose={() => store.toggleFilterMenu()} />
    </div>
  )
}
