import { emptyModel, type LabModel } from './scheme'
import type { LabDraft } from './types'

export function createDraft(subject = 'Физика'): LabDraft {
  return {
    title: '',
    subject,
    summary: '',
    goal: '',
    visibility: 'private',
    assignedClassIds: [],
    model: emptyModel(),
    maxRows: 15,
    noisePercent: 3,
    guide: '',
  }
}

export function emptyDraft(): LabDraft {
  return createDraft()
}

export type { LabModel }
