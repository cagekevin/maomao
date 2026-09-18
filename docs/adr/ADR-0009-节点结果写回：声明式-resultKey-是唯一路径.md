# ADR-0009 · 节点结果写回：声明式 resultKey 是唯一路径

- **状态**：生效
- **结论**：节点结果写回只认声明式 resultKey（成功首写／落盘后覆盖／广播恢复三处共用）；onSuccess／onRecover 只做非 data 副作用，禁止再写同字段。旧「幂等双写无害」被推翻。
- **日期**：2026-09-18
- **裁定人**：架构师（取证后自定）
- **触发**：TD-01-21

## 背景

`useNodeGeneration` 同时提供**两套**写回 `node.data` 的手段：

- **声明式**：`resultKey`（成功首写）+ `recoverable`（广播恢复开关）—— hook 内自动 `patchData`；
- **回调式**：`onSuccess` / `onRecover` —— 节点可自行 `patchData`。

JSDoc 明文背书两者可并存：「onRecover/onSuccess 与声明式并存时，若都写了同一字段会幂等双写（**无害**）」。
于是同一件事（写 `data[resultKey]`）在 hook 内有 **3 处内联判据**，在节点侧还有一条**口头许可**。

## 判据（它凭什么成立 / 为什么不成立）

**旧约定凭什么成立？答不出。** 它是「历来如此 + 看起来无害」，没有物理红线 / 类型层 / 唯一入口 / 对账测试支撑 ⇒ 属**待消灭的对象**（铁律 6 / ADR-0001）：

- 「幂等双写」的前提是「两份写回写的一定是同一个值」—— 而落盘前后 URL 本就不同（`settle` 写原始 URL、`onPersisted` 写持久 URL）；一旦节点回调也写，**谁最后赢取决于时序**，不再是幂等；
- 两份写回掩盖「谁是唯一写回」：排查「结果没回填」时要同时怀疑 hook 与每个节点的回调；
- `recoverable` 开关在**全部生产消费方中恒等于「有 resultKey」**（else 分支零消费 = 幽灵预留 M6）。

## 决议

1. **`resultKey` 是 `node.data` 结果写回的唯一声明**：成功首写 / 落盘后覆盖 / 广播恢复三处共用它；
   判据只此一条 —— **声明了就写、没声明就不写**。
2. **删 `recoverable` 开关**（上下两层同名 `recoverable` 一并删）；上层 `resultField` 与底层 `resultKey` **两名指一物 → 统一为 `resultKey`**。
3. **`onSuccess` / `onRecover` 只做非 data 副作用**（UI state 同步 / 业务记忆 / 节点重建）；**禁止**再 `patchData` 同字段。旧背书已删，改为明写禁令。
4. 回调**按需透传**（节点未声明就不透传空壳），消除 `onRecoverRef.current!` 非空断言掩盖的潜在 TypeError；`run` 改为必填，去掉对应 `!`。
5. 落点：`src/hooks/useNodeGeneration.ts`（唯一写回原语 `writeBackResult`）· `src/hooks/useGenerateNode.ts` · `ImageGenerate` / `VideoGenerate` / `TextGenerate` / `TemplateNode`。

## 后果

- ✅ 收益：hook 内同判据 **3 处 → 1 处**；选项面 **两名/两开关 → 一 name 一声明**；`!` 掩盖的契约缺口清 2 处（`onRecoverRef.current!` / `runRef.current!`）。
- ⚠️ 代价 / 回潮风险：该契约**靠注释与 code review 守护，无机器闸**（未建闸 —— 过「建闸前置评审」：回潮代价不足以抵一道闸的永久成本；`!` 类断言另有 TD-24-6 跟踪）。
  且「幂等双写无害」是**很顺口**的说法，最可能被后人重新写回文档。
- 📌 违反时的判据（怎么发现"又回去了"）：
  · `useNodeGeneration` 里出现**第二处** `patchData({ [resultKey] … })`，或恢复路径重新长出「额外开关」；
  · 任一节点的 `onSuccess` / `onRecover` 内出现 `patchData({ <resultKey> … })`；
  · `grep -rn "recoverable" src/` 或 `grep -rn "resultField" src/` 重新命中（排除留痕注释）。
