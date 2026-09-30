import { describe, expect, it } from 'vitest'
import { UNITS, groupForDimension, sameDimension } from '@/physics/quantity'
import { LIBRARY } from './components/library'
import { canConnect, portsCompatible, solveScheme, type Scheme } from './solver'

import { getComponent } from './index'
import type { PortSpec } from './component'

function specOf(key: string) {
  const spec = getComponent(key)
  if (!spec) throw new Error(`нет компонента ${key}`)
  return spec
}

function port(key: string, index: number): PortSpec {
  const spec = specOf(key)
  const found = spec.ports[index]
  if (!found) throw new Error(`у «${key}» нет порта ${index}`)
  return found
}

describe('номиналы задаются в удобных единицах, а считаются в СИ', () => {
  it('100 мГн в параметре — это 0,1 Гн в формуле', () => {
    expect(UNITS.millihenry.factor).toBeCloseTo(1e-3, 12)
    expect(100 * (UNITS.millihenry.factor ?? 0)).toBeCloseTo(0.1, 9)
  })

  it('100 мкФ в параметре — это 1e-4 Ф в формуле', () => {
    expect(UNITS.microfarad.factor).toBeCloseTo(1e-6, 12)
    expect(100 * (UNITS.microfarad.factor ?? 0)).toBeCloseTo(1e-4, 12)
  })

  it('катушка и конденсатор в журнале показывают заданное значение', () => {
    expect(specOf('coil').params[0]?.unit.symbol).toBe('мГн')
    expect(specOf('capacitor').params[0]?.unit.symbol).toBe('мкФ')
    expect(specOf('resistor').params[0]?.unit.symbol).toBe('Ом')
  })
})

describe('закон Ома в собранной цепи', () => {
  it('источник 12 В и резистор 10 Ом дают ток 1,2 А', () => {
    const scheme: Scheme = {
      components: [
        { id: 'src', key: 'source', params: { voltage: 12 } },
        { id: 'r', key: 'resistor', params: { resistance: 10 } },
      ],
      links: [
        { id: 'l1', from: { component: 'src', terminal: 'right' }, to: { component: 'r', terminal: 'left' } },
      ],
    }

    const result = solveScheme(scheme)

    expect(result.issues).toEqual([])
    expect(result.values['r:out']).toBeCloseTo(1.2, 6)
    expect(result.values['src:current']).toBeCloseTo(1.2, 6)
  })

  it('резистор 4 Ом при 12 В даёт 3 А', () => {
    const scheme: Scheme = {
      components: [
        { id: 'src', key: 'source', params: { voltage: 12 } },
        { id: 'r', key: 'resistor', params: { resistance: 4 } },
      ],
      links: [
        { id: 'l1', from: { component: 'src', terminal: 'right' }, to: { component: 'r', terminal: 'left' } },
      ],
    }

    expect(solveScheme(scheme).values['r:out']).toBeCloseTo(3, 6)
  })

  it('последовательная цепь складывает сопротивления', () => {
    const scheme: Scheme = {
      components: [
        { id: 'src', key: 'source', params: { voltage: 12 } },
        { id: 'r1', key: 'resistor', params: { resistance: 10 } },
        { id: 'r2', key: 'resistor', params: { resistance: 10 } },
      ],
      links: [
        { id: 'l1', from: { component: 'src', terminal: 'right' }, to: { component: 'r1', terminal: 'left' } },
        { id: 'l2', from: { component: 'r1', terminal: 'right' }, to: { component: 'r2', terminal: 'left' } },
      ],
    }

    const result = solveScheme(scheme)

    expect(result.issues).toEqual([])
    expect(result.values['src:current']).toBeCloseTo(0.6, 6)
  })

  it('без нагрузки силы тока нет', () => {
    const scheme: Scheme = {
      components: [{ id: 'src', key: 'source', params: { voltage: 12 } }],
      links: [],
    }

    expect(solveScheme(scheme).values['src:current']).toBeNull()
  })
})

describe('приборы измерения', () => {
  it('амперметр показывает силу тока независимо от места в цепи', () => {
    const scheme: Scheme = {
      components: [
        { id: 'src', key: 'source', params: { voltage: 12 } },
        { id: 'amp', key: 'ammeter', params: { limit: 5 } },
        { id: 'r', key: 'resistor', params: { resistance: 10 } },
      ],
      links: [
        { id: 'l1', from: { component: 'src', terminal: 'right' }, to: { component: 'amp', terminal: 'left' } },
        { id: 'l2', from: { component: 'amp', terminal: 'right' }, to: { component: 'r', terminal: 'left' } },
      ],
    }

    const result = solveScheme(scheme)

    expect(result.issues).toEqual([])
    expect(result.values['amp:out']).toBeCloseTo(1.2, 6)
  })

  it('вольтметр показывает напряжение источника', () => {
    const scheme: Scheme = {
      components: [
        { id: 'src', key: 'source', params: { voltage: 9 } },
        { id: 'r', key: 'resistor', params: { resistance: 10 } },
        { id: 'vm', key: 'voltmeter', params: { limit: 15 } },
      ],
      links: [
        { id: 'l1', from: { component: 'src', terminal: 'right' }, to: { component: 'r', terminal: 'left' } },
        { id: 'l2', from: { component: 'r', terminal: 'right' }, to: { component: 'vm', terminal: 'left' } },
      ],
    }

    const result = solveScheme(scheme)

    expect(result.issues).toEqual([])
    expect(result.values['vm:out']).toBeCloseTo(9, 6)
  })

  it('у обоих приборов настраивается диапазон измерений', () => {
    expect(specOf('ammeter').params.map((param) => param.id)).toEqual(['limit'])
    expect(specOf('voltmeter').params.map((param) => param.id)).toEqual(['limit'])
  })
})

describe('лампа, конденсатор, катушка и контур', () => {
  it('лампа зажигается от 1 В и доходит до красного на номинале', () => {
    const render = (voltage: number) => {
      const spec = specOf('lamp')
      const markup = (spec.view as (props: unknown) => unknown)({
        inputs: { in: voltage },
        outputs: { out: null },
        params: { nominal: 12, power: 20 },
        time: 0,
        running: false,
      })

      return JSON.stringify(markup)
    }

    expect(render(0.5)).toContain('"fillOpacity":0')
    expect(render(1)).toContain('rgb(250, 246, 190)')
    expect(render(12)).toContain('rgb(214, 40, 26)')
    expect(render(12)).not.toBe(render(1))
  })

  it('контур считает частоту по формуле Томсона с pi = 3,142', () => {
    const scheme: Scheme = {
      components: [
        { id: 'coil', key: 'coil', params: { inductance: 100 } },
        { id: 'cap', key: 'capacitor', params: { capacitance: 100 } },
        { id: 'tank', key: 'oscillator' },
      ],
      // катушка и конденсатор стоят в цепи, контур читает их номиналы
      links: [
        { id: 'l1', from: { component: 'coil', terminal: 'right' }, to: { component: 'cap', terminal: 'left' } },
      ],
    }

    const result = solveScheme(scheme)
    const expected = 1 / (2 * 3.142 * Math.sqrt(0.1 * 1e-4))

    expect(result.issues).toEqual([])
    expect(result.values['tank:frequency']).toBeCloseTo(expected, 6)
  })

  it('контур без катушки и конденсатора частоту не считает', () => {
    const result = solveScheme({ components: [{ id: 'tank', key: 'oscillator' }], links: [] })

    expect(result.values['tank:frequency']).toBeNull()
  })
})

describe('соединяемость по группам величин', () => {
  it('электрические величины соединяются между собой', () => {
    expect(portsCompatible(port('source', 0), port('resistor', 0))).toBe(true)
    expect(portsCompatible(port('source', 0), port('ammeter', 0))).toBe(true)
    expect(portsCompatible(port('source', 0), port('capacitor', 0))).toBe(true)
    expect(portsCompatible(port('resistor', 1), port('ammeter', 0))).toBe(true)
  })

  it('вход соединяется только с выходом', () => {
    const meter = specOf('ammeter')
    const resistor = specOf('resistor')

    expect(canConnect(meter, 'right', resistor, 'left').ok).toBe(true)

    const inToIn = canConnect(meter, 'left', resistor, 'left')
    expect(inToIn.ok).toBe(false)
    if (!inToIn.ok) expect(inToIn.reason).toContain('входы')

    const outToOut = canConnect(meter, 'right', resistor, 'right')
    expect(outToOut.ok).toBe(false)
    if (!outToOut.ok) expect(outToOut.reason).toContain('выходы')
  })

  it('у каждого прибора клеммы подписаны и совпадают с портами', () => {
    for (const spec of LIBRARY) {
      for (const terminal of spec.terminals) {
        const found = spec.ports.find((entry) => entry.id === terminal.port)
        expect(found, `«${spec.title}»: клемма ${terminal.id} без порта`).toBeDefined()
        expect(found!.dir, `«${spec.title}»: клемма ${terminal.id} не совпадает с портом`).toBe(terminal.dir)
        expect(found!.label.length).toBeGreaterThan(0)
      }

      for (const declared of spec.ports.filter((entry) => entry.dir === 'out' && !entry.readonly)) {
        const hasTerminal = spec.terminals.some((terminal) => terminal.port === declared.id)
        expect(hasTerminal, `«${spec.title}»: у выхода ${declared.id} нет клеммы`).toBe(true)
      }
    }
  })

  it('в лабораторной остались только электрические приборы', () => {
    expect(LIBRARY.map((spec) => spec.key).sort()).toEqual([
      'ammeter',
      'capacitor',
      'coil',
      'lamp',
      'oscillator',
      'resistor',
      'source',
      'voltmeter',
    ])
  })
})

describe('группы величин', () => {
  it('электрические величины попадают в группу «electrical»', () => {
    const units = [
      UNITS.volt,
      UNITS.ampere,
      UNITS.ohm,
      UNITS.watt,
      UNITS.henry,
      UNITS.millihenry,
      UNITS.farad,
      UNITS.microfarad,
    ]

    for (const unit of units) {
      expect(groupForDimension(unit.dimension)).toBe('electrical')
    }
  })

  it('размерности в порядке', () => {
    for (const spec of LIBRARY) {
      for (const declared of spec.ports) {
        expect(sameDimension(declared.unit.dimension, declared.unit.dimension)).toBe(true)
      }
    }
  })
})
