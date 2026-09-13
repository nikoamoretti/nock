export type SearchDocument = {
  id: string
  type: 'issue' | 'project' | 'document'
  title: string
  identifier?: string
  body: string
  updatedAt: number
}
