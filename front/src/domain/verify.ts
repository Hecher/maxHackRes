import type { JournalColumn, LabModel } from './scheme'
import type { ReadingRow } from './types'

export interface RowCheck {
  rowNumber: number
  expected: number | null
  given: number | null
  deviationPercent: number | null
  ok: boolean | null
}

const TOLERANCE_PERCENT = 8
const GRAVITY = 9.8

function round(value: number, precision: number): number {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

function findColumn(columns: JournalColumn[], unit: string, source?: 'auto' | 'manual') {
  return columns.find(
    (column) =>
      (column.unit ?? '').toLowerCase() === unit.toLowerCase() &&
      (source === undefined || column.source === source),
  )
}

function valueOf(row: ReadingRow, column: JournalColumn | undefined): number | null {
  if (!column) return null
  const value = row.values[column.key]
  return typeof value === 'number' ? value : null
}

function settingOf(model: LabModel | undefined, unit: string): number | null {
  if (!model) return null

  for (const component of model.stand.components) {
    for (const [key, value] of Object.entries(component.params ?? {})) {
      const journalColumn = model.journal.find(
        (column) => column.bind?.component === component.id && column.bind.port === key,
      )
      if (journalColumn && (journalColumn.unit ?? '').toLowerCase() === unit.toLowerCase()) return value
    }
  }

  return null
}

export function checkRow(row: ReadingRow, columns: JournalColumn[], model?: LabModel): RowCheck {
  const empty: RowCheck = {
    rowNumber: row.number,
    expected: null,
    given: null,
    deviationPercent: null,
    ok: null,
  }

  const manual = columns.find((column) => column.source === 'manual')
  if (!manual) return empty

  const given = valueOf(row, manual)
  const expected = expectedValue(row, columns, manual, model)
  if (given === null || expected === null) return { ...empty, given }

  const base = Math.abs(expected) < 1e-9 ? 1 : Math.abs(expected)
  const deviation = Math.abs(given - expected) / base

  return {
    rowNumber: row.number,
    expected: round(expected, Math.max(manual.precision ?? 2, 2)),
    given,
    deviationPercent: round(deviation * 100, 0),
    ok: deviation * 100 <= TOLERANCE_PERCENT,
  }
}

function expectedValue(
  row: ReadingRow,
  columns: JournalColumn[],
  manual: JournalColumn,
  model?: LabModel,
): number | null {
  const unit = (manual.unit ?? '').toLowerCase()

  if (unit === 'ом') {
    const voltage = valueOf(row, findColumn(columns, 'В', 'auto'))
    const current = valueOf(row, findColumn(columns, 'А', 'auto'))
    if (voltage !== null && current !== null && current !== 0) return voltage / current
    return null
  }

  if (unit === 'м/с') {
    const distance = valueOf(row, findColumn(columns, 'м', 'auto'))
    const time = valueOf(row, findColumn(columns, 'с', 'auto'))
    if (distance !== null && time !== null && time !== 0) return distance / time
    return null
  }

  if (unit === 'м²' || unit === 'м2') {
    const force = valueOf(row, findColumn(columns, 'Н', 'auto'))
    const pressure = valueOf(row, findColumn(columns, 'Па', 'auto'))
    if (force !== null && pressure !== null && pressure !== 0) return force / pressure
    return null
  }

  if (unit.startsWith('дж/')) {
    const voltage = valueOf(row, findColumn(columns, 'В', 'auto'))
    const current = valueOf(row, findColumn(columns, 'А', 'auto'))
    const time = valueOf(row, findColumn(columns, 'с', 'auto'))
    const mass = settingOf(model, 'кг') ?? valueOf(row, findColumn(columns, 'кг', 'auto'))
    const start = valueOf(row, columns.find((column) => column.label === 'T0'))
    const finish = valueOf(row, columns.find((column) => column.label === 'Tк'))

    if (
      voltage === null ||
      current === null ||
      time === null ||
      mass === null ||
      mass === 0 ||
      start === null ||
      finish === null
    ) {
      return null
    }

    const delta = finish - start
    if (delta <= 0) return null

    return (voltage * current * time) / (mass * delta)
  }

  if (unit === '') {
    const force = valueOf(row, findColumn(columns, 'Н', 'auto'))
    const mass = settingOf(model, 'кг') ?? valueOf(row, findColumn(columns, 'кг', 'auto'))

    if (force === null || mass === null || mass === 0) return null

    return force / (mass * GRAVITY)
  }

  return null
}

export interface AttemptSummary {
  checked: number
  correct: number
  rows: RowCheck[]
}

export function checkAttempt(
  rows: ReadingRow[],
  columns: JournalColumn[],
  model?: LabModel,
): AttemptSummary {
  const checks = rows.map((row) => checkRow(row, columns, model))
  const applicable = checks.filter((check) => check.ok !== null)

  return {
    rows: checks,
    checked: applicable.length,
    correct: applicable.filter((check) => check.ok).length,
  }
}
