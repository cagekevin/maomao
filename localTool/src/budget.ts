/**
 * 生成任务**预算真源**（capability → 「这个任务该等多久」，ms）。
 *
 * 【为什么真源归后端，且必须只有一份】（143 · 规划 §2.2）
 *   预算是「这个任务该等多久」这个**业务判据**；而「某平台实测要多久」这类知识**只有后端有**。
 *   前端硬编码 `VIDEO_TIMEOUT` = **消费者替生产者定真相**（三铁律③：消费者禁止替生产者做任何决定）。
 *   ⇒ 后端持有默认，**在接口响应里告知**调用方（生产者给全）；调用方可以传 `override` 表达
 *   「我这次只等 N 秒」，但**覆盖是输入，不是默认真相**。
 *
 * 【数值口径 —— 每个数都要能说出它凭什么】
 *   · `chat 180_000` —— 对应前端 `CHAT_TOTAL_TIMEOUT`（= `CHAT_TIMEOUT` 120s + 60s 宽限）。
 *     ⚠️ **不是** `CHAT_TIMEOUT=120s`：后者是「等上游响应」**段**的值，不是任务总预算（规划 §2.3）。
 *   · `image 300_000` —— 实测 **p99**（`tasks` 表 n=478，p99=295.8s，max 482.3s）⇒ 覆盖 99%。
 *     超窗的那 ~0.84% **不是损失**：前端预算用尽返回 `pending`（**非终态**），消费方保持 running
 *     并由恢复轮询续 attach 到真终态（实证样本 `task_mtmo41qq_nzr13p`：482.3s 仍 `completed` + 有结果）。
 *   · `video 600_000` —— ⚠️ **无实测支撑**（`tasks` 表 video 仅 **6** 条样本、max 250s）⇒ 沿用现值，
 *     **待补实测**。别把它读成「实测够用」。
 *
 * 【为什么不预建 `[provider]` 层】（ADR-0053 ①：不许为设想的消费方铺路）
 *   加 provider 层的前提 = **先有该 provider 的实测分布**。没有数据就建空层 = 幽灵预留。
 *   要加时的形状：`override ?? DEFAULT_BUDGET_MS[provider]?.[capability] ?? DEFAULT_BUDGET_MS[capability]`
 *   —— 只加这一层查表，不改调用方。
 *
 * 【落点为什么在这里，而不是 `ai-relay/index.ts`】
 *   `ai-relay` 的自我定位是「12 个中转的**连接层** kit」（见其文件头）—— 预算是**本应用的业务策略**，
 *   不是连接层能力。故落在 `localTool/src/` 根（与 `relay-poll.ts` / `generateEngine.ts` 同级，
 *   两个消费方都是根级模块，零新增依赖边、也不污染库的边界）。
 */

export const DEFAULT_BUDGET_MS = {
  chat: 180_000,
  image: 300_000,
  video: 600_000,
} as const;

export type BudgetCapability = keyof typeof DEFAULT_BUDGET_MS;

/**
 * 预算**唯一入口**：`override`（调用方本次耐心）优先于后端默认。
 *
 * 【为什么 override 要过校验，不能只写 `override ?? DEFAULT`】
 *   `??` 只挡 `null`/`undefined` —— 实证 `0 ?? 5 === 0`、`NaN ?? 5 === NaN`。
 *   而 `0` 在本仓语义是「**不掐点**」（见 `httpClient` 契约），`NaN` 会让 `setTimeout` 立即触发
 *   ⇒ 两者都会把「有预算」变成「没预算/秒超时」。故与路由层 `body.timeoutMs` 的校验同口径
 *   （`Number.isFinite && > 0`）再兜一道。
 */
export function budgetMsFor(capability: BudgetCapability, override?: number): number {
  return typeof override === 'number' && Number.isFinite(override) && override > 0
    ? override
    : DEFAULT_BUDGET_MS[capability];
}
