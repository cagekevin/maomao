# PromptInput `@资产名` 自动转缩略图 —— 缺陷分析与改进方向

> **日期**：2026-09-07
> **状态**：~~纯分析文档（按需求只调查、不改代码）~~ → **已实施（2026-09-07）**：按 §八 8.5 落地（findAutoLinkOccurrences/extendable/isTerminatedByBreak/commitOccurrencesInRun + PromptInput 事件接线 + 单测），改前为纯分析未改代码
> **更新(2026-09-07)**：追加 **§八 · 完美算法研究**——推荐「就地转换 + 事件驱动提交」算法，只研究、未改代码。
> **结论**：用户感知的「粘贴/手输的 `@资产名` 不会自动变成缩略图，必须打空格再退回来才生效」**属实**，根因是 `@名 → 芯片` 的自动转换函数在「运行时输入/粘贴」场景下被一个性能短路判断吞掉了，只有「首次加载」和「改名」两种场景才会真正触发。
> **关联文档**：`docs/69-PromptInput-@提及交互定稿方案-2026-08-28.md`（候选层）、`docs/70-画布图片命名与@名匹配-全节点方案-2026-08-28.md`（名字匹配 + `autoLinkAssetsByName` 设计）

---

## 〇、一句话结论

「该不该弹候选层」的算法（`detectMentionQuery`）是好的；真正不够好的是**「已经写出来的 `@资产名` 文字，何时被转换成缩略图芯片」这条链路**。当前它只在**挂载 / 改名**时跑一次，运行期打字和粘贴都因为一处 `serializeDOM(el) === value` 的提前 return 而被跳过，于是 `@资产名` 一直以纯文本形式挂着，必须借助「候选弹层插入（打空格→退格→重触发弹层→回车/点选）」这种歪招才能变成缩略图。

---

## 一、现象复述（用户原话）

1. **从别处复制一段含 `@资产名` 的文字粘进来** → 不会自动变成缩略图（保持纯文本）。
2. **自己手输 `@资产名`** → 也不会自动变缩略图；必须**再打个空格、再退回来**才「仿佛生效」。

两者指向同一个底层机制缺失：运行时输入的 `@名` 文本**没有实时自动转芯片**，只能间接触发「候选弹层插入」那一条路径。

---

## 二、关键代码与调用链

### 2.1 自动转换的唯一入口：`autoLinkAssetsByName`

`src/components/base/prompt/promptChips.ts:282-306`

```ts
export function autoLinkAssetsByName(
  text: string,
  assets: Array<{ id: string; label: string; url?: string; kind?: string }> = [],
): string {
  if (!text || assets.length === 0) return text;
  const byName = new Map(/* label → asset，全等映射 */);
  ...
  return text.replace(re, (_m, name) => `@{${a.id}:${a.label}${thumb}}`);
}
```

职责：把字符串里**全等命中**的 `@资产名` 替换成 `@{id:label|thumb}` 芯片字符串。纯函数、可单测（见 `tests/unit/promptChips.test.ts`）。

**关键点**：它只在「字符串 → 芯片」的渲染重建阶段被调用，见下一节。

### 2.2 调用点：唯一的重建 effect（含致命短路）

`src/components/base/prompt/PromptInput.tsx:219-236`

```ts
React.useEffect(() => {
  const el = editorRef.current;
  if (!el) return;
  normalizeChipSlots(el);
  const nameChanged = prevNameSigRef.current !== nameSignature;
  prevNameSigRef.current = nameSignature;
  if (!nameChanged && serializeDOM(el) === value) return;   // ← 219~225：短路
  const cursor = saveCursor(el);
  syncingRef.current = true;
  el.innerHTML = '';
  for (const node of renderPromptToNodes(
         autoLinkAssetsByName(value || '', all),            // ← 230：转换在这里发生
         chipMetaMap,
       ))
    el.appendChild(node);
  normalizeChipSlots(el);
  syncingRef.current = false;
  if (cursor !== null) restoreCursor(el, cursor);
}, [value, chipMetaMap, nameSignature]);
```

依赖 `[value, chipMetaMap, nameSignature]`：**只有这三个外部信号变化才会重跑**，重跑时才把 `autoLinkAssetsByName` 应用于整段 value。

### 2.3 运行时输入/粘贴如何走到 effect

- **打字**：`onInput` → `emitDOM()`（`serializeDOM` → `onChange`）→ 父级更新 `value` prop → effect 重跑。
- **粘贴**：`handlePaste`（`:531-546`）把纯文本插入 DOM 后 `emitDOM()` → 同上。

两条路径**都先写 DOM、再 emit 出等价的 value**，因此 effect 重跑时 `serializeDOM(el)` 必然等于 `value`。

---

## 三、根因推导（为什么会被吞掉）

短路条件（`PromptInput.tsx:225`）：

```ts
if (!nameChanged && serializeDOM(el) === value) return;
```

- `nameChanged`：仅「素材改名」时为 `true`。
- `serializeDOM(el) === value`：DOM 当前序列化结果 == 最新 value。

**运行时打字 / 粘贴的场景**：

| 步骤 | DOM（编辑器内） | value（emit 后） | nameChanged | 短路判定 |
|---|---|---|---|---|
| 用户粘入 `@资产名` | `@资产名`（纯文本） | `@资产名` | false | `serializeDOM===value` → **return，不重建** |
| 用户逐字打 `@资产` | `@资产`（纯文本） | `@资产` | false | 同上，**每次都 return** |

因为 DOM 里已经是和 value 一模一样的**未转换纯文本**，短路直接返回，`autoLinkAssetsByName`（`PromptInput.tsx:230`）**根本没机会执行** → `@资产名` 永远以纯文本挂着。

**反倒能生效的两种场景**（恰好绕过了短路）：

| 场景 | 为什么能转 |
|---|---|
| **首次加载 / 挂载** | 挂载时 `el.innerHTML` 为空，`serializeDOM(el)===''` ≠ 非空 `value` → 不短路 → 重建并转换。这就是为什么「存过的 `@资产名` 一打开就变成缩略图」，但「运行中粘进来却不变」。 |
| **素材改名** | `nameSignature` 变化 → `nameChanged=true` → 跳过短路 → 整段重建，连旧 `@名` 也一并转换。 |

**结论**：自动转换在运行期是「假死」的，只在加载/改名这种「DOM 与 value 天然不一致」的瞬间才触发。用户说的「打空格再退回来」，实际是被迫走「`@` 候选弹层」那条**手动插入**路径（`handleSelectMention` → `insertChipAtCursor` 直接 `buildChipEl`），并非真正的自动识别——属于歪打正着的 workaround。

---

## 四、为什么当初会加这个短路（理解设计意图，避免误删）

`docs/70` §7.5 / §7.7 的设计目标：**防重算**。

- `all` / `refImages` / `refTexts` 每次 render 都是新建数组，若直接当 effect 依赖，鼠标 hover 都会重跑 `autoLinkAssetsByName`，浪费。
- 解法：用 `nameSignature`（素材名字签名）做依赖，「只对名字变化敏感，名字没变不重跑」。
- 该短路的语义本意是「**DOM 与 value 一致就无需重建**」，但它基于一个隐含假设：**value 永远是「已转换」形态**。而现实是 value 在运行期经常是「用户刚敲进去的未转换 `@名` 纯文本」，于是假设崩塌，转换被误杀。

所以这是「性能短路」与「正确性」的冲突——短路过于激进，把「需要转换的新文本」也当成「无需动」跳过了。

---

## 五、改进方向（仅提案，未实施）

### 方案 A（最小改动 · 推荐先验证）：让短路感知「未转换的 @名」

把短路条件从「DOM 与 value 完全一致就跳过」改为「确实没有可转换内容才跳过」：

```ts
// 伪代码：在短路前判断「当前 DOM 里是否仍存在可被 autoLink 命中的 @名」
const raw = serializeDOM(el);
const wouldChange = raw !== autoLinkAssetsByName(raw, all);
if (!nameChanged && !wouldChange) return;
```

- 优点：复用现有渲染入口，改动集中在一处；未命中资产名时仍走原短路、零性能损耗。
- 风险：每次输入多跑一次 `autoLinkAssetsByName`（纯函数、O(名×素材)，prompt 一般 <2KB，可忽略）；需小心「转换后 value vs DOM 光标」的抖动（`restoreCursor` 已处理光标，但要验证重组后光标位）。

### 方案 B（更精准）：粘贴 / 输入后就地转换命中的 @名

在 `handlePaste` 与 `onInput` 里，仅对「新增的文本片段」跑一次 `autoLinkAssetsByName`，把命中的 `@资产名` 直接就地替换成芯片节点（不整段 innerHTML 重建）。

- 优点：不触碰现有重建机制，性能最好，光标最稳。
- 缺点：要处理「跨 textNode 的 `@名`」「芯片前 ZWSP 落点」「与候选弹层插入的边界互斥」等细节，实现成本高于 A。

### 方案 C（架构级 · 与 docs/69 P2-A 同源）：editor 根文本化 + 持续重判

把 `docs/69` 里「方案 A：从 editor 根做一次轻量文本化，得到整段纯文本 + 光标偏移」落地后，`detectMentionQuery` / `autoLinkAssetsByName` 都能基于「整段文本」稳定工作，自动转换可挂在 `selectionchange` + rAF 上持续触发。

- 优点：彻底解决「跨 textNode 漏判」「输入即转换」等一连串问题，且为 docs/69 的形态 V2（搜索条）铺路。
- 缺点：改动面最大，需先做 docs/69 的 P2 拍板。

---

## 六、验收 / 自测建议（若后续实施）

| 用例 | 期望 |
|---|---|
| 在已渲染编辑器里粘贴 `@资产名`（命中某素材） | 松手后立即变为缩略图芯片，无需再操作 |
| 手输 `@资产名` 完整名字（不用弹层） | 输入完成后自动变缩略图 |
| 输入 `@不存在的资产` | 保持纯文本，不误转 |
| 输入 `@猫` 但候选里有「猫」「猫A」 | 不提前误转，仍走全等匹配语义（docs/70 约束） |
| 改名场景 | 旧 `@名` 仍随改名一并更新（现有行为不退化） |
| 性能 | 普通打字不卡顿；`autoLinkAssetsByName` 只在确有可转内容时跑重建 |

---

## 七、相关文件索引

| 文件:行 | 角色 |
|---|---|
| `src/components/base/prompt/PromptInput.tsx:219-236` | 重建 effect（含短路 `:225` 与转换调用 `:230`） |
| `src/components/base/prompt/PromptInput.tsx:531-546` | `handlePaste`（粘贴只插纯文本 + emit，不过滤） |
| `src/components/base/prompt/PromptInput.tsx:397-428` | `handleSelectMention`（候选弹层手动插入芯片——当前的 workaround 路径） |
| `src/components/base/prompt/promptChips.ts:282-306` | `autoLinkAssetsByName`（唯一转换函数） |
| `src/components/base/prompt/promptChips.ts:185-217` | `renderPromptToNodes`（字符串→芯片 DOM） |
| `src/components/base/prompt/promptMention.ts:81-88` | `detectMentionQuery`（候选层触发判定，与本文问题正交） |
| `docs/70-画布图片命名与@名匹配-全节点方案-2026-08-28.md` §7.5/§7.7 | 短路的设计意图（防重算） |

---

## 八、完美算法研究（2026-09-07 追加 · 研究结论，未改代码）

> 目标：**既准**（粘贴/手输命中就转、不早转不误转、改名不退化）**又不伤性能**（不打字卡顿、不每键整段重建、不加 timer）。
> 一句话：**保留现有「挂载/改名全量重建」，新增一条「就地转换 + 事件驱动提交」的运行期链路**（改进方向 B 的增强版）。
> 纯方向 A（每输入对整段跑一次 `autoLink` + 全量 innerHTML 重建）命中点太大、会把光标所在还在编辑的 `@名` 也误转，不满足「不早转」。

### 8.1 语义不动点（先定义「转对了」是什么）

记 `F(V) = autoLinkAssetsByName(V, all)`。稳定后的正确形态是：
`DOM == renderPromptToNodes(F(value))`（与挂载/改名重建后的结果一致）。

运行期自动转换的本质 = **让 DOM 尽快收敛到 F 的不动点**，但前提是：
- **不漏转**：粘贴、手输的 `@名` 最终都会到 F 态（验收 1/2/6）；
- **不早转**：光标还停在 `@名` 尾巴上、它可能被继续补打成更长的素材名（`猫`→`猫A`），或候选弹层还需要它来选择时，先不动（验收 4）。

### 8.2 两个判据（唯一规则，杜绝规则分叉）

| 概念 | 定义 | 作用 |
|---|---|---|
| **前沿 frontier** | 光标位置（IME 组字中除外）或粘贴片段末尾 | 只有「右边界 == frontier」的 `@名` 还可能继续变长；其余均已封口 |
| **可扩展 extendable(name)** | ∃ 素材 label ≠ name 且 `label.startsWith(name)`（如 `猫` 之于 `猫A`） | 判定 frontier 处的 `@名` 是否「可能被补成更长命中」 |

**命中扫描用「最长优先 + 非重叠」**（与 `autoLinkAssetsByName` 同一套语义，见 8.5），因此「可扩展的名」会自动让位给更长命中，不存在两套正则打架。

**提交判定**（对 finder 返回的每个命中 occ=`{start,end,name}`）：

| 条件 | 判定 | 说明 |
|---|---|---|
| `end < frontier` | ✅ **可提交** | 已被后续输入封口，永远不可能再变长为别的素材名（若可变长，finder 会命中更长项而非它） |
| `end == frontier` 且 `!extendable(name)` 且弹层除同名项外无其它候选 | ✅ **可提交（即时转，零等待）** | 打完即唯一/最长命中；弹层没给用户其它可选项，转它 = 替用户按了回车 |
| `end == frontier` 且 `extendable(name)` 或弹层还有其它候选（如 `猫` vs `花猫`） | ⏸ **延迟** | 等终结字符 / 光标离开 / 弹层选中后再判 |

> 「弹层还有其它候选」的判断：`filtered`（现 `includes` 过滤）里存在 `label !== query` 的项。名字含但不以 query 开头的项（`猫` vs `花猫`）也应保留弹层可选项，避免用户无法用方向键选它。

### 8.3 事件驱动决策表（接线落点 = PromptInput.tsx）

| 事件 | 动作 | 验收对应 |
|---|---|---|
| **粘贴** `handlePaste` | 整段插入纯文本后，对该 textNode 跑一次提交；**粘贴片段末尾若还是 extendable 的 open query，最末一个命中延迟**（否则「贴 `@猫` 再手补 `A` 成 `@猫A`」会被提前转死） | 1：松手即变芯片 |
| **打字** `onInput`（非 IME） | 对光标所在 run 重跑提交：凡是 `end<frontier` 或「`end==frontier` 且条件满足」的命中就地转；`extendable` 的尾巴不动，留给下一步 | 2/3/4 |
| **终结字符**（空格/标点/换行/超长） | 字符使 query 关闭 → 原尾巴 `end` 变为 `< frontier` → 按 8.2 自动可提交。**这就是「打空格/打逗号即转」**，不需要回退重开弹层 | 2 的退化场景 |
| **光标离开 / blur** | 残留的尾巴按 8.2 判一次；**仅当本实例持有关注/光标（`saveCursor` 非 null）时提交**，避免共享 value 的面板实例抢转换（复用现有 `saveCursor` 判空防线） | 5 |
| **素材改名 / 挂载** | 维持现状：`nameChanged` 绕过短路 → 全量重建（现有行为不退化） | 6 |
| **IME 组字中** | 一律不判不转（`composingRef` / `isComposing`，与 `detectMention` 同守卫） | 中文输入不闪 |

**性能预算（对照现状每次按键已做的开销）**：
- 现状每次按键已：`emitDOM` 全量 `serializeDOM`（O(n)，n≈prompt 全文 <2KB）+ effect 里再 `serializeDOM(el)===value` 比对一次 → 与是否转换无关，跑不了；
- 新增：仅命中时对**光标所在 run**（几十~几百字符）跑一次 finder + 就地 DOM 手术（拆 textNode→[前文][chip][后文]，补 ZWSP 光标位，换算光标）；
- 不新增：**无整段 innerHTML 重建、无定时器、无常驻监听**（selectionchange 仅在有尾巴待判时挂，可用 rAF 合并，仿 §五/69 M2 的范式）。

**最坏情形**：粘贴大段含大量 `@名` → 对该段一次性 O(段长×素材名)，一次性成本可接受；且粘贴本就要一次重排。

### 8.4 就地转换的 DOM 手术要点（为何比方向 A 稳）

| 点 | 处理 |
|---|---|
| 转一个命中 | 把 textNode 按 `[s,e)` 拆三段，中间 `buildChipEl` 替入；芯片前无文本/前一兄弟是 BR/芯片 → 补 ZWSP 光标位（复用 `ensureCaretSlotBeforeChip`/`normalizeChipSlots`） |
| 光标 | 若光标恰在 `@名` 尾后（典型打字场景），手术后落点 = 芯片后；因只动本地且目标明确，**不用走全局 saveCursor/restoreCursor**（那套「@名算 2 字符、芯片算 1 单位」在跨转换时有偏移漂移风险，是本方案不选全量重建的核心理由之一） |
| 收尾 | `normalizeChipSlots(el)` + `emitDOM()`；effect 随后比对 `serializeDOM(el)===value` 相等 → 短路，不重跑，无闪烁 |
| 边界 | `@名` 横跨两个 textNode（理论残留）→ 以「run 内最近边界（BR/芯片/块首）到光标」为操作单位；粘贴片段天然单 textNode，不受影响 |

### 8.5 落地步骤（施工时按此拆，可独立单测/回滚）

1. **纯函数** `promptChips.ts`：把 `autoLinkAssetsByName` 重构为复用新增 `findAutoLinkOccurrences(text, assets) → [{start,end,name,asset}]`（最长优先、非重叠），**让「批量转换」与「就地提交」共用同一匹配源**——根治两套规则分叉（69 P1 的隐患顺带消除）；新增 `extendable(name, assets)`、`isTerminatedByBreak` 类小纯函数（BREAK 集从 `promptMention.ts` 导入，边界单一真源）。补表驱动单测。
2. **DOM 助手**（`promptChips.ts` 或组件内）：`commitOccurrencesInRun(node, assets, frontierOffset)` 就地转 + 光标换算，返回是否变化。
3. **事件接线** `PromptInput.tsx`：粘贴 / 打字 / 终结字符 / blur(与 selectionchange 二选一) 四处调提交；IME 与共享实例守卫照抄现有 `saveCursor` 防线。
4. **测试**：纯函数 finder/extendable 表驱动（含 `猫`/`猫A`、`猫`/`花猫`、正则特殊字符）；组件级「粘贴即转 / 手输唯一名即转 / 猫猫歧义不早转 / 打空格转 / IME 不转 / 双实例不抢焦点」回归。

### 8.6 与既有各方案的取舍

| 方案 | 为何不直接采用 |
|---|---|
| 方案 A（§五）改短路为「`raw!==F(raw)` 就全量重建」 | 每键多一次整段 `autoLink` + 命中即整段 innerHTML；且「唯一名打完」在弹层开着时会被立即全量转（早转），必须在 effect 里再叠 query 感知，逻辑反而更绕；光标经 saveCursor/restore 跨转换有偏移漂移 |
| 方案 C（§五，根文本化） | 方向正确（为跨 textNode 与形态 V2 铺路），但改动面最大；本次的 frontier 判据已能把运行期问题收在 textNode 内解决，C 留作后续独立做 |
| **本方案（B 增强）** | 命中即转、只动本地、无 timer、无全量重建；匹配源与 F 单一 → 天然收敛到不动点，准与性能兼得 |

### 8.7 待拍板决策

1. **弹层开着时要不要「即时转」**（8.2 第三行判定）：本设计取**折中**——仅当候选列表只剩同名项才即时转（=替按回车），只要还有别的名字候选就留给弹层/终结字符。若产品想要更贴近 Notion（弹层开着绝不自动转、一律等回车/空格），删掉第三行判定即可，属一行开关。
2. **运行期 `@名` 是否加强「前/后边界」**（69 §十二-P1 遗留：`我的邮箱abc@人物参考` 这类文本全量 autoLink 仍会误转）：与本次问题正交，动它会改 `autoLinkAssetsByName` 契约并牵连挂载/改名全量链路与既有单测，**建议另开议题**，不混入本次施工。
