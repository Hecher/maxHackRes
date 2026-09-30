export interface RuntimeConfig {
  apiBaseUrl?: string
  botName?: string
}

declare global {
  interface Window {
    __VLR_CONFIG__?: RuntimeConfig
  }
}

export {}

const runtime: RuntimeConfig =
  typeof window === 'undefined' ? {} : window.__VLR_CONFIG__ ?? {}

export const API_BASE_URL =
  runtime.apiBaseUrl || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'

export const MAX_BOT_NAME = runtime.botName || import.meta.env.VITE_MAX_BOT_NAME || 'vlr_bot'
