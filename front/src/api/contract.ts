import type { Attempt, Classroom, Lab, LabDraft, Profile, Role } from '@/domain/types'
import type { StartParams } from '@/platform/maxBridge'

export interface ProfileRequest {

  userId?: number

  startParams: StartParams

  devRole?: Role
  initDataRaw?: string
}

export interface CatalogResult {
  privateLabs: Lab[]
  publicLabs: Lab[]
}

export interface VlrApi {
  getProfile(request: ProfileRequest): Promise<Profile>
  listLabs(profile: Profile): Promise<CatalogResult>
  getLab(labId: string): Promise<Lab>
  listClassrooms(): Promise<Classroom[]>
  
  advanceYear?(): Promise<Classroom[]>
  createLab(draft: LabDraft, profile: Profile): Promise<Lab>
  listAttempts(profile: Profile): Promise<Attempt[]>
  submitAttempt(attempt: Attempt): Promise<Attempt>

  reviewAttempt?(attemptId: string, review: { grade: number | null; comment: string | null }): Promise<void>

  downloadAttemptExport?(attemptId: string): Promise<Blob>

  
  attemptExportUrl?(attemptId: string): string | null
  
  guideUrl?(labId: string): string | null

  updateProfile?(patch: {
    full_name?: string
    city?: string
    school?: string
    class_number?: number
  }): Promise<Profile>
}

export class ApiError extends Error {
  readonly status: number
  readonly hint: string

  constructor(message: string, status = 0, hint = 'Попробуйте ещё раз') {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.hint = hint
  }
}
