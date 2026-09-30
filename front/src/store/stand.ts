import { create } from 'zustand'
import { canConnect, getComponent } from '@/sim'
import {
  addComponent as addToStand,
  addLink,
  addColumn as addJournalColumn,
  moveComponent,
  removeComponent,
  removeLink,
  setParams,
  type JournalColumn,
  type Stand,
} from '@/domain/scheme'
import { createDraft } from '@/domain/draft'
import type { LabDraft, Visibility } from '@/domain/types'

export interface DraftIssue {
  field: 'title' | 'stand' | 'journal' | 'audience'
  message: string
}

interface StandState {
  draft: LabDraft
  selectedId: string | null
  pending: { component: string; terminal: string } | null
  notice: string | null
  issues: DraftIssue[]

  reset: () => void
  patch: (patch: Partial<LabDraft>) => void
  setVisibility: (visibility: Visibility) => void
  toggleClass: (classId: string) => void

  addComponent: (key: string) => void
  select: (id: string | null) => void
  move: (id: string, x: number, y: number) => void
  remove: (id: string) => void
  updateParams: (id: string, params: Record<string, number>) => void
  tapTerminal: (componentId: string, terminalId: string) => void
  cancelPending: () => void
  disconnect: (linkId: string) => void

  addColumn: (column: JournalColumn) => void
  updateColumn: (key: string, patch: Partial<JournalColumn>) => void
  removeColumn: (key: string) => void

  validate: (hasAudience: boolean) => DraftIssue[]
}

let counter = 0

function nextId(prefix: string): string {
  counter += 1
  return `${prefix}${counter}`
}


export function nextManualColumnKey(): string {
  return nextId('manual-')
}

export const useStand = create<StandState>((set, get) => ({
  draft: createDraft(),
  selectedId: null,
  pending: null,
  notice: null,
  issues: [],

  reset: () => set({ draft: createDraft(), selectedId: null, pending: null, notice: null, issues: [] }),

  patch: (patch) => set({ draft: { ...get().draft, ...patch } }),

  setVisibility: (visibility) =>
    set({ draft: { ...get().draft, visibility, assignedClassIds: visibility === 'public' ? [] : get().draft.assignedClassIds } }),

  toggleClass: (classId) => {
    const { draft } = get()
    const assigned = draft.assignedClassIds.includes(classId)
      ? draft.assignedClassIds.filter((item) => item !== classId)
      : [...draft.assignedClassIds, classId]

    set({ draft: { ...draft, assignedClassIds: assigned } })
  },

  addComponent: (key) => {
    const { draft } = get()
    const id = nextId('c')
    const stand = addToStand(draft.model.stand, id, key)

    set({
      draft: { ...draft, model: { ...draft.model, stand } },
      selectedId: id,
      notice: null,
    })
  },

  select: (id) => set({ selectedId: id }),

  move: (id, x, y) => {
    const { draft } = get()
    const stand = moveComponent(draft.model.stand, id, x, y)
    set({ draft: { ...draft, model: { ...draft.model, stand } } })
  },

  remove: (id) => {
    const { draft } = get()
    const stand = removeComponent(draft.model.stand, id)

    set({
      draft: {
        ...draft,
        model: {
          ...draft.model,
          stand,
          journal: draft.model.journal.filter((column) => column.bind?.component !== id),
        },
      },
      selectedId: null,
      notice: null,
    })
  },

  updateParams: (id, params) => {
    const { draft } = get()
    const stand = setParams(draft.model.stand, id, params)
    set({ draft: { ...draft, model: { ...draft.model, stand } } })
  },

  tapTerminal: (componentId, terminalId) => {
    const { draft, pending } = get()

    if (!pending) {
      set({ pending: { component: componentId, terminal: terminalId }, notice: null })
      return
    }

    if (pending.component === componentId && pending.terminal === terminalId) {
      set({ pending: null })
      return
    }

    const first = draft.model.stand.components.find((item) => item.id === pending.component)
    const second = draft.model.stand.components.find((item) => item.id === componentId)
    const firstSpec = getComponent(first?.key)
    const secondSpec = getComponent(second?.key)

    if (!firstSpec || !secondSpec) {
      set({ pending: null, notice: 'Компонент не найден в библиотеке' })
      return
    }

    const check = canConnect(firstSpec, pending.terminal, secondSpec, terminalId)
    if (!check.ok) {
      set({ pending: null, notice: check.reason })
      return
    }

    const stand = addLink(draft.model.stand, {
      id: nextId('l'),
      from: { component: pending.component, terminal: pending.terminal },
      to: { component: componentId, terminal: terminalId },
    })

    set({
      draft: { ...draft, model: { ...draft.model, stand } },
      pending: null,
      notice: null,
    })
  },

  cancelPending: () => set({ pending: null, notice: null }),

  disconnect: (linkId) => {
    const { draft } = get()
    const stand = removeLink(draft.model.stand, linkId)
    set({ draft: { ...draft, model: { ...draft.model, stand } } })
  },

  addColumn: (column) => {
    const { draft } = get()
    set({
      draft: {
        ...draft,
        model: { ...draft.model, journal: addJournalColumn(draft.model.journal, column) },
      },
    })
  },

  updateColumn: (key, patch) => {
    const { draft } = get()
    set({
      draft: {
        ...draft,
        model: {
          ...draft.model,
          journal: draft.model.journal.map((column) =>
            column.key === key ? { ...column, ...patch } : column,
          ),
        },
      },
    })
  },

  removeColumn: (key) => {
    const { draft } = get()
    set({
      draft: {
        ...draft,
        model: { ...draft.model, journal: draft.model.journal.filter((column) => column.key !== key) },
      },
    })
  },

  validate: (hasAudience) => {
    const { draft } = get()
    const issues: DraftIssue[] = []

    if (!draft.title.trim()) issues.push({ field: 'title', message: 'Укажите название работы' })

    const stand = draft.model.stand
    if (stand.components.length === 0) {
      issues.push({ field: 'stand', message: 'На стенде нет ни одного компонента' })
    }

    for (const component of stand.components) {
      const spec = getComponent(component.key)
      if (!spec) continue

      const connected = new Set<string>()
      for (const link of stand.links) {
        if (link.to.component === component.id) connected.add(link.to.terminal)
        if (link.from.component === component.id) connected.add(link.from.terminal)
      }

      for (const port of spec.ports.filter((item) => item.dir === 'in')) {
        const terminal = spec.terminals.find((item) => item.port === port.id)
        if (terminal && !connected.has(terminal.id)) {
          issues.push({
            field: 'stand',
            message: `У прибора «${spec.title}» не подключён вход «${port.label}»`,
          })
        }
      }
    }

    const journal = draft.model.journal
    if (journal.length === 0) {
      issues.push({ field: 'journal', message: 'В журнале нет ни одного столбца' })
    }

    for (const column of journal) {
      if (column.source !== 'auto') continue
      if (!column.bind) {
        issues.push({ field: 'journal', message: `Столбец «${column.label}» не привязан к прибору` })
        continue
      }

      const component = stand.components.find((item) => item.id === column.bind?.component)
      const spec = component ? getComponent(component.key) : undefined
      if (!spec?.ports.some((port) => port.id === column.bind?.port)) {
        issues.push({ field: 'journal', message: `Столбец «${column.label}» ссылается на пропавший порт` })
      }
    }

    if (draft.visibility === 'private' && !hasAudience) {
      issues.push({ field: 'audience', message: 'Выберите класс или опубликуйте работу для всех' })
    }

    set({ issues })
    return issues
  },
}))

export type { Stand }
