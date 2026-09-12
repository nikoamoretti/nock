export { adapterStub } from '../../src/lib/integrations.ts'
import type { IntegrationProvider } from '../../src/lib/integrations.ts'

export const STUB_PROVIDERS: Exclude<IntegrationProvider, 'github'>[] = [
  'gitlab',
  'slack',
  'sentry',
  'zendesk',
  'front',
]
