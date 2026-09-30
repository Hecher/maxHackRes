import { useEffect, useRef, useState } from 'react'

export function useRunClock(running: boolean): number {
  const [time, setTime] = useState(0)
  const frame = useRef<number | null>(null)
  const startedAt = useRef<number>(0)
  const accumulated = useRef<number>(0)

  useEffect(() => {
    if (!running) {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      frame.current = null
      return
    }

    startedAt.current = performance.now() - accumulated.current * 1000

    const tick = () => {
      const elapsed = (performance.now() - startedAt.current) / 1000
      accumulated.current = elapsed
      setTime(elapsed)
      frame.current = requestAnimationFrame(tick)
    }

    frame.current = requestAnimationFrame(tick)

    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      frame.current = null
    }
  }, [running])

  return time
}

export function useRunClockReset(onReset: () => void): () => void {
  return onReset
}
