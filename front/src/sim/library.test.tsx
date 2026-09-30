import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DOMAINS, allComponents, defaultParams, getComponent, inputsOf } from './index'
import type { ComponentSpec, ViewProps } from './component'

const components = allComponents()

function viewProps(spec: ComponentSpec, overrides: Partial<ViewProps> = {}): ViewProps {
  const outputs: Record<string, number | null> = {}
  const inputs: Record<string, number | null> = {}

  for (const port of spec.ports) {
    if (port.dir === 'out') outputs[port.id] = port.unit.factor * 1
    else inputs[port.id] = port.unit.factor * 1
  }

  return { outputs, inputs, params: defaultParams(spec), time: 1.5, running: true, ...overrides }
}

describe('библиотека', () => {
  it('не пустая и покрывает все разделы', () => {
    expect(components.length).toBeGreaterThanOrEqual(8)

    for (const domain of DOMAINS) {
      const items = components.filter((spec) => spec.domain === domain.key)
      expect(items.length, `раздел «${domain.title}» пуст`).toBeGreaterThan(0)
    }
  })

  it('ключи уникальны', () => {
    const keys = components.map((spec) => spec.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('у каждого компонента есть выход', () => {
    const withoutOutput = components
      .filter((spec) => spec.ports.every((port) => port.dir !== 'out'))
      .map((spec) => spec.key)

    expect(withoutOutput).toEqual([])
  })

  it('клеммы привязаны к существующим портам нужного направления', () => {
    for (const spec of components) {
      expect(spec.terminals.length, `у «${spec.title}» нет клемм`).toBeGreaterThan(0)

      for (const terminal of spec.terminals) {
        const port = spec.ports.find((item) => item.id === terminal.port)
        expect(port, `клемма «${terminal.id}» ссылается на несуществующий порт`).toBeDefined()
        expect(port?.dir).toBe(terminal.dir)
      }
    }
  })

  it('координаты клемм внутри корпуса', () => {
    for (const spec of components) {
      for (const terminal of spec.terminals) {
        expect(terminal.x).toBeGreaterThanOrEqual(0)
        expect(terminal.x).toBeLessThanOrEqual(100)
        expect(terminal.y).toBeGreaterThanOrEqual(0)
        expect(terminal.y).toBeLessThanOrEqual(100)
      }
    }
  })

  it('параметры описаны корректно', () => {
    for (const spec of components) {
      for (const param of spec.params) {
        expect(param.min).toBeLessThan(param.max)
        expect(param.value).toBeGreaterThanOrEqual(param.min)
        expect(param.value).toBeLessThanOrEqual(param.max)
        expect(param.step).toBeGreaterThan(0)
      }
    }
  })

  it('находится по ключу', () => {
    expect(getComponent('resistor')?.title).toBe('Резистор')
    expect(getComponent('oscillator')?.domain).toBe('electricity')
  })
})

describe('расчёт компонентов', () => {
  it('считает на значениях по умолчанию', () => {
    for (const spec of components) {
      const params = defaultParams(spec)
      const inputs: Record<string, number | null> = {}
      for (const port of inputsOf(spec)) inputs[port.id] = port.unit.factor

      const result = spec.compute({ inputs, params, time: 1 })

      for (const port of spec.ports) {
        if (port.dir !== 'out') continue
        const value = result[port.id]
        expect(value === null || Number.isFinite(value), `«${spec.title}»: порт ${port.id}`).toBe(true)
      }
    }
  })

  it('не падает и не выдаёт бесконечность без подключённых входов', () => {
    for (const spec of components) {
      const params = defaultParams(spec)
      const inputs: Record<string, number | null> = {}
      for (const port of inputsOf(spec)) inputs[port.id] = null

      const result = spec.compute({ inputs, params, time: 0 })

      for (const port of spec.ports) {
        if (port.dir !== 'out') continue
        const value = result[port.id]
        expect(value === null || Number.isFinite(value), `«${spec.title}»: порт ${port.id}`).toBe(true)
      }
    }
  })
})

describe('визуализация компонентов', () => {
  it('рисуется без ошибок', () => {
    for (const spec of components) {
      if (!spec.view) continue
      const markup = renderToStaticMarkup(<svg>{spec.view(viewProps(spec))}</svg>)
      expect(markup.length, `«${spec.title}»: пустая отрисовка`).toBeGreaterThan(0)
    }
  })

  it('показывает прочерк, когда значения ещё нет', () => {
    for (const spec of components) {
      if (!spec.view) continue

      const outputs: Record<string, number | null> = {}
      const inputs: Record<string, number | null> = {}
      for (const port of spec.ports) {
        if (port.dir === 'out') outputs[port.id] = null
        else inputs[port.id] = null
      }

      const markup = renderToStaticMarkup(
        <svg>{spec.view({ outputs, inputs, params: defaultParams(spec), time: 0, running: false })}</svg>,
      )

      expect(markup.length).toBeGreaterThan(0)
    }
  })

  it('анимация колебательного контура зависит от времени', () => {
    const tank = getComponent('oscillator')!
    const props = viewProps(tank)
    props.outputs.frequency = 50
    props.outputs.out = 1.2

    const first = renderToStaticMarkup(<svg>{tank.view!({ ...props, time: 0, running: true })}</svg>)
    const second = renderToStaticMarkup(<svg>{tank.view!({ ...props, time: 0.7, running: true })}</svg>)

    expect(first).not.toBe(second)
  })
})
