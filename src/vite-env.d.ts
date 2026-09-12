/// <reference types="vite/client" />

import type { NockStore } from './lib/store'

declare global {
  interface Window {
    __NOCK__?: NockStore
  }
}

export {}
