import type { Facing } from '@shared/types'
import { WINDOW } from '@shared/constants'
import { drawCapybara, setTangerineBounce, setDroolProgress, setHulaActive, advanceHulaFrame, setEatingProgress } from './capybara-renderer'
import { stateMachine } from './state-machine'
import { animationPlayer } from './animation-player'
import { physicsBody } from './physics'
import { interactionDetector } from './interaction-detector'
import { behaviorAI } from './behavior-ai'
import type { IdleAction } from './behavior-ai'
import { windowBridge } from './window-bridge'
import { petStore } from '../store/pet-store'

// ============================================================
// 日志工具
// ============================================================
const LOG_PREFIX = '%c[LULU]'
const LOG_STYLE_STATE = 'color:#4FC3F7;font-weight:bold'

function logState(msg: string, ...args: unknown[]): void {
  console.log(LOG_PREFIX, LOG_STYLE_STATE, msg, ...args)
}

/**
 * 渲染循环管理器
 * 功能：双击吸附拖拽 + 部位点击交互 + 5秒空闲随机行为
 * 窗口始终接收鼠标事件（无穿透），透明边框仅 4px 不影响周围桌面操作
 */
class RenderLoopManager {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private rafId: number | null = null
  private lastTime = 0
  private dpr = 1

  // 幂等保护：防止 init() 被重复调用导致事件监听器累积
  private isInitialized = false

  // 事件监听器引用（用于 destroy 时清理）
  private listeners: { target: EventTarget; type: string; handler: EventListenerOrEventListenerObject }[] = []

  // [DEBUG] 渲染心跳计时
  private lastDebugHeartbeat = 0

  // Canvas 像素健康检查（每 15 秒采样像素，检测是否变空白）
  private lastPixelCheck = 0
  private readonly PIXEL_CHECK_INTERVAL = 15000

  // 光标位置
  private cursorX = 0
  private cursorY = 0

  // 窗口位置
  private windowX = 0
  private windowY = 0

  // 吸附拖拽状态（双击吸附鼠标，再次点击释放）
  private isStickyDragging = false
  private stickyOffsetX = 0
  private stickyOffsetY = 0
  private pendingDragScreenX = 0
  private pendingDragScreenY = 0
  private hasPendingDrag = false

  // 双击检测
  private lastClickTime = 0
  private readonly DOUBLE_CLICK_MS = 350

  // 状态跟踪
  private lastEffectTime = 0
  private groundY = 0
  private currentFacing: Facing = 'right'

  // === 动画计时器 ===
  private tangerineBounceStart = 0
  private readonly TANGERINE_BOUNCE_DURATION = 2000
  private readonly TANGERINE_BOUNCE_COUNT = 5
  private readonly TANGERINE_BOUNCE_AMP = 12

  private hulaStartTime = 0
  private readonly HULA_DURATION = 5000

  private eatingStartTime = 0
  private readonly EATING_DURATION = 3000

  private bathStartTime = 0
  private readonly BATH_DURATION = 10000

  // 行走/奔跑状态
  private walkSpeed = 0

  // 爱心特效计时器
  private heartStartTime = 0
  private readonly HEART_DURATION = 2500
  private lastHeartSpawn = 0

  // === Store 更新优化 ===
  private lastStoreState: string = ''
  private lastStoreFrame = -1
  private lastStoreWindowX = 0
  private lastStoreWindowY = 0
  private lastStoreFacing = ''

  // === 行走/返回逻辑 ===
  /** 用户最后拖拽放下的位置（回家位置） */
  private homeX = 0
  private homeY = 0
  /** 是否正在因空闲行为行走 */
  private isWalking = false
  /** 是否正在返回回家位置 */
  private isReturning = false
  private readonly RETURN_SPEED = 2
  /** 屏幕边界（行走时用于边缘检测 + 位置钳位） */
  private screenLeft = 0
  private screenRight = 9999
  private screenTop = 0
  private screenBottom = 9999

  // === 窗口位置同步（核心防卡死机制） ===
  /** 主进程返回的实际窗口位置（异步到达） */
  private syncActualX = 0
  private syncActualY = 0
  /** 是否有待应用的位置同步 */
  private syncPending = false
  /** 上次发起同步请求的时间 */
  private lastSyncRequest = 0
  /** 同步间隔 */
  private readonly SYNC_INTERVAL = 500
  /** initPosition 是否已完成（防止同步覆盖初始化前的默认位置） */
  private isPositionInitialized = false

  // === 智能穿透状态缓存 ===
  /** 当前穿透状态（null=未初始化，true=穿透中，false=不穿透） */
  private lastIgnoreState: boolean | null = null

  // === 免打扰模式 ===
  /** 禁止全屏幕走/跑动（仅原地动画） */
  private noWalkRun = false

  /** 初始化（幂等：重复调用时先清理旧的监听器和动画帧） */
  init(canvas: HTMLCanvasElement): void {
    // 幂等保护：如果已初始化，先销毁旧的
    if (this.isInitialized) {
      this.destroy()
    }
    this.isInitialized = true

    this.canvas = canvas
    this.dpr = window.devicePixelRatio || 1
    canvas.width = WINDOW.WIDTH * this.dpr
    canvas.height = WINDOW.HEIGHT * this.dpr
    canvas.style.width = WINDOW.WIDTH + 'px'
    canvas.style.height = WINDOW.HEIGHT + 'px'

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    this.ctx = ctx
    ctx.scale(this.dpr, this.dpr)

    // Canvas 上下文丢失恢复（防止长时间运行后空白）
    canvas.addEventListener('contextlost', (e) => {
      e.preventDefault()
      this.ctx = null  // 标记上下文已丢失，让 draw() 检测到并跳过绘制
      console.warn('%c[LULU] ⚠️ Canvas 上下文丢失，等待恢复', 'color:#FF5722;font-weight:bold')
    })
    canvas.addEventListener('contextrestored', () => {
      console.log('%c[LULU] ✅ Canvas 上下文已恢复（事件）', 'color:#4CAF50;font-weight:bold')
      this.forceResetCanvas()
    })

    windowBridge.onCursorPos((pos) => {
      this.cursorX = pos.x
      this.cursorY = pos.y
      // 吸附拖拽中：即使鼠标移出窗口边界也持续跟随（主进程轮询不依赖窗口焦点）
      if (this.isStickyDragging) {
        this.pendingDragScreenX = pos.x
        this.pendingDragScreenY = pos.y
        this.hasPendingDrag = true
      }
    })

    this.initPosition()
    this.bindMouseEvents()
    this.bindMenuActions()
    this.lastTime = performance.now()
    this.tick(this.lastTime)
  }

  /** 初始化位置 */
  private async initPosition(): Promise<void> {
    try {
      const bounds = await windowBridge.getScreenBounds()
      if (!bounds) return
      this.groundY = bounds.workAreaBottom - WINDOW.HEIGHT * 0.22
      // 先设置屏幕边界，再钳位窗口位置
      this.screenLeft = bounds.x
      this.screenRight = bounds.x + bounds.width
      this.screenTop = bounds.y
      this.screenBottom = bounds.workAreaBottom
      this.windowX = Math.round(bounds.x + bounds.width / 2 - WINDOW.WIDTH / 2)
      this.windowY = Math.round(bounds.workAreaBottom - WINDOW.HEIGHT)
      this.clampWindowPos()
      this.homeX = this.windowX
      this.homeY = this.windowY
      windowBridge.setWindowPosition(this.windowX, this.windowY)

      physicsBody.groundY = this.groundY
      physicsBody.x = this.windowX + WINDOW.WIDTH / 2
      physicsBody.y = this.windowY + WINDOW.HEIGHT * 0.78
      this.isPositionInitialized = true
      // 初始状态：窗口穿透（等鼠标移到宠物身上时才不穿透）
      this.lastIgnoreState = true
      windowBridge.setIgnoreMouse(true)
    } catch (e) {
      console.error('Failed to init position:', e)
    }
  }

  /** 异步刷新屏幕边界 */
  private refreshScreenBounds(): void {
    windowBridge.getScreenBounds()?.then((bounds) => {
      if (bounds) {
        this.screenLeft = bounds.x
        this.screenRight = bounds.x + bounds.width
        this.screenTop = bounds.y
        this.screenBottom = bounds.workAreaBottom
      }
    }).catch(() => {})
  }

  /**
   * 钳位窗口位置到屏幕边界内
   * 必须与主进程 setWindowPosition 的钳位逻辑一致，
   * 否则 this.windowX/Y 会与实际窗口位置不同步，导致碰撞检测失效
   */
  private clampWindowPos(): void {
    this.windowX = Math.max(this.screenLeft, Math.min(this.windowX, this.screenRight - WINDOW.WIDTH))
    this.windowY = Math.max(this.screenTop, Math.min(this.windowY, this.screenBottom - WINDOW.HEIGHT))
  }

  /**
   * 窗口位置同步 — 核心防卡死机制
   *
   * 渲染进程的 windowX/Y 可能与主进程实际窗口位置不同步：
   *  - 主进程 setWindowPosition 会按 display.workArea 钳位
   *  - 渲染进程 clampWindowPos 可能使用不同显示器的边界
   *  - 多显示器、DPI 缩放、OS 重新定位窗口等
   *
   * 本方法每 SYNC_INTERVAL(500ms) 查询一次主进程实际窗口位置，
   * 在每帧 update() 开头应用纠正，确保交互检测使用正确坐标。
   */
  private syncWindowPosition(): void {
    // 1. 定期发起异步查询
    const now = Date.now()
    if (now - this.lastSyncRequest > this.SYNC_INTERVAL) {
      this.lastSyncRequest = now
      windowBridge.getWindowPos()?.then((pos) => {
        if (pos) {
          this.syncActualX = pos.x
          this.syncActualY = pos.y
          this.syncPending = true
        }
      }).catch(() => {})
    }

    // 2. 应用待处理的同步结果（在每帧开头，位置变更之前）
    //    吸附拖拽时跳过（渲染器正在控制位置）
    if (this.syncPending && this.isPositionInitialized && !this.isStickyDragging) {
      this.syncPending = false
      const dx = Math.abs(this.windowX - this.syncActualX)
      const dy = Math.abs(this.windowY - this.syncActualY)
      if (dx > 1 || dy > 1) {
        console.log(
          `%c[LULU] 🔄 位置同步 渲染器=(${this.windowX},${this.windowY}) → 实际=(${this.syncActualX},${this.syncActualY}) 偏差=(${dx},${dy})`,
          'color:#FF9800;font-weight:bold'
        )
        this.windowX = this.syncActualX
        this.windowY = this.syncActualY
        // 刷新屏幕边界（可能窗口被移到了不同显示器）
        this.refreshScreenBounds()
        // 非行走/返回状态时，同步回家位置
        if (!this.isWalking && !this.isReturning) {
          this.homeX = this.windowX
          this.homeY = this.windowY
        }
      }
    }
  }

  /**
   * 智能穿透 — 鼠标不在宠物身上时窗口穿透，移到宠物身上时不穿透
   *
   * 原理：主进程 setIgnoreMouseEvents(true, { forward:true }) 让窗口穿透点击
   * 但仍转发 mousemove 事件。渲染进程根据鼠标位置判断是否在宠物身上：
   *  - 在宠物身上 → setIgnoreMouseEvents(false) → 接收点击/右键
   *  - 不在宠物身上 → setIgnoreMouseEvents(true, forward) → 点击穿透到桌面
   *
   * 有了位置同步机制，windowX/Y 始终与主进程一致，isOverPet 判断准确。
   */
  private updateSmartPassthrough(): void {
    // 吸附拖拽中：必须不穿透（需要接收释放点击）
    if (this.isStickyDragging) {
      if (this.lastIgnoreState !== false) {
        this.lastIgnoreState = false
        windowBridge.setIgnoreMouse(false)
      }
      return
    }

    // 检查鼠标是否在宠物身上
    const isOver = interactionDetector.isOverPet(
      this.cursorX, this.cursorY,
      this.windowX, this.windowY,
      this.currentFacing
    )
    const shouldIgnore = !isOver

    // 仅在状态变化时发送 IPC（减少开销）
    if (shouldIgnore !== this.lastIgnoreState) {
      this.lastIgnoreState = shouldIgnore
      windowBridge.setIgnoreMouse(shouldIgnore)
    }
  }

  /** 绑定鼠标事件（存储引用以便 destroy 时清理） */
  private bindMouseEvents(): void {
    const onMouseMove = (e: MouseEvent) => {
      this.cursorX = e.screenX
      this.cursorY = e.screenY
      // 即时更新智能穿透（比 update() 循环更快响应鼠标进入/离开宠物）
      this.updateSmartPassthrough()
      if (this.isStickyDragging) {
        this.pendingDragScreenX = e.screenX
        this.pendingDragScreenY = e.screenY
        this.hasPendingDrag = true
      }
    }

    const onMouseDown = (e: MouseEvent) => {
      // [DEBUG] 记录每次鼠标按下
      const localX = e.screenX - this.windowX
      const localY = e.screenY - this.windowY
      console.log(`%c[LULU-DEBUG] 🖱️ mousedown button=${e.button} screen=(${e.screenX},${e.screenY}) local=(${localX},${localY}) facing=${this.currentFacing}`, 'color:#FF5722;font-weight:bold')
      if (e.button === 0) {
        e.preventDefault()
        this.handleMouseDown(e.screenX, e.screenY)
      } else if (e.button === 2) {
        e.preventDefault()
        windowBridge.showContextMenu()
      }
    }

    const onContextMenu = (e: Event) => e.preventDefault()
    const onDblClick = (e: Event) => e.preventDefault()
    const onWindowContextMenu = (e: Event) => e.preventDefault()

    window.addEventListener('mousemove', onMouseMove)
    this.canvas?.addEventListener('mousedown', onMouseDown)
    this.canvas?.addEventListener('contextmenu', onContextMenu)
    this.canvas?.addEventListener('dblclick', onDblClick)
    window.addEventListener('contextmenu', onWindowContextMenu)

    // 保存引用以便清理
    this.listeners = [
      { target: window, type: 'mousemove', handler: onMouseMove },
      { target: this.canvas!, type: 'mousedown', handler: onMouseDown },
      { target: this.canvas!, type: 'contextmenu', handler: onContextMenu },
      { target: this.canvas!, type: 'dblclick', handler: onDblClick },
      { target: window, type: 'contextmenu', handler: onWindowContextMenu },
    ]
  }

  /** 绑定菜单动作 IPC 监听 */
  private bindMenuActions(): void {
    // 菜单点击触发的动作
    windowBridge.onTriggerAction((action) => {
      this.handleMenuAction(action)
    })

    // 禁止全屏幕走/跑动开关
    windowBridge.onToggleNoWalkRun((enabled) => {
      this.noWalkRun = enabled
      console.log(`%c[LULU] ${enabled ? '🔇' : '🔊'} 全屏幕走/跑动 ${enabled ? '已禁止' : '已恢复'}`, 'color:#9C27B0;font-weight:bold')
    })
  }

  /** 处理菜单触发的动作 */
  private handleMenuAction(action: string): void {
    // 正在吸附拖拽 → 先释放
    if (this.isStickyDragging) {
      this.endStickyDrag()
    }

    this.stopAllEffects()

    switch (action) {
      case 'drag': {
        logState('🖱️ 菜单触发 → 吸附拖拽')
        const petCenterX = this.windowX + WINDOW.WIDTH / 2
        const petCenterY = this.windowY + WINDOW.HEIGHT * 0.78
        this.startStickyDrag(petCenterX, petCenterY)
        break
      }
      case 'tangerine':
        logState('🍊 菜单触发 → 顶橘子')
        this.triggerTangerineBounce()
        behaviorAI.onInteraction()
        break
      case 'hula':
        logState('🫸 菜单触发 → 扭呼啦圈')
        this.triggerHula()
        behaviorAI.onInteraction()
        break
      case 'eating':
        logState('😋 菜单触发 → 吃橘子')
        this.triggerEating()
        behaviorAI.onInteraction()
        break
      case 'bath':
        logState('🛁 菜单触发 → 泡澡冥想')
        this.triggerBath()
        behaviorAI.onInteraction()
        break
    }
  }

  // ============================================================
  // 停止所有特效 — 每次触发新特效前调用
  // ============================================================
  private stopAllEffects(): void {
    // 停止橘子颠动
    this.tangerineBounceStart = 0
    setTangerineBounce(null)

    // 停止呼啦圈
    this.hulaStartTime = 0
    setHulaActive(false)

    // 停止吃橘子
    this.eatingStartTime = 0
    setEatingProgress(0)

    // 停止泡澡
    this.bathStartTime = 0

    // 停止爱心
    this.heartStartTime = 0

    // 停止行走和返回
    this.walkSpeed = 0
    this.isWalking = false
    this.isReturning = false

    // 重置口水
    setDroolProgress(0)
  }

  /**
   * 鼠标按下 — 双击吸附拖拽 + 单击部位交互
   * 吸附模式：双击后宠物跟随鼠标（无需按住），再次点击释放
   */
  private handleMouseDown(screenX: number, screenY: number): void {
    // 正在吸附拖拽 → 再次点击释放
    if (this.isStickyDragging) {
      this.endStickyDrag()
      return
    }

    if (!interactionDetector.isOverPet(screenX, screenY, this.windowX, this.windowY, this.currentFacing)) return

    const now = Date.now()

    // 双击 → 开始吸附拖拽（停止所有特效，包括呼啦圈）
    if (now - this.lastClickTime < this.DOUBLE_CLICK_MS) {
      logState('🖱️ 双击 → 停止所有特效 → 吸附鼠标')
      this.stopAllEffects()
      this.startStickyDrag(screenX, screenY)
      this.lastClickTime = 0
      return
    }

    // 单击部位交互 — 先停止所有特效
    this.stopAllEffects()

    const part = interactionDetector.detectPart(screenX, screenY, this.windowX, this.windowY, this.currentFacing)
    if (part === 'tangerine') {
      logState('🍊 点击橘子 → 颠动 5 下')
      this.triggerTangerineBounce()
      behaviorAI.onInteraction()
    } else if (part === 'head') {
      logState('🫸 点击头部 → 扭呼啦圈 5 秒')
      this.triggerHula()
      behaviorAI.onInteraction()
    } else if (part === 'snout') {
      logState('😋 点击嘴部 → 吃橘子')
      this.triggerEating()
      behaviorAI.onInteraction()
    } else if (part === 'belly' || part === 'foot') {
      logState('🛁 点击下半身 → 泡澡冥想 10 秒')
      this.triggerBath()
      behaviorAI.onInteraction()
    } else {
      // 未命中具体部位 → 恢复 idle
      stateMachine.forceSet('idle')
      animationPlayer.reset()
    }

    this.lastClickTime = now
  }

  /** 触发橘子颠动 */
  private triggerTangerineBounce(): void {
    this.tangerineBounceStart = Date.now()
    stateMachine.forceSet('idle')
    animationPlayer.reset()
  }

  /** 触发呼啦圈 */
  private triggerHula(): void {
    this.hulaStartTime = Date.now()
    setHulaActive(true)
    stateMachine.forceSet('hula')
    animationPlayer.reset()
  }

  /** 触发吃橘子 */
  private triggerEating(): void {
    this.eatingStartTime = Date.now()
    setEatingProgress(0.001)
    stateMachine.forceSet('eating')
    animationPlayer.reset()
  }

  /** 触发泡澡冥想 */
  private triggerBath(): void {
    this.bathStartTime = Date.now()
    stateMachine.forceSet('bath')
    animationPlayer.reset()
  }

  /** 触发爱心特效（从胸前放出粉色大爱心） */
  private triggerHeart(): void {
    this.heartStartTime = Date.now()
    this.lastHeartSpawn = 0
    stateMachine.forceSet('idle')
    animationPlayer.reset()
  }

  /** 开始吸附拖拽 — 双击后宠物跟随鼠标，无需按住 */
  private startStickyDrag(screenX: number, screenY: number): void {
    this.isStickyDragging = true
    behaviorAI.onInteraction()

    // 记录鼠标与宠物中心的偏移量
    const petCenterX = this.windowX + WINDOW.WIDTH / 2
    const petCenterY = this.windowY + WINDOW.HEIGHT * 0.78
    this.stickyOffsetX = screenX - petCenterX
    this.stickyOffsetY = screenY - petCenterY

    stateMachine.forceSet('drag')
    logState('🖱️ 吸附拖拽开始 → 跟随鼠标')
  }

  /** 结束吸附拖拽 — 再次点击释放 */
  private endStickyDrag(): void {
    this.isStickyDragging = false
    this.hasPendingDrag = false

    const petCenterY = this.windowY + WINDOW.HEIGHT * 0.78
    this.groundY = petCenterY
    physicsBody.groundY = this.groundY
    physicsBody.reset(this.windowX + WINDOW.WIDTH / 2, petCenterY)

    // 记录回家位置（用户最后放下的位置）
    this.homeX = this.windowX
    this.homeY = this.windowY

    // 刷新屏幕边界（可能拖到了另一个显示器）
    this.refreshScreenBounds()

    behaviorAI.onInteraction()
    stateMachine.forceSet('idle')
    animationPlayer.reset()
    logState('🖱️ 吸附释放 → idle，回家位置已记录')
  }

  /** 应用吸附拖拽位置 */
  private applyPendingDrag(): void {
    if (!this.hasPendingDrag) return
    this.hasPendingDrag = false

    const newCenterX = this.pendingDragScreenX - this.stickyOffsetX
    const newCenterY = this.pendingDragScreenY - this.stickyOffsetY

    this.windowX = Math.round(newCenterX - WINDOW.WIDTH / 2)
    this.windowY = Math.round(newCenterY - WINDOW.HEIGHT * 0.78)

    // 钳位到屏幕边界 — 必须与主进程 setWindowPosition 的钳位一致
    // 否则 this.windowX/Y 会与实际窗口位置不同步
    this.clampWindowPos()

    windowBridge.setWindowPosition(this.windowX, this.windowY)
  }

  /** 添加特效 */
  private addEffect(type: 'heart' | 'zzz'): void {
    const now = Date.now()
    if (now - this.lastEffectTime < 200) return
    this.lastEffectTime = now

    petStore.get().addEffect({
      type,
      x: WINDOW.WIDTH / 2 + (Math.random() - 0.5) * 40,
      y: WINDOW.HEIGHT * 0.3,
      life: 1500,
    })
  }

  /** 从胸前放出粉色大爱心 */
  private spawnChestHeart(): void {
    petStore.get().addEffect({
      type: 'heart',
      x: WINDOW.WIDTH / 2 + (Math.random() - 0.5) * 20,
      y: WINDOW.HEIGHT * 0.55, // 胸前位置
      life: 2000,
    })
  }

  /** 主循环 */
  private tick = (now: number): void => {
    const dt = Math.min((now - this.lastTime) / 1000, 0.1)
    this.lastTime = now

    // [DEBUG] 每 5 秒输出一次渲染心跳
    if (now - this.lastDebugHeartbeat > 5000) {
      this.lastDebugHeartbeat = now
      console.log(`%c[LULU-DEBUG] 💓 render heartbeat state=${stateMachine.current} frame=${animationPlayer.frame} pos=(${this.windowX},${this.windowY}) cursor=(${this.cursorX},${this.cursorY})`, 'color:#4CAF50;font-weight:bold')
    }

    // Canvas 像素健康检查（每 15 秒采样像素，检测是否变空白）
    if (now - this.lastPixelCheck > this.PIXEL_CHECK_INTERVAL) {
      this.lastPixelCheck = now
      this.checkCanvasPixels()
    }

    try {
      this.update(dt)
      this.draw()
    } catch (e) {
      console.error('[LULU] 渲染循环异常:', e)
      // 异常时强制重置 canvas（终极恢复）
      this.forceResetCanvas()
    }
    this.rafId = requestAnimationFrame(this.tick)
  }

  /** 恢复 canvas 上下文（轻量恢复：仅重新获取上下文 + 重置变换）
   *  用于 ctx 为 null 但 canvas 尚可的情况（如 contextlost 事件触发后 contextrestored 事件到达前）
   */
  private recoverCanvas(): void {
    if (!this.canvas) return
    try {
      const ctx = this.canvas.getContext('2d')
      if (ctx) {
        this.ctx = ctx
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.scale(this.dpr, this.dpr)
        console.log('%c[LULU] 🔄 Canvas 上下文已恢复', 'color:#4CAF50;font-weight:bold')
      }
    } catch (e) {
      console.error('[LULU] Canvas 恢复失败:', e)
    }
  }

  /**
   * 强制重置 Canvas（终极恢复手段）
   *
   * 设置 canvas.width 会清除所有上下文状态并创建全新的上下文对象。
   * 这是唯一可靠的方法来从"上下文丢失但 getContext('2d') 返回非 null 旧引用"中恢复。
   *
   * 使用场景：
   *  - 像素检测发现画布空白（上下文静默失效）
   *  - contextrestored 事件触发
   *  - 渲染循环异常
   */
  private forceResetCanvas(): void {
    if (!this.canvas) return
    try {
      // 设置 width 会清除画布 + 重置上下文（即使值相同）
      this.canvas.width = WINDOW.WIDTH * this.dpr
      this.canvas.height = WINDOW.HEIGHT * this.dpr
      this.canvas.style.width = WINDOW.WIDTH + 'px'
      this.canvas.style.height = WINDOW.HEIGHT + 'px'
      const ctx = this.canvas.getContext('2d')
      if (ctx) {
        this.ctx = ctx
        ctx.scale(this.dpr, this.dpr)
        console.log('%c[LULU] ✅ Canvas 已强制重置（全新上下文）', 'color:#4CAF50;font-weight:bold')
      }
    } catch (e) {
      console.error('[LULU] Canvas 强制重置失败:', e)
    }
  }

  /**
   * 像素级健康检查 — 采样画布像素检测是否变空白
   *
   * 当上下文静默失效时（Electron/Windows 上 contextlost 事件可能不触发），
   * this.ctx 仍为非 null 旧引用，drawing 操作静默失败（不抛异常），
   * 导致画布完全透明但程序无感知。
   *
   * 本方法采样画布中心区域像素，如果全部透明则判定为空白 → 强制重置。
   */
  private checkCanvasPixels(): void {
    if (!this.ctx || !this.canvas) {
      this.forceResetCanvas()
      return
    }
    try {
      // 采样画布中部区域 30x30 设备像素（覆盖水豚身体区域）
      const w = this.canvas.width
      const h = this.canvas.height
      const sx = Math.floor(w * 0.3)
      const sy = Math.floor(h * 0.4)
      const sw = Math.min(30, w)
      const sh = Math.min(30, h)
      const data = this.ctx.getImageData(sx, sy, sw, sh).data
      // 检查是否有任何非透明像素（alpha > 0）
      let hasContent = false
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 0) { hasContent = true; break }
      }
      if (!hasContent) {
        console.warn('%c[LULU] ⚠️ 像素检测：画布空白 → 强制重置上下文', 'color:#FF5722;font-weight:bold')
        this.forceResetCanvas()
      }
    } catch (e) {
      // getImageData 抛异常 → 上下文已失效
      console.error('%c[LULU] ⚠️ 像素检测异常 → 强制重置', 'color:#FF5722;font-weight:bold', e)
      this.forceResetCanvas()
    }
  }

  /** 更新逻辑 */
  private update(dt: number): void {
    const store = petStore.get()
    const currentState = stateMachine.current

    // 0. 窗口位置同步（核心防卡死 — 纠正渲染器与主进程的位置不同步）
    this.syncWindowPosition()

    // 0.3 智能穿透（位置同步后，用准确的 windowX/Y 判断鼠标是否在宠物身上）
    this.updateSmartPassthrough()

    // 0.5 吸附拖拽位置更新
    if (this.isStickyDragging) {
      this.applyPendingDrag()
    }

    // 1. 面朝方向（睡眠、行走、返回、吸附拖拽时由移动逻辑控制）
    const isMovingBySelf = this.walkSpeed > 0 || this.isReturning
    if (currentState !== 'sleep' && !isMovingBySelf) {
      const petCenterX = this.windowX + WINDOW.WIDTH / 2
      const newFacing: Facing = this.cursorX < petCenterX ? 'left' : 'right'
      if (newFacing !== this.currentFacing) {
        this.currentFacing = newFacing
      }
    }

    // 2. 动画更新
    const animFinished = animationPlayer.update(currentState, dt)
    if (animFinished && stateMachine.isLocked) {
      stateMachine.unlock()
      animationPlayer.reset()
    }

    // 2.5 橘子颠动动画
    if (this.tangerineBounceStart > 0) {
      const elapsed = Date.now() - this.tangerineBounceStart
      if (elapsed >= this.TANGERINE_BOUNCE_DURATION) {
        this.tangerineBounceStart = 0
        setTangerineBounce(null)
      } else {
        const progress = elapsed / this.TANGERINE_BOUNCE_DURATION
        const phase = progress * this.TANGERINE_BOUNCE_COUNT
        const bounce = Math.abs(Math.sin(phase * Math.PI))
        const decay = Math.pow(1 - progress, 0.6)
        const offset = -bounce * decay * this.TANGERINE_BOUNCE_AMP
        setTangerineBounce(offset)
      }
    }

    // 2.6 呼啦圈动画
    if (this.hulaStartTime > 0) {
      advanceHulaFrame()
      const elapsed = Date.now() - this.hulaStartTime
      if (elapsed >= this.HULA_DURATION) {
        this.hulaStartTime = 0
        setHulaActive(false)
        stateMachine.forceSet('idle')
        animationPlayer.reset()
        logState('🫸 呼啦圈结束 → idle')
      }
    }

    // 2.7 吃橘子动画
    if (this.eatingStartTime > 0) {
      const elapsed = Date.now() - this.eatingStartTime
      const progress = Math.min(elapsed / this.EATING_DURATION, 1)
      setEatingProgress(progress)
      if (elapsed >= this.EATING_DURATION) {
        this.eatingStartTime = 0
        setEatingProgress(0)
        stateMachine.forceSet('idle')
        animationPlayer.reset()
        logState('😋 吃完橘子 → idle')
      }
    }

    // 2.8 泡澡冥想
    if (this.bathStartTime > 0) {
      const elapsed = Date.now() - this.bathStartTime
      if (elapsed >= this.BATH_DURATION) {
        this.bathStartTime = 0
        stateMachine.forceSet('idle')
        animationPlayer.reset()
        logState('🛁 泡澡结束 → idle')
      }
    }

    // 2.9 爱心特效（从胸前持续放出粉色大爱心）
    if (this.heartStartTime > 0) {
      const elapsed = Date.now() - this.heartStartTime
      if (elapsed >= this.HEART_DURATION) {
        this.heartStartTime = 0
        logState('💕 爱心特效结束 → idle')
      } else {
        // 每 300ms 放出一个爱心
        if (elapsed - this.lastHeartSpawn >= 300) {
          this.lastHeartSpawn = elapsed
          this.spawnChestHeart()
        }
      }
    }

    // 3. 返回回家位置（行走结束后）
    if (this.isReturning) {
      const dx = this.homeX - this.windowX
      if (Math.abs(dx) <= this.RETURN_SPEED) {
        // 到家了
        this.windowX = this.homeX
        this.clampWindowPos()
        this.isReturning = false
        this.walkSpeed = 0
        stateMachine.forceSet('idle')
        animationPlayer.reset()
        logState('🏠 返回原位 → idle')
      } else {
        // 继续往回走
        this.windowX += Math.sign(dx) * this.RETURN_SPEED
        this.clampWindowPos()
        this.currentFacing = dx > 0 ? 'right' : 'left'
        windowBridge.setWindowPosition(this.windowX, this.windowY)
        // 保持 walk 动画
        if (currentState !== 'walk') {
          stateMachine.forceSet('walk')
          animationPlayer.reset()
        }
      }
    }

    // 4. 行走/奔跑 — 移动窗口 + 触边一次后返回原位（免打扰时原地走跑）
    else if (this.walkSpeed > 0 && (currentState === 'walk' || currentState === 'run')) {
      // 检查行走行为是否已结束
      if (this.isWalking && behaviorAI.getCurrentAction() === null) {
        if (this.noWalkRun) {
          // 原地走/跑结束 → 直接 idle（无需返回）
          this.isWalking = false
          this.walkSpeed = 0
          stateMachine.forceSet('idle')
          animationPlayer.reset()
          logState('🏠 原地走/跑结束 → idle')
        } else {
          // 行走结束 → 开始返回回家
          this.isWalking = false
          this.isReturning = true
          this.walkSpeed = 0
          logState('🏠 行走结束 → 返回原位')
        }
      } else if (this.noWalkRun) {
        // 原地走/跑：只播放动画，不移动窗口位置
        // 偶尔改变方向增加视觉趣味
        if (Math.random() < 0.005) {
          const newDir = behaviorAI.getWalkDirection() > 0 ? -1 : 1
          behaviorAI.setWalkDirection(newDir as 1 | -1)
        }
        this.currentFacing = behaviorAI.getWalkDirection() > 0 ? 'right' : 'left'
      } else {
        const dir = behaviorAI.getWalkDirection()
        this.windowX += Math.round(this.walkSpeed * dir)

        // 屏幕边缘检测 → 触边一次后返回原位（不再来回弹）
        if (this.windowX <= this.screenLeft + 2) {
          this.windowX = this.screenLeft + 2
          this.isWalking = false
          this.isReturning = true
          this.walkSpeed = 0
          logState('🧱 撞到左边 → 返回原位')
        } else if (this.windowX >= this.screenRight - WINDOW.WIDTH - 2) {
          this.windowX = this.screenRight - WINDOW.WIDTH - 2
          this.isWalking = false
          this.isReturning = true
          this.walkSpeed = 0
          logState('🧱 撞到右边 → 返回原位')
        }

        // 钳位 Y（安全措施，行走时 Y 不应该变化但防止意外）
        this.clampWindowPos()
        windowBridge.setWindowPosition(this.windowX, this.windowY)
        this.currentFacing = behaviorAI.getWalkDirection() > 0 ? 'right' : 'left'
      }
    }

    // 5. 行为AI — yawn → sleep 过渡
    if (currentState !== 'drag') {
      const yawnTransition = behaviorAI.checkTrigger(currentState)
      if (yawnTransition && !stateMachine.isLocked) {
        behaviorAI.consumePendingSleep()  // 仅在转换真正发生时消费标志
        stateMachine.forceSet(yawnTransition)
        animationPlayer.reset()
        if (yawnTransition === 'sleep') {
          behaviorAI.onSleepStart()
          this.addEffect('zzz')
          logState('😴 → sleep')
        }
      }
    }

    // 5.5 睡眠醒来检测（30秒后 → yawn 醒来）
    if (currentState === 'sleep') {
      behaviorAI.checkIdleAction(currentState)
      if (behaviorAI.getCurrentAction() === null) {
        stateMachine.forceSet('yawn')
        animationPlayer.reset()
        setDroolProgress(0)
        logState('🥱 睡了30秒 → 伸懒腰醒来 → yawn')
      }
    }

    // 5.6 空闲随机行为（5秒无操作后触发，行走/返回时不触发）
    if (currentState !== 'drag' && currentState !== 'hula' && currentState !== 'eating' && currentState !== 'bath' && currentState !== 'yawn' && currentState !== 'sleep' && !this.isReturning && !this.isWalking) {
      const idleAction = behaviorAI.checkIdleAction(currentState)
      if (idleAction && !stateMachine.isLocked) {
        this.handleIdleAction(idleAction)
      }
    }

    // 5.7 口水生长 — 使用实时状态（避免转换帧中 currentState 局部变量过时）
    const actualState = stateMachine.current
    if (actualState === 'sleep') {
      setDroolProgress(behaviorAI.getDroolProgress())
    } else {
      setDroolProgress(0)
    }

    // 5.8 睡眠时偶尔添加 Zzz
    if (currentState === 'sleep' && Math.random() < 0.005) {
      this.addEffect('zzz')
    }

    // 6. Store 更新
    const newState = stateMachine.current
    const newFrame = animationPlayer.frame
    if (
      newState !== this.lastStoreState ||
      newFrame !== this.lastStoreFrame ||
      this.windowX !== this.lastStoreWindowX ||
      this.windowY !== this.lastStoreWindowY ||
      this.currentFacing !== this.lastStoreFacing
    ) {
      this.lastStoreState = newState
      this.lastStoreFrame = newFrame
      this.lastStoreWindowX = this.windowX
      this.lastStoreWindowY = this.windowY
      this.lastStoreFacing = this.currentFacing
      petStore.set({
        state: newState,
        frame: newFrame,
        windowX: this.windowX,
        windowY: this.windowY,
        facing: this.currentFacing,
      })
    }

    // 7. 更新特效
    store.updateEffects()
  }

  /** 处理空闲随机行为 */
  private handleIdleAction(action: NonNullable<IdleAction>): void {
    switch (action) {
      case 'run': {
        logState('🏃 空闲随机 → 跑动（流汗）')
        this.walkSpeed = 3
        this.isWalking = true
        this.refreshScreenBounds()
        // 根据当前位置选择跑动方向：靠左往右跑，靠右往左跑
        const screenMid = (this.screenLeft + this.screenRight) / 2
        const petCenterX = this.windowX + WINDOW.WIDTH / 2
        behaviorAI.setWalkDirection(petCenterX < screenMid ? 1 : -1)
        stateMachine.forceSet('run')
        animationPlayer.reset()
        break
      }
      case 'hula':
        logState('🫸 空闲随机 → 扭呼啦圈')
        this.triggerHula()
        break
      case 'eating':
        logState('😋 空闲随机 → 吃橘子')
        this.triggerEating()
        break
      case 'tangerine':
        logState('🍊 空闲随机 → 顶橘子')
        this.triggerTangerineBounce()
        break
      case 'sleep':
        logState('🥱 空闲随机 → 打哈欠 → 睡觉 30 秒')
        behaviorAI.triggerSleepSequence()
        stateMachine.forceSet('yawn')
        animationPlayer.reset()
        break
      case 'heart':
        logState('💕 空闲随机 → 放出粉色爱心')
        this.triggerHeart()
        break
      case 'bath':
        logState('🛁 空闲随机 → 泡澡冥想 10 秒')
        this.triggerBath()
        break
    }
  }

  /** 绘制 */
  private draw(): void {
    if (!this.ctx || !this.canvas) {
      // 上下文丢失 → 强制重置
      this.forceResetCanvas()
      return
    }
    const ctx = this.ctx
    const w = WINDOW.WIDTH
    const h = WINDOW.HEIGHT

    ctx.clearRect(0, 0, w, h)

    const store = petStore.get()
    drawCapybara(ctx, store.state, store.frame, store.facing, w, h)
    this.drawEffects(ctx)
  }

  /** 绘制特效 */
  private drawEffects(ctx: CanvasRenderingContext2D): void {
    const effects = petStore.get().effects
    const now = Date.now()

    for (const effect of effects) {
      const age = now - effect.born
      const progress = age / effect.life
      const y = effect.y - progress * 40
      const alpha = 1 - progress
      const scale = 0.8 + progress * 0.4

      ctx.save()
      ctx.globalAlpha = alpha
      ctx.translate(effect.x, y)
      ctx.scale(scale, scale)

      switch (effect.type) {
        case 'heart':
          this.drawHeart(ctx)
          break
        case 'zzz':
          this.drawZzz(ctx, progress)
          break
      }
      ctx.restore()
    }
  }

  private drawHeart(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FF6B9D'
    ctx.beginPath()
    ctx.moveTo(0, 4)
    ctx.bezierCurveTo(-8, -4, -8, -10, 0, -6)
    ctx.bezierCurveTo(8, -10, 8, -4, 0, 4)
    ctx.fill()
  }

  private drawZzz(ctx: CanvasRenderingContext2D, progress: number): void {
    const size = 10 + progress * 6
    ctx.fillStyle = '#7CB342'
    ctx.font = `bold ${size}px sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText('Z', 0, 0)
  }

  /** 停止循环并清理所有资源 */
  destroy(): void {
    this.isInitialized = false

    // 停止动画帧
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }

    // 移除所有事件监听器（防止累积）
    for (const { target, type, handler } of this.listeners) {
      target.removeEventListener(type, handler)
    }
    this.listeners = []

    // 重置动画状态
    setTangerineBounce(null)
    setDroolProgress(0)
    setHulaActive(false)
    setEatingProgress(0)

    // 重置穿透状态为穿透（防止 HMR 重载时卡在不穿透状态）
    windowBridge.setIgnoreMouse(true)
    this.lastIgnoreState = null
  }
}

/** 全局渲染循环实例 */
export const renderLoop = new RenderLoopManager()
