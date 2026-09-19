/**
 * `EditorCore` 单例的**叶子访问点** —— 打破 `engine/core` ↔ 命令类 的结构环（TD-22-68）。
 *
 * ════════════════════════════════════════════════════════════════
 * 【为什么需要这个文件（这是 TD-22-68 的解，不是可选封装）】
 *
 * 母体：`engine/core/index.ts` **既当 barrel、又定义 `EditorCore` 实现**，而 24 个命令类
 * 在顶层 `import { EditorCore } from '@/…/engine/core'` 并调 `EditorCore.getInstance()`
 * ⇒ 命令 ↔ core **目录级互依**，形成 25 组结构环：
 *
 *   core/index.ts →(值, new XManager)→ managers/*-manager.ts
 *                 →(值, 引 barrel)→   commands 各分组 index.ts
 *                 →(值)→              commands 下的叶子命令文件
 *                 →(值, 这里)→        core/index.ts   ← 环闭合
 *
 * 【为什么"命令改注入 EditorCore 实例"不是唯一解、也不是本仓要的形态】
 * 命令类**只在 execute()/undo() 调用期**需要 editor（构造期不需要），
 * 全量改成注入 = 动 24 个命令的构造签名 + 全部 new 点 + 命令栈语义（undo/redo 正确性），
 * 改动半径远大于收益（本仓 §「闸把作者逼成它禁止的样子」的教训）。
 *
 * 【本方案：把"访问单例"这一件事挪到叶子】
 * 环的闭合边是「命令 → `core/index.ts`（那个**又定义类、又当 barrel** 的大模块）」。
 * 断环只需让命令依赖一个**零运行时依赖的叶子**：
 *   · 本文件只 `import type { EditorCore }`（编译擦除，无运行时边）⇒ **真叶子**；
 *   · 命令 import 本文件的 `getEditor()` ⇒ 不再触达 `core/index.ts`；
 *   · `core/index.ts` 的构造函数调 `registerEditorInstance(this)` ⇒ 值边指向叶子（单向，无环）。
 *
 * 【依赖方向（改后）】
 *   editorInstance.ts（叶子 · 零运行时依赖）
 *        ↑                                  ↑
 *   命令类（execute 期 getEditor()）    core/index.ts（构造期 registerEditorInstance）
 *
 * 【诚实边界】本文件持有的是**运行期引用**，不是"第二份单例真源" ——
 * 真源仍是 `EditorCore` 的 `static instance` / `getInstance()`（`core/index.ts`），
 * 本文件只做**转存**（`registerEditorInstance` 由构造函数唯一调用）。两处必须同步，
 * 故 `getEditor()` 在未注册时 fail-loud（不静默返回空对象：那会让命令静默失效）。
 * ════════════════════════════════════════════════════════════════
 */
import type { EditorCore } from '@/components/videoEditor/engine/core';

let instance: EditorCore | null = null;

/**
 * 由 `EditorCore` 构造函数调用 —— **唯一**写入点。
 * 各 manager / 命令类**不得**调用本函数（否则就是"第二份单例真源"）。
 */
export function registerEditorInstance(core: EditorCore): void {
  instance = core;
}

/**
 * 取当前 `EditorCore` 单例（命令类在 `execute()` / `undo()` 内使用）。
 *
 * 【为什么 fail-loud】命令的 `execute()` 只会在实例已存在后被调用（实例由
 * `getInstance()` 构造、构造期即注册）。取不到 = 有人绕过 `getInstance()` 直接 new
 * 或加载序被打乱 —— 此时**静默返回 null/空对象**会让命令无声失效（本仓 M5 母体
 * 「失败不可见」），故直接抛错。
 */
/**
 * 由 `EditorCore.reset()`（静态·仅测试）调用 —— 静态单例被丢弃时同步清空本叶子，
 * 否则 `reset()` 后 `getEditor()` 仍会返回**已丢弃的旧实例**（测试隔离假通过）。
 */
export function clearEditorInstance(): void {
  instance = null;
}

export function getEditor(): EditorCore {
  if (!instance) {
    throw new Error(
      'EditorCore 实例尚未注册（engine/core/editorInstance.ts）—— ' +
        '请经 EditorCore.getInstance() 获取实例，勿直接 new。',
    );
  }
  return instance;
}
