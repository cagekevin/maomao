/**
 * videoEditor 域「操作结果」统一契约形态 —— **唯一真源**。
 *
 * ════════════════════════════════════════════════════════════════
 * 【为什么需要这一层】本域的写/读操作原本用四种互不相同的方式回答成败：
 *   ① 返回 id（失败也返回）—— 调用方只能**二次探测**（TD-22-37：`getAssets().find(name+url)`）
 *   ② 返回 void（失败静默）—— `await` 返回 ≠ 成功（TD-22-33 flush / TD-22-43 加载）
 *   ③ 宽松形状（`success?: boolean; error?: string`）—— 调用方靠**双检**兜（TD-22-38）
 *   ④ throw —— 唯一诚实的一种
 * 于是「成没成功」这个真相散在四处、且三处**不可判别**：调用方只能猜、探测或写防御双检。
 * 这是母体 **M1「结果契约缺位」** 在本域的表现（base 域早已用 `PersistOutcome` 收口，本域漏了）。
 *
 * 【形态（唯一）】判别位 = **`ok`**（与 base 域 `PersistOutcome` 同构，遵 CLAUDE.md §5.4.9 单一规则）：
 *   · 成功：`{ ok: true, ...载荷 }`
 *   · 失败：`{ ok: false, reason, message? }` —— `reason` 是**机器可判**的稳定词表（各域定义），
 *     `message` 给人看（开发者日志 / 用户提示）。
 * 新写「可能失败」的引擎操作**一律**返回本形态；调用方按 `ok` 分支，**禁止**再二次探测。
 *
 * 【与 `MigrationResult` 的关系（不要再来统一一次）】`MigrationResult`
 * （`engine/services/storage/migrations/transformers/types.ts`）的判别位是 `skipped`，
 * 它回答的是「**这次要不要迁移**」（成功 / 跳过 三态），**不是**「操作成没成功」——
 * 语义不同域，**刻意不合并**（合并会削掉 `skipped` 这层信息，且它已收口为唯一真源）。
 * ════════════════════════════════════════════════════════════════
 */

/**
 * 操作失败支（所有操作结果联合的失败形态，唯一）。
 *
 * @typeParam TReason 该域的失败原因词表（稳定、有限；**禁自由文本**——自由文本无法被调用方判别）
 */
export interface OperationFailure<TReason extends string = string> {
  ok: false;
  /** 机器可判的失败原因（各域词表；调用方据此分支，**禁**靠 message 猜）。 */
  reason: TReason;
  /** 给人看的补充说明（开发者日志 / 用户提示）；无则省略。 */
  message?: string;
}
