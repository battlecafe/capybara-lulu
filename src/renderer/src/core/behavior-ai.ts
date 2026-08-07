import type { PetState } from '@shared/types'

/** 空闲时随机行为类型（walk+run 已合并为 run"跑动"） */
export type IdleAction = 'run' | 'hula' | 'eating' | 'tangerine' | 'sleep' | 'bath' | 'heart' | null

/** 睡眠持续时间（30秒后醒来，从60秒减少） */
const SLEEP_DURATION = 30000

/** 空闲触发时间（5秒无操作） */
const IDLE_TIMEOUT = 5000

/** 各行为持续时间（毫秒） */
const ACTION_DURATIONS: Record<string, number> = {
  run: 4000,
  hula: 5000,
  eating: 3000,
  tangerine: 2000,
  bath: 10000,
  heart: 2500,
}

/** 加权概率表（总和 100） */
const ACTION_WEIGHTS: { action: NonNullable<IdleAction>, weight: number }[] = [
  { action: 'sleep',     weight: 25 },  // 最懒，概率最大
  { action: 'run',       weight: 10 },  // 跑动（合并了走路+奔跑）
  { action: 'hula',      weight: 13 },
  { action: 'eating',    weight: 13 },
  { action: 'tangerine', weight: 13 },
  { action: 'bath',      weight: 13 },
  { action: 'heart',     weight: 13 },
]

/**
 * 行为AI — 5秒空闲后随机触发自动行为
 * 随机行为（加权概率）：跑动(10%)、扭呼啦圈(13%)、吃橘子(13%)、顶橘子(13%)、
 * 泡澡冥想(13%)、打哈欠睡觉30秒(25%)、粉色大爱心(13%)
 */
export class BehaviorAI {
  private lastInteractionTime = Date.now()
  private currentAction: IdleAction = null
  private actionStartTime = 0
  private actionDuration = 0
  private pendingSleep = false
  private sleepStartTime = 0
  private walkDirection: 1 | -1 = 1

  /** 记录用户交互（重置空闲计时器，取消当前行为） */
  onInteraction(): void {
    this.lastInteractionTime = Date.now()
    this.currentAction = null
    this.pendingSleep = false
  }

  /** 记录进入睡眠状态 */
  onSleepStart(): void {
    this.sleepStartTime = Date.now()
  }

  /** 获取口水生长进度（0 = 无，1 = 完全落地） */
  getDroolProgress(): number {
    if (this.sleepStartTime === 0) return 0
    const elapsed = Date.now() - this.sleepStartTime
    return Math.min(elapsed / SLEEP_DURATION, 1)
  }

  /** 获取当前行走方向 */
  getWalkDirection(): 1 | -1 {
    return this.walkDirection
  }

  /** 设置行走方向（用于屏幕边缘反弹） */
  setWalkDirection(dir: 1 | -1): void {
    this.walkDirection = dir
  }

  /** 获取当前行为 */
  getCurrentAction(): IdleAction {
    return this.currentAction
  }

  /**
   * 检查空闲行为是否应触发
   * 返回需要执行的行为类型，或 null
   */
  checkIdleAction(currentState: PetState): IdleAction {
    // 拖拽中不触发
    if (currentState === 'drag') return null

    // 睡眠中 → 检查是否该醒来
    if (currentState === 'sleep') {
      if (this.sleepStartTime > 0 && Date.now() - this.sleepStartTime >= SLEEP_DURATION) {
        this.sleepStartTime = 0
        this.currentAction = null
        this.lastInteractionTime = Date.now()
      }
      return null
    }

    // 如果当前有行为在执行中，检查是否完成
    if (this.currentAction) {
      const elapsed = Date.now() - this.actionStartTime
      if (elapsed >= this.actionDuration) {
        // 行为完成 → 重置
        this.currentAction = null
        this.lastInteractionTime = Date.now()
      }
      return null
    }

    // yawn/sleep 过渡中不触发新行为
    if (currentState === 'yawn' || currentState === 'hula' || currentState === 'eating' || currentState === 'bath') {
      return null
    }

    // 检查空闲是否超时
    const idleTime = Date.now() - this.lastInteractionTime
    if (idleTime < IDLE_TIMEOUT) return null

    // 加权随机选择行为
    const totalWeight = ACTION_WEIGHTS.reduce((sum, a) => sum + a.weight, 0)
    let rand = Math.random() * totalWeight
    let action: NonNullable<IdleAction> = 'sleep'
    for (const wa of ACTION_WEIGHTS) {
      rand -= wa.weight
      if (rand <= 0) {
        action = wa.action
        break
      }
    }

    this.currentAction = action
    this.actionStartTime = Date.now()
    this.actionDuration = action === 'sleep'
      ? SLEEP_DURATION
      : (ACTION_DURATIONS[action] || 3000)

    // 随机行走方向
    this.walkDirection = Math.random() < 0.5 ? -1 : 1

    return action
  }

  /**
   * 检查 yawn 后是否应进入 sleep
   * （用于 yawn → sleep 的过渡）
   * 注意：不在此处消费 pendingSleep 标志，由调用方在转换成功后调用 consumePendingSleep()
   */
  checkTrigger(currentState: PetState): PetState | null {
    if (this.pendingSleep) {
      return 'sleep'
    }
    return null
  }

  /** 消费 pendingSleep 标志（仅在 yawn→sleep 转换真正发生时调用） */
  consumePendingSleep(): void {
    this.pendingSleep = false
  }

  /** 通知开始睡觉序列（yawn → sleep） */
  triggerSleepSequence(): void {
    this.pendingSleep = true
  }
}

/** 全局行为AI实例 */
export const behaviorAI = new BehaviorAI()
