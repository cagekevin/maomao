> 本文件是「逆向学习」技能的一个分支指南。**入口与场景分流见技能根目录的 `SKILL.md`**。

# 分支 D · Electron 应用逆向（最小版）

> ⚠️ **来源说明**：本分支只收录**在一个真实项目里实证过的做法**，**未经过多项目实战验证**。带 `[待验证]` 的条目请自行核对后再用。

---

## 适用

目标是 Electron 桌面应用：有 `main.js` + `preload.js`，渲染层是打包后的网页（`index.html` + `assets/*.js`）。

---

## 1. 三层结构（通用认知）

| 层 | 文件 | 作用 |
|---|---|---|
| **main** | `main.js` | 主进程，Node 全权限：窗口、文件、网络、IPC 服务端 |
| **preload** | `preload.js` | 桥：`contextBridge` 把主进程能力暴露成 `window.api` |
| **renderer** | `index.html` + `assets/*.js` | 真正的 UI，通常是被打包混淆的产物 |

---

## 2. 最有用的入口：读 preload 的 IPC 桥 [实证]

`preload.js` 里 `contextBridge.exposeInMainWorld('api', { ... })` 的**每一个方法**，就是渲染层能调用的宿主能力。

**读它 = 一次拿到"这个应用能做什么"的完整清单**，比逐个读渲染层混淆代码高效得多。

| preload 里的调用 | 主进程对应 | 语义 |
|---|---|---|
| `ipcRenderer.invoke(ch, ...)` | `ipcMain.handle(ch, ...)` | 请求-响应（异步，有返回值） |
| `ipcRenderer.send(ch, ...)` | `ipcMain.on(ch, ...)` | 单向发送 |
| `ipcRenderer.sendSync(ch, ...)` | `ipcMain.on` + `event.returnValue` | 同步（阻塞） |
| `ipcRenderer.on(ch, cb)` | `webContents.send(ch, ...)` | 主进程 → 渲染层事件推送（返回取消函数） |

---

## 3. 让渲染层脱离 Electron 跑起来 [实证]

渲染层调用 `window.api.xxx()`，而 `window.api` 由 preload 注入。**在普通浏览器里打开 `index.html` 时它是 `undefined`，渲染层直接崩**。

**项目里的做法**：在 `index.html` 里内联一段 `<script>`，按 preload 的方法清单**注入一个假 api 对象**（每个方法给 mock 返回值），渲染层即可在浏览器里跑起来，便于调试/验证。

> 真实样例：该项目 `index.html` 内联的 `window.api = { ... }` 脚本（逐条 mock 了 preload 的全部方法）。

---

## 4. 对已安装产物原地打补丁 [实证]

不想重打包时，可直接改已安装的产物文件。**项目里的做法**：

1. **自动备份**：`.bak` 已存在则不覆盖（保留最原始版本）
2. **幂等**：`replace` 字符串已在位 → 跳过（防重复跑改坏）
3. **锚点校验**：`anchor` 找不到 → 报错退出（防换版本后改错位置）
4. 全部替换后写回

> 真实样例：该项目 `patch_canvas_interaction.cjs`（改的是压缩产物里的字面量，注意 `true/false` 在压缩后是 `!0/!1`）。

---

## 5. 未覆盖 / 未验证

以下**均未实战验证**，本分支暂不展开，避免误导：

- **asar 打包形态**（该项目的产物是解压目录 `resources/app/`，没遇到 asar）[待验证]
- **主进程 CDP 交互**（注入 / 喂文件 / 拦截响应 / 跨 frame）[待验证]
- **Electron 环境被第三方识别**的问题与排查 [待验证]

---

## 自检

- [ ] 是否读完 `main.js` 入口与 `preload.js` 的完整 api 清单？
- [ ] 渲染层是否能脱离 Electron 跑起来（mock 齐全）？
- [ ] 若做过原地补丁，是否**幂等 + 有备份 + 锚点校验**？
