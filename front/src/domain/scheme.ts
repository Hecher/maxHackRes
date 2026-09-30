import type { Scheme, SchemeLink } from '@/sim/solver'

export interface PlacedComponent {
  id: string
  key: string
  params?: Record<string, number>
  x: number
  y: number
  label?: string
}

export interface Stand {
  components: PlacedComponent[]
  links: SchemeLink[]
}

export interface JournalColumn {
  key: string
  label: string
  unit?: string
  source: 'auto' | 'manual'
  
  bind?: { component: string; port: string }
  precision: number
}

export const MODEL_VERSION = 2

export interface LabModel {
  version: number
  stand: Stand
  journal: JournalColumn[]
}

export function emptyStand(): Stand {
  return { components: [], links: [] }
}

export function emptyModel(): LabModel {
  return { version: MODEL_VERSION, stand: emptyStand(), journal: [] }
}

export function schemeOf(stand: Stand): Scheme {
  return {
    components: stand.components.map((item) => ({
      id: item.id,
      key: item.key,
      params: item.params,
    })),
    links: stand.links,
  }
}

export function componentById(stand: Stand, id: string): PlacedComponent | undefined {
  return stand.components.find((item) => item.id === id)
}

export function freeSlot(stand: Stand): { x: number; y: number } {
  const columns = 3
  const step = 30
  const index = stand.components.length

  return {
    x: 22 + (index % columns) * step,
    y: 26 + Math.floor(index / columns) * step,
  }
}

export function addComponent(stand: Stand, id: string, key: string, params?: Record<string, number>): Stand {
  const slot = freeSlot(stand)

  return {
    ...stand,
    components: [...stand.components, { id, key, params, x: slot.x, y: slot.y }],
  }
}

export function moveComponent(stand: Stand, id: string, x: number, y: number): Stand {
  return {
    ...stand,
    components: stand.components.map((item) =>
      item.id === id ? { ...item, x: clampPosition(x), y: clampPosition(y) } : item,
    ),
  }
}

function clampPosition(value: number): number {
  return Math.max(6, Math.min(94, Math.round(value * 10) / 10))
}

export function removeComponent(stand: Stand, id: string): Stand {
  return {
    components: stand.components.filter((item) => item.id !== id),
    links: stand.links.filter((link) => link.from.component !== id && link.to.component !== id),
  }
}

export function setParams(stand: Stand, id: string, params: Record<string, number>): Stand {
  return {
    ...stand,
    components: stand.components.map((item) => (item.id === id ? { ...item, params } : item)),
  }
}

export function addLink(stand: Stand, link: SchemeLink): Stand {
  const exists = stand.links.some(
    (item) =>
      (item.from.component === link.from.component &&
        item.from.terminal === link.from.terminal &&
        item.to.component === link.to.component &&
        item.to.terminal === link.to.terminal) ||
      (item.from.component === link.to.component &&
        item.from.terminal === link.to.terminal &&
        item.to.component === link.from.component &&
        item.to.terminal === link.from.terminal),
  )

  return exists ? stand : { ...stand, links: [...stand.links, link] }
}

export function removeLink(stand: Stand, linkId: string): Stand {
  return { ...stand, links: stand.links.filter((item) => item.id !== linkId) }
}

export function usedTerminals(stand: Stand, componentId: string): Set<string> {
  const used = new Set<string>()

  for (const link of stand.links) {
    if (link.from.component === componentId) used.add(link.from.terminal)
    if (link.to.component === componentId) used.add(link.to.terminal)
  }

  return used
}

export function autoColumn(componentId: string, portId: string, label: string, unit?: string): JournalColumn {
  return {
    key: `${componentId}-${portId}`,
    label,
    unit,
    source: 'auto',
    bind: { component: componentId, port: portId },
    precision: 2,
  }
}

export function manualColumn(key: string, label: string, unit?: string, precision = 2): JournalColumn {
  return { key, label, unit, source: 'manual', precision }
}

export function addColumn(journal: JournalColumn[], column: JournalColumn): JournalColumn[] {
  if (journal.some((item) => item.key === column.key)) return journal
  return [...journal, column]
}
