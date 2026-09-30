import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Typography } from '@maxhub/max-ui'
import { UNITS, GROUP_COLORS, groupForDimension, sameDimension } from '@/physics/quantity'
import { allComponents, getComponent, portValue, type SolveIssue } from '@/sim'
import type { PlacedComponent, Stand } from '@/domain/scheme'
import s from './StandCanvas.module.css'

export interface StandCanvasProps {
  stand: Stand
  
  values: Record<string, number | null>
  time: number
  running: boolean
  
  editable?: boolean
  selectedId?: string | null
  pendingTerminal?: { component: string; terminal: string } | null
  issues?: SolveIssue[]
  onSelect?: (id: string | null) => void
  onMove?: (id: string, x: number, y: number) => void
  onTerminal?: (componentId: string, terminalId: string) => void
}

const DEVICE_SIZE = 26
const MIN_SCALE = 0.6
const MAX_SCALE = 3

function clampScale(value: number): number {
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, value))
}

function terminalPoint(item: PlacedComponent, terminalId: string): { x: number; y: number } | null {
  const spec = getComponent(item.key)
  const terminal = spec?.terminals.find((entry) => entry.id === terminalId)
  if (!terminal) return null

  return {
    x: item.x + ((terminal.x - 50) / 100) * DEVICE_SIZE,
    y: item.y + ((terminal.y - 50) / 100) * DEVICE_SIZE,
  }
}

function sideOf(item: PlacedComponent, terminalId: string): 'left' | 'right' {
  const spec = getComponent(item.key)
  const terminal = spec?.terminals.find((entry) => entry.id === terminalId)
  return terminal?.side === 'left' ? 'left' : 'right'
}

function wireRoute(
  from: PlacedComponent,
  fromTerminal: string,
  to: PlacedComponent,
  toTerminal: string,
): string | null {
  const a = terminalPoint(from, fromTerminal)
  const b = terminalPoint(to, toTerminal)
  if (!a || !b) return null

  const fromSide = sideOf(from, fromTerminal)
  const toSide = sideOf(to, toTerminal)
  const stub = 4

  const a1 = { x: a.x + (fromSide === 'right' ? stub : -stub), y: a.y }
  const b1 = { x: b.x + (toSide === 'right' ? stub : -stub), y: b.y }

  const bothRight = fromSide === 'right' && toSide === 'right'
  const bothLeft = fromSide === 'left' && toSide === 'left'
  const trunkX = bothRight ? Math.max(a1.x, b1.x) : bothLeft ? Math.min(a1.x, b1.x) : (a1.x + b1.x) / 2

  const parts = [`M${round(a.x)} ${round(a.y)} H${round(a1.x)}`]
  if (Math.abs(a1.x - trunkX) > 0.2) parts.push(`H${round(trunkX)}`)
  if (Math.abs(a1.y - b1.y) > 0.5) parts.push(`V${round(b1.y)}`)
  parts.push(`H${round(b.x)}`)

  return parts.join(' ')
}

function round(value: number): number {
  return Math.round(value * 10) / 10
}

function readingAt(
  item: PlacedComponent,
  values: Record<string, number | null>,
): number | null {
  const spec = getComponent(item.key)
  if (!spec) return null

  for (const port of spec.ports) {
    const isCurrent = port.dir === 'out' && sameDimension(port.unit.dimension, UNITS.ampere.dimension)
    if (!isCurrent) continue

    const value = values[`${item.id}:${port.id}`]
    if (typeof value === 'number' && Math.abs(value) > 1e-9) return Math.abs(value)
  }

  return null
}

export function StandCanvas({
  stand,
  values,
  time,
  running,
  editable = false,
  selectedId = null,
  pendingTerminal = null,
  issues = [],
  onSelect,
  onMove,
  onTerminal,
}: StandCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 })
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null)
  const pan = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)

  const problemIds = useMemo(() => {
    const ids = new Set<string>()
    for (const issue of issues) {
      if ('componentId' in issue) ids.add(issue.componentId)
      if (issue.kind === 'incompatible' || issue.kind === 'wrong-direction') ids.add(issue.linkId)
    }
    return ids
  }, [issues])

  function toScheme(clientX: number, clientY: number): { x: number; y: number } {

    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 }

    const px = ((clientX - rect.left) / rect.width) * 100
    const py = ((clientY - rect.top) / rect.height) * 100

    return { x: (px - view.x) / view.scale, y: (py - view.y) / view.scale }
  }

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (!editable) return
    const point = toScheme(event.clientX, event.clientY)
    pan.current = { x: point.x, y: point.y, vx: view.x, vy: view.y }
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!editable) return
    const point = toScheme(event.clientX, event.clientY)

    if (drag.current && onMove) {
      onMove(drag.current.id, point.x + drag.current.dx, point.y + drag.current.dy)
      return
    }

    if (!pan.current) return
    const anchor = pan.current
    setView((current) => ({
      ...current,
      x: anchor.vx + (point.x - anchor.x) * current.scale,
      y: anchor.vy + (point.y - anchor.y) * current.scale,
    }))
  }

  function handlePointerUp() {
    drag.current = null
    pan.current = null
  }

  function zoomBy(factor: number) {
    setView((current) => ({ ...current, scale: clampScale(current.scale * factor) }))
  }

  if (stand.components.length === 0) {
    return (
      <div className={s.wrap} ref={wrapRef}>
        <div className={s.empty}>
          <Typography.Body variant="small">
            {editable
              ? 'Стенд пуст. Добавьте компоненты из палитры ниже.'
              : 'В этой работе не задан стенд. Обратитесь к учителю.'}
          </Typography.Body>
        </div>
      </div>
    )
  }

  return (
    <div className={s.wrap} ref={wrapRef}>
      {editable ? (
        <div className={s.legend}>
          <span className={s.legendRow}>
            <span className={`${s.legendDot} ${s.legendDotOut}`} />
            выход — начало провода
          </span>
          <span className={s.legendRow}>
            <span className={`${s.legendDot} ${s.legendDotIn}`} />
            вход — конец провода
          </span>
          <span className={s.legendRow}>величины одной группы соединяются между собой</span>
        </div>
      ) : null}

      <div className={s.zoom}>
        <button type="button" className={s.zoomButton} onClick={() => zoomBy(1.2)} aria-label="Приблизить">
          +
        </button>
        <button type="button" className={s.zoomButton} onClick={() => zoomBy(1 / 1.2)} aria-label="Отдалить">
          −
        </button>
        <button
          type="button"
          className={s.zoomButton}
          onClick={() => setView({ x: 0, y: 0, scale: 1 })}
          aria-label="Показать целиком"
        >
          ⤢
        </button>
      </div>

      <svg
        className={s.svg}
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Стенд"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onLostPointerCapture={handlePointerUp}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
          
          {editable
            ? stand.components.map((item) => (
                <rect
                  key={`plate-${item.id}`}
                  className={[
                    s.plate,
                    selectedId === item.id ? s.plateActive : '',
                    problemIds.has(item.id) ? s.plateWrong : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  x={item.x - DEVICE_SIZE / 2 - 2}
                  y={item.y - DEVICE_SIZE / 2 - 2}
                  width={DEVICE_SIZE + 4}
                  height={DEVICE_SIZE + 4}
                  rx={3}
                  onPointerDown={(event) => {
                    event.stopPropagation()
                    const point = toScheme(event.clientX, event.clientY)
                    drag.current = { id: item.id, dx: item.x - point.x, dy: item.y - point.y }
                    event.currentTarget.setPointerCapture?.(event.pointerId)
                    onSelect?.(item.id)
                  }}
                />
              ))
            : null}

          {stand.links.map((link) => {
            const from = stand.components.find((item) => item.id === link.from.component)
            const to = stand.components.find((item) => item.id === link.to.component)
            if (!from || !to) return null

            const route = wireRoute(from, link.from.terminal, to, link.to.terminal)
            if (!route) return null

            // Ток ищем на обоих концах провода: он есть у прибора, который
            // считает его по закону Ома, а на клемме может быть напряжение.
            const current = readingAt(from, values) ?? readingAt(to, values) ?? 0
            const flowing = running && current > 1e-9
            const speed = flowing ? Math.min(60, 4 + current * 12) : 0

            return (
              <g key={link.id}>
                <path className={s.wire} d={route} data-role="wire" />
                {flowing ? (
                  <path
                    className={s.current}
                    d={route}
                    strokeDasharray="2 4"
                    strokeDashoffset={-((time * speed) % 6)}
                  />
                ) : null}
              </g>
            )
          })}

          {stand.components.map((item) => {
            const spec = getComponent(item.key)
            if (!spec) return null

            const outputs: Record<string, number | null> = {}
            const inputs: Record<string, number | null> = {}
            const params: Record<string, number> = {}

            for (const port of spec.ports) {
              const base = values[`${item.id}:${port.id}`] ?? null
              const shown =
                base === null ? null : (base - (port.unit.offset ?? 0)) / port.unit.factor

              if (port.dir === 'out') outputs[port.id] = shown
              else inputs[port.id] = shown
            }

            for (const param of spec.params) params[param.id] = item.params?.[param.id] ?? param.value

            const wrong = problemIds.has(item.id)

            return (
              <g key={item.id}>
                <g
                  transform={`translate(${item.x - DEVICE_SIZE / 2} ${item.y - DEVICE_SIZE / 2}) scale(${DEVICE_SIZE / 100})`}
                  className={[s.device, wrong ? s.deviceWrong : ''].filter(Boolean).join(' ')}
                >
                  {spec.view ? (
                    spec.view({ outputs, inputs, params, time, running })
                  ) : (
                    <circle cx={50} cy={50} r={30} fill="none" stroke="currentColor" strokeWidth={3} />
                  )}
                </g>

                <text className={s.label} x={item.x} y={item.y + DEVICE_SIZE / 2 + 4.5}>
                  {item.label ?? spec.title}
                </text>

                {spec.terminals.map((terminal) => {
                  const pending =
                    pendingTerminal?.component === item.id && pendingTerminal.terminal === terminal.id

                  const point = terminalPoint(item, terminal.id)
                  if (!point) return null

                  const port = spec.ports.find((entry) => entry.id === terminal.port)
                  const group = port ? groupForDimension(port.unit.dimension) : 'other'
                  const isIn = terminal.dir === 'in'
                  const selectedHere = selectedId === item.id

                  return (
                    <g key={terminal.id}>
                      <circle
                        className={[
                          s.terminal,
                          isIn ? s.terminalIn : s.terminalOut,
                          pending ? s.terminalPending : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        cx={point.x}
                        cy={point.y}
                        r={2.4}
                        data-role="terminal"
                        data-component={item.id}
                        data-terminal={terminal.id}
                        data-dir={terminal.dir}
                        onPointerDown={(event) => {
                          event.stopPropagation()
                          onTerminal?.(item.id, terminal.id)
                        }}
                      />

                      {editable && (selectedHere || pending) ? (
                        <>
                          <circle
                            className={s.terminalGroup}
                            cx={point.x}
                            cy={point.y}
                            r={1}
                            fill={GROUP_COLORS[group]}
                          />
                          <text
                            className={s.terminalLabel}
                            x={point.x + (terminal.side === 'left' ? -3.4 : 3.4)}
                            y={point.y - 1.4}
                            textAnchor={terminal.side === 'left' ? 'end' : 'start'}
                          >
                            {port ? `${isIn ? 'вход' : 'выход'} · ${port.unit.symbol}` : isIn ? 'вход' : 'выход'}
                          </text>
                        </>
                      ) : null}
                    </g>
                  )
                })}
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}

export { allComponents, portValue }
