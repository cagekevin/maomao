# ADR-0005 · 深拷贝=结构化克隆（禁 JSON 往返）

- **状态**：生效
- **结论**：深拷贝唯一入口 deepClone（structuredClone）；非克隆化类型（函数/Symbol/DOM）根部抛错，不静默丢弃
- **日期**：2026-09-18
- **裁定人**：架构师（取证后自定）
- **触发**：TD-18-9（`deepClone` 签名承诺 `T` 实为 JSON 深拷贝，`as T` 假收窄）

## 背景

`core/utils.deepClone` 的旧实现是 `JSON.parse(JSON.stringify(v)) as T`，约束只写在注释里
（「含函数/Date/循环引用者请勿用」）。它在**类型层**和**运行时**同时说了假话：

| 面 | 旧实现的谎 |
| --- | --- |
| 类型 | 签名承诺 `T`，实现返回 `any` → 靠 **`as T` 假收窄**圆场 |
| 运行时 | **静默丢数据**：丢 `undefined` 字段 · `Date`→字符串 · `Map`/`Set`→`{}` · 循环引用抛 `TypeError` |
| 守卫 | 约束只在注释 = **假护栏**（无任何机器校验） |

## 判据（它凭什么成立 / 为什么不成立）

- **旧约定凭什么成立？答不出。** 它既非物理红线，也非类型层约束，更无对账测试支撑 ⇒ 按**铁律 6**，它就是**待消灭的对象**。
- **能力取证**：`structuredClone` 在 node 与 jsdom（vitest）环境**均可用**，且**仓内已有先例**
  （`nodeDataSchema.ts:120` · `d3dPersistence.ts`）—— 不是新引入的重依赖。
- **消费面取证**：`director3d` 与 `clipboard` 传入的均为**纯 JSON 数据**
  （`project.ts` 里的 `Map`/`Set` 全是局部计算，不在被克隆结构内）⇒ 两实现对现有消费方**行为等价**（无回归风险）。
- **Step 0 附带发现**：仓内「深拷贝」实有 **2 份实现**（`deepClone` + `d3dPersistence.ts` 的裸 `structuredClone`）。

## 决议

1. **唯一实现**：`deepClone<T>(value: T): T` → `structuredClone(value)`
   - **原生返回 `T`**（无需 `as`）⇒ 假收窄消除；
   - 保留 `Date` / `Map` / `Set` / **循环引用** ⇒ 静默丢数据消除；
   - 含**函数 / Symbol / DOM 节点**者抛 `DataCloneError` ⇒ **失败改为根部炸开**（一诚实闸）。
2. **第二份实现收口**：`d3dPersistence.ts` 的裸 `structuredClone(project)` 改委托 `deepClone`。
   ⚠️ 必须从**叶模块** `base/core/utils.ts` 取 —— `project.ts:17 → d3dPersistence.ts` 已存在，反向 import 会**成环**。
3. **落点**：`src/components/base/core/utils.ts`（唯一实现）· `src/components/director3d/d3dPersistence.ts`（改委托）。
4. `director3d` 域内仍以 `cloneProjectValue` re-export（域内语义名，消费方零改动）。

## 后果

- ✅ 类型诚实（无 `as T`）· 不再静默丢数据 · 失败可见（根部抛错）· 深拷贝实现份数 2 → 1。
- ✅ 消费方**零改动**（签名与返回类型未变）。
- ⚠️ **代价 / 行为变化**：含 `Date` 的数据由「变字符串」改为「保留 `Date`」；含 `Map`/`Set` 的由「变 `{}`」改为「保留」。
  本次取证确认现有消费方**均为纯 JSON 数据**，不受影响；**新**消费方若依赖旧的归一化语义，必须显式走 JSON 序列化。
- ⚠️ **回潮风险**：有人为「能塞进 localStorage」而"顺手"改回 JSON 往返（`localStorage` 需要 JSON 可序列化 —— 那是**持久化层**的职责，不是深拷贝的）。
- 📌 **违反时的判据**：
  1. 全仓 grep `JSON.parse(JSON.stringify` 出现在**深拷贝**语境；
  2. `deepClone` 里出现 `as T` 或 `JSON.`；
  3. 出现第三份深拷贝实现（裸 `structuredClone` 用于拷贝业务对象）。
