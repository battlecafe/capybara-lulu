/** 桌宠所有状态 */
export type PetState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'sleep'
  | 'drag'
  | 'eating'
  | 'yawn'
  | 'hula'
  | 'bath'

/** 朝向 */
export type Facing = 'left' | 'right'

/** 动画定义 */
export interface AnimDef {
  /** 帧数 */
  frames: number
  /** 帧率 */
  fps: number
  /** 是否循环 */
  loop: boolean
  /** 播完后是否锁定（不可被打断） */
  lockUntilDone?: boolean
}

/** IPC 通道名称 */
export const IPC_CHANNELS = {
  CURSOR_POS: 'cursor-pos',
  SET_IGNORE_MOUSE: 'set-ignore-mouse',
  SET_WINDOW_POS: 'set-window-pos',
  SET_WINDOW_SIZE: 'set-window-size',
  GET_CURSOR_POS: 'get-cursor-pos',
  GET_SCREEN_BOUNDS: 'get-screen-bounds',
  GET_WINDOW_POS: 'get-window-pos',
  QUIT_APP: 'quit-app',
  SHOW_CONTEXT_MENU: 'show-context-menu',
  TRIGGER_ACTION: 'trigger-action',
  TOGGLE_NO_WALK_RUN: 'toggle-no-walk-run',
} as const

/** 屏幕边界信息 */
export interface ScreenBounds {
  x: number
  y: number
  width: number
  height: number
  /** 工作区底部（扣除任务栏后的底部 y 坐标） */
  workAreaBottom: number
}

/** 鼠标位置 */
export interface Point {
  x: number
  y: number
}
