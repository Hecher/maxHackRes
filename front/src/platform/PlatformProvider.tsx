import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  detectPlatform,
  parseStartParam,
  setClosingConfirmation,
  waitForBridge,
  type MaxInitData,
  type MaxPlatform,
  type MaxWebApp,
  type StartParams,
} from './maxBridge'

export interface PlatformState {

  ready: boolean

  inMax: boolean
  platform: MaxPlatform
  bridge?: MaxWebApp
  initData?: MaxInitData

  initDataRaw?: string
  startParams: StartParams
  version?: string
  deviceName?: string
}

const PlatformContext = createContext<PlatformState | null>(null)

const LATE_BRIDGE_WINDOW_MS = 5000
const LATE_BRIDGE_POLL_MS = 500

function stateFromBridge(bridge: MaxWebApp | undefined, platform: MaxPlatform): PlatformState {
  const initData = bridge?.initDataUnsafe

  const insideMax = Boolean(bridge && (initData?.user?.id || bridge.initData))

  return {
    ready: true,
    inMax: insideMax,
    platform: insideMax ? platform : detectPlatform(),
    bridge,
    initData,
    initDataRaw: bridge?.initData,
    startParams: parseStartParam(initData?.start_param),
    version: bridge?.version,
    deviceName: bridge?.deviceName,
  }
}

export function PlatformProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PlatformState>({
    ready: false,
    inMax: false,
    platform: 'unknown',
    startParams: {},
  })

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const bridge = await waitForBridge()
      if (cancelled) return

      setState(stateFromBridge(bridge, detectPlatform(bridge)))

      if (bridge) return

      const deadline = Date.now() + LATE_BRIDGE_WINDOW_MS
      while (!cancelled && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, LATE_BRIDGE_POLL_MS))
        if (cancelled) return

        const late = typeof window === 'undefined' ? undefined : window.WebApp
        if (late) {
          setState(stateFromBridge(late, detectPlatform(late)))
          return
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!state.ready || !state.bridge) return
    setClosingConfirmation(state.bridge, true)
    return () => setClosingConfirmation(state.bridge, false)
  }, [state.ready, state.bridge])

  const value = useMemo(() => state, [state])

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>
}

export function usePlatform(): PlatformState {
  const ctx = useContext(PlatformContext)
  if (!ctx) throw new Error('usePlatform должен вызываться внутри PlatformProvider')
  return ctx
}
