import type { PetState, Facing } from '@shared/types'
import { COLORS } from '@shared/constants'

// ============================================================
// 橘子颠动覆盖 — 由 render-loop 外部控制，优先于状态动画
// ============================================================
let tangerineBounceOverride: number | null = null

/** 设置橘子颠动偏移（null = 恢复状态动画） */
export function setTangerineBounce(value: number | null): void {
  tangerineBounceOverride = value
}

// ============================================================
// 口水生长覆盖 — 由 render-loop 外部控制，0=无口水 1=完全落地
// ============================================================
let droolProgressOverride = 0

/** 设置口水生长进度（0 = 无，1 = 完全延伸至地面） */
export function setDroolProgress(value: number): void {
  droolProgressOverride = value
}

// ============================================================
// 呼啦圈动画覆盖 — 由 render-loop 外部控制
// ============================================================
let hulaActive = false
let hulaFrame = 0

/** 设置呼啦圈是否激活 */
export function setHulaActive(active: boolean): void {
  hulaActive = active
  if (!active) hulaFrame = 0
}

/** 推进呼啦圈帧（由 render-loop 每帧调用） */
export function advanceHulaFrame(): void {
  if (hulaActive) hulaFrame++
}

// ============================================================
// 吃橘子动画覆盖 — 由 render-loop 外部控制
// progress: 0→1 完整周期
//   0.00-0.30: 橘子从头顶飞到嘴边（抛物线轨迹）
//   0.30-0.85: 咀嚼阶段（橘子消失，嘴巴张合）
//   0.85-1.00: 橘子重新长回头顶（淡入）
// ============================================================
let eatingProgress = 0          // 0 = 未激活，>0 = 动画进行中
let eatingActive = false

/** 设置吃橘子动画状态（progress=0 表示未激活） */
export function setEatingProgress(progress: number): void {
  if (progress <= 0) {
    eatingActive = false
    eatingProgress = 0
  } else {
    eatingActive = true
    eatingProgress = progress
  }
}

/** 吃橘子动画是否激活 */
export function isEatingActive(): boolean {
  return eatingActive
}

/**
 * 水豚噜噜渲染器 - 参考图精确匹配
 * 特征：超大头(≈1:1身)、温暖金黄、超大圆眼、宽大突出吻部、头顶橘子、小圆耳
 * 整体风格：3D Q版/糯米团子感，圆润无棱角
 */

/** 动画参数 */
interface AnimParams {
  bodyOffsetY: number
  bodyScaleX: number
  bodyScaleY: number
  bodyRotation: number  // 身体旋转角度（弧度），扭腰效果
  bodyOffsetX: number   // 身体水平偏移（扭腰时左右摆动）
  headOffsetX: number
  headOffsetY: number
  legPhase: number
  legAmplitude: number
  legTuck: number
  eyeState: 'open' | 'closed' | 'happy' | 'sleepy' | 'wide'
  blink: boolean
  mouthOpen: number
  mouthCurve: number
  tangerineBob: number
  cheekVisible: boolean
  droolVisible: boolean // 口水（睡觉时）
  sweatVisible: boolean // 蓝色汗液（跑动时）
}

function defaultParams(): AnimParams {
  return {
    bodyOffsetY: 0,
    bodyScaleX: 1,
    bodyScaleY: 1,
    bodyRotation: 0,
    bodyOffsetX: 0,
    headOffsetX: 0,
    headOffsetY: 0,
    legPhase: 0,
    legAmplitude: 0,
    legTuck: 0,
    eyeState: 'open',
    blink: false,
    mouthOpen: 0,
    mouthCurve: 0.5,
    tangerineBob: 0,
    cheekVisible: true,
    droolVisible: false,
    sweatVisible: false,
  }
}

/** 各状态动画参数 */
function computeAnimParams(state: PetState, frame: number): AnimParams {
  const p = defaultParams()

  switch (state) {
    case 'idle': {
      p.bodyScaleY = 1 + Math.sin(frame * 0.5) * 0.02
      p.bodyScaleX = 1 - Math.sin(frame * 0.5) * 0.012
      const blinkCycle = frame % 24
      p.blink = blinkCycle < 2
      p.mouthCurve = 0.3
      break
    }

    case 'walk': {
      // 使用连续时间避免整数帧导致的脚部卡顿
      const walkT = performance.now() * 0.001
      p.legPhase = walkT * 8
      p.legAmplitude = 3
      p.bodyOffsetY = Math.abs(Math.sin(p.legPhase)) * 1.5
      p.mouthCurve = 0.2
      break
    }

    case 'run': {
      // 使用连续时间避免整数帧导致的脚部卡顿
      const runT = performance.now() * 0.001
      p.legPhase = runT * 12
      p.legAmplitude = 5
      p.bodyOffsetY = Math.abs(Math.sin(p.legPhase)) * 3
      p.bodyScaleY = 1 + Math.sin(p.legPhase * 2) * 0.015
      p.mouthCurve = 0.1
      p.eyeState = 'wide'
      p.sweatVisible = true  // 跑动时流蓝色汗液
      break
    }

    case 'sleep': {
      p.bodyScaleY = 1 + Math.sin(frame * 0.3) * 0.015
      p.eyeState = 'closed'
      p.mouthCurve = 0.2
      p.bodyOffsetY = 2
      p.droolVisible = true
      break
    }

    case 'drag': {
      p.legTuck = 1
      p.bodyScaleX = 1.08
      p.bodyScaleY = 0.96
      p.eyeState = 'wide'
      p.mouthOpen = 0.15
      p.mouthCurve = -0.1
      break
    }

    case 'eating': {
      // 吃橘子动画：咀嚼阶段嘴巴张合
      if (eatingActive && eatingProgress >= 0.30 && eatingProgress < 0.85) {
        // 咀嚼 — 快速张合
        p.mouthOpen = (Math.sin(frame * 3.0) + 1) * 0.35
        p.bodyOffsetY = Math.abs(Math.sin(frame * 3.0)) * 1.2
      } else if (eatingActive && eatingProgress < 0.30) {
        // 飞行阶段 — 张嘴准备接
        p.mouthOpen = 0.4
      }
      p.mouthCurve = 0.4
      p.cheekVisible = true
      p.eyeState = 'happy'
      break
    }

    case 'yawn': {
      const t = frame / 2
      p.mouthOpen = Math.sin(t * Math.PI) * 0.7
      p.eyeState = 'sleepy'
      p.bodyScaleY = 1 + Math.sin(t * Math.PI) * 0.015
      break
    }

    case 'hula': {
      // 扭腰：身体左右大幅摆动 + 旋转，头部反向跟随
      const sway = Math.sin(frame * 0.9)
      const swayAbs = Math.abs(sway)
      // 身体水平偏移：左右摆动 ±7px（最明显的视觉效果）
      p.bodyOffsetX = sway * 7
      // 身体旋转 ±0.5 弧度 ≈ ±28°
      p.bodyRotation = sway * 0.5
      // 扭腰时身体微压
      p.bodyScaleY = 1 - swayAbs * 0.06
      // 上下弹动（节拍感）
      p.bodyOffsetY = Math.abs(Math.sin(frame * 1.8)) * 2
      // 头部反向轻微跟随（与身体形成对比，增强扭腰感）
      p.headOffsetX = -sway * 3
      p.eyeState = 'happy'
      p.mouthCurve = 0.8
      p.tangerineBob = Math.sin(frame * 0.9 + Math.PI * 0.3) * 2
      break
    }

    case 'bath': {
      // 泡澡冥想：身体微微下沉、轻微呼吸、双眼微闭
      const breath = Math.sin(frame * 0.5)
      p.bodyScaleY = 1 + breath * 0.02
      p.bodyScaleX = 1 - breath * 0.01
      p.bodyOffsetY = 3 + breath * 0.5  // 身体微沉（泡在水里）
      p.eyeState = 'sleepy'             // 双眼微闭
      p.mouthCurve = 0.5                // 满足微笑
      p.cheekVisible = true
      p.tangerineBob = breath * 0.5
      break
    }
  }

  return p
}

/**
 * 水豚噜噜的绘制 - 坐标系说明
 * 原点在角色脚下中心，y 向上为负
 * 整体高度约 150px
 * 头部占比约 60%（超大头Q版）
 * 参考图特征：头部几乎是球形，身体小而圆润，吻部宽大突出
 */

/** 绘制水豚噜噜 */
export function drawCapybara(
  ctx: CanvasRenderingContext2D,
  state: PetState,
  frame: number,
  facing: Facing,
  canvasW: number,
  canvasH: number
): void {
  const params = computeAnimParams(state, frame)

  // 中心点
  const cx = canvasW / 2
  const groundY = canvasH * 0.82

  ctx.save()
  ctx.translate(cx, groundY)

  if (facing === 'left') {
    ctx.scale(-1, 1)
  }

  // 泡澡状态：先画浴缸后部 + 热水，再画水豚，最后画浴缸前壁 + 蒸汽
  const isBath = state === 'bath'
  if (isBath) drawBathTubBack(ctx)

  // 绘制顺序：阴影 → 后腿 → 身体 → 前腿 → [呼啦圈] → 头部 → 耳朵 → 橘子(正常/重生) → 吻部 → 脸部 → 腮红 → [吃橘子时:橘子在嘴前]
  drawShadow(ctx, params)
  drawBackLegs(ctx, params)
  drawBody(ctx, params)
  drawFrontLegs(ctx, params)
  if (hulaActive) drawHulaHoop(ctx, params)
  drawHead(ctx, params)
  drawEars(ctx, params)
  // 非吃橘子状态或重生阶段：橘子在头部位置正常绘制
  if (!eatingActive || eatingProgress >= 0.85) {
    drawTangerine(ctx, params)
  }
  drawSnout(ctx, params)
  drawFace(ctx, params, state)
  if (params.cheekVisible) drawCheeks(ctx, params)
  // 跑动时绘制蓝色汗液
  if (params.sweatVisible) drawSweat(ctx, frame)
  // 吃橘子时：橘子飞到嘴边或在嘴里咀嚼，需在脸部之后绘制（覆盖眼睛/嘴）
  if (eatingActive && eatingProgress < 0.85) {
    drawTangerine(ctx, params)
  }

  // 泡澡状态：水豚上方画浴缸前壁 + 蒸汽
  if (isBath) {
    drawBathTubFront(ctx)
    drawSteam(ctx, frame)
  }

  ctx.restore()
}

// ============= 各部位绘制 =============

/**
 * 呼啦圈 — 围绕水豚腰部的旋转圆环
 * 橙色+黄色交替的彩色呼啦圈，随帧旋转
 */
function drawHulaHoop(ctx: CanvasRenderingContext2D, p: AnimParams): void {
  ctx.save()
  // 呼啦圈定位到腰部，跟随身体上下弹动
  ctx.translate(0, p.bodyOffsetY)

  const centerX = 3   // 偏向身体中心
  const centerY = -15  // 身体中部（腰部）
  const rx = 32        // 椭圆水平半径（比身体宽一圈）
  const ry = 10        // 椭圆垂直半径（透视压缩）

  // 呼啦圈旋转角度
  const angle = hulaFrame * 0.35

  // 外圈阴影
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.ellipse(centerX, centerY + 1, rx, ry, 0, 0, Math.PI * 2)
  ctx.stroke()

  // 主圈体 — 分段彩色绘制
  const segments = 12
  const colors = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF']
  for (let i = 0; i < segments; i++) {
    const startAngle = (i / segments) * Math.PI * 2 + angle
    const endAngle = ((i + 1) / segments) * Math.PI * 2 + angle
    ctx.strokeStyle = colors[i % colors.length]
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.ellipse(centerX, centerY, rx, ry, 0, startAngle, endAngle)
    ctx.stroke()
  }

  // 高光（上方亮线，制造立体感）
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.ellipse(centerX, centerY - 1, rx, ry, 0, Math.PI + 0.3, Math.PI * 2 - 0.3)
  ctx.stroke()

  ctx.restore()
}

// ============= 泡澡冥想 =============

/** 浴缸后部 + 热水（在水豚之前绘制） */
function drawBathTubBack(ctx: CanvasRenderingContext2D): void {
  ctx.save()

  // 浴缸外壁（深色，在水豚身后）
  ctx.fillStyle = '#8B7355'
  ctx.beginPath()
  ctx.moveTo(-38, 2)
  ctx.lineTo(-42, -12)
  ctx.quadraticCurveTo(-42, -20, -34, -21)
  ctx.lineTo(34, -21)
  ctx.quadraticCurveTo(42, -20, 42, -12)
  ctx.lineTo(38, 2)
  ctx.closePath()
  ctx.fill()

  // 热水水面（浅蓝色半透明）
  ctx.fillStyle = 'rgba(135, 206, 235, 0.6)'
  ctx.beginPath()
  ctx.ellipse(0, -16, 38, 6, 0, 0, Math.PI * 2)
  ctx.fill()

  // 水面高光波纹
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.ellipse(-10, -18, 12, 2, -0.2, 0, Math.PI)
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(12, -15, 8, 1.5, 0.3, 0, Math.PI)
  ctx.stroke()

  ctx.restore()
}

/** 浴缸前壁（在水豚之后绘制，遮挡下半身） */
function drawBathTubFront(ctx: CanvasRenderingContext2D): void {
  ctx.save()

  // 浴缸前壁弧线（半透明，让水豚下半身若隐若现）
  ctx.fillStyle = 'rgba(139, 115, 85, 0.55)'
  ctx.beginPath()
  ctx.moveTo(-38, 2)
  ctx.quadraticCurveTo(-35, -8, -32, -12)
  ctx.lineTo(32, -12)
  ctx.quadraticCurveTo(35, -8, 38, 2)
  ctx.closePath()
  ctx.fill()

  // 浴缸边沿（亮色高光）
  ctx.strokeStyle = '#A0826D'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.ellipse(0, -14, 38, 6, 0, 0, Math.PI)
  ctx.stroke()

  // 浴缸边沿顶部高光
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.ellipse(0, -15, 36, 5, 0, Math.PI + 0.2, Math.PI * 2 - 0.2)
  ctx.stroke()

  ctx.restore()
}

/** 蒸汽（从浴缸上方不断升腾的泡泡，营造真实泡澡感） */
function drawSteam(ctx: CanvasRenderingContext2D, frame: number): void {
  ctx.save()

  const t = performance.now() * 0.001

  // 6 缕蒸汽泡泡，各自有独立的速度、相位和水平摆动，持续上升
  const bubbleCount = 6
  for (let i = 0; i < bubbleCount; i++) {
    // 每个泡泡的独立参数
    const speed = 0.25 + (i % 3) * 0.08    // 上升速度（每秒）
    const cycleLen = 1 / speed              // 完整周期（秒）
    const phaseOffset = (i / bubbleCount) * cycleLen
    const cycle = ((t + phaseOffset) % cycleLen) / cycleLen  // 0→1

    // 水平位置：在浴缸上方均匀分布 + 轻微摆动
    const baseX = (i - (bubbleCount - 1) / 2) * 11
    const wobble = Math.sin(t * 1.5 + i * 1.3) * 4
    const x = baseX + wobble

    // 垂直位置：从浴缸水面(-18)持续上升至画布顶部
    const startY = -18
    const endY = -85
    const y = startY + (endY - startY) * cycle

    // 透明度：中间最浓，两端渐隐（底部生成 + 顶部消散）
    const alpha = Math.sin(cycle * Math.PI) * 0.35

    // 大小：随上升逐渐膨胀
    const r = 3 + cycle * 5

    // 主泡泡
    ctx.globalAlpha = alpha
    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()

    // 附带小泡泡（偏移）
    ctx.globalAlpha = alpha * 0.6
    ctx.beginPath()
    ctx.arc(x + r * 0.6, y - r * 0.4, r * 0.5, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

/** 阴影 */
function drawShadow(ctx: CanvasRenderingContext2D, p: AnimParams): void {
  ctx.save()
  const scale = p.bodyOffsetY < 0 ? 0.6 : 1
  ctx.fillStyle = 'rgba(0, 0, 0, 0.08)'
  ctx.beginPath()
  ctx.ellipse(0, 1, 35 * scale * p.bodyScaleX, 5 * scale, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/** 后腿（短粗圆柱） */
function drawBackLegs(ctx: CanvasRenderingContext2D, p: AnimParams): void {
  const w = 8
  const h = 9
  const leftOff = Math.sin(p.legPhase) * p.legAmplitude
  const rightOff = Math.sin(p.legPhase + Math.PI) * p.legAmplitude
  drawLeg(ctx, -13, -2 + leftOff - p.legTuck * 4, w, h, p.legTuck)
  drawLeg(ctx, -6, -2 + rightOff - p.legTuck * 4, w, h, p.legTuck)
}

/** 前腿 */
function drawFrontLegs(ctx: CanvasRenderingContext2D, p: AnimParams): void {
  const w = 9
  const h = 9
  const leftOff = Math.sin(p.legPhase + Math.PI) * p.legAmplitude
  const rightOff = Math.sin(p.legPhase) * p.legAmplitude
  drawLeg(ctx, 6, -2 + leftOff - p.legTuck * 4, w, h, p.legTuck)
  drawLeg(ctx, 13, -2 + rightOff - p.legTuck * 4, w, h, p.legTuck)
}

/** 单条腿 */
function drawLeg(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, tuck: number
): void {
  ctx.save()
  ctx.fillStyle = COLORS.BODY_DARK
  if (tuck > 0.5) {
    ctx.beginPath()
    ctx.ellipse(x, y, w * 0.6, h * 0.4, 0, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.beginPath()
    ctx.roundRect(x - w / 2, y, w, h * (1 - tuck * 0.3), 4)
    ctx.fill()
  }
  ctx.restore()
}

/**
 * 身体（小而圆润的糯米团子形，与头部紧凑衔接）
 * 参考图：身体比头部小很多，几乎是头部的底座
 */
function drawBody(ctx: CanvasRenderingContext2D, p: AnimParams): void {
  ctx.save()
  ctx.translate(p.bodyOffsetX, p.bodyOffsetY)
  // 扭腰旋转：以腰部（y=-10）为中心旋转，腰部以下不动
  ctx.translate(0, -10)
  ctx.rotate(p.bodyRotation)
  ctx.translate(0, 10)
  ctx.scale(p.bodyScaleX, p.bodyScaleY)

  // 身体主体 - 矮胖圆润形（比头部小）
  ctx.fillStyle = COLORS.BODY
  ctx.beginPath()
  ctx.ellipse(0, -15, 26, 18, 0, 0, Math.PI * 2)
  ctx.fill()

  // 腹部浅色（偏下前方）
  ctx.fillStyle = COLORS.BELLY
  ctx.beginPath()
  ctx.ellipse(3, -12, 18, 12, 0, 0, Math.PI * 2)
  ctx.fill()

  // 身体高光（左上方，制造圆润感）
  ctx.fillStyle = COLORS.BODY_LIGHT
  ctx.globalAlpha = 0.35
  ctx.beginPath()
  ctx.ellipse(-7, -22, 10, 5, -0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  // 身体底部深色阴影（衔接腿部）
  ctx.fillStyle = COLORS.BODY_DARK
  ctx.globalAlpha = 0.12
  ctx.beginPath()
  ctx.ellipse(0, -3, 22, 5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  ctx.restore()
}

/**
 * 头部（超大球体，占整体 60%）
 * 参考图：头部几乎是完美球形，远大于身体
 */
function drawHead(ctx: CanvasRenderingContext2D, p: AnimParams): void {
  ctx.save()
  ctx.translate(p.headOffsetX, p.headOffsetY + p.bodyOffsetY * 0.3)

  // 头部主体 - 超大圆球
  ctx.fillStyle = COLORS.BODY
  ctx.beginPath()
  ctx.arc(0, -52, 42, 0, Math.PI * 2)
  ctx.fill()

  // 头部高光（左上方，大范围柔光）
  ctx.fillStyle = COLORS.BODY_LIGHT
  ctx.globalAlpha = 0.35
  ctx.beginPath()
  ctx.ellipse(-14, -65, 16, 10, -0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  // 头部下方阴影渐变（衔接身体，制造体积感）
  ctx.fillStyle = COLORS.BODY_DARK
  ctx.globalAlpha = 0.12
  ctx.beginPath()
  ctx.ellipse(0, -22, 32, 7, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  ctx.restore()
}

/**
 * 耳朵（小圆耳，位于头顶两侧）
 * 参考图：耳朵非常小，几乎是头顶的小凸起
 */
function drawEars(ctx: CanvasRenderingContext2D, p: AnimParams): void {
  ctx.save()
  ctx.translate(p.headOffsetX, p.headOffsetY + p.bodyOffsetY * 0.3)

  // 左耳 - 小圆凸
  ctx.fillStyle = COLORS.BODY_DARK
  ctx.beginPath()
  ctx.arc(-30, -80, 5, 0, Math.PI * 2)
  ctx.fill()
  // 左耳内侧
  ctx.fillStyle = COLORS.SNOUT
  ctx.globalAlpha = 0.5
  ctx.beginPath()
  ctx.arc(-30, -80, 2.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  // 右耳 - 小圆凸
  ctx.fillStyle = COLORS.BODY_DARK
  ctx.beginPath()
  ctx.arc(30, -80, 5, 0, Math.PI * 2)
  ctx.fill()
  // 右耳内侧
  ctx.fillStyle = COLORS.SNOUT
  ctx.globalAlpha = 0.5
  ctx.beginPath()
  ctx.arc(30, -80, 2.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  ctx.restore()
}

/** 头顶橘子（标志性元素） */
function drawTangerine(ctx: CanvasRenderingContext2D, p: AnimParams): void {
  // 吃橘子动画状态判定
  if (eatingActive) {
    if (eatingProgress < 0.30) {
      // 阶段1: 橘子从头顶飞到嘴边（抛物线轨迹）
      const t = eatingProgress / 0.30  // 0→1
      // 起点 (0, -94)，终点嘴边 (14, -33)
      const startX = 0, startY = -94
      const endX = 14, endY = -33
      // 线性插值位置
      const x = startX + (endX - startX) * t
      const y = startY + (endY - startY) * t
      // 抛物线弧度（向上拱起再落下）
      const arc = -Math.sin(t * Math.PI) * 15
      drawTangerineAt(ctx, p, x, y + arc, 1, 1)
      return
    } else if (eatingProgress < 0.85) {
      // 阶段2: 咀嚼阶段 — 橘子在嘴的位置，逐渐变小
      const t = (eatingProgress - 0.30) / 0.55  // 0→1
      // 橘子在嘴的位置，随咀嚼逐渐缩小
      const scale = 1 - t * 0.6  // 从 1 缩小到 0.4
      // 咀嚼时橘子轻微抖动
      const wobble = Math.sin(eatingProgress * 40) * 0.5
      drawTangerineAt(ctx, p, 14 + wobble, -33, 1, scale)
      return
    } else {
      // 阶段3: 橘子重新长回头顶（淡入）
      const t = (eatingProgress - 0.85) / 0.15  // 0→1
      drawTangerineAt(ctx, p, 0, -94, t, 1)
      return
    }
  }

  drawTangerineAt(ctx, p, 0, -94, 1, 1)
}

/** 在指定位置绘制橘子（alpha 控制淡入淡出，scale 控制大小） */
function drawTangerineAt(ctx: CanvasRenderingContext2D, p: AnimParams, x: number, y: number, alpha: number, scale: number): void {
  ctx.save()
  const bob = tangerineBounceOverride !== null ? tangerineBounceOverride : p.tangerineBob
  ctx.translate(p.headOffsetX + x, p.headOffsetY + p.bodyOffsetY * 0.3 + y + bob)
  ctx.scale(scale, scale)
  ctx.globalAlpha = alpha

  // 橘子主体
  ctx.fillStyle = COLORS.TANGERINE
  ctx.beginPath()
  ctx.arc(0, 0, 7.5, 0, Math.PI * 2)
  ctx.fill()

  // 橘子深色底部
  ctx.fillStyle = COLORS.TANGERINE_DARK
  ctx.globalAlpha = 0.3 * alpha
  ctx.beginPath()
  ctx.ellipse(0, 3, 5.5, 2.5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = alpha

  // 橘子高光
  ctx.fillStyle = COLORS.SNOUT_LIGHT
  ctx.globalAlpha = 0.4 * alpha
  ctx.beginPath()
  ctx.arc(-2.5, -3, 2.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = alpha

  // 果蒂
  ctx.fillStyle = COLORS.TANGERINE_DARK
  ctx.beginPath()
  ctx.arc(0, -7, 1.2, 0, Math.PI * 2)
  ctx.fill()

  // 叶子（两片）
  ctx.fillStyle = COLORS.LEAF
  ctx.beginPath()
  ctx.ellipse(3, -8, 3.5, 2, Math.PI / 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(-3, -8, 3.5, 2, -Math.PI / 4, 0, Math.PI * 2)
  ctx.fill()
  // 叶脉
  ctx.fillStyle = COLORS.LEAF_DARK
  ctx.globalAlpha = 0.3 * alpha
  ctx.beginPath()
  ctx.ellipse(3, -8, 1.5, 0.8, Math.PI / 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(-3, -8, 1.5, 0.8, -Math.PI / 4, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

/**
 * 大吻部（水豚标志性特征：宽大突出的圆球状吻部）
 * 参考图：吻部极大，占据面部下方 60%，橙琥珀色渐变
 */
function drawSnout(ctx: CanvasRenderingContext2D, p: AnimParams): void {
  ctx.save()
  ctx.translate(p.headOffsetX, p.headOffsetY + p.bodyOffsetY * 0.3)

  // 吻部主体 - 宽大椭圆，向前突出
  ctx.fillStyle = COLORS.SNOUT
  ctx.beginPath()
  ctx.ellipse(14, -38, 24, 17, 0, 0, Math.PI * 2)
  ctx.fill()

  // 吻部高光（上方偏亮，制造圆润感）
  ctx.fillStyle = COLORS.SNOUT_LIGHT
  ctx.globalAlpha = 0.3
  ctx.beginPath()
  ctx.ellipse(12, -44, 18, 8, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  // 吻部下半（更深色，制造体积感）
  ctx.fillStyle = COLORS.SNOUT_DARK
  ctx.globalAlpha = 0.25
  ctx.beginPath()
  ctx.ellipse(14, -33, 20, 9, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  // 鼻子（位于吻部前上方）
  ctx.fillStyle = COLORS.NOSE
  ctx.beginPath()
  ctx.ellipse(26, -45, 4, 3, 0, 0, Math.PI * 2)
  ctx.fill()

  // 鼻子高光
  ctx.fillStyle = COLORS.EYE_WHITE
  ctx.globalAlpha = 0.4
  ctx.beginPath()
  ctx.arc(25, -46, 1, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  ctx.restore()
}

/** 脸部（眼睛、嘴巴） */
function drawFace(ctx: CanvasRenderingContext2D, p: AnimParams, _state: PetState): void {
  ctx.save()
  ctx.translate(p.headOffsetX, p.headOffsetY + p.bodyOffsetY * 0.3)

  drawEyes(ctx, p)
  drawMouth(ctx, p)

  // 睡觉时的口水 — 随睡眠时间慢慢变长，30秒后落地
  if (p.droolVisible) {
    const progress = droolProgressOverride
    if (progress > 0.01) {
      const mouthX = 20
      const mouthY = -30
      const groundY = 2      // 脚下地面
      const totalLen = groundY - mouthY  // 约 32px
      const len = totalLen * progress
      const tipY = mouthY + len

      // 轻微摇摆，增加可爱感
      const wobble = Math.sin(Date.now() * 0.003) * 1.5 * progress
      const midY = (mouthY + tipY) / 2
      const midX = mouthX + wobble

      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'
      // 口水线条（从嘴边向下延伸，中间有摇摆）
      ctx.beginPath()
      ctx.moveTo(mouthX - 1.5, mouthY)
      ctx.quadraticCurveTo(midX - 1, midY, midX - wobble * 0.5, tipY)
      ctx.lineTo(midX - wobble * 0.5 + 2, tipY)
      ctx.quadraticCurveTo(midX + 2, midY, mouthX + 1.5, mouthY)
      ctx.closePath()
      ctx.fill()

      // 口水末端的水滴
      ctx.beginPath()
      ctx.ellipse(mouthX + wobble * 0.5, tipY + 2, 2, 2.5 + progress, 0, 0, Math.PI * 2)
      ctx.fill()
    } else {
      // 刚入睡：小口水
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
      ctx.beginPath()
      ctx.ellipse(20, -30, 2, 3, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  ctx.restore()
}

/**
 * 眼睛 - 超大黑色圆眼 + 白色高光
 * 参考图：眼睛很大，纯黑瞳孔，双高光（玻璃感）
 */
function drawEyes(ctx: CanvasRenderingContext2D, p: AnimParams): void {
  // 眼睛位置（头部偏上方，间距宽）
  const eyeY = -60
  const leftEyeX = -15
  const rightEyeX = 15
  // 眼睛半径（参考图中眼睛很大）
  const eyeR = 7.5

  if (p.blink || p.eyeState === 'closed') {
    // 闭眼 - 弧线 ⌒
    ctx.strokeStyle = COLORS.EYE
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(leftEyeX - eyeR, eyeY)
    ctx.quadraticCurveTo(leftEyeX, eyeY + 4, leftEyeX + eyeR, eyeY)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(rightEyeX - eyeR, eyeY)
    ctx.quadraticCurveTo(rightEyeX, eyeY + 4, rightEyeX + eyeR, eyeY)
    ctx.stroke()
  } else if (p.eyeState === 'happy') {
    // 开心眼 ^^
    ctx.strokeStyle = COLORS.EYE
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(leftEyeX - eyeR, eyeY + 2)
    ctx.quadraticCurveTo(leftEyeX, eyeY - 5, leftEyeX + eyeR, eyeY + 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(rightEyeX - eyeR, eyeY + 2)
    ctx.quadraticCurveTo(rightEyeX, eyeY - 5, rightEyeX + eyeR, eyeY + 2)
    ctx.stroke()
  } else if (p.eyeState === 'sleepy') {
    // 睡眼 - 半闭的弧
    ctx.fillStyle = COLORS.EYE
    ctx.beginPath()
    ctx.ellipse(leftEyeX, eyeY + 1, eyeR * 0.8, 2, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(rightEyeX, eyeY + 1, eyeR * 0.8, 2, 0, 0, Math.PI * 2)
    ctx.fill()
    // 上眼睑线
    ctx.strokeStyle = COLORS.EYE
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(leftEyeX - eyeR, eyeY - 1)
    ctx.lineTo(leftEyeX + eyeR, eyeY - 1)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(rightEyeX - eyeR, eyeY - 1)
    ctx.lineTo(rightEyeX + eyeR, eyeY - 1)
    ctx.stroke()
  } else if (p.eyeState === 'wide') {
    // 惊讶大眼 - 更大的圆 + 白底
    ctx.fillStyle = COLORS.EYE_WHITE
    ctx.beginPath()
    ctx.arc(leftEyeX, eyeY, eyeR + 1, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(rightEyeX, eyeY, eyeR + 1, 0, Math.PI * 2)
    ctx.fill()
    // 瞳孔
    ctx.fillStyle = COLORS.EYE
    ctx.beginPath()
    ctx.arc(leftEyeX, eyeY, eyeR - 1, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(rightEyeX, eyeY, eyeR - 1, 0, Math.PI * 2)
    ctx.fill()
    // 高光
    ctx.fillStyle = COLORS.EYE_WHITE
    ctx.beginPath()
    ctx.arc(leftEyeX - 2, eyeY - 2, 1.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(rightEyeX - 2, eyeY - 2, 1.5, 0, Math.PI * 2)
    ctx.fill()
  } else {
    // 正常睁眼 - 超大黑色圆眼
    ctx.fillStyle = COLORS.EYE
    ctx.beginPath()
    ctx.arc(leftEyeX, eyeY, eyeR, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(rightEyeX, eyeY, eyeR, 0, Math.PI * 2)
    ctx.fill()
    // 双高光（玻璃感）- 主高光
    ctx.fillStyle = COLORS.EYE_WHITE
    ctx.beginPath()
    ctx.arc(leftEyeX - 2, eyeY - 2.5, 2.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(rightEyeX - 2, eyeY - 2.5, 2.2, 0, Math.PI * 2)
    ctx.fill()
    // 小高光（下方偏右）
    ctx.beginPath()
    ctx.arc(leftEyeX + 2, eyeY + 2, 0.9, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(rightEyeX + 2, eyeY + 2, 0.9, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** 嘴巴 */
function drawMouth(ctx: CanvasRenderingContext2D, p: AnimParams): void {
  const mouthX = 14
  const mouthY = -33

  if (p.mouthOpen > 0.1) {
    // 张嘴
    ctx.fillStyle = COLORS.MOUTH_INNER
    ctx.beginPath()
    ctx.ellipse(mouthX, mouthY, 5, 3 + p.mouthOpen * 5, 0, 0, Math.PI * 2)
    ctx.fill()
    // 嘴巴轮廓
    ctx.strokeStyle = COLORS.MOUTH
    ctx.lineWidth = 1
    ctx.stroke()
  } else {
    // 微笑/表情弧线
    const curve = p.mouthCurve * 4
    ctx.strokeStyle = COLORS.MOUTH
    ctx.lineWidth = 1.5
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(mouthX - 5, mouthY)
    ctx.quadraticCurveTo(mouthX, mouthY + curve, mouthX + 5, mouthY)
    ctx.stroke()
  }
}

/** 腮红 */
function drawCheeks(ctx: CanvasRenderingContext2D, p: AnimParams): void {
  ctx.save()
  ctx.translate(p.headOffsetX, p.headOffsetY + p.bodyOffsetY * 0.3)

  ctx.fillStyle = COLORS.CHEEK
  ctx.beginPath()
  ctx.arc(-18, -46, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(18, -46, 5, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

/**
 * 蓝色汗液 — 跑动时从头部两侧飞出蓝色汗滴
 * 模拟动漫风格的汗液飞溅效果
 */
function drawSweat(ctx: CanvasRenderingContext2D, frame: number): void {
  ctx.save()

  const t = performance.now() * 0.001

  // 3 颗汗滴，分别从头部左右两侧飞出，循环动画
  for (let i = 0; i < 3; i++) {
    // 每颗汗滴有独立的循环周期（~0.6秒）
    const cycleLen = 0.6
    const offset = i * (cycleLen / 3)
    const cycle = ((t + offset) % cycleLen) / cycleLen  // 0→1

    // 汗滴初始位置（头部两侧上方），随循环向斜上方飞出
    const side = i % 2 === 0 ? -1 : 1  // 左右交替
    const startX = side * 32
    const startY = -70
    // 飞行轨迹：斜上方
    const x = startX + side * cycle * 12
    const y = startY - cycle * 18
    // 透明度：飞出时渐隐
    const alpha = (1 - cycle) * 0.7
    // 大小：微微变小
    const size = 3.5 - cycle * 1

    ctx.globalAlpha = alpha
    ctx.fillStyle = '#42A5F5'  // 蓝色汗液

    // 泪滴形状（上尖下圆）
    ctx.beginPath()
    ctx.moveTo(x, y - size)
    ctx.quadraticCurveTo(x + size * 0.6, y - size * 0.3, x + size * 0.5, y)
    ctx.quadraticCurveTo(x + size * 0.3, y + size * 0.7, x, y + size)
    ctx.quadraticCurveTo(x - size * 0.3, y + size * 0.7, x - size * 0.5, y)
    ctx.quadraticCurveTo(x - size * 0.6, y - size * 0.3, x, y - size)
    ctx.fill()

    // 高光
    ctx.globalAlpha = alpha * 0.5
    ctx.fillStyle = '#90CAF9'
    ctx.beginPath()
    ctx.arc(x - size * 0.2, y - size * 0.2, size * 0.3, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}
