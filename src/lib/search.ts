export type SearchDocument = {
  id: string
  type: 'issue' | 'project' | 'document'
  title: string
  identifier?: string
  body: string
  updatedAt: number
}

export function searchRowKey(row: SearchDocument): string {
  return `${row.type}:${row.id}`
}

/** Render, keyboard, and pointer order: issues, then projects, then documents. */
export function flattenSearchResults(rows: SearchDocument[]): SearchDocument[] {
  return (['issue', 'project', 'document'] as const).flatMap((type) =>
    rows.filter((row) => row.type === type),
  )
}
