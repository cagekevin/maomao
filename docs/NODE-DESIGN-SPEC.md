# 节点设计规范（NODE-DESIGN-SPEC）

> **本文档定义「一个节点该长什么样、有哪些板块、设置项怎么给、操作怎么交互」。**
> 目标：**任何新节点做出来都不能偏离画布视觉 DNA**，且板块/设置/操作都有章法，后续 AI 照着就能设计出和现有节点风格一致的节点。
>
> 配套：`NEW-NODE-GUIDE.md`（怎么写代码）、`tailwind.config.js`（token 真相）、`CODING-STANDARD.md`（规范总纲）。

---

## 〇、画布视觉 DNA（所有节点的共同基调）

先记住这套「视觉基因」，任何节点都不许偏离：

| 维度 | 约定 |
|------|------|
| **底色** | 节点主容器 `bg-surface-raised`(#1c1c1c)，内层面板 `bg-surface-1`(#222)，输入 `bg-surface-hover`/`bg-input`(#141414)，内容区深 `bg-canvas`/`bg-surface-muted`(#151515) |
| **文字** | 强 `text-strong`(fff) → 弱 `text-muted`(#888) → 最弱 `text-faint`(#666)；节点 UI 几乎全用小字号（见下） |
| **边框** | 常态 `border-edge`(#333)，hover `border-edge-strong`/`hover:border-edge-muted`，选中 `border-edge-strong` |
| **圆角** | 主容器 `rounded-xl`，卡片/按钮 `rounded-md`/`rounded-lg`，胶囊 `rounded-full` |
| **字号** | 节点 UI 全用 `text-2xs`(8) / `text-meta`(9) / `text-caption`(10) / `text-caption-sm`(11) / `text-body-xs`(12)，大段文字才用 body 级。**禁止** `text-[10px]` 等裸字号 |
| **阴影** | 节点主容器 `shadow-xl`，弹层 `shadow-popover`，选中态可用 `shadow-glow-*` |
| **状态色** | 蓝 `#3b82f6`（主操作/选中/链接）、绿 `#22c55e`（成功）、红 `#ef4444`（危险/删除）、黄 `#eab308`（警告）、紫 `#d946ef`（特殊标记） |
| **z-index** | 一律语义 token（`z-dropdown`/`z-popover`/`z-modal`），禁裸数字 |
| **拖拽** | 节点内容区 `drag-handle cursor-move`，交互控件标 `nodrag` |
| **hover 反馈** | 按钮：`hover:bg-surface-hover` + `hover:text-white` + 边框 `hover:border-edge`；选中项：`bg-surface-hover-strong text-white border-edge-strong` |

> 一句话：**节点是「灰黑卡片 + 小字号 + 语义状态色 + token」的统一体。** 新节点只要不偏离这几点，就和画布融为一体。

---

## 一、板块规划（一个节点有哪些"区"）

所有节点按固定板块组织（不是乱堆 UI）：

```
┌──────────────────────────── NodeShell（统一外壳）─────────────┐
│  NodeTitle 标题 + titleRight（右侧小操作，如模式切换）              │
│  HoverToolbar（hover 顶部胶囊栏：上传/裁剪/下载/…）               │
│  ┌─ 主显示区（flex-1，节点核心内容，必填）────────────────┐      │
│  │  图片/视频/文本/结果 预览（内容居中，性能降级可隐藏）        │      │
│  │  + ResizeFullscreenHandle（可选，右下角改尺寸）           │      │
│  └──────────────────────────────────────────────────────┘      │
│  ExpandablePanel（展开面板，可选，放设置/参数/多步骤）            │
│     ├─ 素材缩略图区（上游连线/上传的真实素材，空则不渲染）         │
│     ├─ 输入区（PromptInput 提示词 / 具体操作项）                │
│     └─ 控制条（参数设置 + 生成/操作按钮）                       │
└─────────────────────────────────────────────────────────────────┘
```

### 各板块职责（写节点先想清楚放哪）

| 板块 | 放什么 | 参考 |
|------|--------|------|
| **titleRight** | 模式切换（切分节点 规则/手动/切刀）、全选/展开（图片盒子） | GridSplit/GridMerge/ImageBox |
| **HoverToolbar** | hover 才显示的一次性操作（上传/裁剪/下载/发送/复制） | 所有节点 |
| **主显示区** | 节点核心产物（生成的图/视频/文本预览）；**必须 flex-1 填满** | PromptNode/ImageNode |
| **ExpandablePanel** | 参数设置、多步骤、不常用的配置（默认收起或展开） | TextNode/PromptNode |
| **控制条** | 生成/操作按钮 + 参数快捷入口（模型/比例/尺寸下拉） | 所有生成节点 |

---

## 二、设置项规范（设置按钮/参数有哪几种形态）

做设置项时，从下面**固定几种形态**里选，不要自创控件样式：

| 形态 | 用法 | 视觉约定 | 参考 |
|------|------|---------|------|
| **分段按钮** | 2~4 个互斥选项（模式/方向） | 每个 `px-2 py-0.5 rounded text-caption border`，选中 `bg-blue-500/15 border-blue-500/60 text-blue-300`，未选 `bg-surface-hover border-edge text-gray-400 hover:text-white` | GridSplit 模式切换 |
| **下拉菜单** | 选项多（比例/分辨率/时长/模型） | 触发按钮 + `absolute bottom-full` 面板 `bg-surface-1 border-edge rounded-lg shadow-xl p-3 z-popover`，选项选中 `bg-surface-hover-strong text-white` | PromptNode 画质菜单 / ModelSelect |
| **数值输入** | 尺寸/数量/阈值 | `w-* bg-surface-hover text-gray-200 rounded px-1.5 py-0.5 border border-edge` | GridSplit 行列 |
| **文本输入** | 单行参数（角标模板/名称） | `flex-1 bg-surface-hover text-gray-300 text-xs rounded px-2 py-1 border border-edge` | GridSplit 角标 |
| **开关/勾选** | 布尔（自动拆分/图片盒子/自适应） | `<input type="checkbox" className="accent-blue-500">` + label | TextNode 自动拆分 |
| **颜色选择** | 背景色/标记色 | `<input type="color">` | GridMerge 背景 |
| **弹层** | 复杂配置（预设库/导入） | `FullscreenModal` 或按钮弹小面板 | PromptLibrary |

> **铁律**：设置项只允许上面 7 种形态，禁止自创（如手写 option 样式、手写开关动画）。新形态要先在规范里登记，不能直接乱写。

---

## 三、具体操作规范（交互怎么设计，含"图片上写文字"例）

> 每个操作都要想清楚三件事：**入口在哪（hover栏/控制条/右键）、交互形态（点/拖/双击/菜单）、结果去哪（本节点覆盖/新建节点/弹层/下载）**。

### 3.1 操作入口约定

| 操作类型 | 入口位置 |
|---------|---------|
| 高频单次（上传/下载/裁剪/复制） | HoverToolbar |
| 低频/需参数（批量、高级） | ExpandablePanel 控制条 |
| 选中后动作（切分/删除） | 节点内容区 / 右键菜单 |

### 3.2 结果去向约定

| 操作结果 | 约定 |
|---------|------|
| 覆盖本节点（如压缩/编辑） | 写回 `node.data`，节点原地更新，**不新建节点** |
| 生成新内容（如切片/合并/抽帧） | **新建 imageNode + 自动连线**（spawn） |
| 需全屏精细操作 | FullscreenModal 弹层 |
| 下载/复制 | 走 `clipboard.js` |

### 3.3 例：图片上写文字（一个完整的操作设计示范）

假设要给图片节点加"在图上写文字"：

**板块规划**：主显示区预览图 + ExpandablePanel 放文字编辑。
**入口**：HoverToolbar 加"文字"按钮 → 打开 FullscreenModal 编辑器。
**设置项**：
- 文字内容（文本输入）
- 位置（下拉：左上/居中/右下… 或 拖拽定位）
- 字号（数值输入）、颜色（颜色选择）、字体（下拉）
- 背景遮罩（开关：无/黑条/白条）

**具体操作流程**：
1. 点 hover"文字"按钮 → FullscreenModal 打开，显示图片 + 文字图层（可拖动/缩放）
2. 面板下方设文字内容 + 样式（按 §二 的 7 种形态）
3. 点"确认" → canvas 把文字合成到图 → 写回 `node.data.imageUrl`（**覆盖本节点**，符合 3.2 第一条）
4. 可再点"导出"走 `clipboard.downloadUrl` 下载，或"重来"清空文字层

> 这套流程完全复用 OverlayEditor 的"图层 + 画布合成 + 导出"模式，不另起炉灶。

### 3.4 通用操作模板（照抄）

- **上传**：隐藏 `<input type=file>` + hover 按钮触发 `fileRef.click()`，读文件后 `updateData`。
- **裁剪/编辑**：FullscreenModal + ImageEditor，保存写回 `data.imageUrl`。
- **生成**：`useNodeGeneration` + `GenerateButton`，成功写回 data + 记忆参数。
- **删除**：hover 垃圾桶按钮，危险红。

---

## 四、验收清单（新节点写完对照）

- [ ] 外壳用 NodeShell，没手写背景/边框/阴影？
- [ ] 样式全用 token（§〇），没裸色值/裸字号/裸 z-index？
- [ ] 板块按 §一 规划（主显示区 flex-1 / 设置进 ExpandablePanel）？
- [ ] 设置项用 §二 的 7 种形态，没自创控件？
- [ ] 操作结果按 §三.2（覆盖 vs 新建 vs 弹层）？
- [ ] 参考图用 `useConnectedInputs` 真实数据，空则不渲染假示例？
- [ ] 4 处注册（NodePalette + nodeTypes + useConnectedInputs.NODE_OUTPUTS + 文档）？
- [ ] `npm run test:smoke` + `test:regression` + `build` 全绿？
