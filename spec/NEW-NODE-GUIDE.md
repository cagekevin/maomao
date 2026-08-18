# 新建节点完全指南（NEW-NODE-GUIDE）

> **本文档是「新增一个节点」的权威流程，写给所有后续 AI / 开发者。**
> 基于通读现有全部节点（TextNode / PromptNode / DiscountVideoNode / ImageBoxNode / GridSplitNode / GridMergeNode / VideoExtractNode / VideoProcessNode / ImageNode / FaceMosaicNode / PanoramaNode / Director3DNode / GroupNode / ScriptBoxNode）+ 核心 base 能力（NodeShell / useConnectedInputs / hooks / useNodeGeneration）后提炼出的**统一范式**。
>
> 配套：`NODE-DESIGN-SPEC.md`（**节点长什么样**：视觉DNA/板块/设置/操作）、`ARCHITECTURE.md §7`（设计原则）、`BASE-CAPABILITIES.md`（能力清单）、`CODING-STANDARD.md`（规范总纲）、`tailwind.config.js`（样式 token）。

---

## 〇、一句话

> **外壳用 NodeShell，节点只写「业务专属内容」，数据用「useState 存 UI + setNodes 写回 data」，通用能力走单一入口，注册必须 3 处同步。**

参考节点（从简到繁）：`TextNode`（最简）→ `PromptNode` / `DiscountVideoNode`（含生成+参数记忆）→ `GridSplitNode` / `GridMergeNode`（含高度自适应+自定义端口+管线产出）→ `ScriptBoxNode`（复合）。

---

## 一、标准骨架（照抄）

```jsx
// components/XxxNode.jsx
import React, { useState, useRef } from 'react'
import NodeShell from './base/NodeShell.jsx'
import HoverToolbar from './base/HoverToolbar.jsx'
import ExpandablePanel from './base/ExpandablePanel.jsx'
import { useConnectedInputs } from './base/useConnectedInputs.js'
import { useMediaDegrade } from './base/useMediaDegrade.js'
// ...按需 import

export default function XxxNode({ id, data, selected }) {
  const connected = useConnectedInputs(id)          // 上游数据（可选）
  const { isHidden } = useMediaDegrade()             // 性能降级（可选）
  const [expanded, setExpanded] = useState(data.expanded ?? true)
  const [myField, setMyField] = useState(data.myField || '')
  // ...业务 state

  // 写回 data（不可变局部更新）
  const patchData = (patch) =>
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)))

  return (
    <NodeShell
      id={id}
      label={data.label}
      defaultTitle="节点名"
      icon={<Icon size={11} className="text-gray-500" />}
      selected={selected}
      handleVariant="small"
      aspectRatio={aspectRatio}
      defaultHeight={240}
      wrapperRef={wrapperRef}
    >
      <HoverToolbar buttons={toolbarButtons} />                {/* 可选 */}
      <input type="file" ref={fileRef} hidden style={{ display: 'none' }} />
      <div className="relative flex flex-col w-full flex-1 min-h-0">   {/* 主显示框（唯一必须 children） */}
        ...业务内容...
        <ResizeFullscreenHandle targetRef={wrapperRef} onResizeEnd={onMainBoxResize} />  {/* 可选 */}
      </div>
      <ExpandablePanel expanded={expanded} minWidth={420}>...{/* 展开面板 */}</ExpandablePanel>
      <FullscreenModal open={open} onClose={...}>...</FullscreenModal>   {/* 可选 */}
    </NodeShell>
  )
}
```

---

## 二、外壳与样式（最高频）

- **外壳全用 NodeShell**：尺寸/标题/端口/主容器背景/边框/阴影内置，**禁止手写外壳**。
- children 里**不要再写** `bg-surface-raised` / `rounded-xl` / `border` / `shadow`——主容器已提供，重复写会出双重外框、颜色不一致（ARCHITECTURE.md §9.3）。
- 样式全用 token（`bg-surface-1` / `text-body` / `border-edge` / `text-caption`），token 在 `tailwind.config.js`。**禁止**新写裸色值 `bg-[#1c1c1c]` / `text-gray-500` / `text-[10px]` / `z-[9999]`。

---

## 三、尺寸 / 高度 / 端口

### 尺寸
- 根 div 尺寸 = ReactFlow `node.width/height`（NodeShell 用 `useNodeSize` 订阅，非跟随父容器），端口基于中点定位。**别在节点里另写尺寸逻辑。**
- 比例 `aspectRatio` / `sizeMode` / `keepAspect` 由 NodeShell 管，别手写 resize。
- 右下角手柄 `ResizeFullscreenHandle` + `onMainBoxResize`（写 node.width/height）；面板内「部件」只写 `node.data.inputWidth/inputHeight`（见 `hooks.js` 的 `useNodeResize`）。

### 高度自适应（内容撑高超过 node.height 时）
```
用 ResizeObserver 监听主容器 → contentRef.offsetHeight 变化时
useNodeResize(id).onMainBoxResize(w, h) 写回 node.height + updateNodeInternals
```
参考 GridSplitNode / GridMergeNode / ScriptBoxNode 的 `ResizeObserver` effect。简单节点（内容固定）无需。

### 端口
- 默认左右 CustomHandle 已由 NodeShell 渲染。要多端口/指定位置：`CustomHandle`（`handleId` / `top`），**别自创端口样式**。
- 不需要默认端口 → `showHandles={false}`（如 ImageBoxNode 用自定义 in/active 口、GridSplit 用 cell-N 口）。

---

## 四、数据状态（统一范式，别踩坑）

通读全部节点后确认：**不存在"两派"，只有一套统一范式 + 一个特例。**

| 范式 | 做法 | 适用 |
|------|------|------|
| **统一范式（推荐）** | `useState(data.xxx)` 存 UI + `setNodes` 不可变更新写回 data | 几乎所有节点 |
| **data 直读特例** | 直接读 `data.images`，不复制 state | ImageBoxNode（多图容器，数据量大且被连线/剧本盒子频繁读写） |

统一范式的完整循环：
1. **初始化**：`useState(data.xxx)`（读 node.data 初始值）
2. **写回**：`setNodes(ns => ns.map(n => n.id===id ? {...n, data:{...n.data,...patch}} : n))`，非目标节点 `: n` 原样返回
3. **外部同步**：`useEffect` 监听 `data.xxx` 变化 → setState 刷新（GridSplit/GridMerge/DiscountVideo 都这么做）；外部是 Agent 批量写时用 `useSyncNodeData(data, setters)`
4. **参数记忆**（可选）：`useNodePrefs('节点type', { defaults })` 记住上次模型/比例/尺寸，跨节点复用

> ⚠️ 不要把「手写 setNodes」当范式：可抽 `updateData` 帮助函数（如 ImageBoxNode），但不要引入新 state 管理库。

---

## 五、通用能力（单一入口，别各写各的）

见 `docs/CODING-STANDARD.md §一` 完整清单，最常用的：

| 能力 | 唯一入口 |
|------|---------|
| 判断媒体类型 | `base/mediaType.js` |
| URL 归一（/files/ 补全） | `base/imageUrl.js` `toAbsoluteFileUrl` |
| 弹提示 | `base/toastStore.js` `showToast` |
| 落盘 dataURL / 上传文件 | `base/filesApi.js` |
| 图片压缩 | `base/imageCompress.js` |
| 复制/下载 | `base/clipboard.js` |
| 缩略图（多图容器） | `base/LazyImage.jsx` |
| 生成流程 | `base/useNodeGeneration.js` |
| 模型下拉 | `base/ModelSelect.jsx` |
| 提示词输入 | `base/PromptInput.jsx` |
| 生成按钮 | `base/GenerateButton.jsx` |
| 尺寸/点击外部关闭 | `base/hooks.js` `useNodeResize`/`useOutsideClick`/`useSizeSync` |

---

## 六、注册（3 处同步，缺一不可）

新增节点**必须**在以下 3 处登记，漏任何一处都会出问题：

| # | 位置 | 作用 | 漏了会怎样 |
|---|------|------|-----------|
| 1 | `components/base/NodePalette.jsx` `paletteNodes` 加 `{ type, label, icon, cat, component, data, builtin:true }` | 右键菜单/节点面板出现 + **`buildNodeTypeComponents()` 自动派生画布 nodeTypes** | 右键找不到节点 / 画布渲染异常 |
| 2 | **`base/useConnectedInputs.js` `NODE_OUTPUTS` 加一行** | 下游连线拿你的产出 | **下游连了线也拿不到数据** |
| 3 | `docs/BASE-CAPABILITIES.md` 登记新 base 能力 / 数据契约写交接文档 | 沉淀 | 后续 AI 不知道有这能力 |

> **`component` 字段 = 画布渲染组件**（区别于 `icon`=工具栏小图标）。`App.jsx` 不再手写 `nodeTypes` 平行表，直接 `...buildNodeTypeComponents()` 派生（`spec/CONTEXT.md` §一·5.B）。
> **例外**：`director3dNode`（WebGL 无法 SSR，palette 不持 component）与 `ghostTarget`（连线占位）由 `App.jsx` 派生后显式补充，新增此类节点才改 `App.jsx`。

> **第 2 处最容易被忽略**。`useConnectedInputs.js` 的 `NODE_OUTPUTS` 是「下游自动拿上游数据」的管线契约。有产出的节点必须在此声明（如 `imageBoxNode` → `data.images`、`videoExtractNode`/`gridSplitNode` → `data.extractedImages[]`）。数组型产出用 `arrayImages` 归一。不登记 = 下游的参考图/文本永远是空的。

---

## 七、验证门禁

```
npm run test:smoke        # 冒烟质量门（每次改都跑）
npm run test:regression   # 节点注册表 + 脚本盒引擎回归（改了节点跑）
npm run build             # 编译校验 + 回灌 dist/
```

---

## 八、常见坑速查（通读踩出来的）

1. **文本区塌缩**：用 `flex-1`（父已是 flex），**别用 `h-full`**（百分比在 flex 下解析为 auto → 塌缩成一行）。
2. **双重外框**：children 里重复写 `bg-surface-raised`/`border` → 出两个框、颜色不一致。背景只由 NodeShell 主容器提供。
3. **整个 children 标 nodrag**：会盖住可拖区域，只剩标题栏能拖。只给交互控件（按钮/输入/textarea）标 nodrag。
4. **端口错位**：改尺寸后没写回 `node.width/height` + `updateNodeInternals` → 端口基于旧 wrapper 定位跑偏。
5. **下游拿不到数据**：没在 `useConnectedInputs` 的 `NODE_OUTPUTS` 登记产出。
6. **素材区显示假示例**：参考图必须用 `useConnectedInputs` 的真实上游 + 长度条件判断，空则整块不渲染，绝不写死示例图。
7. **TDZ**：`useVideoPoster` 等 hook 必须在相关 state 定义之后调用（DiscountVideoNode 注释有警告）。

---

## 九、判断准则

- 差异是「业务内容」→ 放 children（正常）。
- 差异是「外壳/端口/尺寸行为」→ 优先收敛到 NodeShell，不在节点里特判。
- 确实需要 NodeShell 不提供的通用能力时，才在节点层扩展，并注释原因，避免下一个 AI 以为写错了。
