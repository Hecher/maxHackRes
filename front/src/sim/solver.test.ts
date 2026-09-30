import { describe, expect, it } from 'vitest'
import { UNITS, quantity, toBase } from '@/physics/quantity'
import { registerComponent, resetRegistry } from './registry'
import { canConnect, portValue, solveScheme, validateScheme, type Scheme } from './solver'
import type { ComponentSpec } from './component'

function source(): ComponentSpec {
  return {
    key: 'test-source',
    domain: 'electricity',
    title: 'Источник',
    hint: 'Задаёт напряжение',
    ports: [{ id: 'out', label: 'Напряжение', unit: UNITS.volt, dir: 'out' }],
    terminals: [{ id: 'plus', x: 88, y: 50, side: 'right', port: 'out', dir: 'out' }],
    params: [
      { id: 'emf', label: 'ЭДС', unit: UNITS.volt, of: 'control', min: 0, max: 24, step: 0.5, value: 12 },
    ],
    compute: ({ params }) => ({ out: params.emf ?? 0 }),
  }
}

function resistor(): ComponentSpec {
  return {
    key: 'test-resistor',
    domain: 'electricity',
    title: 'Резистор',
    hint: 'Закон Ома',
    ports: [
      { id: 'voltage', label: 'Напряжение', unit: UNITS.volt, dir: 'in' },
      { id: 'current', label: 'Сила тока', unit: UNITS.ampere, dir: 'out' },
    ],
    terminals: [
      { id: 'left', x: 12, y: 50, side: 'left', port: 'voltage', dir: 'in' },
      { id: 'right', x: 88, y: 50, side: 'right', port: 'current', dir: 'out' },
    ],
    params: [
      { id: 'resistance', label: 'Сопротивление', unit: UNITS.ohm, of: 'setting', min: 1, max: 100, step: 1, value: 10 },
    ],
    compute: ({ inputs, params }) => {
      const voltage = inputs.voltage ?? null
      const resistance = params.resistance ?? 1
      return { current: voltage === null ? null : voltage / resistance }
    },
  }
}

function meter(): ComponentSpec {
  return {
    key: 'test-meter',
    domain: 'electricity',
    title: 'Амперметр',
    hint: 'Показывает ток',
    ports: [
      { id: 'in', label: 'Ток', unit: UNITS.ampere, dir: 'in' },
      { id: 'out', label: 'Показание', unit: UNITS.ampere, dir: 'out' },
    ],
    terminals: [
      { id: 'left', x: 10, y: 50, side: 'left', port: 'in', dir: 'in' },
      { id: 'right', x: 90, y: 50, side: 'right', port: 'out', dir: 'out' },
    ],
    params: [],
    compute: ({ inputs }) => ({ out: inputs.in ?? null }),
  }
}

function thermalSink(): ComponentSpec {
  return {
    key: 'test-thermal',
    domain: 'thermal',
    title: 'Температура',
    hint: 'Принимает только температуру',
    ports: [{ id: 'plus', label: 'Температура', unit: UNITS.celsius, dir: 'in', group: 'thermal' }],
    terminals: [{ id: 'plus', x: 12, y: 50, side: 'left', port: 'plus', dir: 'in' }],
    params: [],
    compute: () => ({}),
  }
}

function prepare() {
  resetRegistry()
  registerComponent(source())
  registerComponent(resistor())
  registerComponent(meter())
}

const chain: Scheme = {
  components: [
    { id: 'src', key: 'test-source', params: { emf: 12 } },
    { id: 'r', key: 'test-resistor', params: { resistance: 10 } },
    { id: 'amp', key: 'test-meter' },
  ],
  links: [
    { id: 'l1', from: { component: 'src', terminal: 'plus' }, to: { component: 'r', terminal: 'left' } },
    { id: 'l2', from: { component: 'r', terminal: 'right' }, to: { component: 'amp', terminal: 'left' } },
  ],
}

describe('проверка схемы', () => {
  it('принимает корректную цепочку', () => {
    prepare()
    expect(validateScheme(chain)).toEqual([])
  })

  it('ловит несовместимые величины: ток в температуру', () => {
    prepare()
    registerComponent(thermalSink())

    const bad: Scheme = {
      components: [
        { id: 'r1', key: 'test-resistor' },
        { id: 't1', key: 'test-thermal' },
      ],
      links: [
        { id: 'x', from: { component: 'r1', terminal: 'right' }, to: { component: 't1', terminal: 'plus' } },
      ],
    }

    const issues = validateScheme(bad)
    expect(issues.some((issue) => issue.kind === 'incompatible')).toBe(true)
  })

  it('ловит провод между двумя входами', () => {
    prepare()

    const bad: Scheme = {
      components: [
        { id: 'a', key: 'test-meter' },
        { id: 'b', key: 'test-resistor' },
      ],
      links: [
        { id: 'x', from: { component: 'a', terminal: 'left' }, to: { component: 'b', terminal: 'left' } },
      ],
    }

    const issues = validateScheme(bad)
    expect(issues.some((issue) => issue.kind === 'wrong-direction' && issue.reason === 'in-to-in')).toBe(true)
  })

  it('ловит неизвестный компонент', () => {
    prepare()

    const issues = validateScheme({ components: [{ id: 'x', key: 'нет-такого' }], links: [] })
    expect(issues.some((issue) => issue.kind === 'unknown-component')).toBe(true)
  })
})

describe('соединение клемм', () => {
  it('разрешает выход со входом одной величины', () => {
    prepare()
    const result = canConnect(source(), 'plus', resistor(), 'left')
    expect(result.ok).toBe(true)
  })

  it('запрещает соединять разные величины и объясняет почему', () => {
    prepare()
    registerComponent(thermalSink())

    const result = canConnect(resistor(), 'right', thermalSink(), 'plus')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('Разные величины')
  })
})

describe('расчёт схемы', () => {
  it('считает ток по закону Ома', () => {
    prepare()
    const result = solveScheme(chain)

    expect(result.issues).toEqual([])
    expect(result.values['r:current']).toBeCloseTo(1.2, 9)
    expect(result.values['amp:out']).toBeCloseTo(1.2, 9)
  })

  it('учитывает настроенный параметр', () => {
    prepare()

    const other: Scheme = {
      ...chain,
      components: chain.components.map((item) =>
        item.id === 'r' ? { ...item, params: { resistance: 4 } } : item,
      ),
    }

    const result = solveScheme(other)
    expect(result.values['r:current']).toBeCloseTo(3, 9)
  })

  it('не считает схему с несовместимым соединением', () => {
    prepare()
    registerComponent(thermalSink())

    const bad: Scheme = {
      components: [
        { id: 'r1', key: 'test-resistor' },
        { id: 't1', key: 'test-thermal' },
      ],
      links: [
        { id: 'x', from: { component: 'r1', terminal: 'right' }, to: { component: 't1', terminal: 'plus' } },
      ],
    }

    const result = solveScheme(bad)
    expect(result.issues.some((issue) => issue.kind === 'incompatible')).toBe(true)
    expect(result.values['r1:current']).toBeNull()
  })

  it('оставляет вход без провода пустым', () => {
    prepare()

    const result = solveScheme({ components: [{ id: 'r', key: 'test-resistor' }], links: [] })
    expect(result.values['r:current']).toBeNull()
  })

  it('отдаёт значение в единице порта', () => {
    prepare()

    const result = solveScheme(chain)
    const current = portValue(chain, result.values, 'r', 'current')

    expect(current).toBeCloseTo(1.2, 9)
  })
})

describe('величины', () => {
  it('переводит в СИ и обратно', () => {
    const milliamps = quantity(1200, UNITS.milliampere)
    expect(toBase(milliamps)).toBeCloseTo(1.2, 9)
  })
})
