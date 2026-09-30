import { describe, expect, it } from 'vitest'
import {
  addComponent,
  addLink,
  emptyStand,
  freeSlot,
  moveComponent,
  removeComponent,
  removeLink,
  schemeOf,
  setParams,
  usedTerminals,
} from './scheme'

describe('стенд', () => {
  it('ставит новый компонент на свободное место', () => {
    let stand = emptyStand()
    stand = addComponent(stand, 'a', 'resistor')
    stand = addComponent(stand, 'b', 'lamp')

    expect(stand.components).toHaveLength(2)
    expect(stand.components[0]?.x).not.toBe(stand.components[1]?.x)
  })

  it('не даёт увести прибор за пределы полотна', () => {
    let stand = addComponent(emptyStand(), 'a', 'resistor')
    stand = moveComponent(stand, 'a', 500, -200)

    expect(stand.components[0]?.x).toBeLessThanOrEqual(94)
    expect(stand.components[0]?.y).toBeGreaterThanOrEqual(6)
  })

  it('меняет параметры прибора', () => {
    let stand = addComponent(emptyStand(), 'a', 'resistor')
    stand = setParams(stand, 'a', { resistance: 42 })

    expect(stand.components[0]?.params).toEqual({ resistance: 42 })
  })

  it('удаляет прибор вместе с его проводами', () => {
    let stand = addComponent(emptyStand(), 'a', 'source')
    stand = addComponent(stand, 'b', 'lamp')
    stand = addLink(stand, {
      id: 'l1',
      from: { component: 'a', terminal: 'plus' },
      to: { component: 'b', terminal: 'left' },
    })
    stand = addLink(stand, {
      id: 'l2',
      from: { component: 'b', terminal: 'right' },
      to: { component: 'a', terminal: 'minus' },
    })

    expect(stand.links).toHaveLength(2)

    const after = removeComponent(stand, 'b')
    expect(after.components).toHaveLength(1)
    expect(after.links).toHaveLength(0)
  })

  it('не добавляет один и тот же провод дважды', () => {
    let stand = addComponent(emptyStand(), 'a', 'source')
    stand = addComponent(stand, 'b', 'lamp')

    const link = {
      id: 'l1',
      from: { component: 'a', terminal: 'plus' },
      to: { component: 'b', terminal: 'left' },
    }

    stand = addLink(stand, link)
    stand = addLink(stand, { ...link, id: 'l2' })

    expect(stand.links).toHaveLength(1)
  })

  it('считает повторный провод в обратную сторону тем же проводом', () => {
    let stand = addComponent(emptyStand(), 'a', 'source')
    stand = addComponent(stand, 'b', 'lamp')

    stand = addLink(stand, {
      id: 'l1',
      from: { component: 'a', terminal: 'plus' },
      to: { component: 'b', terminal: 'left' },
    })
    stand = addLink(stand, {
      id: 'l2',
      from: { component: 'b', terminal: 'left' },
      to: { component: 'a', terminal: 'plus' },
    })

    expect(stand.links).toHaveLength(1)
  })

  it('убирает провод по идентификатору', () => {
    let stand = addComponent(emptyStand(), 'a', 'source')
    stand = addComponent(stand, 'b', 'lamp')
    stand = addLink(stand, {
      id: 'l1',
      from: { component: 'a', terminal: 'plus' },
      to: { component: 'b', terminal: 'left' },
    })

    expect(removeLink(stand, 'l1').links).toHaveLength(0)
  })

  it('показывает занятые клеммы', () => {
    let stand = addComponent(emptyStand(), 'a', 'source')
    stand = addComponent(stand, 'b', 'lamp')
    stand = addLink(stand, {
      id: 'l1',
      from: { component: 'a', terminal: 'plus' },
      to: { component: 'b', terminal: 'left' },
    })

    expect([...usedTerminals(stand, 'a')]).toEqual(['plus'])
    expect([...usedTerminals(stand, 'b')]).toEqual(['left'])
  })

  it('отдаёт схему без координат', () => {
    const stand = addComponent(emptyStand(), 'a', 'resistor')
    const scheme = schemeOf(stand)

    expect(scheme.components[0]).toEqual({ id: 'a', key: 'resistor', params: undefined })
  })

  it('раскладывает места по сетке', () => {
    const first = freeSlot(emptyStand())
    const second = freeSlot(addComponent(emptyStand(), 'a', 'resistor'))

    expect(first.x).toBeLessThan(second.x)
  })
})
