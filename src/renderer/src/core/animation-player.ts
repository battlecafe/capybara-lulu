import type { PetState } from '@shared/types'
import { ANIM_DEFS } from '../animations/definitions'

/**
 * 动画播放器 - 按帧率推进序列帧
 */
export class AnimationPlayer {
  private _frame = 0
  private _frameTime = 0
  private _finished = false

  get frame(): number {
    return this._frame
  }

  get isFinished(): boolean {
    return this._finished
  }

  /** 重置到第一帧 */
  reset(): void {
    this._frame = 0
    this._frameTime = 0
    this._finished = false
  }

  /**
   * 更新动画帧
   * @param state 当前状态
   * @param dt 帧间隔（秒）
   * @returns 是否刚播完（非循环动画的最后一帧）
   */
  update(state: PetState, dt: number): boolean {
    const def = ANIM_DEFS[state]

    if (this._finished) return true

    // 累加帧时间
    this._frameTime += dt * def.fps

    if (this._frameTime >= 1) {
      const advance = Math.floor(this._frameTime)
      this._frameTime -= advance
      this._frame += advance

      if (this._frame >= def.frames) {
        if (def.loop) {
          this._frame %= def.frames
        } else {
          this._frame = def.frames - 1
          this._finished = true
          return true
        }
      }
    }

    return false
  }
}

/** 全局动画播放器实例 */
export const animationPlayer = new AnimationPlayer()
