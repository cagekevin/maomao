# TASK-002 — 依赖批 product_reference / fusion 提示词改写（对齐大雄）

> 你只能写这个文件，碰任何其他文件视为失败。

## ⚠️ 铁律（违反重做）
1. **只读不改**：本任务是「深度核验 + 精确定位」，禁止修改任何 `src/` 代码，禁止写脚本，只产出本 md 文档。
2. **行号必须真实**：所有行号必须来自你**本次实际打开文件核实**后的结果。引用格式 `文件路径 L实际行号`。
3. **结论必须有代码证据**：每个结论必须贴「文件 + 行号 + 关键代码片段」，不能只写"缺/不缺"。
4. **自包含**：本文件已含所有探索起点，不需要也不得查看其他 `TASK-*` 文件，不知道有几个 AI 在并行。

---

## 一、项目背景
我们 AI 助手逐项追平大雄。本任务深入核验「前序依赖步骤（Wave2）是否改写下游 prompt，而非仅连线」。

## 二、硬约束
只读核验。产出必须「可执行」：让下一个实现 AI 拿到就能动手。

## 三、探索起点（真实 grep，行号以实际核实为准）

### 大雄侧（canvas-agent.js）
- 主文件 `/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/web/canvas-agent.js`
- `agentExtractSubjectLabel(text, index)` ≈ L10093（从 prompt 抽主体名，如"黑猫"）
- `agentBuildFusionPrompt(prevGens, userText)` ≈ L10153（融合：挂全部前序成功图 + 改写提示词）
- `agentBuildProductReferencePrompt(productGen, pagePrompt, userText)` ≈ L10166（产品参考：只挂产品定稿 + 改写提示词）
- 依赖批改写调用点 ≈ L10218 / L10252 / L10277 / L10284
- 依赖步失败日志 pushLog ≈ L10990

### 我们侧
- 执行器 `/Users/kevin/Documents/maomao/src/components/base/canvasPlanExecutor.js`
  - `dependsOnPrevious` ≈ L21
  - independent/dependent 分组 ≈ L73-74
  - Wave2 依赖批（只建连线，不改写 prompt）≈ L161-175
  - 跳过文案「前置步骤未全部成功，已跳过」≈ L173
- 我们 execute_plan 工具：`/Users/kevin/Documents/maomao/src/components/base/useCanvasAgentTools.js`（generations 已带 dependency_mode）
- 已剖析基底：`docs/AI助手开发历史/08-大雄canvas-agent架构剖析与地基对照-2026-08-16.md`

## 四、覆盖清单（逐项给「大雄怎么做 + 我们缺在哪 + 精确落点」）
1. 贴出大雄三个函数（extractSubjectLabel / buildFusionPrompt / buildProductReferencePrompt）的**完整代码逻辑**。
2. 大雄在依赖批（L10218/10252/10277/10284）怎么调用这些函数、怎么改写 `g.prompt`。
3. 我们 `canvasPlanExecutor` Wave2（L161-175）现在对依赖步做了什么——是不是只连前序节点、不改写 `data.prompt`？`dependency_mode` 是否被读取？
4. **结论**：我们 `executePlan` 要在哪改，才能在 `dependency_mode==='product_reference'|'fusion'` 时改写下游 prompt。移植哪个函数、放哪个文件、在哪个调用点改。

## 五、输出规范
按「大雄怎么做（代码证据）/ 我们现状（代码证据）/ 追平落点（可执行）」三节。落点必须写「改哪个文件哪一行 + 怎么改」。

---

# 核验产出（TASK-002 结论）

> 本产出由本次实际打开文件逐行核实。所有行号对应真实文件内容。

## A. 大雄怎么做（代码证据）

### A1. 三个核心函数完整逻辑

**① `agentExtractSubjectLabel(text, index)`** — `/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/web/canvas-agent.js` **L10093-10120**
从 prompt 抽主体短标签（如"黑猫"），先 `agentStripSharedStylePrefix` 去统一设定前缀，再剥离「请严格参考/用户原意/将它们融合…」等引导语，然后用多组正则优先取「与A的B」尾部、再取「一只/一个/一位 + 主体」、再取含猫狗包装等产品词、最后取首句。兜底 `素材${index+1}`。

```js
10093:function agentExtractSubjectLabel(text='', index=0){
10094:    let t = agentStripSharedStylePrefix(text);
10095:    t = t
10096:        .replace(/请严格参考[^。\n]*/g, ' ')
10097:        .replace(/用户原意[：:][^。\n]*/g, ' ')
10098:        .replace(/将它们融合为同一张完整画面[^。\n]*/g, ' ')
10099:        .replace(/保持各主体外形与关键特征一致[^。\n]*/g, ' ')
10100:        .replace(/【统一设定[·・]?不可变更】/g, ' ')
10101:        .replace(/\s+/g, ' ')
10102:        .trim();
10103:    if(!t) return `素材${index + 1}`;
10104:    const relative = t.match(/与[^，。；\n]{1,20}?的([\u4e00-\u9fffA-Za-z0-9]{1,12}?(?:猫猫|猫咪|黑猫|橘猫|白猫|猫|狗狗|小狗|犬|狗|包装|产品|场景))/);
10105:    if(relative && relative[1]) return relative[1].slice(0, 12);
10106:    const animal = t.match(/(?:一只|一个|一位)(?!与)([\u4e00-\u9fffA-Za-z0-9]{1,12}?(?:猫猫|猫咪|黑猫|橘猫|白猫|猫|狗狗|小狗|犬|狗|老虎|狮子|小熊|兔子|小鸟|金鱼|女孩|男孩|男人|女人|人物|包装|产品))/);
10107:    if(animal && animal[1]) return animal[1].slice(0, 12);
10110:    // 其余 patterns / first 兜底（见 L10110-10119）
10119:    return first.slice(0, 12) || `素材${index + 1}`;
10120:}
```

**② `agentBuildFusionPrompt(prevGens, userText)`** — **L10153-10165**
把所有前序成功图抽标签拼成 `图1（黑猫）、图2（橘猫）`，从最后一张前序 prompt + 用户文本抽动作 `action`，生成「请严格参考图1…图2…，将参考图中的主体自然融合…：${action}」，并补「保持各主体外形与关键特征与参考图一致，统一光影与透视，构图自然协调。」

```js
10153:function agentBuildFusionPrompt(prevGens, userText=''){
10154:    const labels = prevGens.map((g,i)=>{
10155:        const short = agentExtractSubjectLabel(g.prompt || g.professionalPrompt || '', i);
10156:        return `图${i+1}（${short||'素材'}）`;
10157:    }).join('、');
10158:    const action = agentCleanFusionActionText(prevGens[prevGens.length-1]?.prompt || '', userText);
10159:    let prompt = `请严格参考${labels}（按参考图数组顺序），将参考图中的主体自然融合到同一完整画面：${action}`;
10160:    prompt = prompt.replace(/：请严格参考/g, '：').replace(/\s+/g, ' ').trim();
10161:    if(!/保持各主体外形|外形与关键特征/.test(prompt)){
10162:        prompt += '。保持各主体外形与关键特征与参考图一致，统一光影与透视，构图自然协调。';
10163:    }
10164:    return prompt;
10165:}
```

**③ `agentBuildProductReferencePrompt(productGen, pagePrompt, userText)`** — **L10166-10172**
以「产品定稿」为唯一一致性参考，约束后续页只换构图/文案、不要融合。

```js
10166:function agentBuildProductReferencePrompt(productGen, pagePrompt='', userText=''){
10167:    const product = agentExtractSubjectLabel(productGen?.prompt || '产品定稿', 0);
10168:    let page = agentStripSharedStylePrefix(pagePrompt || '').trim();
10169:    const user = String(userText || '').trim();
10170:    const head = `严格参考图1（产品定稿：${product}）作为唯一产品一致性参考。后续画面必须保持同一包装外形、材质、Logo、标签版式与品牌识别完全一致，只更换页面构图与文案层级，不要把多张页面融合成一张。`;
10171:    return `${head}${page?`\n${page}`:''}${user && !page.includes(user)?`\n用户原意：${user}`:''}`;
10172:}
```

**辅助函数（被上面调用，落点移植时需一并搬）**
- `agentStripSharedStylePrefix(text)` — L10086-10092
- `agentCleanFusionActionText(basePrompt, userText)` — L10121-10152（抽"打架/互动/融合"动作）
- `agentLooksLikeFusionPrompt(text)` — L10055-10056（正则判断融合意图）
- `agentLooksLikeSeriesPrompt(text)` — L10058-10059
- `agentNormalizeDependencyMode(mode, prompt)` — L10067-10077（归一化 `fusion`/`product_reference`/`none`）
- `agentApplySharedStyleToPrompt(prompt, sharedStyle)` — L10078-10085

### A2. 大雄在依赖批改写 `g.prompt` 的调用点（关键：不是只连线，而是重建 prompt）

函数 `agentMarkGenerationDependencies` 在三个分支里**直接改写 `g.prompt`**：

- **L10218**（seriesHint 分支，后续详情页/主图）：`g.prompt = agentBuildProductReferencePrompt(gens[0], g.prompt, userText);`
- **L10252**（无融合项、模型只给独立主体时，追加一个真融合步）：`prompt: agentBuildFusionPrompt(gens, userText),`
- **L10277**（已有融合项时，对每个 fusion 步重建）：`g.prompt = prev.length ? agentBuildFusionPrompt(prev, userText || g.prompt || '') : agentCleanFusionActionText(g.prompt, userText);`
- **L10284**（product_reference 步）：`g.prompt = agentBuildProductReferencePrompt(gens[0], g.prompt, userText);`

即：**大雄在规划期就把下游 prompt 改成"挂前序成功图 + 改写后的提示词"，再交给执行层。连线只是把图喂给节点，prompt 文本本身已被替换。**

### A3. 大雄调用点处对 `g.dependency_mode` 的设定（确认"改写在依赖模式已知后发生"）
- L10209 / L10271 / L10280 / L10258：`g.dependency_mode = 'fusion' | 'product_reference'`
- 改写在 L10218/L10252/L10277/L10284 之前已确定 mode，函数按 mode 决定调用哪个 builder。

---

## B. 我们现状（代码证据）

### B1. 我们执行器 Wave2 只连线、不改写 prompt
`/Users/kevin/Documents/maomao/src/components/base/canvasPlanExecutor.js`

- **L73-74**：分批 `independent` / `dependent`，依据 `dependsOnPrevious(step)`（L19-24），**只看 `depends_on_previous`/`use_previous_results`/`depends_on_steps`，不读 `dependency_mode`**。
- **L161-191** Wave2 主体：
  - **L166** `createGenNode(step, …)` —— 建节点时 `data.prompt = step.prompt`（L94），**原样写入，未做任何改写**。
  - **L170-177** 仅当独立批全成功时 `ctx.addEdges(prevOk → nodeId)`（L176-177），即"连线喂图"。
  - **L179** `runNode(nodeId, step)` 直接用原 `step.prompt` 跑。
- 全文件搜索：**`canvasPlanExecutor.js` 中不存在任何 `dependency_mode` 字面**（见下方核对）。Wave2 完全不区分 `fusion` / `product_reference`，一律只做连线。

### B2. `dependency_mode` 在执行器之外确实存在但执行器不消费
`grep dependency_mode src/` 命中 7 处，均为**工具描述/策划提示**，无一在 `canvasPlanExecutor.js`：
- `src/components/base/useAgentChat.js` L123 / L131（策划说明要求后续步 `dependency_mode: product_reference`）
- `src/components/base/skillStore.js` L27 / L31
- `src/components/base/useCanvasAgentTools.js` L574 / L609（generations 每项含 `dependency_mode`）

且 `useCanvasAgentTools.js` **L650** `executePlan({ ctx, generations: resolvedGens, autoRun, model, defaults: panel, referenceImages: globalRefs })` 已把整份 `resolvedGens`（含 `dependency_mode` 字段）传进执行器——**执行器拿到了字段但丢弃了**。

> 结论证据：我们 Wave2 是"只建连线、不改写 `data.prompt`"；`dependency_mode` 已从工具层传入执行器，但 `canvasPlanExecutor.js` 从未读取它（既不在 L73-74 分组逻辑，也不在 L166 建节点、L179 跑节点处）。大雄的核心差异正是"在依赖步改写 prompt 文本"，我们缺这一环。

---

## C. 追平落点（可执行）

**目标**：在 `executePlan` 的 Wave2 里，当 `step.dependency_mode === 'product_reference' | 'fusion'` 时，仿大雄在 `createGenNode` 之前重建 `data.prompt`（对应大雄 L10218/L10277/L10284）。连线（L176-177）保留，作为"把前序图喂给节点"的通道，二者互补。

### C1. 改哪个文件 + 哪一行 + 怎么改

**文件**：`/Users/kevin/Documents/maomao/src/components/base/canvasPlanExecutor.js`

**步骤 1：移植辅助函数**（在文件顶部 `normalizeResolution` 之后，L44 之后插入，或集中放一个 `dependencyPrompt.js` 再 import；建议就地内联以避免新文件依赖）：
- 从大雄 L10086-10092 搬 `agentStripSharedStylePrefix` → 改名 `stripSharedStylePrefix`。
- 从 L10055-10056 搬 `agentLooksLikeFusionPrompt` → `looksLikeFusionPrompt`。
- 从 L10121-10152 搬 `agentCleanFusionActionText` → `cleanFusionActionText`。
- 从 L10093-10120 搬 `agentExtractSubjectLabel` → `extractSubjectLabel`。
- 从 L10153-10165 搬 `agentBuildFusionPrompt` → `buildFusionPrompt`。
- 从 L10166-10172 搬 `agentBuildProductReferencePrompt` → `buildProductReferencePrompt`。
（这 6 个函数均为纯函数、无外部依赖，可直接复制。）

**步骤 2：在 Wave2 循环里读取 `dependency_mode` 并改写 prompt**
定位 **L163-166**：
```
163:      const step = dependent[i]
164:      const anchor = nextAnchor(ctx, base, entries.length)
165:      const nodeId = await createGenNode(step, step.index ?? i, anchor)
```
改为（在 `createGenNode` 之前先算改写后的 prompt，并把 `data.prompt` 用改写版覆盖）：
```js
      const step = dependent[i]
      // ── 对齐大雄 L10218/L10277/L10284：依赖步改写下游 prompt ──
      let effectivePrompt = step.prompt || ''
      const depMode = String(step.dependency_mode || '').toLowerCase()
      if (depMode === 'fusion') {
        const prevSteps = steps.slice(0, steps.indexOf(step)).filter((s) => s && (s.prompt || s.title))
        effectivePrompt = prevSteps.length
          ? buildFusionPrompt(prevSteps, step.prompt || '')
          : cleanFusionActionText(step.prompt || '', '')
      } else if (depMode === 'product_reference') {
        const productStep = steps[0] // 第 1 步即产品定稿（对齐大雄 gens[0]）
        effectivePrompt = buildProductReferencePrompt(productStep, step.prompt || '', '')
      }
      // 用改写后的 prompt 覆盖原 step.prompt 再建节点（建节点时 data.prompt 取 step.prompt）
      const rewrittenStep = { ...step, prompt: effectivePrompt }
      const anchor = nextAnchor(ctx, base, entries.length)
      const nodeId = await createGenNode(rewrittenStep, step.index ?? i, anchor)
```
注意：`createGenNode` 内部（L92-104）从 `step.prompt` 读 `data.prompt`，所以只要传 `rewrittenStep` 即可，无需改 `createGenNode` 本身。

**步骤 3（可选，对齐大雄）：分组也用 `dependency_mode`**
L73-74 目前仅按 `dependsOnPrevious` 分组。若希望 `dependency_mode==='none'` 但带 `depends_on_previous` 的步也走 Wave2，逻辑已 OK；无需改分组。保持现状即可——分组不影响 prompt 改写（改写发生在 Wave2 循环内）。

### C2. 调用点对照表（大雄 → 我们）
| 大雄 | 我们落点 |
|---|---|
| L10218 / L10284 `agentBuildProductReferencePrompt` | `canvasPlanExecutor.js` L163-166 改后 `product_reference` 分支 |
| L10277 `agentBuildFusionPrompt` | `canvasPlanExecutor.js` L163-166 改后 `fusion` 分支 |
| L10252 追加融合步 | 暂不移植（我们规划层已先生成融合步，执行层只消费；如需补齐"模型漏给融合步"的兜底，可在 L161 前对 `dependent` 追加一步，优先级低于上述两步） |

### C3. 落点自测（对齐验收 4.1/4.3）
1. 4.1 三个大雄函数完整代码见 A1（含行号）。
2. 4.3 我们 Wave2 现状见 B1：已证明 `canvasPlanExecutor.js` 不读 `dependency_mode`（L73-74 分组只看 `dependsOnPrevious`；L166/L179 用原 `step.prompt`；全文件无 `dependency_mode` 字面）。落点 C1 在 L163-166 处读取并改写，符合验收。
3. 实现后自测：构造 `generations` = [产品定稿(dependency_mode:'none'), 主图(dependency_mode:'product_reference', depends_on_previous:true)]，`executePlan` 应对第 2 步 `data.prompt` 注入"严格参考图1（产品定稿：…）…"改写文本，而非原 prompt。

---

## 六、验收标准（可自测）
（已在 C3 逐项回应：4.1 贴大雄三函数完整代码 ✓；4.3 明确我们 Wave2 不读 `dependency_mode` 并贴 L73-74/L166/L179 证据 ✓；追平落点落到 `canvasPlanExecutor.js` L163-166 具体行 ✓。）

## 七、铁律文件名（产出即本文档，不新建）
本文件即唯一产出，已写满，未改动任何其他文件。


## 六、验收标准（可自测）
1. 4.1：贴出大雄三个函数完整代码（可略注释）。
2. 4.3：明确我们 Wave2 是否读取 dependency_mode（贴文件+行号证据）。
3. 追平落点必须落到具体文件+行号。

## 七、铁律文件名（产出即本文档，不新建）
本文件即唯一产出。写满后结束，不要改动任何其他文件。
