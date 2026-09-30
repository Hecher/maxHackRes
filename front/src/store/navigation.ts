import { create } from 'zustand'
import type { LabMode } from '@/domain/types'

export type Screen =
  | { name: 'catalog' }
  | { name: 'lab'; labId: string; mode: LabMode }
  | { name: 'builder' }
  | { name: 'attempts' }
  | { name: 'profile' }

interface NavigationState {
  stack: Screen[]
  go: (screen: Screen) => void
  back: () => void
  reset: (screen: Screen) => void

  popFromHistory: () => void
}

let pushedDepth = 0

export const useNavigation = create<NavigationState>((set, get) => ({
  stack: [{ name: 'catalog' }],

  go: (screen) => {
    set({ stack: [...get().stack, screen] })
    pushedDepth += 1
    window.history.pushState({ vlrDepth: pushedDepth }, '')
  },

  back: () => {
    if (get().stack.length <= 1) return
    if (pushedDepth > 0) {

      window.history.back()
      return
    }
    set({ stack: get().stack.slice(0, -1) })
  },

  reset: (screen) => {
    set({ stack: [screen] })
  },

  popFromHistory: () => {
    pushedDepth = Math.max(0, pushedDepth - 1)
    const stack = get().stack
    if (stack.length <= 1) return
    set({ stack: stack.slice(0, -1) })
  },
}))

const FALLBACK: Screen = { name: 'catalog' }

export function useCurrentScreen(): Screen {
  return useNavigation((state) => state.stack[state.stack.length - 1] ?? FALLBACK)
}

export function useCanGoBack(): boolean {
  return useNavigation((state) => state.stack.length > 1)
}
