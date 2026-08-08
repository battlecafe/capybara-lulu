import { Menu, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../shared/types'

/** 禁止跑动状态（模块级，菜单勾选保持） */
let noWalkRunEnabled = false

/**
 * 构建菜单模板 — 交互方式（可点击触发）+ 自动行为说明 + 免打扰 + 隐藏
 */
function buildMenuTemplate(win?: BrowserWindow | null): Electron.MenuItemConstructorOptions[] {
  /** 发送动作到渲染进程 */
  const trigger = (action: string) => {
    win?.webContents.send(IPC_CHANNELS.TRIGGER_ACTION, action)
  }

  return [
    // === 交互方式（可点击触发） ===
    { label: '─── 交互方式 ───', enabled: false },
    { label: '🖱️ 双击身体：拖拽移动', click: () => trigger('drag') },
    { label: '🍊 点击橘子：颠橘子 5 下', click: () => trigger('tangerine') },
    { label: '🫸 点击头部：扭呼啦圈 5 秒', click: () => trigger('hula') },
    { label: '😋 点击嘴部：吃橘子', click: () => trigger('eating') },
    { label: '🛁 点击肚子/脚：泡澡冥想 10 秒', click: () => trigger('bath') },
    // === 自动行为说明 ===
    { type: 'separator' },
    { label: '─── 自动行为 ───', enabled: false },
    { label: '5秒无操作后随机：', enabled: false },
    { label: '🏃 跑动 / 🫸 扭呼啦圈', enabled: false },
    { label: '😋 吃橘子 / 🍊 顶橘子', enabled: false },
    { label: '🛁 泡澡冥想 / 💕 放爱心', enabled: false },
    { label: '🥱 打哈欠睡觉 30秒', enabled: false },
    // === 操作按钮 ===
    { type: 'separator' },
    {
      label: '禁止跑动（免打扰）',
      type: 'checkbox',
      checked: noWalkRunEnabled,
      click: (menuItem) => {
        noWalkRunEnabled = menuItem.checked
        win?.webContents.send(IPC_CHANNELS.TOGGLE_NO_WALK_RUN, noWalkRunEnabled)
        // 确保 checkbox 点击后置顶状态恢复（Windows 上 checkbox 点击可能不触发 popup callback）
        if (win) {
          setTimeout(() => win.setAlwaysOnTop(true, 'screen-saver'), 50)
        }
      },
    },
    { label: '隐藏', click: () => win?.hide() },
  ]
}

let isMenuShowing = false

/**
 * 弹出水豚噜噜右键菜单
 */
export function showPetContextMenu(win?: BrowserWindow | null): void {
  if (isMenuShowing) return
  isMenuShowing = true

  const menu = Menu.buildFromTemplate(buildMenuTemplate(win))

  if (win) {
    win.focus()
  }

  /** 恢复置顶状态 + 重置菜单标志 */
  const restoreAlwaysOnTop = () => {
    if (win) {
      win.setAlwaysOnTop(true, 'screen-saver')
    }
    isMenuShowing = false
  }

  menu.popup({
    callback: () => {
      // 使用 setTimeout 确保菜单完全关闭后再恢复（避免时序竞争）
      setTimeout(restoreAlwaysOnTop, 50)
    },
  })

  // 兜底：如果 callback 未触发（Windows 某些版本上 checkbox 点击后 callback 可能不调用），
  // 3 秒后强制恢复置顶状态
  setTimeout(() => {
    if (isMenuShowing) {
      restoreAlwaysOnTop()
    }
  }, 3000)
}
