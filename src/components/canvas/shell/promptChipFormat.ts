/**
 * prompt 芯片**字符串格式契约**的唯一真源（零依赖纯逻辑）。
 *
 * ════════════════════════════════════════════════════════════════
 * 【为什么单独成文件（TD-22-68 断环 · 2026-09-20）】
 *
 * 母体：芯片序列化格式 `@{id:label}` 的正则（`promptChipRe`）原住在
 * `canvas/shell/promptChips.ts` —— 那是 **DOM 工具层**（整文件围着
 * `document.createElement` / `Node.ELEMENT_NODE` 转）。而**纯逻辑**的
 * `creative/creativePresets.ts`（`collectPresetIds` 要抽 `cp_*` 胶囊 id）也用它
 * ⇒ 依赖链变成：
 *
 *   hooks/useNodeData → creativePresets（纯逻辑） → canvas/shell/promptChips（DOM 工具层）
 *
 * 即「**纯逻辑层依赖 DOM 工具层**」—— 与 `useNodeData → creative 域门面(UI)` 同源的
 * **依赖倒置**，只是换了跳。它会把 DOM 层的依赖（`logger`、`promptMention`）连带拖进
 * 任何本想只要一个正则的消费者（如 `hooks/useNodeData`）。
 *
 * 【本方案：把"格式契约"从"DOM 工具"里剥出来】
 * `promptChipRe()` 描述的是**字符串格式**（`@{id:label|thumb}` 长什么样），
 * 与 DOM 毫无关系 —— 它只是**恰好被写在了** DOM 工具文件里。剥到本文件后：
 *   · 本文件**零 import** ⇒ 真叶子；
 *   · `promptChips.ts`（DOM 工具层）从本文件取正则 ⇒ 依赖向下（DOM → 格式契约）；
 *   · `creativePresets.ts`（纯逻辑）从本文件取正则 ⇒ 依赖向下（逻辑 → 格式契约）；
 *   · `hooks/useNodeData` 的依赖链末端收敛在**零依赖叶子**，不再拖进 `canvas/shell/`。
 *
 * 【诚实边界】本文件只搬「格式契约」这一件事，**不搬任何 DOM 函数**
 * （`buildChipEl` / `serializeDOM` / `renderPromptToNodes` 等一律留在 `promptChips.ts`）。
 * 格式契约是字符串级事实，DOM 操作是实现层 —— 两者本就该分层。
 * ════════════════════════════════════════════════════════════════
 */

/**
 * 芯片序列化正则（唯一入口，禁止散落复制）。
 * 格式：`@{id:label}` 或 `@{id:label|thumbUrl}`（thumbUrl 可选）。
 *   - group1 = id（不含冒号）
 *   - group2 = label（不含 `|` 与 `}`，旧数据无 url 段时完全兼容）
 *   - group3 = 可选缩略图 URL（已 encodeURIComponent，防止 `}` 等字符破坏解析）
 * 旧数据 `@{id:label}`（无 `|`）也能正确匹配，向后兼容不崩。
 *
 * 【为什么是工厂而非常量（TD-05-5）】`/g` 正则在 `exec()` 后**携带 `lastIndex` 可变状态**：
 * 模块级共享同一实例时，任何一处 `exec` 中途 return 都会让**下一次调用从错位置开始**（静默丢匹配）。
 * 原实现导出 const `PROMPT_CHIP_RE`（外部可持同一实例）——现改为工厂，调用方各拿各的，
 * 从结构上消除共享可变状态。内部 `exec` 循环亦改用局部实例。
 */
export const promptChipRe = (): RegExp => /@\{([^:]+):([^|}]*)(?:\|([^}]+))?\}/g;
