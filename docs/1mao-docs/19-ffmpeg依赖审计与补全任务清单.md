# 19 - ffmpeg 依赖审计报告

> **文档类型**：审计 + 结论报告（已结案）
> **对应断点**：`docs/02` P2 / `docs/03` B·P2 / `docs/05` 中-4 / `docs/06` 中-4
> **审计日期**：2026-08-01
> **代码实证**：`localTool/src/routes/system.ts:50-58`（`handleStatus` 函数，硬编码 `ffmpeg:false` 位于第 55 行）
> **关联文档行号说明**：各断点文档（docs/02、docs/03、docs/05、docs/06）中引用的 `system.ts:18` 均为**早期代码行号**（彼时 `handleStatus` 函数位置靠前）。经 2026-08-01 复核当前 `localTool/src/routes/system.ts`，硬编码 `ffmpeg:false` 实际位于**第 55 行**（函数 `handleStatus` 整体在 50-58 行）。本文档以当前代码为准，旧 `:18` 引用仅作历史定位，不影响结论。

---

## 一、摘要（Executive Summary）

| 项目 | 结论 |
|------|------|
| 是否需要集成 ffmpeg | **否** |
| 当前 `status.ffmpeg` 值 | `false`（硬编码，无运行时探测） |
| 当前 `status.ffmpeg` 性质 | **死字段**（后端硬返 false，前端读取后丢弃） |
| 对功能的影响 | 无硬阻塞；仅后端图片缩略图退化为"复制原图"，质量退化但可用 |
| 断点处理 | **定性关闭（非缺陷）**，保持 `ffmpeg:false` |
| 后续可选优化 | 缩略图真缩放应走 `sharp`，与 ffmpeg 无关 |

**一句话结论**：自研前端视频/音频管线为纯前端实现（WebCodecs + MediaBunny），不依赖后端 ffmpeg；后端 localTool 也无任何 ffmpeg 集成，**无需补齐 ffmpeg**，原断点定性关闭。

---

## 二、背景与现状

### 2.1 断点来源
> 以下各断点文档引用的 `system.ts:18` 为早期行号，当前实为 `system.ts:55`（函数 `handleStatus` 50-58 行），详见文档头"关联文档行号说明"。结论不受影响。
- `docs/02` P2（第 114 行）：ffmpeg 依赖未审计，`system.ts` 返回 `ffmpeg:false`。
- `docs/03` B·P2（第 82-85 行）："是否必需待定"，需抓包/比对原版确认。
- `docs/05` 中-4（第 133 行）：待定项，原版是否内置 ffmpeg、前端是否依赖。
- `docs/06` 中-4（第 342 行）：拍板决策——查原版是否内置 ffmpeg，不需要则不改。

### 2.2 后端现状（实锤）
`/api/status` 由 `handleStatus` 直接硬编码返回 `ffmpeg:false`，localTool 代码中**无任何 ffmpeg 调用/集成**：

```ts
// localTool/src/routes/system.ts:50-58
export async function handleStatus(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  return json(res, {
    status: 'ok',
    version: VERSION,
    message: 'localTool service',
    ffmpeg: false,   // ← 硬编码，无运行时探测
    port: PORT,
  });
}
```

### 2.3 服务端缩略图降级（两处，均为服务端行为）
| 位置 | 函数 | 降级代码 | 调用路径 |
|------|------|----------|----------|
| `files.ts:116-128` | `tryGenerateThumbnail()` | `files.ts:123` `fs.copyFileSync(filePath, thumbPath)` | upload 路径（`handleUploadFormData:44`、`saveRemoteUrl:112`），对**图片**直接复制原图生成"缩略图"（未缩放、未压缩） |
| `files.ts:210-238` | `handleThumbnail()` | `files.ts:233` `fs.copyFileSync(filePath, thumbPath)` | `/api/files/thumbnail` 接口，注释"简单复制（无 sharp 时）" |

> **两处降级的关键细节（修正原模糊描述）**：
> - 二者均为 Node 端 `fs.copyFileSync`，**前端不感知、无对应分支**。这是 ffmpeg 唯一实际影响的环节——图片缩略图退化为"复制整张原图"。
> - `tryGenerateThumbnail`（123 行）**无条件** `copyFileSync`：即使环境有 `sharp`，它也直接复制原图，并未调用 `sharp` 缩放。即该函数本身就是一个"原样复制"兜底，与 sharp 是否可用无关（注释"无 sharp 时"易误导，实际是始终复制）。
> - `handleThumbnail`（210-238 行）**已解析** `maxDim`/`quality` 请求参数（216-217 行），并用于构造缩略图缓存文件名前缀（229 行 `${maxDim}x${quality}_`），但 **233 行仍 `copyFileSync` 整张原图**——即 `maxDim`/`quality` 仅参与**缓存键命名**，**从未用于实际缩放/压缩**。无论前端传什么尺寸，得到的都是原图副本。这是比"简单复制"更精确的错漏点：参数被读取却被无视。
> - 正确定性：缩略图"真缩放"须引入 `sharp` 重写这两处（见 §六 遗留优化 1），与 ffmpeg 无关。

---

## 三、审计证据：前端视频/音频功能排查

> 方法：`dist/assets` 打包产物静态分析（关键词扫描 + 字符级上下文提取）。
> 核心结论：**前端视频/音频处理管线为纯前端实现，不调用后端 ffmpeg。**

### 3.1 全局结论
- 打包产物中**未发现任何对后端 ffmpeg 转码/拼合/缩略图的调用路径**（无 `exec`/`fetch('/api/ffmpeg...')` 类调用）。
- 唯一与 `ffmpeg` 字符串相关的代码位于 `httpClient-BknZwXjG.js`：拉取 `/api/status` 后读取 `status.ffmpeg`，但该值被**读取后直接丢弃**（表达式 `typeof e4?.ffmpeg=="boolean"&&e4.ffmpeg;` 是无效语句，未进入任何 `if` 分支）。即前端当前**并未**根据 `status.ffmpeg` 走任何分叉。
- 前端技术栈：**WebCodecs（VideoEncoder/VideoDecoder）+ MediaBunny（自研 MP4 封装）+ MediaRecorder/captureStream + canvas**，全部浏览器原生/纯前端。

### 3.2 各功能模块逐一排查

| # | 功能 | 代码位置（dist chunk） | 实现技术 | 依赖后端 ffmpeg |
|---|------|------------------------|----------|----------------|
| 1 | 视频/时间线导出合成（timeline 24 处） | `src-_qSScO88.js` | WebCodecs + MediaBunny 自研 MP4 封装 | **否** |
| 2 | 视频编解码（forceTranscode / codec / bitrate） | `src-_qSScO88.js` | WebCodecs `VideoEncoder`/`VideoDecoder` | **否** |
| 3 | 视频转 GIF / 逐帧提取 | `src-_qSScO88.js` | canvas 逐帧绘制 + 前端 GIF 编码 | **否** |
| 4 | 音频导出 / 编码（mp3 / wav） | `mediabunny-mp3-encoder-CZeRAvEV.js` | MediaBunny MP3 编码器 | **否** |
| 5 | 音视频录制 / 流式导出 | `httpClient` / `src-_qSScO88.js` | `MediaRecorder` + `captureStream` | **否** |
| 6 | 媒体自适应播放（MSE / webm / mp4） | `httpClient` | 浏览器原生 MSE | **否** |
| 7 | 画布素材视频节点渲染 | `httpClient` | `canvas.drawImage` + `captureStream` | **否** |
| 8 | 视频缩略图（前端组件 126 处） | `httpClient` / `src-_qSScO88.js` | canvas 抽帧 | **否** |
| 9 | 提取音频 / 配音 | `src-_qSScO88.js` | WebCodecs Audio + MediaBunny | **否** |

> 说明：`httpClient` 中 `concat`（64 处）绝大多数为 React 数组 `concat`（连线/节点合并），**非视频拼合**；真正的视频拼合/合成在 `src-_qSScO88.js` 中由 MediaBunny + WebCodecs 纯前端完成。

---

## 四、分析：原假设订正

原任务草稿的描述存在前后端边界混淆，已据实证订正：

| 原假设 | 实际情况 | 订正 |
|--------|----------|------|
| 前端按 `status.ffmpeg` 做特性探测 | 前端读取该字段后直接丢弃，无任何 `if` 分支 | 删除"前端特性探测"描述 |
| S2 缩略图降级是前端行为 | 降级是服务端 `files.ts` 两处 `copyFileSync`（`:123`/`:233`），前端不感知 | 更正为"服务端行为" |
| 视频拼合/转码也依赖后端 ffmpeg | 前端视频管线纯前端（WebCodecs/MediaBunny），不调后端 ffmpeg | 假设不成立 |

**正确定性**：`status.ffmpeg` 当前在自研端是**死字段**。唯一与之相关的真实降级发生在**服务端图片缩略图**（无 sharp/ffmpeg → 复制原图），且这不影响前端视频处理。该断点为**非硬阻塞**，能力对等降级，功能可用。

---

## 五、最终结论

### 5.1 主结论：不需要集成 ffmpeg
判据：
1. 前端视频/音频管线纯前端，不调后端 ffmpeg（§3 实证）。
2. 前端不消费 `status.ffmpeg`，故 `false` 对前端无可见影响。
3. 后端 localTool 无 ffmpeg 代码，保持 `false` 零风险。
4. 即使原版曾依赖后端 ffmpeg，自研端已对等覆盖，无需对齐。

→ **保持 `ffmpeg:false`，断点定性关闭（非缺陷）。**

### 5.2 关联任务处置
| 任务 | 原目标 | 结论 |
|------|--------|------|
| 任务 1 核实原版是否内置 | 决策前置 | **不需要**（结论已定） |
| 任务 2 集成方式 | 选方案 A/B/C | 跳过（结论为不需要） |
| 任务 3 运行时探测改 true | 探测 ffmpeg 可用性 | **不实施**——前端不消费该字段，改 true 属无效工程且可能误导 |
| 任务 4 缩略图真缩放 | ffmpeg 替代 copyFileSync | **不实施**——若未来要提升缩略图质量，应引入 `sharp` 而非 ffmpeg |
| 任务 5 验证与结案 | 关闭断点 | **已结案**（见 5.3） |

### 5.3 结案动作清单（执行项）
- [x] 本文档标注 ffmpeg 断点**已定性关闭（非缺陷）**，保持 `ffmpeg:false`。
- [x] 关联断点表状态更新：
  - `docs/05` 中-4（第 133 行）：`[未实施·待定]` → **`[已闭环·结论:不需要]`**
  - `docs/06` 中-4（第 342 行）：开放待定 → **已拍板"不改，保持 false"**
  - `docs/03` B·P2（第 82-85 行）：`[核实·是否必需待定]` → **`[已核实·不需要]`**
  - `docs/02` P2（第 114 行）：维持"中"优先级，标注"非阻塞，已定性关闭"
  - **`docs/02` 第 209 行订正（必须回填）**：原文"前端从 `/api/status` 读 ffmpeg 做特性探测会按 false 自适应"与本文 §3.1 实证**冲突**。实际前端读取 `status.ffmpeg` 后直接丢弃（无效语句，无 `if` 分支），**不存在"按 false 自适应"的探测逻辑**。建议将 docs/02 第 209 行订正为："前端读取 `status.ffmpeg` 后未使用，ffmpeg 为死字段（详见 19 号文档）"。
- [x] 回归确认：ffmpeg 处置未触及 `localTool→Lovart` 生图/生视频转发链，不影响主链路。

---

## 六、遗留可选优化（非阻塞，不在本断点范围）

1. **缩略图质量**：若希望大图缩略图不再是"原图复制"，在 `files.ts` 两处降级点（`:123`/`:233`）接入 `sharp` 做真缩放（建议 `maxDim` 限制 + `quality` 压缩）。这是比 ffmpeg 更轻量、更专业的图片方案。
2. **死字段清理**：`status.ffmpeg` 当前为死字段（后端硬 false、前端丢弃）。可保留（兼容性）或前端删除该无效读取表达式，二者皆可，不影响功能。

---

## 附：关键约束（不可违背）
1. **非阻塞优先**：当前 `ffmpeg:false` 下功能可用，任何改造不得引入回归。
2. **特性探测语义**：若未来前端新增后端转码/缩略图分支，则后端须先具备真实能力再改 `true`，避免前端误用失败路径（当前前端不消费该字段，此约束暂不触发）。
3. **兜底保留**：服务端缩略图 `copyFileSync` 降级分支须保留为不可用时的兜底。
4. **不影响三链路**：ffmpeg 相关处置属 localTool 本地能力，不触及生图/生视频转发链。
