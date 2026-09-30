import { create } from 'zustand'
import { api, ApiError, type CatalogResult, type ProfileRequest } from '@/api/client'
import type { Classroom, Profile, Role } from '@/domain/types'

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

interface SessionState {
  status: LoadStatus
  profile: Profile | null
  classrooms: Classroom[]
  error: string | null

  devRole: Role | null

  init: (request: ProfileRequest) => Promise<void>
  switchRole: (role: Role) => Promise<void>
  setClassrooms: (classrooms: Classroom[]) => void
  advanceYear: () => Promise<void>

  updateProfile: (patch: {
    full_name?: string
    city?: string
    school?: string
    class_number?: number
  }) => Promise<void>
}

export const useSession = create<SessionState>((set, get) => ({
  status: 'idle',
  profile: null,
  classrooms: [],
  error: null,
  devRole: null,

  init: async (request) => {
    set({ status: 'loading', error: null })
    try {
      const profile = await api.getProfile(request)
      set({ profile, status: 'ready' })

      if (profile.role === 'teacher' && get().classrooms.length === 0) {
        try {
          const classrooms = await api.listClassrooms()
          set({ classrooms })
        } catch {

        }
      }
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof ApiError ? error.message : 'Не удалось загрузить профиль',
      })
    }
  },

  switchRole: async (role) => {
    const { profile } = get()
    set({ devRole: role, status: 'loading', error: null })
    try {
      const next = await api.getProfile({ startParams: {}, devRole: role })
      set({ profile: { ...next, id: profile?.id ?? next.id }, status: 'ready' })
      if (role === 'teacher' && get().classrooms.length === 0) {
        const classrooms = await api.listClassrooms()
        set({ classrooms })
      }
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof ApiError ? error.message : 'Не удалось переключить роль',
      })
    }
  },

  setClassrooms: (classrooms) => set({ classrooms }),

  advanceYear: async () => {
    if (!api.advanceYear) return
    set({ error: null })
    try {
      const classrooms = await api.advanceYear()
      set({ classrooms })
    } catch (error) {
      set({ error: error instanceof ApiError ? error.message : 'Не удалось перевести классы' })
    }
  },

  updateProfile: async (patch) => {
    if (!api.updateProfile) return
    set({ error: null })
    try {
      const profile = await api.updateProfile(patch)
      set({ profile })
    } catch (error) {
      set({
        error: error instanceof ApiError ? error.message : 'Не удалось сохранить профиль',
      })
    }
  },
}))

export type { CatalogResult }
