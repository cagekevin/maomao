/**
 * deps/directorDeskService — 导演桌（宿主能力，kit 不实现）。
 *
 * 原实现收集导演桌节点的图片作为参考。kit 无导演桌概念，给 no-op。
 * 签名与调用点（connectedReferenceMedia 传 node.data）保持一致。
 */
import type { BaseNodeData } from '../../core/host-types';

export function collectDirectorImageUrls(
  _data?: BaseNodeData | string,
): Array<{ url: string; sourceNodeId?: string; sourceUrl?: string }> {
  return [];
}
