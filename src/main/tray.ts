import { Tray, Menu, nativeImage, app } from 'electron'
import { deflateSync } from 'zlib'
import { getMainWindow } from './window-manager'

let tray: Tray | null = null

/** CRC32 计算（PNG 格式需要） */
function crc32(buf: Buffer): number {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc = crc ^ buf[i]
    for (let j = 0; j < 8; j++) {
      if (crc & 1) crc = (crc >>> 1) ^ 0xedb88320
      else crc = crc >>> 1
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

/** 创建 PNG chunk */
function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcData = Buffer.concat([typeBuf, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(crcData), 0)
  return Buffer.concat([length, typeBuf, data, crc])
}

/** 生成 16x16 橙色圆形 PNG */
function createTrayIcon() {
  const size = 16
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

  const rowSize = size * 4 + 1
  const raw = Buffer.alloc(rowSize * size)
  for (let y = 0; y < size; y++) {
    raw[y * rowSize] = 0
    for (let x = 0; x < size; x++) {
      const idx = y * rowSize + 1 + x * 4
      const dist = Math.sqrt((x - 7.5) ** 2 + (y - 7.5) ** 2)
      if (dist <= 6.5) {
        raw[idx] = 0xf5; raw[idx + 1] = 0xa6; raw[idx + 2] = 0x23; raw[idx + 3] = 0xff
      } else {
        raw[idx + 3] = 0x00
      }
    }
  }

  const compressed = deflateSync(raw)
  const png = Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ])

  return nativeImage.createFromBuffer(png)
}

export function createTray(): Tray | null {
  try {
    tray = new Tray(createTrayIcon())

    const contextMenu = Menu.buildFromTemplate([
      {
        label: '显示水豚噜噜',
        click: () => {
          const win = getMainWindow()
          if (win) { win.show(); win.setAlwaysOnTop(true, 'screen-saver'); win.focus() }
        },
      },
      {
        label: '隐藏',
        click: () => { getMainWindow()?.hide() },
      },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() },
    ])

    tray.setToolTip('水豚噜噜')
    tray.setContextMenu(contextMenu)

    tray.on('click', () => {
      const win = getMainWindow()
      if (win) {
        if (win.isVisible()) win.hide()
        else { win.show(); win.setAlwaysOnTop(true, 'screen-saver') }
      }
    })
  } catch (e) {
    console.error('Failed to create tray:', e)
  }

  return tray
}
