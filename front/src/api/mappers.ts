import type {
  Attempt,
  AttemptVerdict,
  Lab,
  LabDraft,
  Profile,
  ReadingRow,
  Visibility,
} from '@/domain/types'
import { MODEL_VERSION, emptyStand, type JournalColumn, type LabModel } from '@/domain/scheme'

function toModel(model: ModelDto, columns?: JournalColumn[] | null): LabModel {
  if (model.version === MODEL_VERSION && model.stand) {
    return {
      version: MODEL_VERSION,
      stand: model.stand,
      journal: model.journal ?? columns ?? [],
    }
  }

  return { version: MODEL_VERSION, stand: emptyStand(), journal: columns ?? [] }
}

export interface LabDto {
  id: number
  author_id: number
  author_name?: string | null
  title: string
  subject?: string | null
  summary?: string | null
  goal?: string | null
  guide?: string | null
  guide_file?: string | null
  guide_file_name?: string | null
  visibility: 'public' | 'private'
  math_model: Record<string, unknown>
  scene?: Record<string, unknown> | null
  journal_columns?: JournalColumn[] | null
  assigned_class_ids?: string[] | null
  noise_percent?: number | null
  max_rows?: number | null
  is_published: boolean
  created_at: string
}

export interface UserDto {
  id: number
  max_user_id: number
  full_name: string
  username?: string | null
  role: 'student' | 'teacher'
  city?: string | null
  school?: string | null
  class_number?: number | null
  subject?: string | null
  created_at: string
}

export interface TokenDto {
  access_token: string
  token_type: string
  is_new_user: boolean
  user: UserDto
}

export interface AttemptDto {
  id: number
  student_id: number
  lab_id: number
  mode: 'test' | 'work'
  status: 'in_progress' | 'finished'
  result_data?: Record<string, unknown> | null
  grade?: number | null
  comment?: string | null
  started_at: string
  finished_at?: string | null
  lab_title?: string
  student_name?: string
  class_number?: number | null
}

interface ModelDto {
  version?: number
  stand?: LabModel['stand']
  journal?: LabModel['journal']
}
export function toLab(dto: LabDto, meId: number): Lab {
  const model = (dto.math_model ?? {}) as ModelDto

  return {
    id: String(dto.id),
    title: dto.title,
    subject: dto.subject ?? 'Физика',
    summary: dto.summary ?? '',
    goal: dto.goal ?? '',
    authorId: dto.author_id,
    authorName: dto.author_name ?? 'Автор',
    visibility: dto.visibility as Visibility,
    isOwn: dto.author_id === meId,
    assignedClassIds: dto.assigned_class_ids ?? [],
    model: toModel(model, dto.journal_columns),
    maxRows: dto.max_rows ?? 15,
    noisePercent: dto.noise_percent ?? 3,
    guide: dto.guide ?? '',
    guideFile: dto.guide_file ?? undefined,
    guideFileName: dto.guide_file_name ?? undefined,
    createdAt: dto.created_at,
    runsCount: 0,
  }
}

export function toProfile(user: UserDto): Profile {
  return {
    id: user.max_user_id,
    role: user.role,
    fullName: user.full_name,
    username: user.username ?? undefined,
    city: user.city ?? '',
    school: user.school ?? '',
    classNumber: user.class_number ?? undefined,
    subjects: user.subject ? [user.subject] : undefined,
  }
}

export function toAttempt(dto: AttemptDto): Attempt {
  const result = (dto.result_data ?? {}) as {
    answers?: { rows?: ReadingRow[]; columns?: JournalColumn[]; conclusion?: string }
  }

  const verdict: AttemptVerdict =
    dto.grade !== null && dto.grade !== undefined ? 'accepted' : 'pending'

  return {
    id: String(dto.id),
    labId: String(dto.lab_id),
    labTitle: dto.lab_title ?? `Работа #${dto.lab_id}`,
    studentId: dto.student_id,
    studentName: dto.student_name ?? `Ученик #${dto.student_id}`,
    classId: dto.class_number ? `${dto.class_number}a` : undefined,
    mode: dto.mode,
    status: dto.status === 'finished' ? 'submitted' : 'in_progress',
    rows: result.answers?.rows ?? [],
    columns: result.answers?.columns ?? [],
    grade: dto.grade ?? null,
    verdict,
    comment: dto.comment ?? null,
    conclusion: result.answers?.conclusion ?? null,
    startedAt: dto.started_at,
    submittedAt: dto.finished_at ?? null,
  }
}

export interface LabPayload {
  title: string
  subject: string
  summary: string
  goal: string
  guide: string
  guide_file: string | null
  guide_file_name: string | null
  visibility: Visibility
  math_model: Record<string, unknown>
  journal_columns: JournalColumn[]
  assigned_class_ids: string[]
  noise_percent: number
  max_rows: number
  is_published: boolean
}

export function fromDraft(draft: LabDraft): LabPayload {
  return {
    title: draft.title.trim(),
    subject: draft.subject,
    summary: draft.summary,
    goal: draft.goal,
    guide: draft.guide,
    guide_file: draft.guideFile ?? null,
    guide_file_name: draft.guideFileName ?? null,
    visibility: draft.visibility,
    is_published: draft.visibility === 'public',
    noise_percent: draft.noisePercent,
    max_rows: draft.maxRows,
    math_model: {
      version: draft.model.version,
      stand: draft.model.stand,
      journal: draft.model.journal,
    },
    journal_columns: draft.model.journal,
    assigned_class_ids: draft.visibility === 'private' ? draft.assignedClassIds : [],
  }
}
