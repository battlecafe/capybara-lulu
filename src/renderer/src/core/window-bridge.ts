/** 渲染层调用主进程 API 的桥接层 */

declare global {
  interface Window {
    petAPI: {
      setIgnoreMouse: (ignore: boolean) => void
      setWindowPosition: (x: number, y: number) => void
      setWindowSize: (width: number, height: number) => void
      getCursorPos: () => Promise<{ x: number; y: number }>
      getScreenBounds: () => Promise<{
        x: number
        y: number
        width: number
        height: number
        workAreaBottom: number
      }>
      getWindowPos: () => Promise<{ x: number; y: number }>
      quitApp: () => void
      onCursorPos: (callback: (pos: { x: number; y: number }) => void) => void
      showContextMenu: () => void
      onTriggerAction: (callback: (action: string) => void) => void
      onToggleNoWalkRun: (callback: (enabled: boolean) => void) => void
    }
  }
}

export const windowBridge = {
  /** 设置点击穿透 — 智能模式：true=穿透但转发移动，false=不穿透 */
  setIgnoreMouse: (ignore: boolean) => {
    window.petAPI?.setIgnoreMouse(ignore)
  },

  setWindowPosition: (x: number, y: number) => {
    window.petAPI?.setWindowPosition(x, y)
  },

  setWindowSize: (width: number, height: number) => {
    window.petAPI?.setWindowSize(width, height)
  },

  getCursorPos: () => window.petAPI?.getCursorPos(),

  getScreenBounds: () => window.petAPI?.getScreenBounds(),

  getWindowPos: () => window.petAPI?.getWindowPos(),

  quitApp: () => window.petAPI?.quitApp(),

  onCursorPos: (callback: (pos: { x: number; y: number }) => void) => {
    window.petAPI?.onCursorPos(callback)
  },

  showContextMenu: () => {
    window.petAPI?.showContextMenu()
  },

  onTriggerAction: (callback: (action: string) => void) => {
    window.petAPI?.onTriggerAction(callback)
  },

  onToggleNoWalkRun: (callback: (enabled: boolean) => void) => {
    window.petAPI?.onToggleNoWalkRun(callback)
  },
}
