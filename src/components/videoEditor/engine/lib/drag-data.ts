import type { TimelineDragData } from '@/components/videoEditor/types/drag';
import { tryParse } from '@/components/base/utils/asyncGuard.ts';
import { logger } from '@/components/videoEditor/lib/logger';

/**
 * 时间轴拖拽载荷的编解码（**唯一真源**）。
 *
 * ════════════════════════════════════════════════════════════════
 * 【设计原则】判据只看「本次拖拽自己的事实」，不引入任何跨拖拽状态。
 * ════════════════════════════════════════════════════════════════
 * 一条拖拽的载荷**只存在于 `dataTransfer` 里** —— 它是这次拖拽自己的、随拖拽生灭的。
 * 因此：
 *   · 判断「是不是内部素材拖拽」→ 只看 `dataTransfer.types`（`hasDragData`）。
 *   · 取载荷 → 从 `dataTransfer.getData()` 读（`getDragData`）。
 *
 * 【为什么没有内存副本（原 `lastDragData` 已删）】
 * 旧实现用一个模块级 `lastDragData` 兜底「`getData()` 读不到时」，并把
 * `lastDragData !== null` 混进 `hasDragData` 的返回值。后果是**跨拖拽污染**：
 * 上一次拖拽的残留会让本次「外部文件拖入」被误判为「内部素材拖拽」
 * （`useFileUpload.containsFiles` 即 `!hasDragData(...) && types.includes('Files')`）
 * → 外部文件被静默丢弃 = 「导入第 2 个素材就导不了」。
 *
 * 而那个副本本身也救不了它声称要救的场景：浏览器若在 `dragover` 阶段屏蔽 `getData()`，
 * 拿到的是**上一次拖拽**的数据（同样的错值）——副本是纯负担，不是兜底。
 *
 * 【纪律】禁止重新引入任何「记住上一次拖拽」的模块级变量。
 */

const MIME_TYPE = 'application/x-timeline-drag';

/** 写入本次拖拽的载荷（`dataTransfer` 是本次拖拽的唯一载体）。 */
export function setDragData({
  dataTransfer,
  dragData,
}: {
  dataTransfer: DataTransfer;
  dragData: TimelineDragData;
}): void {
  dataTransfer.setData(MIME_TYPE, JSON.stringify(dragData));
  dataTransfer.setData('text/plain', JSON.stringify(dragData));
}

/**
 * 读取本次拖拽的内部载荷；不是内部拖拽 / 读不到 / 解析失败 → `null`。
 * 全部判据取自 `dataTransfer` 自身（不依赖任何跨拖拽状态）。
 *
 * 【只认内部 MIME，不回落 `text/plain`】与 `hasDragData` **同口径**：
 * 「是不是内部拖拽」与「取内部载荷」必须用同一个判据，否则两者会分叉
 * （分叉正是本模块上一版的病根）。回落 `text/plain` 还会把
 * 外部拖入的任意 JSON 文本误当内部载荷。
 * `setDragData` 仍写 `text/plain` —— 那是给**外部**消费的纯文本表示，与读取判据无关。
 */
export function getDragData({
  dataTransfer,
}: {
  dataTransfer: DataTransfer;
}): TimelineDragData | null {
  const data = dataTransfer.getData(MIME_TYPE);
  if (!data) return null;
  // 解析走唯一原语；判别联合 ⇒ 必须判 ok（2026-09-17 契约收紧）。
  //
  // 【2026-09-17 为什么这里**可以**返回 null（不是"把失败压成默认值"）】本函数的契约是**问句**：
  // 「有没有本仓内部拖拽载荷？」——`getData()` 空串 ＝ **没人写这个 MIME**（正常"没有"）；
  // 非空但 JSON 坏 ＝ 写了却坏了（**代码 bug / 外部软件乱写**）。对调用方的决策
  // （`if (!dragData) return`）而言两者答案都是"无法据此拖拽" ⇒ 判别联合在这里零收益。
  // **但"坏 JSON"不能静默** —— 它意味着写入侧有 bug，必须留痕可查（否则是"静默吞掉自己的缺陷"）。
  const r = tryParse(() => JSON.parse(data) as TimelineDragData);
  if (!r.ok) {
    logger.warn('时间轴拖拽', '内部拖拽载荷不是合法 JSON（本次拖拽已忽略）', { error: r.error });
    return null;
  }
  return r.value;
}

/**
 * 本次拖拽是否携带内部（时间轴）载荷。
 * **只看 `dataTransfer.types`** —— 这是本次拖拽自己的事实，与历史拖拽无关。
 */
export function hasDragData({ dataTransfer }: { dataTransfer: DataTransfer }): boolean {
  return dataTransfer.types.includes(MIME_TYPE);
}
