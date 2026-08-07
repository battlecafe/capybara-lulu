import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/types'

const api = {
  /** 设置点击穿透（智能模式：forward=true 仍转发鼠标移动） */
  setIgnoreMouse: (ignore: boolean) =>
    ipcRenderer.send(IPC_CHANNELS.SET_IGNORE_MOUSE, ignore),

  /** 设置窗口位置 */
  setWindowPosition: (x: number, y: number) =>
    ipcRenderer.send(IPC_CHANNELS.SET_WINDOW_POS, { x, y }),

  /** 设置窗口大小 */
  setWindowSize: (width: number, height: number) =>
    ipcRenderer.send(IPC_CHANNELS.SET_WINDOW_SIZE, { width, height }),

  /** 获取光标位置 */
  getCursorPos: (): Promise<{ x: number; y: number }> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_CURSOR_POS),

  /** 获取屏幕边界 */
  getScreenBounds: () =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_SCREEN_BOUNDS),

  /** 获取窗口实际位置（主进程源） */
  getWindowPos: (): Promise<{ x: number; y: number }> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_WINDOW_POS),

  /** 退出应用 */
  quitApp: () => ipcRenderer.send(IPC_CHANNELS.QUIT_APP),

  /** 监听光标位置更新 */
  onCursorPos: (callback: (pos: { x: number; y: number }) => void) =>
    ipcRenderer.on(IPC_CHANNELS.CURSOR_POS, (_event, pos) => callback(pos)),

  /** 弹出右键交互菜单 */
  showContextMenu: () =>
    ipcRenderer.send(IPC_CHANNELS.SHOW_CONTEXT_MENU),

  /** 监听菜单触发的动作 */
  onTriggerAction: (callback: (action: string) => void) =>
    ipcRenderer.on(IPC_CHANNELS.TRIGGER_ACTION, (_event, action) => callback(action)),

  /** 监听禁止走/跑动开关 */
  onToggleNoWalkRun: (callback: (enabled: boolean) => void) =>
    ipcRenderer.on(IPC_CHANNELS.TOGGLE_NO_WALK_RUN, (_event, enabled) => callback(enabled)),
}

export type PetAPI = typeof api

contextBridge.exposeInMainWorld('petAPI', api)
