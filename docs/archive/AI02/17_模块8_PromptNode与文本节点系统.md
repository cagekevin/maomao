# 模块8 · PromptNode @提及与文本节点系统（AI02）

> 四段式审计补充模块。坐实 `we`@L4176 的**真实语义**（`@提及`文本插入，非资源加载），
> 闭合 `01_映射表` 中"推翻 ARCHITECTURE L141 `we=加载资源`"的结论，并展开 PromptNode 下载/文本节点全链路。
> 全部行号经 `grep` 坐实（2026-07-21 快照）。产出仅在 `docs/AI02/`。

---

## 一、`we`@L4176 真实语义：`@提及` 文本插入（已证伪"资源加载"）

| 锚点 | 行号 | 语义 |
|------|------|------|
| `we = (t, n = false) => {...}` | **L4176** | PromptNode 组件内 `@提及` 插入回调 |
| 构造 `@${t} ` 片段 | L4179 | 拼接 `@名字 ` 前缀 |
| textarea 引用 | L4178 `U.current?.textareaRef?.current` | 取 PromptNode 的 textarea DOM |
| 无 textarea 回退 | L4180-4185 | 直接改 state `d(t)` + `a(e,{prompt:t})` |
| 选区插入 | L4187-4192 | 按 `selectionStart/End` 在光标处插入 `@xxx ` |
| 光标复位 | L4196-4199 `setSelectionRange(m,m)` | 插入后把光标移到 `@xxx ` 之后 |

> ✅ **结论坐实**：`we`@L4176 纯粹是往 PromptNode 的 textarea 插入 `@用户名 ` 文本（含光标定位），**与资源加载/落盘完全无关**。原 `ARCHITECTURE.md` L141 把 `we` 写成"加载资源"是**错误**（`01_映射表` 已推翻）。真实"资源加载(rescan+查询)"是 `we`@L43015（资源面板作用域，见 `11_模块2`）。

### 1.1 `we`@L4176 的调用方（@提及列表选中）

- `n && I >= 0` 分支（L4181/L4191）：带 `I`（提及锚点索引）时做定点替换，说明由 @提及 弹层选中触发。
- 配合 L4622 `U.current?.textareaRef?.current` 与 L29877 `document.execCommand('insertText', ...)`（另一处文本插入路径，非 @提及专用）。

---

## 二、PromptNode 下载逻辑（`Te`@L4203，与 `we` 同组件）

| 锚点 | 行号 | 语义 |
|------|------|------|
| `Te = async t => {...}` | L4203 | PromptNode "下载生成结果"处理器 |
| 读原图 `Q.getConfig(_e)` | L4212 | 从配置取 `imageUrlRef` 原图（base64，size>1e4 用原图） |
| `chrome.downloads.download` | L4227 | 插件端走 chrome 下载 API，存 `maomao/generated-*.png` |
| 本地端回退 | L4226+ try/catch | 非插件端走 fetch/blob 下载 |

> `Te` 才是 PromptNode 的"资源导出"动作（下载图片），与 `@提及` `we` 无关。注意命名：`Te`(下载) vs `we`(@提及) 同组件内两回调，职责清晰不混。

---

## 三、文本节点系统（textNode）

| 锚点 | 行号 | 语义 |
|------|------|------|
| 任务拖入建 `textNode` | L36325 `Z('textNode', t, {text:n,...})` | 跨窗口任务（mediaType=text）落文本节点 |
| 文本素材命名 | L4202 `q = e => ... ? '文本${idx+1}' : ...` | PromptNode 内素材列表命名（图片/文本/素材） |
| 文本节点内容提取 | L4143 `String(e.data.text).trim()` | 提取任务结果中的 `text` 字段 |
| 纯文本拖入兜底 | L36399 `e.dataTransfer.getData('text/plain')` | 画布 onDrop 文本兜底建节点 |

> 文本节点数据形态：`{text: string, label: string}`，由 `Z`(节点工厂，见 `16_模块7`) 统一创建。

---

## 四、双重定义陷阱（累计更新）

| 符号 | 误区（旧文档） | 真实（grep 坐实） |
|------|----------------|-------------------|
| `we`@L4176 | "加载资源"（ARCHITECTURE L141，❌） | **PromptNode `@提及` 文本插入** ✅ |
| `we`@L43015 | — | 资源面板 rescan+查询加载（useCallback）✅ |

> 与 `Jn`(L89/L32490)、`Lr`(L1700/L36293)、`Ir`(L1695/L37137) 同源陷阱。引用 `we` 必须带行号+作用域。

---

## 五、边界契约小结（供门4 质询）

1. **@提及边界**：`we`@L4176 仅改 PromptNode 文本 state + textarea 光标，不触资源层；资源加载请查 `we`@L43015 / `Sv`(L42838) / `Ev`(L42883)。
2. **下载边界**：PromptNode 导出走 `Te`@L4203，插件端 `chrome.downloads`、本地端 fetch/blob；非 `we`。
3. **文本节点边界**：由 `Z('textNode',...)`(L36325) 创建，数据 `{text,label}`；与图片/视频/音频节点平级。
4. **误锚闭环**：本模块完整闭合 `01_映射表` 中"`we`@L4176 ≠ 资源加载"的结论，提供函数体级证据（L4176-4201 纯文本操作，零资源调用）。

---

## 六、本模块新增事实

- ✅ 函数体级坐实 `we`@L4176 = `@提及` 文本插入（L4176-4201 全为 textarea 文本/光标操作，无资源 API 调用）。
- ✅ 坐实 PromptNode 下载 `Te`@L4203（chrome.downloads 插件端 + fetch/blob 本地端双路径）。
- ✅ 坐实文本节点由 `Z('textNode',...)`@L36325 创建，数据形态 `{text,label}`。
- ✅ 闭合 `01_映射表` 对 ARCHITECTURE L141 误锚的推翻结论（提供代码级证据）。

> 本文件引用行号均 grep 坐实；门3 机器校验见 `校验报告.md`（引用多为裸行号/局部变量，门4 人工质询保证）。
