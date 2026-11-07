/**
 * 「把文件拖到文件夹卡片上」的**判据层**（纯函数 · 无 React / 无 IO）。
 *
 * 【为什么抽出来】原判据埋在 `useResourceMoveToFolder` 的 `onDrop` 闭包里 —— 只有渲染测试
 * 能碰到它（本仓已禁 TSX 测试，见 `AGENTS.md §2.3`）。而这里恰恰是**失败可见性**的关键路径：
 * 「未连接引擎 / 非本地资源 / 同目录」三种情况各自要给出不同提示，`moveFile` 失败必须透出后端文案
 * 而不是报成功（TD-12-8）。抽成纯函数后由 `resourceMoveGuard.test.ts` 直接锁。
 *
 * 【与 hook 的分工】本层只回答「这次拖拽该不该移动、移到哪、该说什么话」；
 * hook 只负责「读事件 → 调本层 → 执行 moveFile / toast」。
 */
import { canMoveAsset, resolveMovePaths } from '@/components/base/api/index.ts';

/** 判据只需这几个字段（结构类型，调用方传完整资源项也可）。 */
export interface MoveGuardItem {
  folder?: unknown;
  name?: unknown;
  source?: string | undefined;
  type?: string | undefined;
  url?: unknown;
}

/**
 * 卡片能不能作为拖拽源。
 * 判据：文件夹不是「被移动的东西」；无 url 的条目没有磁盘落点，拖了也移不动。
 */
export function canDragResourceCard(item: MoveGuardItem): boolean {
  return item.type !== 'folder' && Boolean(item.url);
}

export type ResourceMoveDecision =
  /** 这次拖拽不带本仓载荷（含坏 JSON）⇒ 静默忽略，不打扰用户 */
  | { kind: 'ignore'; reason: 'no-payload' }
  /** 明确不能移动 ⇒ 必须给用户一句原因（warning，不是 error） */
  | { kind: 'warn'; message: string }
  /** 可以移动 ⇒ 交给调用方执行 moveFile */
  | { kind: 'move'; src: string; dst: string; target: string };

/**
 * 落点决策（唯一判据，顺序即优先级）。
 *
 * 1. 引擎没连 → 说清楚为什么拖不进去（不静默：用户会以为是拖拽坏了）
 * 2. 没有载荷 → 忽略（别的来源拖进来的东西，不归这里管）
 * 3. 非本地资源 → 说清楚「只支持移动本地资源」
 * 4. 已在目标目录 → 说清楚，且**不调 moveFile**（否则会撞后端去重、行留旧目录 = 假成功）
 * 5. 其余 → 交给 moveFile
 */
export function decideResourceMove(input: {
  connected: boolean;
  item: MoveGuardItem | null;
  target: string;
}): ResourceMoveDecision {
  if (!input.connected) return { kind: 'warn', message: '请先连接本地引擎' };
  const item = input.item;
  if (!item) return { kind: 'ignore', reason: 'no-payload' };
  if (!canMoveAsset(item)) return { kind: 'warn', message: '仅支持移动本地资源' };
  const { src, dst, sameDir } = resolveMovePaths(item, input.target);
  if (sameDir) return { kind: 'warn', message: '文件已在目标目录' };
  return { kind: 'move', src, dst, target: input.target };
}
