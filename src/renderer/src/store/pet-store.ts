import { create } from 'zustand'
import type { PetState, Facing } from '@shared/types'

export interface Effect {
  id: number
  type: 'heart' | 'zzz'
  x: number
  y: number
  born: number
  life: number
}

interface PetStore {
  // 状态
  state: PetState
  facing: Facing
  frame: number

  // 位置
  windowX: number
  windowY: number

  // 效果
  effects: Effect[]

  // Actions
  addEffect: (effect: Omit<Effect, 'id' | 'born'>) => void
  updateEffects: () => void
}

let effectIdCounter = 0

export const usePetStore = create<PetStore>((set) => ({
  state: 'idle',
  facing: 'right',
  frame: 0,

  windowX: 0,
  windowY: 0,

  effects: [],

  addEffect: (effect) =>
    set((state) => ({
      effects: [
        ...state.effects,
        { ...effect, id: ++effectIdCounter, born: Date.now() },
      ],
    })),
  updateEffects: () =>
    set((state) => {
      if (state.effects.length === 0) return {}
      const now = Date.now()
      const filtered = state.effects.filter((e) => now - e.born < e.life)
      if (filtered.length === state.effects.length) return {}
      return { effects: filtered }
    }),
}))

/** 全局便捷访问 */
export const petStore = {
  get: usePetStore.getState,
  set: usePetStore.setState,
}
