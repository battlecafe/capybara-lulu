import { screen } from 'electron'
import { getMainWindow } from './window-manager'
import { IPC_CHANNELS } from '../shared/types'
import { FOLLOW } from '../shared/constants'

let intervalId: NodeJS.Timeout | null = null

export function startCursorTracker(): void {
  if (intervalId) return

  intervalId = setInterval(() => {
    const win = getMainWindow()
    if (!win || win.isDestroyed()) return

    const pos = screen.getCursorScreenPoint()
    win.webContents.send(IPC_CHANNELS.CURSOR_POS, { x: pos.x, y: pos.y })
  }, FOLLOW.POLL_INTERVAL)
}

export function stopCursorTracker(): void {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
}
