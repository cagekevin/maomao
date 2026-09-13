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

      {/* 播放头（mockup `.ve-ph`）：2px 红竖线 + 顶部抓手。
          红一律内联读 `rgb(var(--mao-danger))` —— 不依赖 Tailwind 是否生成 `.bg-danger`（避免编译滞后导致红不出）。 */}
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
            className="absolute top-0 z-[30] cursor-ew-resize touch-none"
            style={{ left: timeToX(displayHead, pps, 0) }}
            onPointerDown={onPlayheadPointerDown}
          >
            <i
              className="absolute top-0 -left-[7px] w-[16px] h-[11px] rounded-[3px_3px_1px_1px] shadow-[0_1px_3px_rgba(0,0,0,.5)]"
              style={{ background: 'rgb(var(--mao-danger) / 1)' }}
            >
              <span
                className="absolute left-[5px] top-[9px] w-0 h-0 border-x-[3px] border-t-[5px] border-x-transparent"
                style={{ borderTopColor: 'rgb(var(--mao-danger) / 1)' }}
              />
            </i>
            <span className="absolute -top-0.5 -left-1 bottom-0 w-2 bg-transparent" />
          </div>
        </>
      )}
    </>
  );
}
