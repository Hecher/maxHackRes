import { create } from 'zustand'
import { getComponent, solveScheme, type SolveIssue } from '@/sim'
import { schemeOf, type Stand } from '@/domain/scheme'
import { useRunClock } from '@/features/stand/useRunClock'
import type { ReadingRow } from '@/domain/types'

interface RunState {
  running: boolean
  hasRun: boolean
  rows: ReadingRow[]
  conclusion: string
  error: string | null

  setRunning: (running: boolean) => void
  setConclusion: (value: string) => void
  setError: (message: string | null) => void
  record: () => void
  removeRow: (id: string) => void
  reset: () => void
}

let rowCounter = 0

export const useRun = create<RunState>((set, get) => ({
  running: false,
  hasRun: false,
  rows: [],
  conclusion: '',
  error: null,

  setRunning: (running) => set({ running, hasRun: get().hasRun || running }),
  setConclusion: (conclusion) => set({ conclusion }),
  setError: (error) => set({ error }),

  record: () => {
    const { rows } = get()
    rowCounter += 1

    set({
      rows: [...rows, { id: `r${rowCounter}`, number: rows.length + 1, values: {} }],
    })
  },

  removeRow: (id) =>
    set({
      rows: get()
        .rows.filter((row) => row.id !== id)
        .map((row, index) => ({ ...row, number: index + 1 })),
    }),

  reset: () => set({ running: false, hasRun: false, rows: [], conclusion: '', error: null }),
}))

export interface RunSnapshot {
  values: Record<string, number | null>
  issues: SolveIssue[]
}

export function snapshot(stand: Stand, time: number): RunSnapshot {
  const result = solveScheme(schemeOf(stand), { time })
  return { values: result.values, issues: result.issues }
}

export function rowValues(
  stand: Stand,
  columns: { key: string; source: 'auto' | 'manual'; bind?: { component: string; port: string } }[],
  values: Record<string, number | null>,
): Record<string, number | null> {
  const row: Record<string, number | null> = {}

  for (const column of columns) {
    if (column.source !== 'auto' || !column.bind) continue

    const component = stand.components.find((item) => item.id === column.bind?.component)
    const spec = component ? getComponent(component.key) : undefined
    const port = spec?.ports.find((item) => item.id === column.bind?.port)

    const base = values[`${column.bind.component}:${column.bind.port}`] ?? null
    row[column.key] =
      base === null || !port ? null : (base - (port.unit.offset ?? 0)) / port.unit.factor
  }

  return row
}

export { useRunClock }
