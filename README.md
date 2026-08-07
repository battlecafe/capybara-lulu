# 水豚噜噜 🦫

> 一个用 Electron + React + Canvas 2D 手工绘制的跨平台桌面宠物，灵感来自水豚（Capybara）的慵懒可爱形象。

水豚噜噜会在你的桌面上闲逛、睡觉、扭呼啦圈、吃橘子、泡澡冥想……她头顶永远顶着一颗小橘子，眼睛会跟随你的鼠标转动。

---

## ✨ 功能特性

### 鼠标交互

| 操作 | 效果 | 持续时间 |
|------|------|----------|
| 🖱️ 双击身体 | 吸附拖拽（再次点击释放） | 直到释放 |
| 🍊 点击橘子 | 颠橘子 5 下 | ~2 秒 |
| 🫸 点击头部 | 扭呼啦圈 | 5 秒 |
| 😋 点击嘴部 | 吃橘子 | 3 秒 |
| 🛁 点击肚子/脚 | 泡澡冥想 | 10 秒 |
| 📋 右键 | 打开交互菜单（可点击菜单项触发上述动作） | — |

### 自动行为

噜噜在 **5 秒无操作**后会随机触发以下行为之一（加权概率，打哈欠睡觉概率最大为 25%）：

| 行为 | 概率 | 持续时间 | 说明 |
|------|------|----------|------|
| 🏃 跑动 | 10% | 4 秒 | 奔跑速度移动，跑动时流蓝色汗液，触边后慢速返回原位（返回时无汗） |
| 🫸 扭呼啦圈 | 13% | 5 秒 | 腰部左右扭动 + 呼啦圈旋转 |
| 😋 吃橘子 | 13% | 3 秒 | 橘子从头顶飞到嘴边，咀嚼后重新长出 |
| 🍊 顶橘子 | 13% | 2 秒 | 头顶橘子上下颠动 5 次 |
| 🛁 泡澡冥想 | 13% | 10 秒 | 浴缸泡澡，蒸汽泡泡不断升腾，双眼微闭 |
| 🥱 打哈欠睡觉 | 25% | 30 秒 | 先打哈欠，再入睡，睡觉时流口水逐渐变长 |
| 💕 放粉色爱心 | 13% | 2.5 秒 | 从胸前持续放出粉色爱心 |

> **免打扰模式**：右键菜单可勾选"禁止全屏幕走/跑动（免打扰）"，开启后噜噜仅原地走/跑，不会移动窗口位置。

### 其他特性

- **智能鼠标穿透**：鼠标不在噜噜身上时窗口自动穿透，不影响桌面操作
- **始终置顶**：窗口以 `screen-saver` 级别始终置于所有程序最上方
- **系统托盘**：最小化到托盘，点击托盘图标可显示/隐藏
- **行走回家**：行走/奔跑结束后自动返回最后拖拽放下的位置
- **屏幕边缘转向**：根据当前位置选择行走方向，触边自动返回
- **画布健康检查**：每 15 秒像素级检测画布是否空白，自动恢复上下文

---

## 🛠️ 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Electron | 32.x | 跨平台桌面应用框架 |
| React | 18.x | UI 框架（仅用于 Canvas 容器组件） |
| TypeScript | 5.x | 类型安全 |
| Vite | 5.x | 构建工具 |
| electron-vite | 2.x | Electron + Vite 集成 |
| electron-builder | 25.x | 打包/分发 |
| Canvas 2D API | — | 手工绘制水豚噜噜的所有部位和动画 |

### 核心技术实现

**纯 Canvas 2D 手绘**：水豚噜噜的每个部位（头、身体、腿、耳朵、眼睛、鼻子、嘴、橘子、呼啦圈、浴缸等）全部通过 Canvas 2D API 手工绘制，不使用任何图片资源或 3D 引擎。

**动画系统**：基于帧的状态机驱动，支持 idle / walk / run / sleep / drag / eating / hula / bath / yawn 等 9 种状态，每种状态有独立的动画参数（身体缩放、偏移、旋转、眨眼、嘴巴张合等）。

**智能穿透**：通过 Electron 的 `setIgnoreMouseEvents(true, { forward: true })` 实现窗口穿透同时转发鼠标移动事件，渲染进程根据鼠标坐标判断是否在宠物身上，动态切换穿透状态。

**位置同步**：渲染进程每 500ms 与主进程同步窗口实际位置，纠正多显示器/DPI 缩放导致的坐标不同步，确保交互检测准确。

**画布恢复**：三层防御机制防止长时间运行后画面消失——`contextlost` 事件标记 + 15 秒像素采样检测 + `canvas.width` 强制重置。

---

## 📦 下载使用

### Windows

1. 从 [Releases](../../releases) 下载 `水豚噜噜.exe`（便携版，无需安装）
2. 双击运行即可

或使用启动脚本 `启动水豚噜噜.bat`（自动清理旧进程后启动）。

### macOS

1. 从 [Releases](../../releases) 下载 `水豚噜噜-x64.dmg`（Intel）或 `水豚噜噜-arm64.dmg`（Apple Silicon）
2. 打开 dmg，将水豚噜噜拖入 Applications 文件夹
3. 首次运行可能需要在"系统设置 > 隐私与安全性"中允许运行

---

## 🔨 从源码构建

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装依赖

```bash
cd capybara-lulu
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建 Windows 版本

```bash
npm run build:win
# 产物：dist/水豚噜噜.exe
```

### 构建 macOS 版本

> **注意**：macOS 版本只能在 macOS 系统上构建。

```bash
npm run build:mac
# 产物：dist/水豚噜噜-x64.dmg, dist/水豚噜噜-arm64.dmg
```

### 使用 GitHub Actions 自动构建

项目包含 `.github/workflows/build.yml`，推送到 GitHub 后可自动构建 Windows + macOS 双平台产物。

---

## 📁 项目结构

```
capybara-lulu/
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── index.ts             # 应用入口
│   │   ├── window-manager.ts    # 窗口管理（透明、置顶、穿透）
│   │   ├── context-menu.ts      # 右键交互菜单
│   │   ├── cursor-tracker.ts    # 光标位置跟踪
│   │   ├── ipc-handlers.ts      # IPC 通信处理
│   │   └── tray.ts              # 系统托盘
│   ├── preload/
│   │   └── index.ts             # 预加载脚本（contextBridge）
│   ├── renderer/                # 渲染进程
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   └── PetCanvas.tsx    # Canvas 容器组件
│   │   │   ├── core/
│   │   │   │   ├── render-loop.ts        # 渲染循环主逻辑
│   │   │   │   ├── capybara-renderer.ts  # 水豚绘制器（所有部位）
│   │   │   │   ├── behavior-ai.ts        # 空闲行为AI
│   │   │   │   ├── animation-player.ts   # 动画帧播放器
│   │   │   │   ├── state-machine.ts      # 状态机
│   │   │   │   ├── interaction-detector.ts # 鼠标交互检测
│   │   │   │   ├── physics.ts           # 物理模拟
│   │   │   │   └── window-bridge.ts     # 渲染层API桥接
│   │   │   ├── store/
│   │   │   │   └── pet-store.ts         # Zustand 状态管理
│   │   │   └── main.tsx                  # React 入口
│   │   └── index.html
│   └── shared/
│       ├── constants.ts          # 常量（窗口尺寸、颜色、轮询间隔）
│       └── types.ts              # 共享类型定义
├── resources/
│   ├── icon.ico                 # Windows 图标
│   ├── icon-mac.png             # macOS 高清图标
│   └── icon.png                 # 通用图标
├── .github/workflows/
│   └── build.yml                # GitHub Actions 构建工作流
├── electron-builder.yml         # 打包配置
├── electron.vite.config.ts      # Vite 配置
└── package.json
```

---

## 📄 许可证

[MIT License](./LICENSE)
