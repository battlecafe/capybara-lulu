import { ipcMain, app, screen } from 'electron'
import { IPC_CHANNELS, ScreenBounds } from '../shared/types'
import {
  setIgnoreMouseEvents,
  setWindowPosition,
  setWindowSize,
  getWindowPosition,
  getMainWindow,
} from './window-manager'
import { showPetContextMenu } from './context-menu'

export function registerIpcHandlers(): void {
  // 设置点击穿透（智能模式）
  ipcMain.on(IPC_CHANNELS.SET_IGNORE_MOUSE, (_event, ignore: boolean) => {
    setIgnoreMouseEvents(ignore)
  })

  // 设置窗口位置
  ipcMain.on(IPC_CHANNELS.SET_WINDOW_POS, (_event, { x, y }: { x: number; y: number }) => {
    setWindowPosition(x, y)
  })

  // 设置窗口大小
  ipcMain.on(IPC_CHANNELS.SET_WINDOW_SIZE, (_event, { width, height }: { width: number; height: number }) => {
    setWindowSize(width, height)
  })

  // 获取光标位置
  ipcMain.handle(IPC_CHANNELS.GET_CURSOR_POS, () => {
    const pos = screen.getCursorScreenPoint()
    return { x: pos.x, y: pos.y }
  })

  // 获取屏幕边界
  ipcMain.handle(IPC_CHANNELS.GET_SCREEN_BOUNDS, (): ScreenBounds => {
    const pos = getWindowPosition()
    const display = screen.getDisplayMatching({ x: pos.x, y: pos.y, width: 1, height: 1 })
    const workArea = display.workArea
    return {
      x: workArea.x,
      y: workArea.y,
      width: workArea.width,
      height: workArea.height,
      workAreaBottom: workArea.y + workArea.height,
    }
  })

  // 获取窗口实际位置（渲染进程用于位置同步，纠正坐标不同步）
  ipcMain.handle(IPC_CHANNELS.GET_WINDOW_POS, () => {
    return getWindowPosition()
  })

  // 退出应用
  ipcMain.on(IPC_CHANNELS.QUIT_APP, () => {
    app.quit()
  })

  // 弹出右键交互菜单（渲染进程触发）
  ipcMain.on(IPC_CHANNELS.SHOW_CONTEXT_MENU, () => {
    showPetContextMenu(getMainWindow())
  })
}
