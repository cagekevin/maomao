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

/** 播放头红线的**视觉宽度**（px）。 */
export const PLAYHEAD_LINE_WIDTH_PX = 2;

/**
 * 播放头拖动命中区的半宽（px）—— 导出给轨道区那一段用。
 *
 * 【为什么两段必须同宽】用户在标尺上试出的"手感"会直接迁移到轨道区：
 * 若上下两段命中宽度不同，就会出现「上面好点、下面点不中」的割裂体验。
 * 故宽度与红线定位一样，**只有这一处定义**，两段都读它。
 */
export const PLAYHEAD_HIT_HALF_WIDTH_PX = PLAYHEAD_HIT_HALF_PX;

/**
 * 播放头红线的定位样式 —— **全工程唯一出处**（标尺段 与 轨道区段 共用）。
 *
 * 【为什么必须收成一个函数（这不是过度抽象，是修一个真实 bug）】
 * 红线被拆成两段绘制（标尺在 `sticky` 行里只有 22px 高，轨道区那段在另一个容器里），
 * 两段必须落在**同一像素列**。原先两处各写一遍 `left: timeToX(...)`，
 * 结果一段写了 `-ml-px`、另一段没写 ⇒ **上下错开 1px**（用户实测报出的偏移）。
 * 同一真相抄两处必漂 —— 故把「x 怎么算」收成这一个函数，两段都调它。
 *
 * 【为什么是 `x - 宽/2`】`timeToX(t)` 给出的是**时刻本身的位置**（数学上是一条零宽线）。
 * 红线有实际宽度（2px），要让它**以该位置为中心**，须左移半个线宽。
 * 两段都自带 `translateX(-50%)` 的话会把宽度算两次，故这里直接算像素、不用 transform。
 */
export function playheadLineStyle(
  timeToX: (t: number) => number,
  head: number,
): { left: number; width: number } {
  return { left: timeToX(head) - PLAYHEAD_LINE_WIDTH_PX / 2, width: PLAYHEAD_LINE_WIDTH_PX };
}

export interface RulerStripProps {
  /** 工程是否已加载（无工程则不渲染标尺与播放头）。 */
  hasProject: boolean;
  pps: number;
  totalDuration: number;
  displayHead: number;
  onPlayheadPointerDown: (e: ReactPointerEvent) => void;
  /**
   * 本轮可用宽度（px）。
   *
   * 【为什么必须显式传进来】修正后的标尺住在 `sticky` 行里、由父级 `translateX` 跟随横滚，
   * 它**自己不是滚动容器** ⇒ `flex-1` 之类的自适应宽度在这里失效（内容全是 `absolute`，
   * 撑不开宽度）。故由父级把「轨道区可视宽 + 总内容宽」中较大的那个算好传进来，
   * 标尺才知道自己要铺多长、横滚多少像素才够。
   */
  contentWidth: number;
}

export function RulerStrip(p: RulerStripProps) {
  const { hasProject, pps, totalDuration, displayHead, onPlayheadPointerDown, contentWidth } = p;

  /** 标尺刻度 —— 共用原语（`rulerTicks`）：步长只由缩放定，刻度点由总长定。 */
  const ticks = useMemo(
    () => (hasProject ? buildTicks(totalDuration, pickTickStep(pps)) : EMPTY_TICKS),
    [hasProject, totalDuration, pps],
  );

  return (
    <>
      {/* ── 标尺（data-timeline-ruler）── 共用原语 `rulerTicks`，与片段同区同原点。
          宽度取父级算好的 `contentWidth`（与轨道行内容同宽），故刻度与片段的像素位置严格一致。 */}
      {hasProject && (
        <div
          className="relative border-b border-edge-faint"
          style={{ height: RULER_HEIGHT, width: contentWidth }}
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

          ⚠️ 命中区**只在标尺行内**（本件住在 `sticky top-0` 行里，高只有 `RULER_HEIGHT`）。
          它负责「点标尺上的红线」这一路；**轨道区那一大段的拖动命中由 VideoEditorDock 承担**
          （见那里的 `data-playhead-hit`）—— 因为本件根本伸不到轨道区的高度里。
          两段命中区调的是**同一个** `onPlayheadPointerDown`，所以行为一致。 */}
      {hasProject && (
        <>
          <div
            className="absolute top-0 h-full z-[20] pointer-events-none"
            style={{
              // 定位走唯一出处 `playheadLineStyle`（含 -半宽居中），**不再各写 `-ml-px`**
              ...playheadLineStyle((t) => timeToX(t, pps, 0), displayHead),
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
            className="absolute top-0 h-full z-[21] cursor-ew-resize touch-none"
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
