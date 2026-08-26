# 工程规范总纲（CODING-STANDARD）

> **这份文档是「一切规范的总入口」，写给后续所有 AI / 开发者。**
> 目标：让"新增节点 / 新功能 / 改样式"都有迹可循、照着单一规范做，避免同一功能多处不同定义、同一样式多处细微差别。
>
> **先读本页 → 按需跳对应规范 → 动手 → 对照自检清单**。禁止凭记忆/凭感觉写。

---

## 〇、文档地图（先看这里定位）

本项目**不缺乏规范**，缺的是"一个总入口把它们串起来"。规范是分散的，做之前必须对号入座：

| 你想做什么 | 权威文档 | 一句话 |
|-----------|---------|--------|
| 建新节点 / 改节点 | `ARCHITECTURE.md §7`（流程）+ `README.md`（节点规范）+ `node-types-map.md`（type↔组件映射） | 三步注册 + 3 处同步 |
| 复用通用能力（别造轮子） | `BASE-CAPABILITIES.md` | 已建好的 base/ 能力清单，直接照用 |
| 写样式（用 token 不用裸色值） | `tailwind.config.js`（token 定义）+ 本页 §二 | 背景/文字/边框/字号/z-index 全走 token |
| 弹提示 / 判断媒体 / URL 归一 | 本页 §一（单一入口清单）+ `07-Toast分级设计`（分级契约） | 遇到 X 就用 Y，禁止各写各的 |
| 测试 / 验证门禁 | `spec/TESTING.md` | smoke/regression/tools/health 四层 |
| 存储键 / 数据收口 | `docs/08-存储键集中登记与收口规范` | 新增存储键先 `StorageKeys` 登记，禁止散落字面量 |
| 错误降级 / 重试 | `docs/09-节点错误降级与重试收敛策略` | API 失败带 `type`，节点按 `type` 决策，禁 if(/网络错误/) |

> 本页不是替代上面文档，而是**强制它们成为唯一依据**，并把最易犯的错写成禁令。

---

## 〇.5、文档现状（哪些有效，哪些已删）

> 已清理过期文档，当前 docs/ 根目录只剩有效规范。**文档若有更新，直接改文件；本页 §四「已知不一致」是实测得出，改了代码要同步更新。**

| 文档 | 状态 | 说明 |
|------|------|------|
| `CLAUDE.md`（根目录） | ✅ 有效 | 工程现状总纲 |
| `ARCHITECTURE.md` | ✅ 有效 | 设计原则 + 新增节点流程 |
| `BASE-CAPABILITIES.md` | ✅ 有效 | base/ 能力清单 |
| `spec/TESTING.md` | ✅ 有效 | 测试体系权威 |
| `CANVAS_PERFORMANCE.md` | ✅ 有效 | 性能机制对照（含状态标注） |
| `node-types-map.md` | ✅ 有效 | 官方节点↔混淆映射（指向已移除 src/bundle，仅供对照） |
| `README.md` | ✅ 有效 | 结构/启动/复刻范围 |
| `tailwind-tokens.md` | ❌ **已删** | 从旧 `src/bundle`（已删）dump 的 class 频次表，非 token 规范；token 唯一真相 = `tailwind.config.js` |
| `08-存储键集中登记与收口规范` | ✅ 有效 | 存储键 `StorageKeys` 中央登记 + 脏键迁移 + 动态键工厂 |
| `09-节点错误降级与重试收敛策略` | ✅ 有效 | 错误分类 `GenErrorType` + `withRetry` 自动重试 + 文案映射 |
| `07-Toast分级设计-2026-08-17.md` | ✅ 有效 | 通知分级契约（error/warning/success/info 语义 + 默认时长 + 语义函数） |
| `53-错误处理静默与虚假审计-2026-08-26.md` | ✅ 有效 | 静默吞错/虚假报错审计结论与修复（本次 catch 铁律来源） |
| `CODING-STANDARD.md` | ✅ 本页 | 本总纲 |

---

## 一、功能单一入口（最易踩坑，先记牢）

> 原则：**同一个能力只允许一个实现入口**。新增逻辑优先查这里有没有现成入口，有就照用，绝不另起一套正则/工具/浮层。

| 想实现的能力 | 唯一入口 | 用法 | 禁止 |
|------------|---------|------|------|
| 弹提示 | `base/toastStore.js` `showToast` | `showToast('msg',{type})` | ❌ 自己写浮层/alert |
| 判断 URL/File 媒体类型 | `base/mediaType.js` | `detectMediaType(url)` / `detectFileType(file)` / `isAudio(type,url)` | ❌ 手写扩展名正则 / `startsWith('data:')` |
| URL 归一化（相对 `/files/` 补全） | `base/imageUrl.js` `toAbsoluteFileUrl` | `toAbsoluteFileUrl(url)` | ❌ 手写拼接 `http://127.0.0.1:18080` |
| 落盘 dataURL / 上传文件 | `base/filesApi.js` | `saveInlineToLocal(dl,sub)` / `uploadFileToLocal(file,sub)` | ❌ 手写 fetch `/api/files/upload` |
| 图片压缩 | `base/imageCompress.js` `compressImage` | `compressImage(url,{quality,format,maxSize})` | ❌ 每处重写 canvas 压缩 |
| 复制图片/文本/下载 | `base/clipboard.js` | `copyImageToClipboard` / `copyText` / `downloadUrl` | ❌ 各处重复 canvas→剪贴板 |
| 节点外壳 / 端口 / 尺寸 | `base/NodeShell.jsx` + `CustomHandle.jsx` | `<NodeShell …>{children}</NodeShell>` | ❌ 手写外壳/端口/外框 |
| 性能降级隐藏媒体 | `base/useMediaDegrade.js` | `useMediaDegrade().hideMedia` | ❌ 手写 lodLevel 判断 |
| 媒体按比例自适应节点 | `base/useFitNodeRatio.js` | `fitFromImage` / `fitFromVideo` | ❌ 手写 resize |
| 视频首帧封面 | `base/useVideoPoster.js` | `useVideoPoster(url,enabled)` | ❌ 手写抓帧 |
| 拖入/粘贴素材 | `base/useAssetDropPaste.js` | `useAssetDropPaste({addNode,…})` | ❌ 手写 drop/paste |
| 整理画布 | `base/useArrangeCanvas.js` | `useArrangeCanvas().arrange` | ❌ 手写 dagre |
| 画布操作（供 Agent/自动化） | `base/useCanvasAgentTools.js` | 工具 Map + schema | ❌ App.jsx 里散落逻辑 |
| 全屏弹层 | `base/FullscreenModal.jsx` | `<FullscreenModal open onClose>` | ❌ 每处重写全屏遮罩 |
| 新增/删除/改节点写回 | `useReactFlow().setNodes` 不可变局部更新 | 只改目标节点，非目标 `: n` | ❌ 全局造新引用 / 直接改 state |
| 存取本地/会话数据 | `base/storageKeys.js` `StorageKeys`（中央登记） | `import { StorageKeys } from './base/storageKeys.js'` → `sGet(StorageKeys.XXX)` | ❌ 写字符串字面量 / 手拼 `yimao_` 前缀 |
| 生成失败/重试决策 | `base/genErrors.js`（分类）+ `base/apiBase.js` `withRetry` | 失败看 `type` 决策，`errorMessageByType` 文案 | ❌ 自写 `if(/网络错误/)` / 自写重试循环 |

**接真系统提示**：上面的 base 能力大多已接 localTool / 网关。新增功能时优先复用，别在节点里硬编码后端地址。**存储键规范详见 `docs/08`，错误重试规范详见 `docs/09`。**

---

## 一.5、错误处理铁律（禁止静默、禁止虚假）

> 决策依据：CLAUDE.md「决策铁律」+ `docs/07-Toast分级设计-2026-08-17.md` + `docs/09-节点错误降级与重试收敛策略`。
> 核心：**任何会失败的关键链路（网络请求 / 文件读写 / 生成 / 同步 / 存储 / 解析 / 资源加载）出错时，必须让用户或开发者至少感知到一次，且不能骗人。**

### 硬规则（写代码前先记牢）

1. **catch 三选一，禁止静默**：关键链路 `try/catch` 或 `.catch` 必须至少做以下之一，否则视为 bug：
   - (a) `logger.warn/error` 记可追溯日志（含 `error?.message` 与上下文）；
   - (b) 弹 toast 提示用户（按 `docs/07` 分级，见下）；
   - (c) 向上 `throw`，由明确的上层统一处理（上层须带 a 或 b）。
   - ❌ 禁止：空的 `catch {}`、`.catch(() => {})`、`.catch(() => null)`（切图/画布加载等已出过静默 bug，见 `docs/53`）。
2. **日志统一收口 `logger`**：业务代码禁止裸 `console.log/warn/error`（见 §四 #5，业务代码已清零；`logger.js` 底层出口与 `director3d/` 子系统除外）。调试期临时 console 提交前必须删或转 `logger.debug`。
3. **toast 分级，禁止错级/假级**：语义分级严格按 `docs/07-Toast分级设计-2026-08-17.md §2.1`：
   - `error`（红）：操作失败、用户需处理（如切图失败、复制失败、画布保存失败）。
   - `warning`（黄）：执行了但有损/降级/前置不满足（如画布加载失败回退默认、未检测到人脸）。
   - `success`（绿）/ `info`（蓝）：按文档消歧规则，**用户一眼可见的结果不弹**（见 docs/07 §2.2 首要原则）。
   - 强制走语义函数：`toastError / toastWarning / toastSuccess / toastInfo`（`base/toastStore.js`），禁止 `showToast(x,'error')` 位置字符串写法（颜色 bug）、禁止失败语义裸调成 info 蓝。
4. **禁止虚假报错**：报错文案必须与实际错误一致；禁止占位文案（如假装成功、用无关文案掩盖失败）、禁止静默 swallow 后返回假成功。
5. **错误分类走 `genErrors.js` + `withRetry`**：生成类失败按 `type` 决策与重试（见 `docs/09`），禁止 `if(/网络错误/)` 手写判断。

### 自检清单（新增/改 catch 时勾选）

- [ ] catch 内有 `logger.warn/error` 或 `toastXxx` 或 `throw`？不是只 `return null`？
- [ ] 失败语义 toast 用了 `toastError`/`toastWarning`（按 docs/07 分级），不是 info 蓝？
- [ ] 文案真实反映了错误原因，没有占位/虚假？
- [ ] 没有裸 `console.*`（调试残留已清理或转 `logger.debug`）？

---

## 二、样式规范（token 优先，禁裸色值）

> 统一 token 定义在 `tailwind.config.js`，值 = 原硬编码 hex，**视觉零变化**。写样式一律用 token，禁止新写裸色值 `bg-[#1c1c1c]` / `text-gray-500`。

### 颜色 token（背景 / 文字 / 边框）
- **背景**：`bg-surface`(1a1a1a) / `bg-surface-1`(222) / `bg-surface-2`(1f1f1f) / `bg-surface-raised`(1c1c1c) / `bg-surface-menu`(1c1c1e) / `bg-surface-hover`(2a2a2a) / `bg-canvas`(0d0c0c) / `bg-input`(141414)
- **文字**：`text-strong`(fff) / `text-primary`(ddd) / `text-body`(ccc) / `text-secondary`(aaa) / `text-muted`(888) / `text-faint`(666) / `text-subtle`(555)
- **边框**：`border-edge`(333) / `border-edge-strong`(555) / `border-edge-muted`(444) / `border-edge-raised`(3a3a3a)
- 用法：`bg-surface-1 text-caption text-gray-200` → 应为 `bg-surface-1 text-body text-gray-200`（或对应 token）

### 字号 token
`text-2xs`(8) / `text-meta`(9) / `text-caption`(10) / `text-caption-sm`(11) / `text-body-xs`(12) / `text-body-sm`(13) / `text-base-sm`(15)。**禁止**新写 `text-[10px]` 等裸值。

### z-index token（防层级冲突）
`z-base`(0) → `z-dropdown`(50) → `z-popover`(1000) → `z-modal`(9999) → `z-ceiling`(2147483647)。**禁止**写魔法数字 `z-[9999]`。

### 节点外观统一（抄 ARCHITECTURE.md §9.3，最高频）
- **标题**：一律用 `NodeShell` 自带标题，右侧操作走 `titleRight` 插槽。**禁止** `showTitle={false}` 后自己在 children 里渲染标题。
- **边框/背景**：主容器边框由 NodeShell 统一（`border-edge`），节点内层**不要**重复加 `border` + 独立 `bg`，否则出现双重外框、颜色不一致。

---

## 三、新增节点流程（Checklist，抄 ARCHITECTURE.md §7 提炼）

> 完整推导见 `ARCHITECTURE.md §7`。这里给可直接勾选的清单。

1. **先答范式问题**（数据被谁读写）：useState 型 or node.data 型（`ARCHITECTURE.md §三`）。
2. **挑范本文件**仿写，建 `components/XxxNode.jsx`（不造轮子、不凭空编 props）。
3. **注册目录**：`base/NodePalette.jsx` `paletteNodes` 加一行 `{ type, label, icon, cat, data, builtin: true }`。
4. **注册 nodeTypes**：`App.jsx` `nodeTypes` 加一行 `type → 组件`。
5. **（B 型节点）接引擎**：仿 `useScriptBoxEngine.js` 注入回调，App 不改。
6. **验证**：`npm run test:smoke` + `npm run test:regression` + `npm run build` 三道门全绿。
7. **沉淀**：数据契约 / 行为写进对应交接文档；`BASE-CAPABILITIES.md` 能力清单如有新增 base 能力要登记。

> ⚠️ **3 处同步铁律**：nodeTypes + NodePalette 两处必须同步，且 NodePalette 行必须 `builtin: true` + 默认 `data`。漏一处 → 右键能搜到但建不出来 / 渲染异常。

---

## 四、已知不一致清单（待收敛，先记录不重构）

> 目的：让后续 AI 知道哪些地方是"历史遗留不一致"，别模仿、别扩散；重构时按这里统一。**当前只记录，不在本轮改代码。**

| # | 位置 | 问题 | 收敛方向 |
|---|------|------|---------|
| 1 | 少数业务文件手写媒体正则（`useConnectedInputs.js`/`useAgentChat.js`/`VideoProcessNode.jsx`/`ImageBoxNode.jsx` 等）绕过 `mediaType.js` | 手写扩展名正则 / `startsWith('data:')`，与 `detectMediaType` 逻辑重复 | 优先收敛到 `mediaType.js`；`director3d/` 是独立子系统不强制 |
| 2 | 裸色值集中在新增节点（`PanoramaNode`/`FaceMosaicNode`/`Director3DNode`/`FaceMosaicEditor`）+ 部分 base 面板 + `scriptbox/` | `bg-[#…]`/`text-gray-…`/`text-[Npx]`/`z-[N]` 绕过 `tailwind.config.js` token | 迁移到 token（`bg-surface-*`/`text-*`/`text-caption`/`z-*`）；**存量核心节点已基本用 token，收敛只针对上述几处** |
| 3 | `filesApi.js` / `imageUrl.js` | `toAbsoluteFileUrl` 有 re-export 与独立 `imageUrl.js` 两处，引用分散 | 明确 `imageUrl.js` 为唯一来源，`filesApi.js` 只 re-export |
| 4 | 各节点 hover 栏 / 底部按钮 | 部分直接 `lucide` 图标 + 裸 class，部分用 `HoverToolbar`/`ToolbarButton` | 统一走 `HoverToolbar` + `ToolbarButton` |
| 5 | 裸 `console.*` 残留 | 2026-08-26 全量扫描：`src/` 业务代码**已无**裸 console.*（仅 `director3d/log.js` 子系统内部 + `logger.js` 底层出口 + `ErrorBoundary.jsx` 注释）。**业务代码已清零**，不强制动 director3d（外部集成，约定不维护）；后续 R-round 仅盯新增代码是否回潮 | 调试临时 console 提交前删或转 `logger.debug`；详见本页 §一.5 错误处理铁律 |

> 收敛原则：**先规范、后重构；渐进收敛、别强行批量**。
> - 新增代码一律按本页规范写（用 token / 走单一入口）。
> - 存量不一致（上表）**改到哪个文件顺手收敛哪个**，不为了"清零"强行批量改——裸色值多在 scriptbox/设置面板/director3d 等非核心处，且很多 `#xxx`（如 `#27272a`/`#181818`/`#121212`）**没有精确对应的 token**，硬改会引入视觉回归。核心生成节点（PromptNode/TextNode/DiscountVideo/ImageNode）已基本用 token。
> - 每批收敛跑 `npm run test:smoke` + `npm run build` 验证。

---

## 五、验收自检（写完代码对照，抄 ARCHITECTURE.md §八）

- [ ] 复用了 `BASE-CAPABILITIES.md` 现有能力？没另起一套实现？
- [ ] 样式全用 `tailwind.config.js` token？没新写裸色值/裸字号/裸 z-index？
- [ ] 媒体判断 / URL 归一 / 提示走了单一入口（§一）？
- [ ] 新节点 3 处同步（nodeTypes + NodePalette + builtin）？
- [ ] 写回是不可变局部更新？非目标节点 `: n` 原样返回？
- [ ] 节点外观统一（NodeShell 标题 / 不外框）？
- [ ] 跑 `npm run test:smoke` + `npm run test:regression` + `npm run build`？

---

## 六、提交前必读（仓库纪律）

- **git 推送必须走代理 7897**：`HTTPS_PROXY=http://127.0.0.1:7897 HTTP_PROXY=http://127.0.0.1:7897 git push origin main`（见 CLAUDE.md §六.1）。
- 本地验证：`npm run test:smoke`（默认自检）→ `npm run build`（编译回灌 dist/）→ 大改动再 `npm run check:health`。
