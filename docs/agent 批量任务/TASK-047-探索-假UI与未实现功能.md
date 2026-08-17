# TASK-047 — 探索：假 UI / 未实现功能 / 占位实现

> 只允许写本文件，碰任何其他文件视为失败。本任务只探索 `src/` + 产出本文档，禁止改代码、禁止写脚本。

## ⚠️ 铁律
1. 只读不改，禁止写脚本。
2. 自包含，不查看其他 TASK-*。
3. 一切结论必须有代码证据（文件 + 行号 + 片段），行号由本人亲自打开核实。

## 一、背景
项目里可能存在"看起来能用、实际没实现"的假 UI：有控件但点了没反应、disabled、空函数、占位 `return null`、"待实现"注释、或功能只做了 UI 没接逻辑。本任务：**亲自去 `src/` 探索，找出所有这类"该实现却没实现 / 假 UI / 占位"的缺口**。

## 二、判断标准
- 有可见交互控件（按钮/开关/选项/输入），但点击后无实际功能 / 空实现 / 永远 disabled。
- 有 UI 展示但对应业务逻辑缺失（只渲染不工作）。
- 注释/命名暗示"待实现/占位/以后再说"。
- 功能有雏形但链路断了（UI 调了接口，接口是 stub/空返回 / 数据不回流）。

## 三、怎么做（实际执行）
1. 通读 `src/components/` 下各节点组件与面板组件，逐一核实每个交互控件是否真的生效。
2. 看 `src/components/base/settings/sections/*`（设置面板）、`TopNav`、`LeftPanel`、`AgentPanel`、`TaskCenter`、`AssetLibrary`、`GeneratedView` 等。
3. grep：`TODO|FIXME|未实现|待实现|占位|return null|disabled|onClick=\{\(\) => \{\}\}`、`未接入|stub|mock|fake|敬请期待`。
4. 补充核对：节点组件 `disabled`/空 handler、设置分区注册表、3D 导演台、`App.jsx` 传给各面板/节点的 props 是否真正接上。
5. 区分：完全无功能 / 部分实现 / disabled 禁用 / 仅展示无逻辑 / 真·空态占位（good UX，不算假 UI）。

## 四、输出规范
表格：`| # | 控件 | 文件:行 | 看起来该干什么 | 实际做什么 | 类型 | 严重度 |`

## 五、验收标准
1. 找出判断为假 UI / 未实现 / 占位的点（宁多勿漏）。
2. 每条带文件:行 + 证据片段。
3. 覆盖节点组件 + 面板 + 设置三类。
4. 只写本文件，不改代码、不写脚本。

---

## 六、探索结论（已核实）

> 只探索 `src/`，未改动任何代码 / 未写脚本。全部结论带文件:行证据。
> **整体结论：绝大多数 UI 都是真实现。** 经全量 grep + 逐文件核实，确凿的"假 UI / 断链"仅 **1 处**（快捷键设置）；另有 **1 处过期注释债务**（CanvasToolbar 误称"占位按钮未传"）、**2 处防御性占位**（正常不可达）、**2 处明确设计取舍**。其余面板 / 节点 / 设置分区均为真实实现。

### 6.1 确凿：设置面板「快捷键设置」是假 UI（断链 + 不持久化）— 严重度 ★★★

| # | 控件 | 文件:行 | 看起来该干什么 | 实际做什么 | 类型 | 严重度 |
|---|------|---------|--------------|-----------|------|--------|
| 1 | 快捷键列表 / 编辑动作 / 编辑组合键 / 删除 / 添加快捷键 | `ShortcutSettings.jsx:11-17,32-68` | 让用户自定义画布快捷键（增删改），改完即对画布生效并持久保存 | 只改组件内 `useState`，**既没持久化，也没回写到画布快捷键逻辑**；刷新/关闭设置即丢失 | 假 UI / 断链 | ★★★ |

**证据链：**

1) 设置页只动本地 state，无保存动作、无写存储：
```11:17:src/components/base/settings/sections/ShortcutSettings.jsx
  const [items, setItems] = React.useState(shortcutData.shortcuts || [])
  const updateKeys = (id, keys) => setItems(...)
  const updateAction = (id, action) => setItems(...)
  const removeItem = (id) => setItems(...)
  const addItem = () => setItems((list) => [...list, {...}])
```
整个文件无任何 `save()` / `localStorage` / `providerStore` 之类的持久化调用；add/edit/delete 全部仅 `setItems`。全仓库 grep `shortcutData|saveShortcut|shortcutStore` 也只在 `ShortcutSettings.jsx` 出现（无持久化实现）。

2) 真·快捷键逻辑是**硬编码**的，根本不读这个设置：
```42:46:src/components/base/useCanvasShortcuts.js
      if (key === 'q') { e.preventDefault(); onAdd?.('textNode'); return }
      if (key === 'w') { e.preventDefault(); onAdd?.('promptNode'); return }
      if (key === 'e') { e.preventDefault(); onAdd?.('discountVideoNode'); return }
```
```66:69:src/components/base/useCanvasShortcuts.js
      if (key === 'a') { e.preventDefault(); onSelectAll?.() }
      else if (key === 'd') { e.preventDefault(); onDuplicate?.() }
      else if (key === 'l') { e.preventDefault(); onArrange?.() }
```
`useCanvasShortcuts.js` 里 Q/W/E、Ctrl+Z/Y、Ctrl+G、Ctrl+Shift+G、Ctrl+A/D/L 全是写死的字符串分支，**从不 import `shortcuts.json`，也不接收任何"用户自定义键位"参数**。因此即便在设置里改成别的键，画布依旧走硬代码。

3) 文件头注释与实现矛盾（"与 useCanvasShortcuts 对齐"是假的）：
```8:8:src/components/base/settings/sections/ShortcutSettings.jsx
 * 数据来自 ../data/shortcuts.json（真实画布快捷键，与 useCanvasShortcuts 对齐）。
```
而 `shortcuts.json`（`settings/data/shortcuts.json:2-11`）只是个静态展示用的 JSON，既不被 `useCanvasShortcuts` 读取，也不被写回。

> 判定：最典型的"假 UI / 占位实现"——**有完整增删改控件、UI 可交互，但既不影响画布也不保存**，对应任务描述中的"功能只做了 UI 没接逻辑 + 链路断"。

### 6.2 过期注释债务（非功能缺口，但会误导，需记录）— 严重度 ★

| # | 位置 | 文件:行 | 说明 |
|---|------|---------|------|
| 2 | CanvasToolbar 调用处注释「占位按钮 onRun/onClearCache 未传」 | `App.jsx:1475` | 该注释已**过时/误导**：`onRun` 按钮在 `CanvasToolbar.jsx:24` 已按需求**主动移除**（非遗漏）；`onClearCache` 实际已在 `App.jsx:1484` 传入 `{handleClearCache}`，并在 `CanvasToolbar.jsx:45,90` 接到 `onClick`。属文档/注释债务，不是假 UI。 |

### 6.3 防御性占位（正常不可达，非真·假 UI）— 严重度 ☆

| # | 控件 | 文件:行 | 说明 |
|---|------|---------|------|
| 3 | 云同步「推送/拉取」未接入提示 | `TopNav.jsx:34,46` | `if (!onPushToCloud) showToast('推送功能未接入')`；但 `App.jsx:1336-1337` 已确实把 `onPushToCloud/onPullFromCloud` 传进 `<TopNav>`（接 `CloudSyncEngine`），正常不会走到该提示。属守卫分支。 |
| 4 | 设置分区 `default` 分支「该设置分区尚未实现」 | `SettingsFrame.jsx:81` | 仅当 `sectionKey` 不在 switch 内才渲染；当前已注册分区为 `api/agent/shortcut`（switch 见 `SettingsFrame.jsx:74,76,78`），均有对应 case，属不可达兜底分支。 |

### 6.4 明确的设计取舍（非缺口）— 严重度 ☆

| # | 位置 | 文件:行 | 说明 |
|---|------|---------|------|
| 5 | 内联大资源转 `/files/` URL | `CanvasToolbar.jsx:23` | 注释明确：原型无后端，改为释放超大内联数据，接真后再转 URL。有意识取舍。 |
| 6 | 幽灵目标节点（透明占位节点） | `GhostTargetNode.jsx:15-34` | 透明 `Handle` 是真功能（解决 React Flow 建 ghost-edge 的 error 008），非假 UI。 |

### 6.5 易误判但确认「真实现」的点（排除法，避免假阳性）

| 疑似点 | 文件:行 | 核查结论 |
|--------|---------|----------|
| 3D 导演台节点 | `Director3DNode.jsx:9,158` / `src/components/director3d/`（46 文件：editor/ 27 ts + 19 tsx） | **真实现**：双击节点 `setOpen(true)`，经 `createPortal` 打开 `Director3DOverlay`（完整模块 `director3d/App.tsx`），退出回写 `directorProject` + 截图落盘 `/files/`。非 stub。 |
| 模板节点 `TemplateNode` | `TemplateNode.jsx:33,238` | **开发者脚手架**（复制它生成新节点），注释"复制本文件为 XxxNode"；其"空态占位（用 token）"是通用空态 UI，非交付给用户的假功能。 |
| PanoramaNode / LazyImage / TopNav 头像 "占位" | `PanoramaNode.jsx:33,264` / `LazyImage.jsx:6` / `TopNav.jsx:23` | 均为**正常的空态/失败兜底/懒加载占位**（good UX），非未实现功能。 |
| `@ 调出素材` | `PromptNode.jsx:234,338,341-351` | **真实现**：`PromptInput` 含 @ 素材弹层，`MaterialStrip` 的 `onInsert={insertMention}`，可插入素材 mention。 |
| ScriptBox 节点 | `scriptBoxEngine.js` | **真实现**：已接真实 `sendToApi`（非 stub）。 |

### 6.6 已核实为"真实现"的面板 / 节点 / 设置（覆盖三类，证明非遍地假 UI）

- **设置（三类全覆盖）**：`ApiSettings`（`providerStore` 持久化增删改 + 测试 + 拉模型）、`AccountsSettings`（含扩展降级逻辑）、`AgentChatSettings`（`agentModelStore` 持久化）、`SkillSettings`、`ModelSection`、`GeneralSettings` —— 均有真实 store / 持久化 / 业务回调。
- **面板**：`LeftPanel`（tab 切换 + 角标）、`TaskCenter`（搜索/过滤/清理均接 `taskStore`）、`AssetLibrary`、`GeneratedView`、`TopNav`（除守卫分支外均接真实回调）、`CanvasToolbar`（各按钮均接 `App` 传入的真实回调、`onClearCache` 已接）。
- **节点**：`PromptNode`(@调素材)、`ScriptBoxNode`(真 API)、`Director3DNode`(真 3D 模块)、`ImageBoxNode`、`PanoramaNode`、`AssetNode` 等 —— 交互全部接 store / 真逻辑；全仓 grep 节点组件 `disabled|placeholder|TODO|stub` 无任何命中。

### 6.7 汇总（按严重度）

| 严重度 | 数量 | 项 |
|--------|------|-----|
| ★★★ 确凿假 UI / 断链 | 1 | `ShortcutSettings`（见 6.1） |
| ★ 过期注释债务（误导） | 1 | `App.jsx:1475` CanvasToolbar 注释误称"未传"（见 6.2） |
| ☆ 防御性占位（不可达） | 2 | TopNav 云同步守卫、SettingsFrame default 兜底（见 6.3） |
| ☆ 设计取舍（非缺口） | 2 | CanvasToolbar 内联资源、GhostTargetNode（见 6.4） |

> 行动建议（不执行，仅记录）：若要让快捷键设置"名副其实"，需 (a) 给 `ShortcutSettings` 加持久化（写 `providerStore`/本地存储），(b) 把 `useCanvasShortcuts` 改为读取该持久化数据并替换硬编码分支；并顺手清理 `App.jsx:1475` 过时注释。
