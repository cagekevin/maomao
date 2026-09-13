/**
 * 时间轴时间 ↔ 源媒体时间 的双向映射原语（纯函数，零依赖）。
 *
 * 【为什么单独成一个模块】此前该换算在 `nodes/VideoProcessNode.tsx` 内**内联写了 3 遍**
 * （:1356 选中片段正算 / :1370 已选中正算 / :1552 播放头反算），语义完全同一份；
 * 视频剪辑器（WYSIWYG 时间轴）必然还要用同一换算。收成 1 份纯函数，避免漂移成 N+1 份。
 *
 * 【判据（7 步法 Step 3）】这是**探测/运算重复**（"怎么算"），可收口；
 * 而"片段在时间轴上怎么摆、吸附到什么、选中后做什么"是各域自己的**判据**，**不并入本模块**。
 *
 * 【依赖方向】本文件零 import —— 落在 `base/utils/` 下不会产生 base 反向依赖业务域的问题，
 * `nodes/` 与 `director3d/`、未来 `videoEditor/` 都可安全复用。
 *
 * 【刻意不并入】`base/utils/videoEngine.ts` 的媒体处理链不做时间轴映射，与本模块无关；
 * 时间↔**像素**换算是另一维（见 `base/utils/timeline/` 内时间轴刻度原语），不要混进这里。
 */

/**
 * 片段的最小时间窗口：只需这两个字段即可完成换算（刻意用窄结构类型，
 * 不 import 任何 clip 模型，避免 base 依赖业务域的类型）。
 *
 * 语义：片段在**时间轴**上从 `timelineStart` 开始，对应源媒体的 `sourceStart`。
 * 两者都允许缺省（视为 0），与既有内联实现的 `?? 0` 兜底一致。
 */
export interface ClipTimeWindow {
  /** 片段在时间轴上的起点（秒）。 */
  timelineStart?: number;
  /** 片段对应源媒体的起点（秒）。 */
  sourceStart?: number;
}

/**
 * 时间轴时间 → 源媒体时间。
 * `sourceStart + (timelineTime - timelineStart)`
 */
export function sourceTimeAt(timelineTime: number, clip: ClipTimeWindow): number {
  return (clip.sourceStart ?? 0) + (timelineTime - (clip.timelineStart ?? 0));
}

/**
 * 源媒体时间 → 时间轴时间（`sourceTimeAt` 的反函数）。
 * `timelineStart + (sourceTime - sourceStart)`
 *
 * 【注意】本函数**不做夹取**。调用方若需"播放头不得早于片段源起点"，
 * 应先把 `sourceTime` 夹到 `>= sourceStart` 再传入（`Math.max(clip.sourceStart ?? 0, sourceTime)`），
 * 等价于原内联写法 `timelineStart + Math.max(0, sourceTime - sourceStart)`。
 * 夹取属调用方判据（不同消费方可能不夹），故留在宿主。
 */
export function timelineTimeAt(sourceTime: number, clip: ClipTimeWindow): number {
  return (clip.timelineStart ?? 0) + (sourceTime - (clip.sourceStart ?? 0));
}
