import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { StandCanvas } from './StandCanvas'
import { addComponent, addLink, emptyStand, type Stand } from '@/domain/scheme'

function bench(): Stand {
  let stand = addComponent(emptyStand(), 'src', 'source')
  stand = addComponent(stand, 'lamp', 'lamp')
  stand = addLink(stand, {
    id: 'l1',
    from: { component: 'src', terminal: 'right' },
    to: { component: 'lamp', terminal: 'left' },
  })

  return stand
}

function render(stand: Stand, overrides: Partial<Parameters<typeof StandCanvas>[0]> = {}) {
  return renderToStaticMarkup(
    <StandCanvas stand={stand} values={{}} time={0} running={false} {...overrides} />,
  )
}

describe('полотно стенда', () => {
  it('на пустом стенде объясняет, что делать', () => {
    const markup = render(emptyStand(), { editable: true })
    expect(markup).toContain('Стенд пуст')
  })

  it('на пустом стенде ученику говорит про учителя', () => {
    const markup = render(emptyStand())
    expect(markup).toContain('не задан стенд')
  })

  it('рисует приборы их моделями', () => {
    const markup = render(bench())

    expect(markup).toContain('<circle')
    expect(markup).toContain('Лампа')
    expect(markup).toContain('Источник питания')  })

  it('рисует провод между клеммами', () => {
    const markup = render(bench())

    expect(markup).toContain('<path')
    expect(markup).toContain('M')
  })

  it('не рисует провод к несуществующему прибору', () => {
    let stand = addComponent(emptyStand(), 'src', 'source')
    stand = {
      ...stand,
      links: [
        { id: 'bad', from: { component: 'src', terminal: 'plus' }, to: { component: 'ghost', terminal: 'x' } },
      ],
    }

    const markup = render(stand)
    expect(markup).not.toContain('ghost')
  })

  it('показывает клеммы только в режиме правки', () => {
    const viewMarkup = render(bench())
    const editMarkup = render(bench(), { editable: true })

    expect(editMarkup.length).toBeGreaterThan(viewMarkup.length)
  })

  it('подсвечивает прибор с проблемой соединения', () => {
    const editing = render(bench(), {
      editable: true,
      issues: [{ kind: 'no-output', componentId: 'src' }],
    })

    expect(editing).toContain('plateWrong')

    const viewing = render(bench(), { issues: [{ kind: 'no-output', componentId: 'src' }] })
    expect(viewing).toContain('deviceWrong')
  })

  it('рисует подложки только в режиме правки', () => {
    expect(render(bench(), { editable: true })).toContain('plate')
    expect(render(bench())).not.toContain('plate')
  })

  it('показывает течение тока, когда опыт идёт', () => {
    const idle = render(bench(), { values: { 'src:source': 12, 'lamp:out': 1.2 }, running: false })
    const flowing = render(bench(), {
      values: { 'src:source': 12, 'lamp:out': 1.2 },
      running: true,
      time: 1,
    })

    expect(flowing).not.toBe(idle)
    expect(flowing).toContain('current')
  })

  it('передаёт время в отрисовку движущихся приборов', () => {
    const stand = addComponent(emptyStand(), 'tank', 'oscillator')

    const first = render(stand, { time: 0, running: true, values: { 'tank:frequency': 50, 'tank:out': 1.2 } })
    const second = render(stand, { time: 0.5, running: true, values: { 'tank:frequency': 50, 'tank:out': 1.2 } })

    expect(first).not.toBe(second)
  })

  it('в покое анимация замирает', () => {
    const stand = addComponent(emptyStand(), 'tank', 'oscillator')

    const first = render(stand, { time: 0, running: false, values: { 'tank:frequency': 50 } })
    const second = render(stand, { time: 3, running: false, values: { 'tank:frequency': 50 } })

    expect(first).toBe(second)
  })
})
