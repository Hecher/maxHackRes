export type MaxPlatform = 'ios' | 'android' | 'desktop' | 'web' | 'unknown'

export interface MaxInitUser {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
}

export interface MaxInitData {
  query_id?: string
  auth_date?: number
  hash?: string
  user?: MaxInitUser
  chat?: { id: number; type: 'DIALOG' | 'CHAT' | 'CHANNEL' }

  start_param?: string
}

export interface MaxWebApp {
  initData?: string
  initDataUnsafe?: MaxInitData
  platform?: string
  version?: string
  deviceName?: string
  getViewportSize?: () => Promise<{ height: string; width: string }>
  getLaunchContext?: () => Promise<{ entryPoint: 'tabbar' | 'default' }>
  enableClosingConfirmation?: () => void
  disableClosingConfirmation?: () => void
  openLink?: (url: string) => void
  openMaxLink?: (url: string) => void
  downloadFile?: (url: string, fileName: string) => void
  shareContent?: (params: { text?: string; link?: string }) => void
  requestContact?: () => Promise<{ phone: string; authDate: string; hash: string }>
  requestScreenMaxBrightness?: () => Promise<{ maxBrightness: boolean }>
  restoreScreenBrightness?: () => Promise<{ maxBrightness: boolean }>
}

declare global {
  interface Window {
    WebApp?: MaxWebApp
  }
}

const BRIDGE_TIMEOUT_MS = 800
const POLL_INTERVAL_MS = 40

export const BRIDGE_URL = 'https://st.max.ru/js/max-web-app.js'

function getBridge(): MaxWebApp | undefined {
  return typeof window === 'undefined' ? undefined : window.WebApp
}

let scriptPromise: Promise<void> | null = null

function ensureBridgeScript(): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve()
  if (getBridge()) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<void>((resolve) => {
    const script = document.createElement('script')
    script.src = BRIDGE_URL
    script.async = true
    script.dataset.maxBridge = 'true'

    script.onload = () => resolve()
    script.onerror = () => resolve()
    document.head.appendChild(script)
  })

  return scriptPromise
}

export async function waitForBridge(timeoutMs = BRIDGE_TIMEOUT_MS): Promise<MaxWebApp | undefined> {
  const immediate = getBridge()
  if (immediate) return immediate

  void ensureBridgeScript()

  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
    const bridge = getBridge()
    if (bridge) return bridge
  }
  return undefined
}

export function detectPlatform(bridge?: MaxWebApp): MaxPlatform {
  const fromBridge = bridge?.platform
  if (fromBridge === 'ios' || fromBridge === 'android' || fromBridge === 'desktop' || fromBridge === 'web') {
    return fromBridge
  }

  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  if (/Windows|Macintosh|Linux|CrOS/i.test(ua)) return 'desktop'
  return 'web'
}

export interface StartParams {
  labId?: string
  mode?: 'test' | 'work'
  classId?: string
  role?: 'student' | 'teacher'
  raw?: string
}

export function parseStartParam(raw?: string): StartParams {
  if (!raw) return {}
  const params: StartParams = { raw }

  const parts = raw.split('-')
  for (let i = 0; i < parts.length; i += 1) {
    const key = parts[i]
    const value = parts[i + 1]
    if (!key || value === undefined) continue
    if (key === 'lab') {
      params.labId = value
      i += 1
    } else if (key === 'mode' && (value === 'test' || value === 'work')) {
      params.mode = value
      i += 1
    } else if (key === 'class') {
      params.classId = value
      i += 1
    } else if (key === 'role' && (value === 'student' || value === 'teacher')) {
      params.role = value
      i += 1
    }
  }
  return params
}

export function buildDeepLink(botName: string, payload: Partial<StartParams> & { labId: string }): string {
  const chunks: string[] = [`lab_${payload.labId}`]
  if (payload.mode) chunks.push(`mode_${payload.mode}`)
  if (payload.classId) chunks.push(`class_${payload.classId}`)
  return `https://max.ru/${botName}?startapp=${chunks.join('-')}`
}

export function setClosingConfirmation(bridge: MaxWebApp | undefined, enabled: boolean): void {
  if (enabled) bridge?.enableClosingConfirmation?.()
  else bridge?.disableClosingConfirmation?.()
}

export function downloadFile(bridge: MaxWebApp | undefined, url: string, fileName: string): void {
  if (bridge?.downloadFile) {
    bridge.downloadFile(url, fileName)
    return
  }
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export async function shareText(bridge: MaxWebApp | undefined, text: string, link: string): Promise<void> {
  if (bridge?.shareContent) {
    bridge.shareContent({ text, link })
    return
  }
  if (typeof navigator !== 'undefined' && navigator.share) {
    await navigator.share({ text, url: link })
    return
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(`${text} ${link}`)
  }
}

export function openExternal(bridge: MaxWebApp | undefined, url: string): void {
  if (bridge?.openLink) {
    bridge.openLink(url)
    return
  }
  window.open(url, '_blank', 'noopener')
}
