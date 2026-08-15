# 一毛画布 · React 原型

静态高保真复刻一毛画布节点 + 通用能力地基，用于视觉确认与后续移植到其他 React 项目。

## 文档指引（开发前必读）

> **先看这两份再动手，避免重复造轮子：**
> - **`BASE-CAPABILITIES.md`** ← **能力清单**：`base/` 已建好的通用能力（节点外壳/通知/素材导入/图片编辑/性能降级/**画布统一工具层**等），做新功能直接照用
> - **`ARCHITECTURE.md`** ← **设计规范**：为什么这样设计、新增节点流程、接真系统路径
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

**真实 LLM 对话**：去掉 `VITE_AGENT_DEMO`，按 `.env.example` 配 `VITE_LLM_CHAT_BASE_URL`（走 localTool 或直连 OpenAI 兼容端点）。注意端点必须**支持 function calling**（`docs/27 §4`：Lovart 网关不支持 tools）。配置详见 `.env.example`。

## 结构

```
src/
  App.jsx                    # React Flow 画布（暗色点阵背景 #0d0c0c/#333/20px），放置三节点
  index.css                  # Tailwind + custom-scrollbar + cust-handle + cust-edge + 跑马灯样式
  components/
    NodeTitle.jsx            # 节点标题栏（复刻 _Component8）
    CustomHandle.jsx         # 自定义连接端口（复刻 _Component12）
    TextNode.jsx             # 文本节点（复刻 Co.jsx / textNode）
    ImageNode.jsx            # 图片节点（复刻 xi.jsx / imageNode）
    PromptNode.jsx           # 生图节点（复刻 bo.jsx / promptNode）
    DiscountVideoNode.jsx    # 特惠视频节点（复刻 As.jsx / discountVideoNode）
    Comet.jsx                # 彗星流光（复刻 _Component111，16 拖尾点 + 发光头，animateMotion）
    CustomEdge.jsx           # 自定义连线（复刻 Mg.jsx，三层 path + comet + 删除按钮）
    ConnectionLine.jsx       # 拖拽中临时连线（复刻 Pg.jsx，同 comet 视觉）
```

## 复刻范围

- **视觉**：严格复刻原始 Tailwind class（`bg-[#1c1c1c]`、`rounded-xl`、hover 边框、悬浮胶囊操作栏等）。
- **画布**：底色 `#0d0c0c` + 点阵网格 `#333/20px/1px`（复刻 `docs/39` §1 / `H_.jsx:11962,12100`）。
- **交互（静态高保真）**：hover 浮层、展开/收起提示词面板、模型/比例/分辨率/时长下拉、文本双击编辑、生成 loading 模拟、特惠视频生成后载入示例视频。
- **连线特效（复刻 `docs/画布底层交互逆向记录.md` §2/§3/§5）**：
  - 选中连线 / 选中关联节点 → `cust-edge-base` 加亮 + `cust-edge-glow` 蓝晕 + `cust-edge-comet` 彗星流光沿 path 流动（纯 SVG `<animateMotion>`，dur 1.8s）。
  - 拖拽连接时临时连线也带流动光点（`ConnectionLine.jsx`）。
  - 连接目标节点时节点外圈旋转跑马灯边框（`cust-marquee-rotate`）。
  - 端口 hover/连接时「变大 + 十字 + 跟随鼠标」（`cust-handle-*`）。
- **未接**：真实 AI 生成、上传、轮询等后端逻辑（用定时器模拟）。

## 连线联动说明

`App.jsx` 里选中一个节点时，会把它相连的边 `data.relatedToSelected` 置 `true`，从而触发该边 comet 加亮（与真机一致）。拖拽任意节点右端口到另一节点左端口可新建带特效的连线；选中连线中点会出现 `×` 删除按钮。

## 复刻地基脚本

`scripts/` 下三个辅助脚本，减少手工复制混淆源码时的出错：

| 脚本 | npm 命令 | 作用 |
| --- | --- | --- |
| `check-jsx.mjs` | `npm run check:jsx` | esbuild 批量校验 `src/components/**/*.jsx` 语法，防止括号/闭合错误 |
| `extract-tailwind.mjs` | `npm run extract:tw` | 从混淆源码（默认 `src/bundle/httpClient-BknZwXjG_components/`）提取全部 Tailwind class 去重清单，核对 class 不遗漏。可用 `--source=` 指定目录、`--out=` 指定输出 |
| `sync-mapping.mjs` | `npm run sync:mapping` | 解析混淆源码 `shared.js` 的 `O_` 节点类型映射 + `component_map.json`，生成 `node-types-map.md`（节点类型→混淆符号→文件名）与可选 JSON |

生成物：`tailwind-tokens.md`、`node-types-map.md` 为脚本输出，可按需删除重生成。

> 说明：混淆源码 className 均为模板字符串（`className={`...`}`），`extract-tailwind` 已处理 `{` 前缀与 `${}` 表达式占位，只保留纯 Tailwind class token。

## 移植到其他 React 项目

节点组件（`TextNode`/`ImageNode`/`DiscountVideoNode`）+ 连线特效组件依赖：
- `reactflow`（端口 `CustomHandle` 用 `Handle`，连线用 `getBezierPath`/`EdgeLabelRenderer`）
- `lucide-react`（图标）
- Tailwind CSS

把 `components/` 全部拷走，并带上 `index.css` 里的 `custom-scrollbar`、`cust-handle`、`cust-edge`、`cust-marquee` 样式即可。
