import type { PetState } from '@shared/types'
import { ANIM_DEFS, STATE_PRIORITY, DEFAULT_RETURN_STATE } from '../animations/definitions'

/**
 * 状态机 - 优先级仲裁 + 动画锁定
 */
export class StateMachine {
  private _current: PetState = 'idle'
  private _locked = false
  private _onTransition: ((from: PetState, to: PetState) => void) | null = null

  get current(): PetState {
    return this._current
  }

  get isLocked(): boolean {
    return this._locked
  }

  onTransition(callback: (from: PetState, to: PetState) => void) {
    this._onTransition = callback
  }

  /** 请求状态切换（遵循优先级） */
  request(next: PetState): boolean {
    if (this._locked) return false
    if (next === this._current) return false
    if (STATE_PRIORITY[next] >= STATE_PRIORITY[this._current]) {
      this.transition(next)
      return true
    }
    return false
  }

  /** 强制切换状态（忽略优先级和锁定，用于拖拽等） */
  forceSet(state: PetState): void {
    this.transition(state)
  }

  /** 解除锁定（非循环动画播完后调用） */
  unlock(): void {
    this._locked = false
    // 播完后回到默认状态
    const returnTo = DEFAULT_RETURN_STATE[this._current]
    if (returnTo) {
      this.transition(returnTo)
    }
  }

  private transition(to: PetState): void {
    const from = this._current
    this._current = to
    const def = ANIM_DEFS[to]
    this._locked = def.lockUntilDone ?? false
    this._onTransition?.(from, to)
  }
}

/** 全局状态机实例 */
export const stateMachine = new StateMachine()
