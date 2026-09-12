import { describe, expect, it } from 'vitest'
import { generateGraphqlTypes } from '../../../server/graphql/generate-types.ts'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

describe('generated GraphQL types', () => {
  it('matches the schema on disk', async () => {
    const expected = await generateGraphqlTypes()
    const actual = await readFile(join(here, 'generated.ts'), 'utf8')
    expect(actual).toBe(expected)
    expect(expected).toContain('export interface IssueCreateInput')
    expect(expected).toContain('export interface Query')
    expect(expected).toContain('issueCreate')
  })
})
