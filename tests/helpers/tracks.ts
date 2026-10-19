/**
 * 轨道测试的访问器 —— 处理 `ChannelTracks = Record<string, ChannelKey[]>` 的两层索引签名。
 *
 * 【两层各是什么语义】
 * 1. `tracks[targetId]` —— **缺失 = 编程错误**：测试断言的是"某对象的轨道"，没有就是 fixture 建错了，
 *    必须响亮地失败（`trackOf` 抛错，不允许 `?? {}` 静默成空轨道）。
 * 2. `track[channel]` —— **缺失 = 该通道没有关键帧**：这是合法业务态（`countChannelKeyframes`
 *    就是靠 `Object.values` 自然忽略缺通道），故 `channelOf` 返回空数组，不抛。
 *
 * 两层的差别就是 §5.3「数据层 fail-loud / 值域允许缺失」的实例，不能一刀切成同一种处理。
 */
import type { ChannelKey, ChannelTracks } from '../../src/components/director3d/project.ts';

/** 取某对象的轨道；不存在 ⇒ 抛（fixture 建错，不是运行时分支）。 */
export function trackOf(tracks: Record<string, ChannelTracks>, target: string): ChannelTracks {
  const track = tracks[target];
  if (track === undefined) {
    throw new Error(`trackOf(): 轨道不存在：${target}（现有：${Object.keys(tracks).join('、')}）`);
  }
  return track;
}

/** 取某通道的关键帧；缺失 ⇒ 空数组（= 该通道无帧，与生产读侧语义一致）。 */
export function channelOf(track: ChannelTracks, channel: string): ChannelKey[] {
  return track[channel] ?? [];
}
