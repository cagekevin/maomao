# ADR-0007 · 接管全局 API 的原引用必须闭包捕获

- **状态**：生效
- **结论**：接管全局 API（console／fetch／Date…）时，原引用必须在包装那一刻捕获进闭包；禁止查全局私有属性 + 兜底回落（会自噬）
- **日期**：2026-09-18
- **裁定人**：架构师（取证后自定）
- **触发**：TD-08-37（logWriter 用 `console._orig_*` + `|| console[level]` 兜底，该兜底一旦可达即**无限递归**）

## 背景

进程内接管全局 API（monkey-patching）的常规写法是"保存原引用 + 替换 + 包装里回调原引用"。
本仓 `localTool/src/utils/logWriter.ts` 接管 `console.log/info/warn/error` 时是这么写的：

```ts
// 旧写法
(console as unknown as Record<string, unknown>)[`_orig_${m}`] = console[m].bind(console); // 存到全局私有属性
console[m] = ((...args) => write(m, args)) as typeof console.log;
// write() 内部：
const orig = (console as unknown as Record<string, any>)[`_orig_${level}`] || console[level]; // ← 兜底
```

两个问题：
1. **真源跑到全局对象上**：`console._orig_*` 是往一个**共享的全局对象**塞私有状态 —— 真源与实现分离，任何第三方也能改它。
2. **兜底会自噬**：`|| console[level]` 的回落目标，在**接管之后就是本包装自己** ⇒ 一旦该兜底可达（init 没跑全、或有人新增 `write('debug', …)` 调用点），就是**无限递归**（栈爆），
   而不是一个可诊断的失败。它用"静默回落到会自噬的路径"掩盖了「**接管时序**」这条契约。

## 判据（它凭什么成立）

- **不能靠守卫**：直觉方案是"加 `if (!orig) throw`"。但按上游不变量「init 必先赋值全部 level」，
  该守卫**不可达** ⇒ 7 步法 Step 4 明写「守卫必须能真触发；按上游不变量恒真/恒假 = **假护栏** ⇒ 要么删、要么改成真判据」。
- **结构优于守卫**（手段优先级 1 > 3）：把原引用**捕获进闭包**，「缺失」在结构上**不可能发生** ——
  于是既不需要兜底，也不需要守卫，契约不再依赖"记得先 init"。

## 决议

**接管全局 API 时，原引用必须在「包装那一刻」捕获进闭包**：

```ts
for (const m of methods) {
  const orig = console[m].bind(console);                       // 捕获
  console[m] = ((...args: unknown[]) => write(m, args, orig)); // 传入闭包
}
function write(level: string, args: unknown[], orig: () => void): void { … orig(...args); }
```

- **禁止**把原引用存到全局对象（`console._orig_*` / `window.__orig*` 一类）后**运行时查找**；
- **禁止**以"查不到就回落到 `console[level]` / `fetch` 本身"作兜底（**回落目标就是包装自己 ⇒ 自噬**）；
- 落点：`localTool/src/utils/logWriter.ts`。

## 后果

- ✅ 全局私有属性 4 个 → **0**；兜底 1 → **0**；契约由**结构**保证（不靠"记得 init"）。
- ✅ 消费方零改动（`initLogWriter` 对外签名未变）。
- ⚠️ **代价 / 回潮风险**：捕获进闭包后，**无法在运行中换回原实现**（如"临时停用接管"）。本仓无此需求；
  若将来要"可撤销的接管"，必须**显式提供 `restore()`**，而不是靠"查全局属性"。
- 📌 **违反时的判据**：
  1. 全仓 grep `_orig_` / `__orig` 出现在**代码**里（注释除外）；
  2. 包装函数内部出现"查不到原引用就回落"的分支 —— 且**回落目标是被包装的那个 API 本身**；
  3. 接管代码把原引用挂在被包装的对象上（而非闭包）。
