import { ApiError, type CatalogResult, type ProfileRequest, type VlrApi } from './contract'
import {
  fromDraft,
  toAttempt,
  toLab,
  toProfile,
  type AttemptDto,
  type LabDto,
  type TokenDto,
  type UserDto,
} from './mappers'
import type { Attempt, Classroom, Lab, LabDraft, Profile, Role } from '@/domain/types'

const SESSION_KEY = 'vlr.session.v1'

const DEV_IDS: Record<Role, number> = {
  student: 900001,
  teacher: 900002,
}

interface StoredSession {
  token: string
  user: UserDto
}

function loadSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredSession
    return parsed?.token && parsed?.user ? parsed : null
  } catch {
    return null
  }
}

function saveSession(session: StoredSession | null): void {
  try {
    if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else window.localStorage.removeItem(SESSION_KEY)
  } catch {

  }
}

export class HttpApi implements VlrApi {
  private session: StoredSession | null = loadSession()

  constructor(private readonly baseUrl: string) {}

  private async request<T>(path: string, init?: RequestInit, withAuth = true): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((init?.headers as Record<string, string>) ?? {}),
    }

    if (withAuth && this.session) {
      headers.Authorization = `Bearer ${this.session.token}`
    }

    let response: Response
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers,
        signal: AbortSignal.timeout(20000),
      })
    } catch {
      throw new ApiError(
        'Нет связи с сервером',
        0,
        'Проверьте, что бэкенд запущен и доступен по адресу из настроек',
      )
    }

    if (response.status === 401) {

      this.session = null
      saveSession(null)
      throw new ApiError('Сессия истекла', 401, 'Откройте приложение заново')
    }

    if (!response.ok) {
      let detail = 'Сервер вернул ошибку'
      try {
        const body = (await response.json()) as { detail?: unknown }
        if (typeof body.detail === 'string') detail = body.detail
      } catch {

      }
      throw new ApiError(detail, response.status, 'Повторите попытку')
    }

    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  }

  private async login(request: ProfileRequest): Promise<void> {

    if (request.initDataRaw) {
      const token = await this.request<TokenDto>(
        '/auth/',
        {
          method: 'POST',

          body: JSON.stringify({ initData: request.initDataRaw, role: request.devRole ?? 'student' }),
        },
        false,
      )
      this.session = { token: token.access_token, user: token.user }
      saveSession(this.session)
      return
    }

    const role: Role = request.devRole ?? 'student'
    const token = await this.request<TokenDto>(
      '/auth/dev-login',
      {
        method: 'POST',
        body: JSON.stringify({ max_user_id: DEV_IDS[role], role }),
      },
      false,
    )
    this.session = { token: token.access_token, user: token.user }
    saveSession(this.session)
  }

  private async loginWithFallback(request: ProfileRequest): Promise<void> {
    try {
      await this.login(request)
    } catch (caught) {
      this.session = null
      saveSession(null)

      if (!request.initDataRaw) {
        throw new ApiError(
          'Приложение открыто вне MAX',
          caught instanceof ApiError ? caught.status : 0,
          'Откройте лабораторию кнопкой в чате с ботом — тогда MAX передаст данные для входа.',
        )
      }

      throw caught
    }
  }

  async getProfile(request: ProfileRequest): Promise<Profile> {
    const wantsOtherRole = request.devRole && this.session && this.session.user.role !== request.devRole

    if (!this.session || wantsOtherRole) {
      await this.loginWithFallback(request)
    }

    return toProfile(this.session!.user)
  }

  getCachedProfile(): Profile | null {
    return this.session ? toProfile(this.session.user) : null
  }

  async listLabs(profile: Profile): Promise<CatalogResult> {
    const labs = await this.request<LabDto[]>('/labs/')
    const mapped = labs.map((dto) => toLab(dto, profile.id))
    const byDate = (a: Lab, b: Lab) => Date.parse(b.createdAt) - Date.parse(a.createdAt)

    return {
      publicLabs: mapped.filter((lab) => lab.visibility === 'public').sort(byDate),

      privateLabs: mapped.filter((lab) => lab.visibility === 'private').sort(byDate),
    }
  }

  async getLab(labId: string): Promise<Lab> {
    const dto = await this.request<LabDto>(`/labs/${encodeURIComponent(labId)}`)
    return toLab(dto, this.session ? this.session.user.max_user_id : 0)
  }

  async listClassrooms(): Promise<Classroom[]> {
    if (this.session?.user.role !== 'teacher') return []

    const rooms = await this.request<{ id: number; school: string; grade: number; label: string; students_count: number }[]>(
      '/classrooms/',
    )

    return rooms.map((room) => ({

      id: String(room.id),
      label: room.label,
      grade: room.grade,
      studentsCount: room.students_count,
    }))
  }

  async advanceYear(): Promise<Classroom[]> {
    await this.request('/classrooms/advance-year', { method: 'POST' })
    return this.listClassrooms()
  }

  async updateProfile(patch: {
    full_name?: string
    city?: string
    school?: string
    class_number?: number
  }): Promise<Profile> {
    const user = await this.request<UserDto>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })

    if (this.session) {
      this.session = { ...this.session, user }
      saveSession(this.session)
    }

    return toProfile(user)
  }

  async createLab(draft: LabDraft, profile: Profile): Promise<Lab> {
    const payload = fromDraft(draft)
    const dto = await this.request<LabDto>('/labs/', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    return toLab(dto, profile.id)
  }

  async listAttempts(): Promise<Attempt[]> {
    const items = await this.request<AttemptDto[]>('/attempts/')
    return items.map(toAttempt)
  }

  async submitAttempt(attempt: Attempt): Promise<Attempt> {
    const labId = Number(attempt.labId)
    if (!Number.isFinite(labId)) {
      throw new ApiError('Работа не найдена на сервере', 400, 'Откройте работу заново')
    }

    const created = await this.request<AttemptDto>('/attempts/', {
      method: 'POST',
      body: JSON.stringify({ lab_id: labId, mode: attempt.mode }),
    })

    const measurements = attempt.rows.map((row) => ({
      step: row.number,
      inputs: {},
      outputs: Object.fromEntries(
        Object.entries(row.values).filter(([, value]) => typeof value === 'number'),
      ),
    }))

    const finished = await this.request<AttemptDto>(`/attempts/${created.id}/finish`, {
      method: 'POST',
      body: JSON.stringify({
        result_data: {
          measurements,

          answers: {
            rows: attempt.rows,
            columns: attempt.columns,
            conclusion: attempt.conclusion ?? '',
          },
          client_metrics: { mode: attempt.mode, source: 'vlr-miniapp' },
        },
      }),
    })

    return {
      ...toAttempt({ ...finished, lab_title: attempt.labTitle, student_name: attempt.studentName }),
      columns: attempt.columns,
      status: 'submitted',
    }
  }

  async reviewAttempt(
    attemptId: string,
    review: { grade: number | null; comment: string | null },
  ): Promise<void> {
    await this.request(`/attempts/${encodeURIComponent(attemptId)}/review`, {
      method: 'POST',
      body: JSON.stringify(review),
    })
  }

  
  attemptExportUrl(attemptId: string): string | null {
    if (!this.session) return null
    return `${this.baseUrl}/attempts/${encodeURIComponent(attemptId)}/export.xls?token=${encodeURIComponent(this.session.token)}`
  }

  guideUrl(labId: string): string | null {
    if (!this.session) return null
    return `${this.baseUrl}/labs/${encodeURIComponent(labId)}/guide?token=${encodeURIComponent(this.session.token)}`
  }

  async downloadAttemptExport(attemptId: string): Promise<Blob> {
    const headers: Record<string, string> = {}
    if (this.session) headers.Authorization = `Bearer ${this.session.token}`

    const response = await fetch(`${this.baseUrl}/attempts/${encodeURIComponent(attemptId)}/export.xls`, {
      headers,
      signal: AbortSignal.timeout(20000),
    })

    if (!response.ok) {
      throw new ApiError('Не удалось получить файл', response.status, 'Повторите попытку')
    }

    return await response.blob()
  }
}
