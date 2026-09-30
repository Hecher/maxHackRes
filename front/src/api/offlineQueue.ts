import type { Attempt } from '@/domain/types'

const QUEUE_KEY = 'vlr.pendingAttempts.v1'

export interface PendingAttempt {

  key: string
  attempt: Attempt
  savedAt: string
}

function read(): PendingAttempt[] {
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as PendingAttempt[]) : []
  } catch {
    return []
  }
}

function write(items: PendingAttempt[]): void {
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(items))
  } catch {

  }
}

export function queueAttempt(attempt: Attempt): PendingAttempt {
  const entry: PendingAttempt = {
    key: `${attempt.labId}-${Date.now().toString(36)}`,
    attempt,
    savedAt: new Date().toISOString(),
  }

  write([entry, ...read()])
  return entry
}

export function listPending(): PendingAttempt[] {
  return read()
}

export function pendingCount(): number {
  return read().length
}

export function removePending(key: string): void {
  write(read().filter((item) => item.key !== key))
}

export async function flushPending(
  submit: (attempt: Attempt) => Promise<unknown>,
): Promise<number> {
  const items = read()
  if (items.length === 0) return 0

  let sent = 0
  for (const item of items) {
    try {
      await submit(item.attempt)
      removePending(item.key)
      sent += 1
    } catch {

      break
    }
  }

  return sent
}
