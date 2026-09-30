import type { ReactNode } from 'react'
import { UNITS } from '@/physics/quantity'
import type { ComponentSpec, ViewProps } from '../component'

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 3,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

const INK = 'var(--lab-ink, #111)'
const ACCENT = 'var(--lab-accent, #d5372c)'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function dial(props: { value: number | null; limit: number; letter: string }): ReactNode {
  const share = props.value === null ? 0 : clamp(Math.abs(props.value) / props.limit, 0, 1)
  const angle = -60 + share * 120

  return (
    <g>
      <circle cx={50} cy={50} r={30} {...STROKE} />
      <path d="M26 64a26 26 0 0 1 48 0" {...STROKE} opacity={0.4} />
      <line
        x1={50}
        y1={54}
        x2={50 + 22 * Math.sin((angle * Math.PI) / 180)}
        y2={54 - 22 * Math.cos((angle * Math.PI) / 180)}
        stroke={ACCENT}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <circle cx={50} cy={54} r={3} fill={INK} />
      <text x={50} y={86} textAnchor="middle" fontSize={20} fill={INK}>
        {props.letter}
      </text>
    </g>
  )
}

function filamentColor(voltage: number | null, maxVoltage: number): string {
  if (voltage === null || Math.abs(voltage) < 1) return '#f0efe6'

  const share = clamp((Math.abs(voltage) - 1) / Math.max(maxVoltage - 1, 1), 0, 1)

  const red = Math.round(250 - 36 * share)
  const green = Math.round(246 - 206 * share)
  const blue = Math.round(190 - 164 * share)

  return `rgb(${red}, ${green}, ${blue})`
}

export const electricityComponents: ComponentSpec[] = [
  {
    key: 'source',
    domain: 'electricity',
    title: 'Источник питания',
    hint: 'Задаёт напряжение в цепи. Напряжение регулирует пользователь',
    ports: [
      { id: 'source', label: 'Напряжение', unit: UNITS.volt, dir: 'out', group: 'electrical' },
      { id: 'current', label: 'Сила тока в цепи', unit: UNITS.ampere, dir: 'out', group: 'electrical', readonly: true },
      { id: 'in', label: 'Обратный провод', unit: UNITS.volt, dir: 'in', group: 'electrical' },
    ],
    terminals: [
      { id: 'right', x: 86, y: 50, side: 'right', port: 'source', dir: 'out' },
      { id: 'left', x: 14, y: 50, side: 'left', port: 'in', dir: 'in' },
    ],
    params: [
      { id: 'voltage', label: 'Напряжение', unit: UNITS.volt, of: 'control', min: 0, max: 24, step: 0.5, value: 12 },
    ],
    compute: ({ params }) => ({ source: params.voltage ?? 0, current: null }),
    measure: ({ circuitCurrent }) => ({ current: circuitCurrent }),
    view: ({ params }) => (
      <g>
        <path d="M40 22v56" {...STROKE} />
        <path d="M60 36v28" {...STROKE} />
        <path d="M40 50H14M60 50h26" {...STROKE} />
        <text x={50} y={16} textAnchor="middle" fontSize={13} fill={INK}>
          {params.voltage ?? 0} В
        </text>
      </g>
    ),
  },
  {
    key: 'ammeter',
    domain: 'electricity',
    title: 'Амперметр',
    hint: 'Включается последовательно. Показывает силу тока по закону Ома',
    ports: [
      { id: 'in', label: 'Сила тока', unit: UNITS.ampere, dir: 'in', group: 'electrical', modifier: true, passthrough: true },
      { id: 'out', label: 'Сила тока', unit: UNITS.ampere, dir: 'out', group: 'electrical' },
    ],
    terminals: [
      { id: 'left', x: 10, y: 50, side: 'left', port: 'in', dir: 'in' },
      { id: 'right', x: 90, y: 50, side: 'right', port: 'out', dir: 'out' },
    ],
    params: [
      { id: 'limit', label: 'Диапазон измерений', unit: UNITS.ampere, of: 'setting', min: 0.1, max: 20, step: 0.1, value: 2 },
    ],
    compute: ({ inputs }) => ({ out: inputs.in ?? null }),
    measure: ({ circuitCurrent }) => ({ out: circuitCurrent }),
    view: ({ outputs, params }) => {
      const limit = params.limit ?? 1
      const value = outputs.out ?? null
      const overload = value !== null && Math.abs(value) > limit

      return (
        <g>
          {dial({ value, limit, letter: 'A' })}
          <text x={50} y={12} textAnchor="middle" fontSize={12} fill={overload ? ACCENT : INK}>
            {value === null ? '—' : `${(overload ? limit : value).toFixed(2)} А`}
          </text>
        </g>
      )
    },
  },
  {
    key: 'voltmeter',
    domain: 'electricity',
    title: 'Вольтметр',
    hint: 'Включается параллельно источнику и показывает его напряжение',
    ports: [
      { id: 'in', label: 'Напряжение', unit: UNITS.volt, dir: 'in', group: 'electrical', modifier: true, passthrough: true },
      { id: 'out', label: 'Напряжение', unit: UNITS.volt, dir: 'out', group: 'electrical' },
    ],
    terminals: [
      { id: 'left', x: 10, y: 50, side: 'left', port: 'in', dir: 'in' },
      { id: 'right', x: 90, y: 50, side: 'right', port: 'out', dir: 'out' },
    ],
    params: [
      { id: 'limit', label: 'Диапазон измерений', unit: UNITS.volt, of: 'setting', min: 1, max: 100, step: 1, value: 15 },
    ],
    compute: ({ inputs }) => ({ out: inputs.in ?? null }),
    measure: ({ circuitVoltage }) => ({ out: circuitVoltage }),
    view: ({ outputs, params }) => {
      const limit = params.limit ?? 1
      const value = outputs.out ?? null
      const overload = value !== null && Math.abs(value) > limit

      return (
        <g>
          {dial({ value, limit, letter: 'V' })}
          <text x={50} y={12} textAnchor="middle" fontSize={12} fill={overload ? ACCENT : INK}>
            {value === null ? '—' : `${(overload ? limit : value).toFixed(2)} В`}
          </text>
        </g>
      )
    },
  },
  {
    key: 'resistor',
    domain: 'electricity',
    title: 'Резистор',
    hint: 'Постоянное сопротивление. Задаёт силу тока в цепи: I = U / R',
    ports: [
      { id: 'in', label: 'Напряжение', unit: UNITS.volt, dir: 'in', group: 'electrical', modifier: true },
      { id: 'out', label: 'Сила тока', unit: UNITS.ampere, dir: 'out', group: 'electrical' },
      { id: 'ohms', label: 'Сопротивление', unit: UNITS.ohm, dir: 'out', group: 'electrical', readonly: true },
    ],
    terminals: [
      { id: 'left', x: 12, y: 50, side: 'left', port: 'in', dir: 'in' },
      { id: 'right', x: 88, y: 50, side: 'right', port: 'out', dir: 'out' },
    ],
    params: [
      { id: 'resistance', label: 'Сопротивление', unit: UNITS.ohm, of: 'setting', min: 1, max: 100, step: 1, value: 10 },
    ],
    compute: ({ inputs, params }) => {
      const resistance = params.resistance ?? 1
      const voltage = inputs.in ?? null
      const measured = typeof resistance === 'number' && resistance > 0 ? resistance : null
      if (voltage === null || resistance === 0) return { out: null, ohms: measured }

      return { out: voltage / resistance, ohms: measured }
    },
    ohms: (params) => params.resistance ?? null,
    view: ({ params, outputs }) => {
      const current = outputs.out ?? null
      const heat = current === null ? 0 : clamp(Math.abs(current) / 3, 0, 1)

      return (
        <g>
          <rect x={28} y={38} width={44} height={24} rx={1} {...STROKE} />
          <path d="M28 50H12M72 50h16" {...STROKE} />
          <rect x={28} y={38} width={44} height={24} rx={1} fill={ACCENT} opacity={heat * 0.35} />
          <text x={50} y={78} textAnchor="middle" fontSize={11} fill={INK}>
            {params.resistance ?? 0} Ом
          </text>
        </g>
      )
    },
  },
  {
    key: 'lamp',
    domain: 'electricity',
    title: 'Лампа',
    hint: 'Светится от бледно-жёлтого до красного по мере роста напряжения',
    ports: [
      { id: 'in', label: 'Напряжение', unit: UNITS.volt, dir: 'in', group: 'electrical', modifier: true },
      { id: 'out', label: 'Сила тока', unit: UNITS.ampere, dir: 'out', group: 'electrical' },
    ],
    terminals: [
      { id: 'left', x: 12, y: 50, side: 'left', port: 'in', dir: 'in' },
      { id: 'right', x: 88, y: 50, side: 'right', port: 'out', dir: 'out' },
    ],
    params: [
      { id: 'nominal', label: 'Номинальное напряжение', unit: UNITS.volt, of: 'setting', min: 1, max: 24, step: 0.5, value: 12 },
      { id: 'power', label: 'Номинальная мощность', unit: UNITS.watt, of: 'setting', min: 1, max: 100, step: 1, value: 20 },
    ],
    compute: ({ inputs, params }) => {
      const voltage = inputs.in ?? null
      const nominal = params.nominal ?? 0
      const power = params.power ?? 0
      if (voltage === null || nominal <= 0 || power <= 0) return { out: null }

      return { out: voltage / ((nominal * nominal) / power) }
    },
    ohms: (params) => {
      const nominal = params.nominal ?? 0
      const power = params.power ?? 0
      if (nominal <= 0 || power <= 0) return null

      return (nominal * nominal) / power
    },
    view: ({ inputs, params }) => {
      const voltage = inputs.in ?? null
      const nominal = params.nominal ?? 12
      const lit = voltage !== null && Math.abs(voltage) >= 1
      const share = voltage === null ? 0 : clamp(Math.abs(voltage) / nominal, 0, 1)

      return (
        <g>
          <circle
            cx={50}
            cy={50}
            r={28}
            fill={filamentColor(voltage, nominal)}
            fillOpacity={lit ? 0.35 + share * 0.65 : 0}
          />
          <circle cx={50} cy={50} r={28} {...STROKE} />
          <path d="M36 36l28 28M64 36L36 64" {...STROKE} />
          <text x={50} y={92} textAnchor="middle" fontSize={11} fill={INK}>
            {voltage === null ? '—' : `${Math.abs(voltage).toFixed(1)} В`}
          </text>
        </g>
      )
    },
  },
  {
    key: 'capacitor',
    domain: 'electricity',
    title: 'Конденсатор',
    hint: 'Включается в цепь. Ёмкость задаёт пользователь',
    ports: [
      { id: 'in', label: 'Сила тока', unit: UNITS.ampere, dir: 'in', group: 'electrical', modifier: true, passthrough: true },
      { id: 'out', label: 'Сила тока', unit: UNITS.ampere, dir: 'out', group: 'electrical' },
    ],
    terminals: [
      { id: 'left', x: 14, y: 50, side: 'left', port: 'in', dir: 'in' },
      { id: 'right', x: 86, y: 50, side: 'right', port: 'out', dir: 'out' },
    ],
    params: [
      { id: 'capacitance', label: 'Ёмкость', unit: UNITS.microfarad, of: 'control', min: 1, max: 2000, step: 1, value: 100 },
    ],
    compute: ({ inputs }) => ({ out: inputs.in ?? null }),
    ohms: () => null,
    view: ({ params }) => (
      <g>
        <path d="M42 26v48M58 26v48" {...STROKE} />
        <path d="M42 50H14M58 50h28" {...STROKE} />
        <text x={50} y={88} textAnchor="middle" fontSize={11} fill={INK}>
          {params.capacitance ?? 0} мкФ
        </text>
      </g>
    ),
  },
  {
    key: 'coil',
    domain: 'electricity',
    title: 'Катушка индуктивности',
    hint: 'Включается в цепь. Индуктивность задаёт пользователь',
    ports: [
      { id: 'in', label: 'Сила тока', unit: UNITS.ampere, dir: 'in', group: 'electrical', modifier: true, passthrough: true },
      { id: 'out', label: 'Сила тока', unit: UNITS.ampere, dir: 'out', group: 'electrical' },
    ],
    terminals: [
      { id: 'left', x: 14, y: 50, side: 'left', port: 'in', dir: 'in' },
      { id: 'right', x: 86, y: 50, side: 'right', port: 'out', dir: 'out' },
    ],
    params: [
      { id: 'inductance', label: 'Индуктивность', unit: UNITS.millihenry, of: 'control', min: 1, max: 5000, step: 1, value: 100 },
    ],
    compute: ({ inputs }) => ({ out: inputs.in ?? null }),
    ohms: () => null,
    view: ({ params }) => (
      <g>
        <path d="M26 40c0-8 8-8 8 0s8 8 8 0 8-8 8 0 8 8 8 0 8-8 8 0" {...STROKE} />
        <path d="M26 60c0-8 8-8 8 0s8 8 8 0 8-8 8 0 8 8 8 0 8-8 8 0" {...STROKE} />
        <path d="M26 32v36M90 32v36" {...STROKE} />
        <text x={50} y={88} textAnchor="middle" fontSize={10} fill={INK}>
          {params.inductance ?? 0} мГн
        </text>
      </g>
    ),
  },
  {
    key: 'oscillator',
    domain: 'electricity',
    title: 'Колебательный контур',
    hint: 'Считает частоту по формуле Томсона f = 1 / (2π√(L·C))',
    ports: [
      { id: 'inductance', label: 'Индуктивность', unit: UNITS.millihenry, dir: 'in', group: 'electrical', modifier: true },
      { id: 'capacitance', label: 'Ёмкость', unit: UNITS.microfarad, dir: 'in', group: 'electrical', modifier: true },
      { id: 'frequency', label: 'Частота', unit: UNITS.hertz, dir: 'out', group: 'electrical', readonly: true },
    ],
    terminals: [
      { id: 'left', x: 16, y: 50, side: 'left', port: 'inductance', dir: 'in' },
    ],
    params: [],
    compute: ({ inputs }) => {
      const asFrequency = (): number | null => {
        const inductance = inputs.inductance ?? null
        const capacitance = inputs.capacitance ?? null
        if (inductance === null || capacitance === null) return null

        const henry = inductance * (UNITS.millihenry.factor ?? 1e-3)
        const farad = capacitance * (UNITS.microfarad.factor ?? 1e-6)
        if (henry <= 0 || farad <= 0) return null

        const pi = 3.142
        return 1 / (2 * pi * Math.sqrt(henry * farad))
      }

      return { frequency: asFrequency() }
    },
    measure: ({ components }) => {
      let inductance = 0
      let capacitance = 0

      for (const other of components) {
        // Номиналы заданы в мГн и мкФ, а в формулу Томсона входят генри и фарады.
        if (other.key === 'coil') inductance += (other.params.inductance ?? 0) * (UNITS.millihenry.factor ?? 1e-3)
        if (other.key === 'capacitor') capacitance += (other.params.capacitance ?? 0) * (UNITS.microfarad.factor ?? 1e-6)
      }

      if (inductance <= 0 || capacitance <= 0) return { frequency: null }

      const pi = 3.142
      return { frequency: 1 / (2 * pi * Math.sqrt(inductance * capacitance)) }
    },
    view: ({ outputs, time, running }) => {
      const frequency = outputs.frequency ?? 0
      // Частота может быть сотнями герц: если вести фазу ровно по ней, волна
      // за кадр успевает пройти десятки периодов и на экране «замирает».
      // Поэтому для анимации берём сглаженную скорость.
      const visual = Math.min(Math.log10(Math.max(frequency, 1)) * 2, 6)
      const phase = running ? time * visual : 0
      const wave = Array.from({ length: 41 }, (_, index) => {
        const x = 10 + index * 2
        const y = 50 - Math.sin(phase + index * 0.35) * 18
        return `${index === 0 ? 'M' : 'L'}${x} ${y.toFixed(1)}`
      }).join(' ')

      return (
        <g>
          <path d={wave} fill="none" stroke={ACCENT} strokeWidth={2.5} />
          <text x={50} y={88} textAnchor="middle" fontSize={11} fill={INK}>
            {frequency > 0 ? `${frequency.toFixed(2)} Гц` : '—'}
          </text>
        </g>
      )
    },
  },
]

export const LIBRARY: ComponentSpec[] = [...electricityComponents]

export type { ViewProps }
