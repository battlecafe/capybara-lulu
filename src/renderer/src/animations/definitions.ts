import type { PetState, AnimDef } from '@shared/types'

/** 所有状态的动画定义 */
export const ANIM_DEFS: Record<PetState, AnimDef> = {
  idle:    { frames: 4, fps: 6, loop: true },
  walk:    { frames: 6, fps: 10, loop: true },
  run:     { frames: 6, fps: 14, loop: true },
  sleep:   { frames: 4, fps: 4, loop: true },
  drag:    { frames: 2, fps: 4, loop: true },
  eating:  { frames: 4, fps: 6, loop: true },
  yawn:    { frames: 3, fps: 4, loop: false, lockUntilDone: true },
  hula:    { frames: 8, fps: 10, loop: true },
  bath:    { frames: 4, fps: 3, loop: true },
}

/** 状态优先级（数字越大越优先） */
export const STATE_PRIORITY: Record<PetState, number> = {
  drag: 100,
  hula: 85,
  bath: 85,
  walk: 50,
  run: 50,
  eating: 40,
  yawn: 30,
  sleep: 20,
  idle: 10,
}

/** 非循环动画播完后自动回到的状态 */
export const DEFAULT_RETURN_STATE: Partial<Record<PetState, PetState>> = {
  yawn: 'idle',
}
