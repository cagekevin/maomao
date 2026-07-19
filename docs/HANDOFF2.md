# 一毛AI画布 · Handoff

> **默认工作上下文 = V1（原版引擎）。除非用户明确提及 V2，否则所有操作均在 V1 下进行。**

---

## 0. 项目概况

一毛AI画布 Chrome 扩展，基于反编译的原版引擎运行。V2（TypeScript 完全重写）已暂停，代码归档在 `src/v2/`。

**当前运行版本：V1（原版引擎，已深度魔改为本地模式）**

| 版本 | 位置 | 状态 |
|------|------|------|
| **V1** | `src/_engine/` + `src/main.tsx` + `src/background.ts` | ✅ 当前运行，本地模式 |
| **V2** | `src/v2/` | ⏸️ 暂停，代码已归档 |

---

## 1. V1 本地模式改造记录

V1 是反编译后的原版引擎，已完成以下改造：

### 基础改造
- **去登录**：`Oa()` 始终返回本地 token，`Ne`(isLoggedIn) 始终 true
- **地址参数化**：`src/_engine/config.js` 集中管理所有端点地址
- **React 实例统一**：项目 React 19.2.7 + `window.React` 桥接
- **Vite 构建**：替代原版 rolldown 打包，`npm run build` 输出到 `dist/`

### 本地模式 UI 清理（`false &&` 隐藏）

| 隐藏项 | 行号区域 | 原因 |
|--------|---------|------|
| 顶栏"发现新版本"横幅 | `a_` 组件调用 | 官方升级 |
| 设置"版本升级"Tab | `i_` 组件调用 | 官方升级 |
| 设置"内置模型"Tab | 45022 | 依赖官方服务器 |
| 设置"后端接入点"Tab | 45049 | 官方服务器切换 |
| Logo 悬浮"访问官网" | 44207 | 跳转官方 |
| 帮助菜单"使用教程" | 36981 | 链接官方文档 |
| 帮助菜单"提交反馈" | 36998 | 链接飞书官方表单 |
| 资源面板"模板库"按钮 | 37471 | 依赖官方服务器 |
| 应用中心整个面板 | 44960 | 官方应用商店 |
| 发布/分享应用对话框 | 44554/44563/44567 | 依赖官方服务器 |
| 头像菜单：余额 | 44328 | 官方账户 |
| 头像菜单：会员信息+充值 | 44432 | 官方付费 |
| 头像菜单：修改密码 | 44480 | 官方账户 |
| 多开 Tab B站视频教程 | 44680 | 教多账号登录 |
| 预设提示词"升级会员"提示 | 45137 | 会员限制 |
| AI 应用 VIP 检查 | 15218 | 会员限制 |

### 功能改造

| 改动 | 说明 |
|------|------|
| **GAS 云端同步** | 头像菜单"推送到云端/从云端拉取"改走 Google Apps Script（`CloudSyncEngine`） |
| **头像按钮** | 红色"未登录" → 固定灰色头像，hover 弹菜单 |
| **菜单昵称** | "一毛用户" → "本地模式"，副标题"数据存储在本地" |
| **"退出登录"** → "重置配置" | 清本地数据 |
| **预设提示词** | 去掉会员数量上限，"添加"按钮永远可用 |
| **AI 应用提示** | "请先登录" → "请先在节点中配置 API URL 和 API Key" |
| **登录弹窗** | `false &&` 隐藏（`Oe` 状态） |

### API 调用短路（函数开头直接 return，零逻辑改动）

| 函数 | 行号 | 改动 | 安全依据 |
|------|------|------|----------|
| `er()` | ~42978 | `return null` | 调用方 `n && (...)` 空值保护 |
| `Pa()` | ~3533 | `return []` | 返回标签数组，调用方遍历空数组 |
| `Fa()` | ~3537 | `return []` | 返回提示词数组 |
| `Ia()` | ~3543 | `return []` | 返回收藏列表 |
| `La()` | ~3552 | `return []` | 返回收藏项列表 |
| `Ra()` | ~3561 | `return {ok:false}` | 收藏操作，入口已无数据 |
| `za()` | ~3590 | `return false` | 取消收藏，入口已无数据 |

### 登录阻挡排查（全部已失效）

| 检查点 | 机制 | 状态 |
|--------|------|------|
| `Oa()` (3509) | 始终返回本地 token | ✅ 不阻挡 |
| `Ba()`/`E` (3601/31240) | `!!Oa()` = true | ✅ 不阻挡 |
| `Ne` (state) | 去登录改造后始终 true | ✅ 不阻挡 |
| `ei/ti` 同步 | 已改 GAS，已去登录检查 | ✅ 不阻挡 |

### V1 待做

- **接入用户自己的 AI 网关**（`127.0.0.1:9004`，OpenAI 风格）：原版用私有 `ai-app` 协议，需写适配层改接
- **模板库本地化**（可选）：当前隐藏，可改用 localTool KV 存储模板

---

## 2. V2 进度（暂停中）

> **方法：PRD 5 步法（Strangler 渐进替换，禁止 big-bang 重写）**

| 模块 | 状态 | 说明 |
|------|------|------|
| **0 本地工具服务** | ✅ 完成 | `localTool/`，21 项验收通过 |
| **1 运行时基座** | ✅ 完成 | React 19.2.7 + Vite + 入口接管 |
| **2 API 通信层** | ✅ 完成 | gateway/localTool 双命名空间 |
| **3 状态与上下文层** | ✅ 完成 | Zustand 6 个 store |
| **4 画布与框架层** | ✅ 骨架完成 | AppShell + React Flow + 五 Tab |
| **5 领域组件层** | ⏸️ 结构完成 | 27 节点 1:1 翻译，外部依赖为 TODO stub |
| **删除 _engine/** | ⬜ 最终步骤 | 全部替换完成后删除 |

**恢复 V2 开发时**：
1. `tailwind.config.js` / `postcss.config.js` 从 `src/v2/` 移回根目录
2. `main.tsx` 中 `lazy import _engine` → `import App from './v2/AppShell'`
3. `npm run build` 验证
4. 逐节点验证，实现 TODO stub

---

## 3. 工程结构

```
yimao-clone/
├── index.html / tsconfig.json / vite.config.ts / package.json
├── .gitignore                     # node_modules / dist / .DS_Store / __pycache__ / *.tsbuildinfo / .localTool-uploads
│
├── docs/
│   ├── HANDOFF2.md                # ★ 本文档（唯一 handoff）
│   ├── var-mapping.txt            # App.js 混淆变量 → 可读名称映射（批量替换用）
│   ├── PRD.md / PRD_MODULE4_5.md
│
├── public/
│   ├── manifest.json              # Chrome MV3
│   └── icon*.png / favicon.svg / logo.png / icons.svg
│
├── apimart-gateway/               # AI 网关（Python FastAPI，:9004）
├── localTool/                     # 本地工具服务（:18080，V1/V2 共用）
├── scripts/                       # 构建与分析脚本
│
├── reference/                     # 原版参考（只读）
│   ├── decompiled/                # 反编译源码
│   ├── mediapipe/                 # MediaPipe 模型（~21MB）
│   └── models/                    # 3D 模型
│
├── src/
│   ├── main.tsx                   # V1 入口
│   ├── background.ts              # Service Worker
│   ├── _engine/                   # V1 引擎（当前运行）
│   │   ├── App.js                 # 主程序（本地模式改造）
│   │   ├── config.js              # ★ 集中配置层
│   │   ├── entry.js               # 入口壳（接入点引导）
│   │   └── vendor / runtime / css
│   └── v2/                        # V2 归档
│
└── dist/                          # 构建产物
```

---

## 4. 构建与启动

```bash
npm run build                      # 构建（必须在 Mac 上）
./start-localtool.sh               # 本地工具服务 :18080
cd apimart-gateway && uvicorn main:app --host 127.0.0.1 --port 9004
```

Chrome：`chrome://extensions/` → 开发者模式 → 加载 `dist/`

---

## 5. V1 配置层

`src/_engine/config.js`：
```js
export const LOCAL_ENGINE = { host: '127.0.0.1', port: 18080 };
export const ENDPOINTS = [{ label: 'API网关', url: 'http://127.0.0.1:9004' }];
export const DEFAULT_ENDPOINT = 'http://127.0.0.1:9004';
export const USE_LOCAL_ENGINE = false;
```

**GAS 同步配置**：App.js 中搜索 `在此填入你的_GAS_部署_URL`

---

## 6. 本地工具服务端点（:18080）

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/status` | GET | 状态检查 |
| `/api/kv/get` / `/api/kv/set` | GET/POST | KV 读写 |
| `/api/files/upload` | POST | 文件上传 |
| `/api/files/read` / `/api/files/thumbnail` | GET | 文件读取/缩略图 |
| `/api/files/mkdir` / `/api/files/move` | POST | 目录操作 |
| `/api/files/open` / `/api/files/list` | GET | 打开/列表 |
| `/api/tasks` | GET/POST | 任务 CRUD |
| `/api/resources` | GET/POST | 资源 CRUD |
| `/api/proxy` | POST | 代理 |
| `/api/jianying/send` | POST | 剪映发送 |

---

## 7. 关键决策记录

| # | 决策 | 说明 |
|---|------|------|
| 1 | Strangler 渐进替换 | V2 按模块 0→5 逐步替换 |
| 2 | React 19.2.7 统一 | 消除双实例冲突 |
| 3 | localTool = better-sqlite3 | 替代闭源 Go 二进制 |
| 4 | `false &&` 隐藏策略 | 不删代码，前置 `false &&` 禁用渲染 |
| 5 | GAS 替代官方云同步 | CloudSyncEngine 原样插入 |
| 6 | V1/V2 物理隔离 | V2 在 `src/v2/`，默认工作 V1 |
| 7 | Vite OOM 防护 | `--max-old-space-size=1024` + engine 独立 chunk |
| 8 | `base: './'` | Chrome 扩展必须相对路径 |
| 9 | Ctrl+拖拽框选 | `ctrlHeld` state 监听物理 Ctrl/Meta 键，动态切换 `panOnDrag`/`selectionOnDrag`。keydown 只响应 `e.key === 'Control'/'Meta'`，不吞组合键，不干扰触控板 pinch |
| 10 | 画布 `minZoom: .05` | React Flow 默认 `minZoom=0.5` 导致缩放和 fitView 受限，显式设为 0.05 |
| 11 | `.react-flow__pane { user-select: none }` | 防止 Ctrl+框选时产生蓝色文本选区干扰后续点击。只作用于 pane，不影响节点内文本复制 |
| 12 | 提示词库本地化 | `qa` 弹窗"提示词广场"Tab 在本地模式下 fallback 展示预设提示词（从 `jr` state 读取），隐藏"我的收藏"Tab |
| 13 | GAS URL 配置化 | `CloudSyncEngine.config.gasUrl` 从 `config.js` 的 `GAS_CLOUD_SYNC_URL` 读取，不再硬编码 |

---

## 8. 已知问题 / 提醒

1. **V1 AI 调用仍走原版私有协议**：需写适配层才能接用户网关
2. **构建平台限制**：VM Linux 和 Mac 的 node_modules 不兼容
3. **engine chunk ~2.9MB**：正常（反编译产物），V2 完成后消失
4. **节点模型选择器"内置模型"标签**：有 `length > 0` 条件保护，列表为空时不显示
5. **收藏功能**：资源面板收藏走本地 KV 可用；提示词广场收藏随广场自然失效
6. **var-mapping.txt**：记录了已识别的混淆变量映射，后续可写脚本批量替换