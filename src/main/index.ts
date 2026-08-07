import { app, BrowserWindow, Tray } from 'electron'
import { join } from 'path'
import { createMainWindow, getMainWindow, stopAlwaysOnTopTimer } from './window-manager'
import { registerIpcHandlers } from './ipc-handlers'
import { startCursorTracker, stopCursorTracker } from './cursor-tracker'
import { createTray } from './tray'

let tray: Tray | null = null

app.whenReady().then(() => {
  // 创建主窗口（透明、无边框、置顶）
  createMainWindow()

  // 注册 IPC 处理器
  registerIpcHandlers()

  // 启动光标跟踪
  startCursorTracker()

  // 创建系统托盘
  tray = createTray()

  // macOS: 隐藏 Dock 图标
  if (process.platform === 'darwin') {
    app.dock?.hide()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  stopCursorTracker()
  stopAlwaysOnTopTimer()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  stopCursorTracker()
  stopAlwaysOnTopTimer()
})
