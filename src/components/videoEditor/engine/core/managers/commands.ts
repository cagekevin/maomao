// 【为何直引文件而非 barrel】`@videoEditor/engine/commands`（barrel）会拉进
// `timeline/transition/add-transition.ts` → `engine/core` → 本文件，形成**模块环**
// （本文件是 `EditorCore` 构造期就 new 的，环会在加载序上埋 TDZ 风险）。
// `batch-command.ts` 只依赖 `base-command.ts`（零依赖）→ 直引它是无环的。
import { BatchCommand } from '@videoEditor/engine/commands/batch-command';
import type { Command } from '@videoEditor/engine/commands/base-command';

export class CommandManager {
  private history: Command[] = [];
  private redoStack: Command[] = [];

  execute({ command }: { command: Command }): Command {
    command.execute();
    this.history.push(command);
    this.redoStack = [];
    return command;
  }

  /**
   * 批量执行 —— 把「一次用户动作」产生的多条命令**打包成一条历史条目**。
   *
   * 【为什么要有这个唯一入口（TD-22-51）】「要不要打包」这个判据原先散在各调用点各写一次
   * （`TimelineManager.updateElements` 写 `commands.length === 1 ? x : new BatchCommand(...)`、
   * `use-editor-actions` 直接 `new BatchCommand(...)`）—— 于是**必然漏**：
   * 转场批量应用（`transitions.tsx`）循环调 N 次 `addTransition` 就漏了，
   * 后果是**一次点击入栈 N 条、撤销要按 N 次**（用户以为撤销坏了）。
   *
   * 【判据】0 条 = 什么都不做（不入栈）；1 条 = 直接用（不包 Batch，保持与单条操作**同形**，
   * 免得多一层无意义的历史节点）；N 条 = `BatchCommand`（undo 逆序 / redo 正序）。
   *
   * @returns 实际入栈的命令；`null` = 空批次（未入栈，调用方无需回滚）。
   */
  executeBatch({
    commands,
    pushHistory = true,
  }: {
    commands: Command[];
    pushHistory?: boolean;
  }): Command | null {
    if (commands.length === 0) return null;

    const command = commands.length === 1 ? commands[0] : new BatchCommand(commands);
    if (pushHistory) {
      this.execute({ command });
    } else {
      command.execute();
    }
    return command;
  }

  undo(): void {
    if (this.history.length === 0) return;
    const command = this.history.pop();
    command?.undo();
    if (command) {
      this.redoStack.push(command);
    }
  }

  redo(): void {
    if (this.redoStack.length === 0) return;
    const command = this.redoStack.pop();
    command?.redo();
    if (command) {
      this.history.push(command);
    }
  }

  canUndo(): boolean {
    return this.history.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.history = [];
    this.redoStack = [];
  }
}
