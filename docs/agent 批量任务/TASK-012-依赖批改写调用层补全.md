# TASK-012 — 依赖批改写"调用层"语义补全（对齐大雄 agentMarkGenerationDependencies）

> 本任务为**实现任务**：需修改 `src/` 代码补齐 TASK-002 函数层改写之外、大雄在调用层（`agentMarkGenerationDependencies`）还做的三件事。
> 注意：TASK-002 已把 6 个纯函数（`stripSharedStylePrefix`/`looksLikeFusionPrompt`/`cleanFusionActionText`/`extractSubjectLabel`/`buildFusionPrompt`/`buildProductReferencePrompt`）移植进 `canvasPlanExecutor.js` 并在 Wave2 实现了 `fusion`/`product_reference` 两个分支的 prompt 改写。本任务只补**调用层三处语义缺口**，不重复移植函数。

## ⚠️ 铁律（违反重做）
1. **只改 `canvasPlanExecutor.js`**（Wave2 区域 L308-340 附近），不得动其他文件。
2. **行号必须真实**：所有行号来自本次实际打开文件核实。引用格式 `文件路径 L实际行号`。
3. **结论必须有代码证据**：每个落点贴「文件 + 行号 + 关键片段」。
4. **不破坏已有功能**：只新增分支/约束，不得删除 TASK-002 已实现的 `fusion`/`product_reference` 改写逻辑。
5. **可单测**：新增逻辑尽量为纯函数或局部可测分支。

---

## 一、项目背景
TASK-002 追平了大雄 `agentBuildFusionPrompt` / `agentBuildProductReferencePrompt` 的**函数层**，并在 Wave2 按 `dependency_mode` 调用（我们 L313-322）。但大雄真正的改写发生在 `agentMarkGenerationDependencies`（约 L10173-10300），它除了这两类 builder 调用，还有 **3 处我们完全没复刻的调用层语义**。本任务补全这三处，使"依赖批改写"从"能用"到"完美复刻大熊"。

## 二、硬约束
实现 + 自测。落点必须可执行：下一个 AI 拿到即可改。

## 三、探索起点（真实位置）
### 大雄侧
- 主文件 `/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/web/canvas-agent.js`
- `agentMarkGenerationDependencies` ≈ L10173-10300（调用层改写总入口）
- `use_attachments=false` 强制约束 ≈ L10209-10217（product_reference 分支）
- `agentLooksLikeSeriesPrompt(userText)` ≈ L10058-10059（套图自动识别）
- 融合兜底"模型漏给融合步则追加" ≈ L10250-10252
- `agentNormalizeDependencyMode` ≈ L10067-10077

### 我们侧
- 执行器 `/Users/kevin/Documents/maomao/src/components/base/canvasPlanExecutor.js`
  - Wave2 改写区 ≈ **L313-322**（已有 `fusion`/`product_reference` 分支，**但三个缺口均未实现**）
  - `product_reference` 分支 ≈ **L319-321**（未设 `use_attachments=false`）
  - 分组逻辑 ≈ L73-74（只按 `dependsOnPrevious`，无 `seriesHint` 全局推断）
  - 融合兜底追加：全文件搜索 `use_attachments`/`seriesHint`/`追加融合` 均 **0 命中**（已核实）

---

## 四、覆盖清单（3 个缺口逐条给"大雄怎么做 + 我们缺在哪 + 精确落点"）

### 缺口 1（最关键）：product_reference 步必须强制 `use_attachments=false`
**大雄怎么做（代码证据）**
`agentMarkGenerationDependencies` 在 seriesHint 分支与 product_reference 分支都显式写 `g.use_attachments = false`（约 L10213-10217），注释明确："否则执行层会引用 2 张（用户上传图 + 产品定稿），结果出错"。
即：product_reference 步只允许引用"产品定稿"，**禁止再叠用户上传的参考图**。

**我们缺在哪（代码证据）**
`canvasPlanExecutor.js` L319-321：
```js
319:      } else if (depMode === 'product_reference') {
320:        const productStep = steps[0]
321:        step = { ...step, prompt: buildProductReferencePrompt(productStep, step.prompt || '', '') }
```
只重建了 prompt，**没有**对 `step.use_attachments` 做任何处理。若 LLM 在 product_reference 步仍带 `attachment_indices` / `referenceImages`，执行层会把"用户图 + 产品定稿"两张都喂进去 → 复刻失败、且实际生图会出错。

**追平落点（可执行）**
在 L321 改为：
```js
      } else if (depMode === 'product_reference') {
        const productStep = steps[0]
        step = {
          ...step,
          prompt: buildProductReferencePrompt(productStep, step.prompt || '', ''),
          use_attachments: false,            // 对齐大雄 L10213：禁止再引用用户上传图，只挂产品定稿
        }
      }
```
> 注意：我们执行层靠 `attachment_indices` / `referenceImages` 决定引用哪些图；设 `use_attachments:false` 后需在 `createGenNode` / `useCanvasAgentTools` 的取图逻辑里尊重该标志（若当前取图逻辑未读 `use_attachments`，则额外加：当 `use_attachments===false` 时忽略 `attachment_indices` 与用户 `referenceImages`，仅用 `step.referenceImages`/连线图）。请落地 AI 在改 L321 后，顺带核实 `createGenNode`（≈L92-104）与 `useCanvasAgentTools.js` 取图处是否消费 `use_attachments`；若不消费，在取图处加 `if (step.use_attachments === false) skipUserAttachments`。

### 缺口 2：seriesHint 套图自动识别（不依赖 LLM 显式标 dependency_mode）
**大雄怎么做（代码证据）**
`agentLooksLikeSeriesPrompt(userText)`（L10058-10059）用正则判断"这是系列产品图/详情页套图"。在 `agentMarkGenerationDependencies` 里：`if (seriesHint && !fusionHint)` 时，把第 1 张当产品定稿，**后续所有步强制 `dependency_mode='product_reference'` + `use_attachments=false`**，即使 LLM 没标。

**我们缺在哪（代码证据）**
我们 Wave2（L313-322）**完全依赖 `step.dependency_mode` 显式值**。LLM 漏标 → 该步走原 prompt、不改写、不挂产品定稿 → 套图一致性丢失。分组逻辑（L73-74）也无 `seriesHint` 推断。

**追平落点（可执行）**
在 Wave2 改写区 L313 之前，加全局推断（需把 `userText` 传入 `executePlan`，若当前未传则先从 `steps` 或 `ctx` 取对话原文，若无则跳过本缺口）：
```js
      // 对齐大雄 L10058 / L10209：套图自动识别，LLM 漏标也能串
      const seriesHint = typeof userText === 'string' && looksLikeSeriesPrompt(userText)
```
然后在 L315 `if (depMode === 'fusion')` 之前插入：
```js
      if (seriesHint && depMode !== 'fusion' && !depMode) {
        // 套图：第1步当产品定稿，后续步强制 product_reference
        step = {
          ...step,
          dependency_mode: 'product_reference',
          use_attachments: false,
          prompt: buildProductReferencePrompt(steps[0], step.prompt || '', ''),
        }
      } else if (depMode === 'fusion') {
```
> 若 `userText` 当前未传入 `executePlan`，落点 AI 需先在上游（`useCanvasAgentTools.js` 的 `executePlan` 调用处）把对话原文作为参数传入，再在 `executePlan` 签名接收。这属于本任务附带的小改动，仅限补 `userText` 透传，不扩其他。

### 缺口 3：融合兜底——"用户要融合但模型只给独立主体"时自动追加融合步
**大雄怎么做（代码证据）**
`agentMarkGenerationDependencies` 约 L10250-10252：当 `!fusionHint`（模型没给任何 fusion 步）但用户意图是融合时，**在 gens 末尾 `push` 一个真融合步**，prompt = `agentBuildFusionPrompt(gens, userText)`，`dependency_mode='fusion'`、`depends_on_previous=true`。

**我们缺在哪（代码证据）**
全文件 `追加融合` / `push` 融合步相关搜索 **0 命中**。我们 Wave2（L311-322）只改写 `dependent` 里已存在的步，不会"补"步。若 LLM 规划时漏给融合步，结果就是多张独立图、没有融合成品。

**追平落点（可执行）**
在 Wave2 循环 `for` 之前（L311 后、L312 前），加融合兜底判断（同样依赖 `userText` / `seriesHint` 的融合意图，可用 `looksLikeFusionPrompt`）：
```js
      // 对齐大雄 L10250：用户要融合但无 fusion 步 → 自动追加
      const fusionIntent = typeof userText === 'string' && looksLikeFusionPrompt(userText)
      const hasFusion = dependent.some((s) => String(s.dependency_mode || '').toLowerCase() === 'fusion')
      if (fusionIntent && !hasFusion && steps.length >= 2) {
        const fusionStep = {
          id: '__auto_fusion__',
          title: '融合成品',
          prompt: buildFusionPrompt(steps, userText || ''),
          dependency_mode: 'fusion',
          depends_on_previous: true,
        }
        dependent = [...dependent, fusionStep]
      }
```
> 注意：自动追加步的 `id='__auto_fusion__'` 需保证不与 LLM 生成的 `id` 冲突；若执行器要求 `id` 唯一且参与连线，请落点 AI 用 `ensureUniqueId` 之类现有工具生成。

---

## 五、我们现状汇总（代码证据，已核实）
- `canvasPlanExecutor.js` L313-322：已实现 `fusion`/`product_reference` 两个分支 prompt 改写（TASK-002 成果，保留）。
- L319-321 `product_reference` 分支：**未设 `use_attachments=false`** → 缺口 1。
- 全文件搜索 `seriesHint` / `use_attachments` / `追加融合`：**0 命中** → 缺口 2、3 均未实现。
- 分组 L73-74：仅 `dependsOnPrevious`，无套图推断 → 缺口 2 关联。

## 六、追平落点总表（大雄 → 我们）
| 大雄语义 | 大雄位置 | 我们落点 | 缺口 |
|---|---|---|---|
| product_reference 强制 `use_attachments=false` | L10213-10217 | `canvasPlanExecutor.js` L319-321 加 `use_attachments:false` + 取图处消费 | 1 |
| seriesHint 套图自动识别，后续步强制 product_reference | L10058-10059 / L10209 | `canvasPlanExecutor.js` L313 前加 `seriesHint` 推断 + 分支 | 2 |
| 融合兜底自动追加融合步 | L10250-10252 | `canvasPlanExecutor.js` L311 后追加融合步 | 3 |

## 七、验收标准（可自测）
1. **缺口 1**：构造 `generations` = [产品定稿, 主图(dependency_mode:'product_reference', attachment_indices:[0])]，`executePlan` 后主图步 `data`/取图逻辑**不引用用户上传图第 0 张**，仅挂产品定稿 → 验证 `use_attachments=false` 生效。
2. **缺口 2**：对话原文含"系列详情页套图"且 LLM 未标 `dependency_mode`，后续步仍被改写为 `buildProductReferencePrompt` 输出 → 验证 `seriesHint` 推断。
3. **缺口 3**：对话原文含"融合"但 `generations` 无 `fusion` 步，`executePlan` 自动多出一个融合节点且其 prompt 为 `buildFusionPrompt` 输出 → 验证兜底追加。
4. **回归**：原有 `fusion`/`product_reference` 显式分支行为不变（TASK-002 功能不退化）。
5. `npm run lint` 与 `vitest` 相关单测（若有 `canvasPlanExecutor.test.js`）通过。

## 八、铁律文件名
本文件即唯一说明文档。实现改动只允许落在 `canvasPlanExecutor.js`（及缺口 1/2 必需的 `use_attachments` 透传小改），不得新建无关文件、不得动 TASK-001/003/004/005 已提交逻辑。
