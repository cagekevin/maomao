/**
 * 标尺 + 播放头（mockup `.ve-ruler` / `.ve-ph`）。
 *
 * 【职责边界】**纯渲染**：刻度用共用原语 `rulerTicks`（不自己发明步长序列），与片段同区同原点；
 * 播放头红竖线 + 顶部拖动抓手。拖动逻辑（seek 吸附）在 `useEditorTransport`，本件只绑事件。
 */
import { useMemo } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { buildTicks, pickTickStep, type Tick } from '../../../base/utils/timeline/rulerTicks.ts';
import { timeToX } from '../../../base/utils/timeline/timeScale.ts';

/** 标尺刻度为空态（避免每次渲染新建数组导致 memo 抖动）。 */
const EMPTY_TICKS: Tick[] = [];

/** 顶部刻度标尺行高（与 `mockup-kit.css:1273` `.ve-ruler` 高度对齐）；左列占位用它同高对齐。 */
export const RULER_HEIGHT = 22;

/**
 * 播放头**拖动命中带**的半宽（px，视觉线宽仍为 2px）。
 *
 * 红线只有 2px，直接点它命中率极低 —— 故命中区左右各外扩本值（共 10px 宽）。
 * 取 5px 是折中：够好点中，又窄到不会大面积压住片段（片段在红线附近仍以自身拖拽为主）。
 */
const PLAYHEAD_HIT_HALF_PX = 5;

export interface RulerStripProps {
  /** 工程是否已加载（无工程则不渲染标尺与播放头）。 */
  hasProject: boolean;
  pps: number;
  totalDuration: number;
  displayHead: number;
  onPlayheadPointerDown: (e: ReactPointerEvent) => void;
}

export function RulerStrip(p: RulerStripProps) {
  const { hasProject, pps, totalDuration, displayHead, onPlayheadPointerDown } = p;

  /** 标尺刻度 —— 共用原语（`rulerTicks`）：步长只由缩放定，刻度点由总长定。 */
  const ticks = useMemo(
    () => (hasProject ? buildTicks(totalDuration, pickTickStep(pps)) : EMPTY_TICKS),
    [hasProject, totalDuration, pps],
  );

  return (
    <>
      {/* ── 标尺（data-timeline-ruler）── 共用原语 `rulerTicks`，与片段同区同原点 */}
      {hasProject && (
        <div
          className="relative border-b border-edge-faint"
          style={{ height: RULER_HEIGHT }}
          data-timeline-ruler
        >
          {ticks.map((t) => (
            <i
              key={t.time}
              className="absolute bottom-0 w-px h-2.5 bg-muted"
              style={{ left: timeToX(t.time, pps, 0) }}
            />
          ))}
          {ticks.map((t) => (
            <em
              key={`label-${t.time}`}
              className="absolute top-0.5 left-0 font-normal not-italic text-[9px] tabular-nums text-secondary"
              style={{ left: timeToX(t.time, pps, 0) + 3 }}
            >
              {t.label}
            </em>
          ))}
        </div>
      )}

      {/* 播放头（mockup `.ve-ph`）：2px 红竖线 + 顶部抓手 + **整线可拖的命中区**。
          红一律内联读 `rgb(var(--mao-danger))` —— 不依赖 Tailwind 是否生成 `.bg-danger`（避免编译滞后导致红不出）。

          【为什么拆成「线 / 命中区」两层】
          红线视觉只有 2px，若只让这 2px 可点，用户极难命中 —— 原实现因此只在**顶部**给了一个小把手，
          结果「只有拖把手才能移动」，线本身完全没反应（正是用户报的问题）。
          解法：线本体继续 `pointer-events-none`（纯视觉，不抢事件），**另起一层贯穿整条的命中区**，
          宽度给到左右各 `HIT_HALF_PX`（≈ 5px，共 10px）—— 明显好点中，又不足以大面积挡住片段。
          层级：命中区 z-[21]（片段在 lane 内 z 更低），只有紧贴红线的窄带优先于片段，
          片段其余区域照常可拖 —— 与剪映 / Premiere 的「playhead 细窄命中带」同款做法。 */}
      {hasProject && (
        <>
          <div
            className="absolute top-0 bottom-0 w-[2px] -ml-px z-[20] pointer-events-none"
            style={{
              left: timeToX(displayHead, pps, 0),
              background: 'rgb(var(--mao-danger) / 1)',
            }}
          />
          <div
            role="slider"
            aria-label="播放头"
            aria-valuemin={0}
            aria-valuemax={Math.round(totalDuration)}
            aria-valuenow={Math.round(displayHead)}
            title="拖动播放头"
            className="absolute top-0 bottom-0 z-[21] cursor-ew-resize touch-none"
            style={{ left: timeToX(displayHead, pps, 0), marginLeft: -PLAYHEAD_HIT_HALF_PX }}
            onPointerDown={onPlayheadPointerDown}
          >
            {/* 加宽的透明命中带（整条贯穿）：`-ml` 让红线落在这条带的正中 */}
            <span style={{ width: PLAYHEAD_HIT_HALF_PX * 2 }} className="absolute inset-y-0" />
            {/* 顶部抓手（视觉）：只作为"这里能拖"的视觉提示，命中交给上面那条带 */}
            <i
              className="absolute top-0 w-[16px] h-[11px] rounded-[3px_3px_1px_1px] shadow-[0_1px_3px_rgba(0,0,0,.5)]"
              style={{
                left: PLAYHEAD_HIT_HALF_PX - 8,
                background: 'rgb(var(--mao-danger) / 1)',
              }}
            >
              <span
                className="absolute left-[5px] top-[9px] w-0 h-0 border-x-[3px] border-t-[5px] border-x-transparent"
                style={{ borderTopColor: 'rgb(var(--mao-danger) / 1)' }}
              />
            </i>
          </div>
        </>
      )}
    </>
  );
}
