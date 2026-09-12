/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GRAPHQL_URL?: string
}

import type { NockStore } from './lib/store'

declare global {
  interface Window {
    __NOCK__?: NockStore
  }
}

export {}
