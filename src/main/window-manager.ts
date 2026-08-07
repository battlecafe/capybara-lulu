import { app, BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { WINDOW } from '../shared/constants'
import { showPetContextMenu } from './context-menu'

let mainWindow: BrowserWindow | null = null

// 缓存显示器信息，避免每次拖拽都调用 screen.getDisplayMatching
let cachedWorkArea: Electron.Rectangle | null = null
let lastCacheTime = 0
const CACHE_DURATION = 500 // ms

export function createMainWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: WINDOW.WIDTH,
    height: WINDOW.HEIGHT,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    type: process.platform === 'darwin' ? 'panel' : 'normal',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // 显式设置置顶（screen-saver 级别确保在所有程序之上）
  mainWindow.setAlwaysOnTop(true, 'screen-saver')

  // 窗口重新显示时恢复置顶（hide→show 后 Windows 可能丢失 alwaysOnTop 状态）
  mainWindow.on('show', () => {
    mainWindow?.setAlwaysOnTop(true, 'screen-saver')
  })

  // macOS: 在所有工作空间可见（包括全屏）
  if (process.platform === 'darwin') {
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  }

  // 禁止后台节流（保持动画流畅）
  ;(mainWindow as any).setBackgroundThrottling?.(false)

  // 开发模式加载 dev server，生产模式加载打包文件
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // 右键 → 弹出水豚交互菜单
  mainWindow.webContents.on('context-menu', (event) => {
    event.preventDefault()
    showPetContextMenu(mainWindow)
  })

  return mainWindow
}

/** 停止定时器（当前无定时器，保留接口兼容） */
export function stopAlwaysOnTopTimer(): void {
  // no-op: 当前版本无定时器
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

/**
 * 设置点击穿透 — 智能模式
 * ignore=true: 窗口穿透但转发鼠标移动（forward），让渲染进程能检测鼠标进入宠物区域
 * ignore=false: 窗口不穿透，正常接收所有鼠标事件（点击、右键等）
 */
export function setIgnoreMouseEvents(ignore: boolean): void {
  if (!mainWindow) return
  if (ignore) {
    mainWindow.setIgnoreMouseEvents(true, { forward: true })
  } else {
    mainWindow.setIgnoreMouseEvents(false)
  }
}

/** 设置窗口位置（带缓存优化，减少 screen API 调用） */
export function setWindowPosition(x: number, y: number): void {
  if (!mainWindow) return

  const now = Date.now()
  if (!cachedWorkArea || now - lastCacheTime > CACHE_DURATION) {
    const display = screen.getDisplayMatching({ x, y, width: 1, height: 1 })
    cachedWorkArea = display.workArea
    lastCacheTime = now
  }

  const workArea = cachedWorkArea!
  const clampedX = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - WINDOW.WIDTH))
  const clampedY = Math.max(workArea.y, Math.min(y, workArea.y + workArea.height - WINDOW.HEIGHT))
  mainWindow.setPosition(Math.round(clampedX), Math.round(clampedY), false)
}

/** 设置窗口大小 */
export function setWindowSize(width: number, height: number): void {
  if (!mainWindow) return
  mainWindow.setSize(width, height)
}

/** 获取当前窗口位置 */
export function getWindowPosition(): { x: number; y: number } {
  if (!mainWindow) return { x: 0, y: 0 }
  const [x, y] = mainWindow.getPosition()
  return { x, y }
}
