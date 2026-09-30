import s from './DependencyChart.module.css'

export interface ChartPoint {
  x: number
  y: number
}

export interface DependencyChartProps {
  points: ChartPoint[]
  curve?: ChartPoint[]
  labelX: string
  labelY: string
}

const WIDTH = 300
const HEIGHT = 180
const PAD = { left: 38, right: 14, top: 14, bottom: 28 }

function bounds(all: ChartPoint[]): { minX: number; maxX: number; minY: number; maxY: number } {
  if (all.length === 0) return { minX: 0, maxX: 1, minY: 0, maxY: 1 }

  const xs = all.map((point) => point.x)
  const ys = all.map((point) => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(0, ...ys)
  const maxY = Math.max(...ys)

  return {
    minX,
    maxX: maxX === minX ? minX + 1 : maxX,
    minY,
    maxY: maxY === minY ? minY + 1 : maxY,
  }
}

export function DependencyChart({ points, curve = [], labelX, labelY }: DependencyChartProps) {
  if (points.length === 0) return null

  const box = bounds([...points, ...curve])
  const innerWidth = WIDTH - PAD.left - PAD.right
  const innerHeight = HEIGHT - PAD.top - PAD.bottom

  const toX = (value: number) => PAD.left + ((value - box.minX) / (box.maxX - box.minX)) * innerWidth
  const toY = (value: number) =>
    PAD.top + innerHeight - ((value - box.minY) / (box.maxY - box.minY)) * innerHeight

  const line = (list: ChartPoint[]) =>
    list
      .slice()
      .sort((a, b) => a.x - b.x)
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${toX(point.x).toFixed(1)} ${toY(point.y).toFixed(1)}`)
      .join(' ')

  return (
    <svg className={s.chart} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`${labelY} от ${labelX}`}>
      {[0, 0.5, 1].map((fraction) => {
        const value = box.minY + (box.maxY - box.minY) * (1 - fraction)
        return (
          <g key={`grid-${fraction}`}>
            <line
              className={s.grid}
              x1={PAD.left}
              y1={PAD.top + innerHeight * fraction}
              x2={WIDTH - PAD.right}
              y2={PAD.top + innerHeight * fraction}
            />
            <text className={s.tick} x={PAD.left - 5} y={PAD.top + innerHeight * fraction + 3} textAnchor="end">
              {value.toFixed(Math.abs(box.maxY) < 10 ? 1 : 0)}
            </text>
          </g>
        )
      })}

      <line className={s.axis} x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + innerHeight} />
      <line
        className={s.axis}
        x1={PAD.left}
        y1={PAD.top + innerHeight}
        x2={WIDTH - PAD.right}
        y2={PAD.top + innerHeight}
      />

      {curve.length > 1 ? <path className={s.curve} d={line(curve)} /> : null}

      {points.map((point, index) => (
        <circle key={`point-${index}`} className={s.point} cx={toX(point.x)} cy={toY(point.y)} r={3.4} />
      ))}

      <text className={s.label} x={PAD.left + innerWidth / 2} y={HEIGHT - 8} textAnchor="middle">
        {labelX}
      </text>
      <text className={s.label} x={12} y={PAD.top + innerHeight / 2} textAnchor="middle" transform={`rotate(-90 12 ${PAD.top + innerHeight / 2})`}>
        {labelY}
      </text>

      <text className={s.tick} x={WIDTH - PAD.right} y={HEIGHT - 8} textAnchor="end">
        {box.maxX.toFixed(Math.abs(box.maxX) < 10 ? 1 : 0)}
      </text>
    </svg>
  )
}
