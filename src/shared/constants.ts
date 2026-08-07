/** 窗口尺寸 - 宽度足够容纳扭腰时身体摆动，上方留足空间供橘子颠动 */
export const WINDOW = {
  WIDTH: 120,
  HEIGHT: 144,
} as const

/** 光标轮询间隔（100ms ≈ 10fps，减少 IPC 开销，避免高频消息影响鼠标事件投递） */
export const FOLLOW = {
  POLL_INTERVAL: 100,
} as const

/** 颜色配置 - 水豚噜噜（参考图精确匹配） */
export const COLORS = {
  BODY: '#F5C842',
  BODY_DARK: '#D9A82A',
  BODY_LIGHT: '#FAD876',
  BELLY: '#FFE89C',
  SNOUT: '#F5A623',
  SNOUT_DARK: '#D88A0E',
  SNOUT_LIGHT: '#FFC04D',
  TANGERINE: '#F5A623',
  TANGERINE_DARK: '#D88A0E',
  LEAF: '#4A9D5E',
  LEAF_DARK: '#3A7D4A',
  OUTLINE: '#B8860B',
  CHEEK: 'rgba(255, 150, 130, 0.45)',
  EYE: '#1A1A1A',
  EYE_WHITE: '#FFFFFF',
  NOSE: '#8B5A2B',
  MOUTH: '#8B4513',
  MOUTH_INNER: '#FF6B6B',
} as const
