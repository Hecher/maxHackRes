import { create } from 'zustand'
import { api, ApiError } from '@/api/client'
import type { Lab, Profile, Visibility } from '@/domain/types'

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

interface CatalogState {
  status: LoadStatus
  error: string | null
  tab: Visibility
  query: string
  privateLabs: Lab[]
  publicLabs: Lab[]

  load: (profile: Profile, options?: { force?: boolean }) => Promise<void>
  setTab: (tab: Visibility) => void
  setQuery: (query: string) => void

  getLabById: (labId: string) => Lab | undefined
  addLab: (lab: Lab) => void
}

export const useCatalog = create<CatalogState>((set, get) => ({
  status: 'idle',
  error: null,
  tab: 'private',
  query: '',
  privateLabs: [],
  publicLabs: [],

  load: async (profile, options) => {
    const isFirstLoad = get().status === 'idle'
    if (!isFirstLoad && !options?.force) return
    set({ status: 'loading', error: null })
    try {
      const result = await api.listLabs(profile)
      set({
        privateLabs: result.privateLabs,
        publicLabs: result.publicLabs,
        status: 'ready',
      })
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof ApiError ? error.message : 'Не удалось загрузить каталог',
      })
    }
  },

  setTab: (tab) => set({ tab }),
  setQuery: (query) => set({ query }),

  getLabById: (labId) => {
    const { privateLabs, publicLabs } = get()
    return [...privateLabs, ...publicLabs].find((lab) => lab.id === labId)
  },

  addLab: (lab) => {
    if (lab.visibility === 'private') {
      set({ privateLabs: [lab, ...get().privateLabs], tab: 'private' })
    } else {
      set({ publicLabs: [lab, ...get().publicLabs], tab: 'public' })
    }
  },
}))

export function selectVisibleLabs(state: CatalogState): Lab[] {
  const source = state.tab === 'private' ? state.privateLabs : state.publicLabs
  const query = state.query.trim().toLowerCase()
  if (!query) return source
  return source.filter(
    (lab) =>
      lab.title.toLowerCase().includes(query) ||
      lab.summary.toLowerCase().includes(query) ||
      lab.authorName.toLowerCase().includes(query),
  )
}
