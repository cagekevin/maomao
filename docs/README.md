# 一毛画布 · React 原型

静态高保真复刻一毛画布节点 + 通用能力地基，用于视觉确认与后续移植到其他 React 项目。当前为可维护工程（`src/`），构建产物为 Chrome 扩展 `dist/`。

## 文档指引（开发前必读）

> **先看这几份再动手，避免重复造轮子：**
> - **`NEW-NODE-GUIDE.md`** ← **新建节点权威流程**：骨架/数据范式/4处注册/管线产出契约/常见坑，建节点前必读
> - **`BASE-CAPABILITIES.md`** ← **能力清单**：`base/` 已建好的通用能力（节点外壳/通知/素材导入/图片编辑/性能降级/**画布统一工具层**等），做新功能直接照用
> - **`ARCHITECTURE.md`** ← **设计规范**：为什么这样设计、新增节点流程、接真系统路径（注意：文档内路径前缀 `prototypes/react-nodes/src/` 为旧写法，实际即根目录 `src/`）
>
> 一句话：**弹提示用 `showToast`、新节点用 `NodeShell`、缩小时藏媒体用 `useMediaDegrade`、拖入素材用 `useAssetDropPaste`、操作画布（供 Agent/自动化）用 `useCanvasAgentTools`**。

## 启动

```bash
npm install
npm run dev     # 自动打开 http://localhost:5180
```

## 画布 AI 助手（演示）

右上角 **AI 助手** 按钮打开右侧聊天面板。说一句话就能驱动画布（创建节点/连线/删除/查看）。

**零配置演示（推荐先试）**：复制 `.env.example` 为 `.env`，确保含 `VITE_AGENT_DEMO=1`，重启 dev——用本地规则引擎模拟 LLM，无需任何 API key：

```
试试说：「帮我生成一张赛博朋克风格的猫咪图」  → 创建生图节点
       「连接 text-1 和 prompt-1」            → 建立连线
       「看看画布有哪些节点」                  → 列出画布
```

**真实 LLM 对话**：去掉 `VITE_AGENT_DEMO`，按 `.env.example` 配 `VITE_LLM_CHAT_BASE_URL`（走 localTool 或直连 OpenAI 兼容端点）。注意端点必须**支持 function calling**（见 `docs/1mao-docs/27-AI操控画布-定稿方案.md` §4：Lovart 网关不支持 tools）。配置详见 `.env.example`。

## 结构

```
src/
  main.jsx                   # 入口
  App.jsx                    # React Flow 画布宿主（暗色点阵背景 #0d0c0c/#333/20px），注册节点 + 通用操作
  index.css                  # Tailwind + custom-scrollbar + cust-handle + cust-edge + 跑马灯样式
  components/
    NodeTitle.jsx            # 节点标题栏
    CustomHandle.jsx         # 自定义连接端口
    TextNode.jsx             # 文本节点
    ImageNode.jsx            # 图片节点
    PromptNode.jsx           # 生图节点
    DiscountVideoNode.jsx    # 特惠视频节点
    VideoExtractNode.jsx     # 视频抽帧节点
    ImageBoxNode.jsx         # 图片盒（多图）
    GridSplitNode.jsx        # 图片切分
    GridMergeNode.jsx        # 图片拼图
    VideoProcessNode.jsx     # 视频处理
    PanoramaNode.jsx         # 全景图
    FaceMosaicNode.jsx       # 人脸打码
    Director3DNode.jsx       # 3D 导演台
    GroupNode.jsx            # 编组
    ScriptBoxNode.jsx        # 剧本盒子（复合节点）
    GhostTargetNode.jsx      # 连线拖出占位节点
    AgentPanel.jsx           # AI 助手面板
    CustomEdge.jsx           # 自定义连线（三层 path + comet + 删除按钮）
    ConnectionLine.jsx       # 拖拽中临时连线
    base/                    # 通用能力地基（NodeShell/CanvasToolbar/useArrangeCanvas/useCanvasAgentTools/Toast/ImageEditor/OverlayEditor/设置面板…）
```

> 新增节点遵循 `BASE-CAPABILITIES.md` 与 `ARCHITECTURE.md` 规范；节点中文名→英文 type 映射见 `node-types-map.md`（由 `npm run sync:mapping` 生成）。

## 复刻范围

- **视觉**：严格复刻原始 Tailwind class（`bg-[#1c1c1c]`、`rounded-xl`、hover 边框、悬浮胶囊操作栏等）。
- **画布**：底色 `#0d0c0c` + 点阵网格 `#333/20px/1px`。
- **交互**：hover 浮层、展开/收起提示词面板、模型/比例/分辨率/时长下拉、文本双击编辑、生成 loading 模拟、特惠视频生成后载入示例视频。
- **连线特效**：选中连线 / 选中关联节点 → 加亮 + 蓝晕 + 彗星流光；拖拽连接时临时连线带流动光点；连接目标节点时旋转跑马灯边框；端口 hover/连接时变大 + 十字 + 跟随鼠标。
- **后端化**：任务中心 / 生成 / 素材走 localTool `/api/resources` 与磁盘一一对应（非 localStorage 假数据）。

## 复刻地基脚本

`scripts/` 下辅助脚本（详见 `scripts/README.md`，以 `docs/TESTING.md` 为测试权威）：

| 脚本 | npm 命令 | 作用 |
| --- | --- | --- |
| `check-jsx.mjs` | `npm run check:jsx` | esbuild 批量校验 `src/components/**/*.jsx` 语法 |
| `extract-tailwind.mjs` | `npm run extract:tw` | 从 `src/` 抽取 Tailwind class 到 `src/index.css` 白名单 |
| `sync-mapping.mjs` | `npm run sync:mapping` | 生成 `node-types-map.md`（节点类型映射） |

> 说明：`extract-tailwind` / `sync-mapping` 现扫描 `src/`（原型源码），不再依赖已移除的 `src/bundle/` 混淆产物。

## 移植到其他 React 项目

节点组件 + 连线特效组件依赖：
- `@xyflow/react`（端口 `CustomHandle` 用 `Handle`，连线用 `getBezierPath`/`EdgeLabelRenderer`）
- `lucide-react`（图标）
- Tailwind CSS

把 `components/` 全部拷走，并带上 `index.css` 里的 `custom-scrollbar`、`cust-handle`、`cust-edge`、`cust-marquee` 样式即可。
