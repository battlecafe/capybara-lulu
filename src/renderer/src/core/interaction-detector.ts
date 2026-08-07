import type { Facing } from '@shared/types'
import { WINDOW } from '@shared/constants'

/**
 * 水豚碰撞盒（窗口 120x144）
 * 渲染器 groundY = 144 * 0.82 = 118.08 ≈ 118
 * 坐标基于渲染器实际绘制位置（facing=right 时的坐标）
 * 所有 x 坐标基于 CENTER_X（= WIDTH/2 = 60），窗口宽度变化时自动适配
 *
 * 注意：渲染器在 facing='left' 时使用 ctx.scale(-1,1) 水平翻转，
 * 所以吻部在 left 时实际位于窗口左侧。detectPart / isOverPet
 * 会根据 facing 自动镜像 x 坐标。
 *
 * 头部圆心 (60, 118-52=66)，半径42
 * 肚子椭圆 (60, 118-15=103)，26x18
 * 吻部椭圆 (60+14=74, 118-38=80)，24x17  ← right 时在右侧，left 时镜像到左侧
 * 左耳 (60-30=30, 118-80=38)，渲染半径5→检测放大到10
 * 右耳 (60+30=90, 118-80=38)，渲染半径5→检测放大到10
 * 左脚区域 (47, 123)，12x8（覆盖两条左腿）
 * 右脚区域 (73, 123)，12x8（覆盖两条右腿）
 * 橘子 (60, 21)，14x14（含叶子区域）
 */

/** 窗口中心 X（用于镜像 + 部位定位） */
const CENTER_X = WINDOW.WIDTH / 2

/** 整体碰撞盒 */
const PET_HITBOX = {
  left: 4,
  right: WINDOW.WIDTH - 4,
  top: 0,
  bottom: 133,
}

/** 各部位检测用的精确坐标（基于窗口 120x144，groundY=118，facing=right） */
const PARTS = {
  tangerine: { cx: CENTER_X,       cy: 21,  rx: 14, ry: 14 },
  head:      { cx: CENTER_X,       cy: 66,  rx: 42, ry: 42 },
  belly:     { cx: CENTER_X,       cy: 103, rx: 22, ry: 14 },
  snout:     { cx: CENTER_X + 14,  cy: 80,  rx: 24, ry: 17 },
  earL:      { cx: CENTER_X - 30,  cy: 38,  rx: 10, ry: 10 },
  earR:      { cx: CENTER_X + 30,  cy: 38,  rx: 10, ry: 10 },
  footL:     { cx: CENTER_X - 13,  cy: 123, rx: 12, ry: 8 },
  footR:     { cx: CENTER_X + 13,  cy: 123, rx: 12, ry: 8 },
}

/** 鼠标点击的水豚部位 */
export type PetPart = 'tangerine' | 'head' | 'belly' | 'snout' | 'ear' | 'foot' | 'none'

/**
 * 交互检测器 - 判断鼠标与水豚的关系
 * 自动根据 facing 方向镜像 x 坐标（与渲染器的 ctx.scale(-1,1) 一致）
 */
export class InteractionDetector {
  /**
   * 判断点是否在椭圆内
   */
  private isInEllipse(px: number, py: number, cx: number, cy: number, rx: number, ry: number): boolean {
    const dx = (px - cx) / rx
    const dy = (py - cy) / ry
    return dx * dx + dy * dy <= 1
  }

  /** 根据 facing 镜像 x 坐标（left 时围绕窗口中心翻转） */
  private mirrorX(x: number, facing: Facing): number {
    return facing === 'left' ? CENTER_X * 2 - x : x
  }

  /**
   * 判断屏幕坐标是否在水豚身上
   */
  isOverPet(screenX: number, screenY: number, windowX: number, windowY: number, facing: Facing = 'right'): boolean {
    const localX = screenX - windowX
    const localY = screenY - windowY

    if (
      localX < PET_HITBOX.left ||
      localX > PET_HITBOX.right ||
      localY < PET_HITBOX.top ||
      localY > PET_HITBOX.bottom
    ) {
      return false
    }

    // 镜像 x 坐标以匹配渲染器的翻转
    const mx = this.mirrorX(localX, facing)
    const p = PARTS
    if (this.isInEllipse(mx, localY, p.tangerine.cx, p.tangerine.cy, p.tangerine.rx, p.tangerine.ry)) return true
    if (this.isInEllipse(mx, localY, p.head.cx, p.head.cy, p.head.rx, p.head.ry)) return true
    if (this.isInEllipse(mx, localY, p.belly.cx, p.belly.cy, p.belly.rx, p.belly.ry)) return true
    if (this.isInEllipse(mx, localY, p.snout.cx, p.snout.cy, p.snout.rx, p.snout.ry)) return true
    if (this.isInEllipse(mx, localY, p.earL.cx, p.earL.cy, p.earL.rx, p.earL.ry)) return true
    if (this.isInEllipse(mx, localY, p.earR.cx, p.earR.cy, p.earR.rx, p.earR.ry)) return true
    if (this.isInEllipse(mx, localY, p.footL.cx, p.footL.cy, p.footL.rx, p.footL.ry)) return true
    if (this.isInEllipse(mx, localY, p.footR.cx, p.footR.cy, p.footR.rx, p.footR.ry)) return true

    return false
  }

  /**
   * 检测鼠标点击了水豚的哪个部位
   * 检测顺序：橘子 > 耳朵 > 脚 > 吻部 > 头部 > 肚子（小部件优先）
   */
  detectPart(screenX: number, screenY: number, windowX: number, windowY: number, facing: Facing = 'right'): PetPart {
    const localX = screenX - windowX
    const localY = screenY - windowY

    // 镜像 x 坐标以匹配渲染器的翻转
    const mx = this.mirrorX(localX, facing)
    const p = PARTS

    if (this.isInEllipse(mx, localY, p.tangerine.cx, p.tangerine.cy, p.tangerine.rx, p.tangerine.ry)) {
      console.log('%c[LULU] 📍 部位检测', 'color:#FF69B4;font-weight:bold', `点击=(${localX},${localY}) 镜像=(${mx.toFixed(0)}) facing=${facing} → 橘子`)
      return 'tangerine'
    }
    if (this.isInEllipse(mx, localY, p.earL.cx, p.earL.cy, p.earL.rx, p.earL.ry)) {
      console.log('%c[LULU] 📍 部位检测', 'color:#FF69B4;font-weight:bold', `点击=(${localX},${localY}) 镜像=(${mx.toFixed(0)}) facing=${facing} → 左耳`)
      return 'ear'
    }
    if (this.isInEllipse(mx, localY, p.earR.cx, p.earR.cy, p.earR.rx, p.earR.ry)) {
      console.log('%c[LULU] 📍 部位检测', 'color:#FF69B4;font-weight:bold', `点击=(${localX},${localY}) 镜像=(${mx.toFixed(0)}) facing=${facing} → 右耳`)
      return 'ear'
    }
    if (this.isInEllipse(mx, localY, p.footL.cx, p.footL.cy, p.footL.rx, p.footL.ry)) {
      console.log('%c[LULU] 📍 部位检测', 'color:#FF69B4;font-weight:bold', `点击=(${localX},${localY}) 镜像=(${mx.toFixed(0)}) facing=${facing} → 左脚`)
      return 'foot'
    }
    if (this.isInEllipse(mx, localY, p.footR.cx, p.footR.cy, p.footR.rx, p.footR.ry)) {
      console.log('%c[LULU] 📍 部位检测', 'color:#FF69B4;font-weight:bold', `点击=(${localX},${localY}) 镜像=(${mx.toFixed(0)}) facing=${facing} → 右脚`)
      return 'foot'
    }
    if (this.isInEllipse(mx, localY, p.snout.cx, p.snout.cy, p.snout.rx, p.snout.ry)) {
      console.log('%c[LULU] 📍 部位检测', 'color:#FF69B4;font-weight:bold', `点击=(${localX},${localY}) 镜像=(${mx.toFixed(0)}) facing=${facing} → 吻部`)
      return 'snout'
    }
    if (this.isInEllipse(mx, localY, p.head.cx, p.head.cy, p.head.rx, p.head.ry)) {
      console.log('%c[LULU] 📍 部位检测', 'color:#FF69B4;font-weight:bold', `点击=(${localX},${localY}) 镜像=(${mx.toFixed(0)}) facing=${facing} → 头部`)
      return 'head'
    }
    if (this.isInEllipse(mx, localY, p.belly.cx, p.belly.cy, p.belly.rx, p.belly.ry)) {
      console.log('%c[LULU] 📍 部位检测', 'color:#FF69B4;font-weight:bold', `点击=(${localX},${localY}) 镜像=(${mx.toFixed(0)}) facing=${facing} → 肚子`)
      return 'belly'
    }

    console.log('%c[LULU] 📍 部位检测', 'color:#FF9800;font-weight:bold', `点击=(${localX},${localY}) 镜像=(${mx.toFixed(0)}) facing=${facing} → 未命中`)
    return 'none'
  }
}

/** 全局交互检测实例 */
export const interactionDetector = new InteractionDetector()
