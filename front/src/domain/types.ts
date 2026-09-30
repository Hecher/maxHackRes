import type { JournalColumn, LabModel } from './scheme'

export type Role = 'student' | 'teacher'

export type Visibility = 'public' | 'private'

export type LabMode = 'test' | 'work'

export interface Profile {
  id: number
  role: Role
  fullName: string
  username?: string
  photoUrl?: string
  city: string
  school: string

  classNumber?: number

  subjects?: string[]
}

export interface Classroom {

  id: string

  label: string
  grade: number

  studentsCount: number
}

export interface ReadingRow {
  id: string

  number: number

  values: Record<string, number | null>
}

export interface Lab {
  id: string
  title: string
  subject: string
  summary: string

  goal: string
  authorId: number
  authorName: string
  visibility: Visibility

  isOwn: boolean

  assignedClassIds: string[]
  
  model: LabModel

  maxRows: number

  noisePercent: number

  guide?: string
  
  guideFile?: string
  guideFileName?: string
  createdAt: string
  runsCount: number
}

export interface LabDraft {
  title: string
  subject: string
  summary: string
  goal: string
  visibility: Visibility
  assignedClassIds: string[]
  model: LabModel

  maxRows: number
  noisePercent: number
  guide: string
  guideFile?: string
  guideFileName?: string
}

export type AttemptStatus = 'in_progress' | 'submitted'

export type AttemptVerdict = 'pending' | 'accepted' | 'needs_work'

export interface Attempt {
  id: string
  labId: string
  labTitle: string
  studentId: number
  studentName: string
  classId?: string
  mode: LabMode
  status: AttemptStatus
  rows: ReadingRow[]

  columns: JournalColumn[]
  grade: number | null
  verdict: AttemptVerdict
  
  conclusion?: string | null
  comment: string | null
  startedAt: string
  submittedAt: string | null
}

export interface CatalogSection {
  visibility: Visibility
  labs: Lab[]
}
