import { Command } from './base-command';

export class BatchCommand extends Command {
  constructor(private commands: Command[]) {
    super();
  }

  execute(): void {
    for (const command of this.commands) {
      command.execute();
    }
  }

  override undo(): void {
    for (const command of [...this.commands].reverse()) {
      command.undo();
    }
  }

  override redo(): void {
    for (const command of this.commands) {
      command.execute();
    }
  }

  /**
   * 批次"是否真的改动了状态" = **有没有任意一个子命令改动了**。
   * 全部空转 ⇒ 整个批次空转 ⇒ `CommandManager` 不入栈（与单条命令同判据）。
   */
  override getDidApply(): boolean {
    return this.commands.some((command) => command.getDidApply());
  }
}
