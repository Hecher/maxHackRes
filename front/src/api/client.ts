import type { Attempt, Classroom, Lab, LabDraft, Profile } from '@/domain/types'
import type { VlrApi } from './contract'
import { API_BASE_URL } from './runtime'
import { HttpApi } from './httpApi'

export { ApiError } from './contract'
export type { CatalogResult, ProfileRequest, VlrApi } from './contract'
export { API_BASE_URL } from './runtime'

export const api: VlrApi = new HttpApi(API_BASE_URL)

export type { Attempt, Classroom, Lab, LabDraft, Profile }
