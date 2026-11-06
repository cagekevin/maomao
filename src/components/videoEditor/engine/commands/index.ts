export { Command } from './base-command';
// 【2026-11-06 · V8】原 `export { BatchCommand } from './batch-command'` 已删：
// barrel 唯二消费者（use-editor-actions / views/media）只取 Command 系；BatchCommand 的真实消费方
// managers/commands.ts 走叶子路径 import，不经 barrel ⇒ 该行是重复导出（单一规则原则）。

export * from './timeline';
export * from './media';
export * from './scene';
export * from './project';
