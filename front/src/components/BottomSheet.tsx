import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Typography } from '@maxhub/max-ui'
import s from './BottomSheet.module.css'

export type SheetLevel = 'peek' | 'half' | 'full'

const PEEK_HEIGHT = 78
const HALF_RATIO = 0.46
const FULL_RATIO = 0.86

function levelHeight(level: SheetLevel, viewportHeight: number): number {
  if (level === 'peek') return PEEK_HEIGHT
  if (level === 'half') return Math.round(viewportHeight * HALF_RATIO)
  return Math.round(viewportHeight * FULL_RATIO)
}

function nearestLevel(height: number, viewportHeight: number): SheetLevel {
  const candidates: SheetLevel[] = ['peek', 'half', 'full']
  let best: SheetLevel = 'peek'
  let bestDistance = Number.POSITIVE_INFINITY

  for (const level of candidates) {
    const distance = Math.abs(levelHeight(level, viewportHeight) - height)
    if (distance < bestDistance) {
      bestDistance = distance
      best = level
    }
  }

  return best
}

export interface BottomSheetProps {
  level: SheetLevel
  onLevelChange: (level: SheetLevel) => void
  title: string

  meta?: string

  actions?: ReactNode

  offsetBottom?: number
  children: ReactNode
}

export function BottomSheet({
  level,
  onLevelChange,
  title,
  meta,
  actions,
  offsetBottom = 0,
  children,
}: BottomSheetProps) {
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window === 'undefined' ? 800 : window.innerHeight,
  )
  const [dragHeight, setDragHeight] = useState<number | null>(null)
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null)

  const movedRef = useRef(false)

  useEffect(() => {
    const onResize = () => setViewportHeight(window.innerHeight)
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [])

  const height = dragHeight ?? levelHeight(level, viewportHeight)

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      dragRef.current = { startY: event.clientY, startHeight: height }
      movedRef.current = false
      setDragHeight(height)
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {

      }
    },
    [height],
  )

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current
      if (!drag) return

      const delta = event.clientY - drag.startY
      if (Math.abs(delta) > 6) movedRef.current = true

      const next = drag.startHeight - delta
      const min = levelHeight('peek', viewportHeight)
      const max = levelHeight('full', viewportHeight)
      setDragHeight(Math.max(min, Math.min(max, next)))
    },
    [viewportHeight],
  )

  const onPointerUp = useCallback(() => {
    if (!dragRef.current) return
    dragRef.current = null

    setDragHeight((current) => {
      if (current !== null) onLevelChange(nearestLevel(current, viewportHeight))
      return null
    })
  }, [onLevelChange, viewportHeight])

  return (
    <section
      className={[s.sheet, dragHeight !== null ? s.dragging : ''].join(' ')}
      style={{
        height,
        bottom: offsetBottom,
        transition: dragHeight !== null ? 'none' : `height var(--dur) var(--ease)`,
      }}
      aria-label={title}
    >
      <div
        className={s.head}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={() => {

          if (movedRef.current) {
            movedRef.current = false
            return
          }
          onLevelChange(level === 'peek' ? 'half' : 'peek')
        }}
      >
        <div className={s.grabber} />
        <div className={s.headRow}>
          <Typography.Label variant="medium-strong" className={s.headTitle}>
            {title}
          </Typography.Label>
          {meta ? (
            <Typography.Label variant="small" className={s.headMeta}>
              {meta}
            </Typography.Label>
          ) : null}
          {actions ? (
            <div className={s.headExtra} onClick={(event) => event.stopPropagation()}>
              {actions}
            </div>
          ) : null}
        </div>
      </div>

      <div className={s.content}>{children}</div>
    </section>
  )
}
