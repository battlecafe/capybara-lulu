/**
 * 轻量位置容器 — 仅存储水豚位置和地面坐标
 * （物理模拟已移除，仅保留 render-loop 所需的属性）
 */
export class PhysicsBody {
  x = 0
  y = 0
  groundY = 0

  /** 重置位置 */
  reset(x: number, y: number): void {
    this.x = x
    this.y = y
  }
}

/** 全局物理体实例 */
export const physicsBody = new PhysicsBody()
