# 已建好的通用能力（base/）— 直接用，别重复造轮子

> **这份文档是「能力清单」**：`src/components/base/` 下已经建好的通用地基。做新节点 / 新功能前先扫一遍，能直接用的就别自己写。
> 每项给「一句话 + 用法 + 复刻源」，照抄即可。
> 配套：`ARCHITECTURE.md`（为什么这样设计的规范）、`README.md`（启动/测试）。

---

## 一、节点外壳与通用控件（做新节点的骨架）

| 能力 | 文件 | 一句话 | 用法 |
|------|------|--------|------|
| **节点外壳** | `NodeShell.jsx` | 所有节点的公共骨架（尺寸/标题/端口/主容器背景/缩放） | 新节点用 `<NodeShell id label defaultTitle icon selected …>{children}</NodeShell>`，别手写外壳 |
| **hover 操作栏** | `HoverToolbar.jsx` | 节点 hover 顶部的胶囊按钮栏 | `<HoverToolbar buttons={[{key,icon,title,onClick,show}]} />` |
| **操作栏按钮** | `ToolbarButton.jsx` | hover 栏单个按钮 | 被 HoverToolbar 使用，一般不用直接 import |
| **生成/停止按钮** | `GenerateButton.jsx` | 底部「生成/停止/刷新」胶囊按钮 | `<GenerateButton loading onGenerate onStop cost />` |
| **模型下拉** | `ModelSelect.jsx` | 模型选择下拉（内置/第三方分组） | `<ModelSelect value onChange models={[{id,label,badge}]} />` |
| **提示词输入** | `PromptInput.jsx` | 提示词 textarea（带 @ 素材联想） | `<PromptInput value onChange />` |
| **展开面板** | `ExpandablePanel.jsx` | 节点展开/收起的内容面板 | `<ExpandablePanel expanded minWidth>{content}</ExpandablePanel>` |
| **全屏弹层** | `FullscreenModal.jsx` | 全屏编辑弹层（Esc/点击空白关闭、可拖改尺寸） | `<FullscreenModal open title onClose>{content}</FullscreenModal>` |
| **拖拽改尺寸手柄** | `ResizeFullscreenHandle.jsx` | 面板右下角拖拽手柄（改输入框/节点尺寸） | `<ResizeFullscreenHandle targetRef onResizeEnd />` |
| **节点尺寸 hook** | `hooks.js` | `useNodeResize` / `useSizeSync` / `useOutsideClick` / `isEditableTarget` | 主框拖拽 / 输入框拖拽 / 点击外部关闭 都从这取 |

> **做新节点的标准动作**：读 `ARCHITECTURE.md §7`（新增节点流程），用 NodeShell + 上面控件组装，别手写外壳/端口/背景。

---

## 二、画布级能力（宿主 App 已接好，扩展直接调）

| 能力 | 文件 | 一句话 | 用法 |
|------|------|--------|------|
| **左下角工具栏** | `CanvasToolbar.jsx` | 运行/整理/小地图/清理/适合视图/性能/缩放% | App 已接入；加按钮在此组件加 |
| **整理画布（dagre 自动排版）** | `useArrangeCanvas.js` | 按连线拓扑自动排列节点（Ctrl+L） | `const { arrange } = useArrangeCanvas(); arrange({nodes,edges,onArrange,onComplete})` |
| **整理确认弹窗** | `ArrangeConfirm.jsx` | 「是否保留整理结果」还原/保留 | App 已接；别处要确认弹窗可直接复用 |
| **性能模式 LOD 降级** | `useMediaDegrade.js` | 缩小时隐藏图片/视频/音频（lodLevel≥2 藏图、≥3 藏视频） | `const { isHidden } = useMediaDegrade(); {!isHidden('image') && <img/>}` |
| **节点按媒体比例自适应** | `useFitNodeRatio.js` | 图片/视频按真实宽高比调节点形状 | `const { fitFromImage, fitFromVideo } = useFitNodeRatio(id)` |
| **视频首帧封面** | `useVideoPoster.js` | 抓视频首帧作封面（未播放时） | `const poster = useVideoPoster(url, enabled)` |
| **媒体类型判断** | `mediaType.js` | 判断 URL/文件的 image/video/audio/text 类型 | `detectMediaType(url)` / `detectFileType(file)` |
| **画布快捷键** | `useCanvasShortcuts.js` | Ctrl+Z/Y/A/D/L、Q/W/E 快速建节点 | App 已接；加快捷键在此扩展 |
| **历史/撤销重做** | `useCanvasHistory.js` | 画布快照撤销栈 | App 已接；记录用 `history.record({nodes,edges})` |
| **右键菜单** | `useContextMenu.js` + `ContextMenu.jsx` | 空白/节点/多选右键菜单 | App 已接；加菜单项在 `menuItems` |
| **LOD 上下文** | `useLod.js` / `LodProvider.jsx` / `LodListener.jsx` | 视口缩放等级 0/1/2/3（性能降级数据源） | 节点用 `useLod().lodLevel` |

---

## 二.5、画布统一工具层（Canvas Agent Tools）★ 为 Agent 铺路

> **给将来「AI 画布助手」（LLM function calling，见 `docs/27` 官方 30 工具）用的统一工具层。**
> 把画布操作（建/删/改节点、连线、查结构、视图）收敛成一份「可被 LLM 调用」的工具清单，不再散落在 App.jsx。

| 能力 | 文件 | 一句话 | 用法 |
|------|------|--------|------|
| **工具层 hook** | `useCanvasAgentTools.js` | 统一画布工具 Map + OpenAI schema | `const { tools, toolSchemas, callTool, execute } = useCanvasAgentTools()` |
| **纯逻辑工厂** | `buildCanvasAgentTools(ctx)` | 脱离 React 构建工具 Map（测试/非 hook 环境用） | `buildCanvasAgentTools(fakeCtx)` |
| **schema 生成** | `buildCanvasAgentToolSchemas()` | OpenAI function calling 格式工具描述数组 | 直接喂 LLM `tools` 字段 |
| **工具名清单** | `CANVAS_AGENT_TOOL_NAMES` | 全部工具名数组 | 枚举/校验 |
| **工具逻辑验证** | `npm run test:tools` | 8 项核心逻辑测试（建/删/改/连线/查询/去重/不可变更新） | `node scripts/test_agent_tools.cjs` |

### 工具清单（当前 17 个）

**只读**：`list_nodes` / `list_edges` / `get_node_details` / `read_canvas`
**修改**：`create_node` / `batch_create_nodes` / `delete_node` / `batch_delete_nodes` / `update_node`（白名单）/ `update_node_raw` / `connect_nodes` / `batch_connect_nodes` / `delete_edge` / `move_node`
**其他**：`trigger_generation`（假实现）/ `fit_view` / `group_nodes`（假实现）

### 使用约定（必读）

- **返回信封**：每个工具 `{ ok, data | error }`，`error` 永远是人话，可直接喂 LLM（对齐官方 `lr()` 返回形状）。
- **写回铁律（原则3）**：所有写操作一律「不可变局部更新」，只改目标节点，非目标节点 `: n` 原样返回，绝不全局造新引用。
- **改节点白名单**：`update_node` 只允许 `prompt/label/selectedModel/aspectRatio/resolution/seconds/text`；要改任意字段才用 `update_node_raw`。
- **新增工具**：在 `useCanvasAgentTools.js` 定义工具对象（name/description/parameters/execute）→ 加入 `AGENT_TOOLS` 数组 → 自动出现在 schema 和 `test:tools` 覆盖范围。**记得加进本清单。**
- **接真系统路径**：当前操作 ReactFlow 内存画布；接真引擎时若 Agent 改走服务端，把 `setNodes/setEdges` 换成调 localTool 状态接口即可，**工具签名与返回信封不变，LLM 侧无感知**。

---

## 二.6、画布 AI 助手面板（AgentPanel）★ 复刻官方 _Component40

> **「说一句话 → 画布实时变化」的聊天面板**，完全复刻官方 `_Component40.jsx`（标题栏/清空/关闭/消息列表/思考中/输入框/模型切换/图片上传/发送/停止/宽度拖拽），并把工具执行接到 §二.5 的工具层。

| 能力 | 文件 | 一句话 | 用法 |
|------|------|--------|------|
| **聊天面板** | `src/components/AgentPanel.jsx` | 复刻官方右侧面板 UI，接入 useAgentChat | `<AgentPanel open onClose agentKey="canvas-assistant" />`（App 已挂，右上角 AI 按钮开关） |
| **对话 hook** | `src/components/base/useAgentChat.js` | 复刻官方 `dr`：消息状态 + SSE 发送 + 多轮工具循环（工具执行接工具层） | `const { messages, sending, send, stop, clear } = useAgentChat({ agentKey })` |
| **消息气泡** | `src/components/AgentMessage.jsx` | 复刻官方 `Cr/Sr/_Component34`：user/assistant/tool 三态 + 思考折叠 + 工具标签 | 被 AgentPanel 使用 |
| **demo 规则引擎** | `useAgentChat.js` 的 `demoPlan` | 本地规则模拟 LLM：识别「创建/连接/删除/查看」意图调工具 | `VITE_AGENT_DEMO=1` 开启，零配置演示 |

### 三种对话模式（useAgentChat 按 env 选择）

| 模式 | 开关 | 行为 |
|------|------|------|
| **Demo（推荐先体验）** | `VITE_AGENT_DEMO=1` | 本地规则引擎模拟 LLM，说一句话→调工具→画布变化，无需 API key |
| **走 localTool** | （默认） | 请求发到 `http://127.0.0.1:18080/api/agent/canvas-assistant/chat`，localTool 转发到支持 function calling 的 LLM（前提：localTool 已配 `LLM_CHAT_BASE_URL`） |
| **直连 OpenAI 兼容** | `VITE_LLM_CHAT_BASE_URL` + `VITE_LLM_CHAT_API_KEY` + `VITE_LLM_CHAT_MODEL` | 直接指到支持 function calling 的端点（魔搭/DeepSeek/OpenAI） |

> 配置见 `prototypes/react-nodes/.env.example`（复制为 `.env` 生效）。

### 复刻要点（对应官方）

- **多轮工具循环**：≤8 轮（`ur=8`，复刻 shared.js:2536），每轮 SSE 解析 `tool_calls` → 调工具层 → 回填 `tool` 结果 → 下一轮。
- **工具执行**：官方 `lr(name,args,canvasHandleRef)` → 本实现 `callTool`（useCanvasAgentTools），**返回信封 `{ok,data|error}` 一致，LLM 侧无感知**。
- **消息契约**：user（含 attachments 图片）/ assistant（content+reasoning+tool_calls+streaming）/ tool（content 为 JSON）三态，与官方一致。
- **视觉模型校验**：发送/上传图片前检查模型是否在视觉集合（`VITE_AGENT_VISION_MODELS` 可扩）。
- **模型下拉**：内置列表（`VITE_AGENT_MODELS` 可覆盖），localStorage 记忆选中模型。

---

## 三、通知系统（统一 toast 地基）★ 打地基的核心

| 能力 | 文件 | 一句话 | 用法 |
|------|------|--------|------|
| **统一通知 store** | `toastStore.js` | 全局 toast 发布订阅 store | `import { showToast } from './base/toastStore.js'` → `showToast('消息', {type:'success'})` |
| **通知渲染容器** | `ToastContainer.jsx` | 顶部居中渲染 toast（状态色模板） | App 根已挂一次，别处**不需要再挂**，直接 showToast 即可 |

### showToast 用法（所有交互提醒统一走这里）
```js
import { showToast } from './components/base/toastStore.js'

showToast('已复制 3 个节点')                       // 默认 info(蓝)
showToast('已导入图片', { type: 'success' })      // 成功(绿)
showToast('生成失败，请重试', { type: 'error' })  // 错误(红)
showToast('额度不足', { type: 'warning' })        // 警告(黄)
showToast('处理中...', { duration: 0 })           // 0 = 不自动消失
```

### 约定（重要）
- **弹任何提示** → `showToast`（全项目统一，别各写各的浮层）
- type 四档对应 doc39 §3.2 状态色模板：success 绿 / error 红 / warning 黄 / info 蓝
- 位置固定在**顶部居中**（右上角/右下角留给未来的任务列表等）
- 接真系统：官方 `onShowToast` 回调直接指向 `showToast` 即可，无需额外封装

---

## 四、素材导入（拖入 / 粘贴）★ 已接好

| 能力 | 文件 | 一句话 | 用法 |
|------|------|--------|------|
| **拖入/粘贴素材** | `useAssetDropPaste.js` | 拖入/粘贴图片/视频/音频/文本建素材节点；粘贴节点组 | `const { onDragOver, onDrop, onPaste } = useAssetDropPaste({ addNode, screenToFlowPosition, onPasteNodeGroup })` |
| **全局粘贴监听** | `useGlobalPaste(onPaste)` | 挂 window paste | App 已接；其它画布要粘贴复用 |

**映射规则（与官方一致）**：图片/视频/音频 → `imageNode`（ImageNode 自动识别类型展示）；文本 → `textNode`；`mutiwindow-images` → 提取帧网格；`mutiwindow-nodes` → 调 `onPasteNodeGroup(json,pos)` 由宿主（App `pasteNodeGroup`）重建节点组。
**注意**：这个 hook 会弹 toast（"已导入图片/视频/文本"），复用即自带反馈。

## 四.1、剪贴板公共工具（复制/下载）★ 统一入口

> **把「复制」能力集中，消除各处重复**。节点复制走 App（含连线），图片/文本/下载走本模块。

| 能力 | 文件 | 一句话 | 用法 |
|------|------|--------|------|
| **复制图片到剪贴板** | `clipboard.js` `copyImageToClipboard(url)` | canvas→PNG 写 `image/png`（对齐官方 Ei），失败退化为复制链接 | `const {ok,msg} = await copyImageToClipboard(url)` |
| **复制文本** | `clipboard.js` `copyText(text)` | clipboard.writeText | `copyText('你好')` |
| **下载文件** | `clipboard.js` `downloadUrl(url,filename)` | fetch blob → a.download | `downloadUrl(resultUrl,'a.png')` |

**已复用**：App「复制图片」（`copyNodeImage`）走 `copyImageToClipboard`。**待迁移**：`ImageBoxNode.copyImage`、各面板 `handleCopy`（复制链接）可逐步迁到本模块消除重复。

## 四.2、画布复制/粘贴节点组 ★ 对齐官方 Ci/xi

> **「复制」= 把选中节点（组）写入系统剪贴板 → 画布 Ctrl+V 重建**（含连线），非原地克隆。对齐官方 `H_.jsx` `Ci`（复制）/`xi`（粘贴）。

| 能力 | 文件 | 一句话 |
|------|------|--------|
| **复制节点组** | `App.jsx` `copySelectedNodes(onlyId?)` | 选中节点序列化 `{type:'mutiwindow-nodes', nodes, edges, originalIds}` → clipboard；右键单节点时只复制它 |
| **粘贴节点组** | `App.jsx` `pasteNodeGroup(json,pos)` | 解析 JSON → 算原组中心 → 以粘贴点为中心重建节点+边，整组选中 |
| **复制节点图片** | `App.jsx` `copyNodeImage(nodeId)` | 图片节点（imageNode/promptNode）右键「复制图片」→ 图片本身进剪贴板（对齐官方 Ei） |

**菜单**：`App.jsx` `nodeMenuItems`（复制 / [复制图片仅图片节点] / 删除）、`selectionMenuItems`（复制 / 删除）。

## 四.3、左侧面板 + 资源系统（任务中心 / 生成 / 素材）★ 后端化，与本地文件一一对应

> **左侧滑出面板**三 tab：任务中心 / 生成 / 素材。**生成**（读 `tasks`）与 **素材**（读 `migrated`+`materials`）都从 localTool `/api/resources` 拉取，与磁盘文件一一对应（rescan 收录），非 localStorage 假数据。两 tab 功能完全一致（拖拽建节点/预览/打开本地/新建文件夹/复制/重命名/删除/无限滚动）。

| 能力 | 文件 | 一句话 |
|------|------|--------|
| **左侧面板** | `LeftPanel.jsx` | 收起态竖条 + 展开面板，三 tab 切换（点空白关闭） |
| **生成视图** | `GeneratedView.jsx` | 读 `tasks` 目录：类型过滤 pill、无限滚动（20/页）、预览、拖拽建节点、⋯菜单（打开本地目录/新建文件夹）、卡片复制/重命名/删除、文件夹进入 |
| **素材视图** | `AssetLibrary.jsx` | 读 `migrated`（全部/人物/场景/道具）+ `materials`：目录 pill、文件夹进入、上传落盘、无限滚动、预览、拖拽、重命名/复制/删除、⋯菜单 |
| **资源 API** | `resourcesApi.js` | `fetchResources`（folder eqOrPrefix）/ `rescanResources` / `deleteResource` / `saveResource` / `renameResource` / `openLocalFolder` / `openFileDir` |
| **任务中心下载** | `TaskCenter.jsx` `downloadResult` | 任务「下载结果」/缩略图下载 → 真实下载（fetch blob→a.download），非占位 toast |

**后端**：`/api/resources`（GET 分页+filter）/ `rescan` / `delete` / `save` / `clear` / `rename`（`localTool/src/routes/resources.ts` + `index.ts`）；`/api/files/open`、`/api/files/open-dir`（打开本地文件夹）。
**说明**：素材上传走 `POST /api/files/upload`（落盘当前目录）→ rescan 收录；重命名走 `/api/resources/rename`（同步改磁盘文件名 + resources 表）。

---

## 五、图片编辑（裁剪/标记/看大图）★ 已接好

| 能力 | 文件 | 一句话 | 用法 |
|------|------|--------|------|
| **全屏图片编辑器** | `ImageEditor.jsx` | 裁剪（react-image-crop）+ 画笔标记 + 撤销/清空/缩放 | `<ImageEditor imageUrl initialTool="crop"|"pencil" onSave onClose />` |

- ImageNode 的「裁剪」「标记」按钮已接入（只对图片显示）
- 图片**双击** = 查看大图（FullscreenModal）
- 接真系统：onSave 里改走「上传 localTool /files/ + 写回 imageUrl」即可

---

## 六、脚本盒子（剧本盒子）引擎

> 见 `ARCHITECTURE.md §七` 和 `SCRIPTBOX-HANDOFF.md`（专属交接文档）。
> `scriptBoxEngine.js` / `useScriptBoxEngine.js` / `useScriptBoxData.js` / `scriptBoxPrompts.js` 已建好。

---

## 七、接入清单速查（新功能先对号入座）

| 你想做什么 | 直接用 | 别自己造 |
|-----------|--------|---------|
| 弹个提示 | `showToast()` | ❌ 自己写浮层 |
| 新节点 | `NodeShell` + 各控件 | ❌ 手写外壳/端口/背景 |
| 节点缩小时隐藏媒体 | `useMediaDegrade()` | ❌ 手写 lodLevel 判断 |
| 图片/视频按比例自适应 | `useFitNodeRatio()` | ❌ 手写 resize 逻辑 |
| 视频封面 | `useVideoPoster()` | ❌ 手写抓帧 |
| 判断文件/URL 类型 | `detectMediaType/FileType` | ❌ 手写正则 |
| 画布支持拖入/粘贴素材 | `useAssetDropPaste()` | ❌ 手写 drop/paste |
| 整理画布 | `useArrangeCanvas()` | ❌ 手写 dagre |
| 裁剪/标记图片 | `<ImageEditor>` | ❌ 手写裁剪 |
| 缩略图替换（接真系统） | 复用 useMediaDegrade + 换 thumbnailUrl | ❌ 重写降级 |

---

## 八、新增能力该放哪（约定）

- **通用、无业务** → `base/`（如 mediaType、toastStore、useFitNodeRatio）
- **画布级交互** → `base/` + App.jsx 接入（如 useAssetDropPaste、CanvasToolbar）
- **某类节点专属** → 放对应节点组件内（如 ImageEditor 归 ImageNode）
- 新 base 能力记得：**加进本清单 + 写注释（为什么这样设计 + 接真系统路径）**，让后面的人能直接照用
