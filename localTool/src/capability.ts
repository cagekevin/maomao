/**
 * capability — 生成能力枚举（`image` / `video` / `chat`）的**后端唯一真源**。
 *
 * 【为什么单独立一份文件（TD-08-59 的由来）】
 *   该枚举此前在后端有 **3 处独立定义**（`relay-poll.ts` · `generateEngine.ts` · `budget.ts`）
 *   ＋ **2 处运行时字面量列举**（`capabilityFromRow` · `routes/generate.ts` 的 HTTP 边界校验）。
 *   `type X = 'image' | 'video' | 'chat'` 的副本是**结构同构**的 ⇒ TS 编译不报、漂移不显，
 *   加第 4 个能力时必有一处漏改（ADR-0057 的立项实证）。
 *
 * 【为什么真源住这里，而不是 `relay-poll.ts` / `budget.ts`】
 *   · 「有哪些生成能力」与「预算数值」「轮询实现」是**不同判据**（变化速率也不同）⇒ 不同居（ADR-0044）；
 *   · 本文件**零 import**（叶子）⇒ `budget.ts` / `relay-poll.ts` / `generateEngine.ts` 都能单向引用它，
 *     不会与既有的 `relay-poll → budget`（`budgetMsFor`）形成环。
 *
 * 【跨栈边界 —— 前端那份为什么不销（ADR-0057 · check-arch 规则 14）】
 *   前端（`src/`，vite 构建）与后端（`localTool/`，node 独立构建 + 独立 package.json）**无共享模块机制**
 *   ⇒ 前端 `relayProxy.ts` 那份是**结构必然**，不是 SSOT 第二份。真正的防线是**两侧成员集合的机器对账**
 *   （`check-arch` 规则 14 的 `RelayCapability` union 项）。
 *   ⇒ 改这里的能力集时**必须同步前端那份**，否则 `npm run check:arch` 红。
 */

/** 生成能力全集 —— 值与类型同源，禁止在别处再列举这三个字面量。 */
export const RELAY_CAPABILITIES = ['image', 'video', 'chat'] as const;

/** 生成能力（后端唯一真源类型）；消费方一律 `import type`，**禁再列举字面量**。 */
export type RelayCapability = (typeof RELAY_CAPABILITIES)[number];

const CAPABILITY_SET: ReadonlySet<string> = new Set(RELAY_CAPABILITIES);

/**
 * 运行时守卫（唯一实现）：`unknown` → `RelayCapability` 的类型谓词。
 *
 * 消费方**禁**再写 `x === 'image' || x === 'video' || x === 'chat'` —— 那是同一判据的第二份字面量，
 * 也是本次收口销掉的载体形态（`capabilityFromRow` / `routes/generate.ts` 两处）。
 * 运行时值来自 `JSON.parse` / HTTP body，**类型系统管不到** ⇒ 边界只能靠本守卫。
 */
export function isRelayCapability(v: unknown): v is RelayCapability {
  return typeof v === 'string' && CAPABILITY_SET.has(v);
}
