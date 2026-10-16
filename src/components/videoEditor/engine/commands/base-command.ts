/**
 * 命令基类。
 *
 * 【入栈判据（本类的核心契约）】`CommandManager` 按 `getDidApply()` 决定是否把命令放进
 * 撤销历史：**什么都没改**的命令不入栈。
 *
 * 【为什么需要它】`CommandManager.execute()` 原先**无条件** `history.push(command)` ——
 * 于是"按下去没反应"的操作（无选中时点「复制元素」、给文本轨点「静音轨道」）也会留下一条
 * **空历史记录**：用户按撤销时看起来"什么都没变"，以为撤销坏了。
 *
 * 本仓其实早有这条判据（`TimelineManager.buildAddTransitionCommand` 返回 `null` = 不入栈，
 * 注释明写"否则撤销历史里会多一条按下去没反应的命令"），但它**靠在每个调用方自觉**。
 * 现在把它升级为**管理器裁决** ⇒ 任何命令、任何调用路径都不再产生空记录。
 *
 * 【默认安全】默认 `true`（保持既有"命令默认入栈"语义）。空转的命令在 `execute()` 里调
 * `markNotApplied()`：**漏调 ⇒ 退回"多一条空历史记录"（与改动前同），不会更糟**；
 * 调对 ⇒ 历史里不再有"按下去没反应"的条目。方向选这一侧是有意的：把"忘了声明"的代价
 * 放在"多一条无用记录"上，而不是"该撤销的撤销不了"。
 */
export abstract class Command {
  private applied = true;

  abstract execute(): void;

  /**
   * 声明"本次 `execute()` 什么都没改"：无选中 / 对象不支持该开关 / 找不到目标 …
   * 调用点放在**提前 return 的那一支**（且该分支不应再触发 `updateTracks`）。
   */
  protected markNotApplied(): void {
    this.applied = false;
  }

  /** 本次执行是否真的改动了状态（`false` ⇒ `CommandManager` 不入栈、也不清 redo）。 */
  getDidApply(): boolean {
    return this.applied;
  }

  undo(): void {
    throw new Error('Undo not implemented for this command');
  }

  redo(): void {
    this.execute();
  }
}
