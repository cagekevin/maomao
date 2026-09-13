/**
 * 片段素材（**胶片条 / 波形**）在片段盒子里的**呈现映射**（纯函数，零 React / 零 IO）。
 *
 * 依据 `docs/120` C11.10（胶片条：一条图共享，片段按源区间映射显示 = **裁剪即所见**）
 * 与 C11.7b（真实波形：降采样成固定列数峰值，按行高绘制）。
 *
 * ── 为什么胶片条和波形**共用本文件的数学** ──
 * 两者问的是**同一个问题**：「源素材的 `[sourceStart, sourceEnd]` 这一段，
 * 该怎么摆进这个只有 `clipDuration × pps` 宽的盒子？」
 * 唯一差别只是**输出形态**：一个喂 CSS `background`（胶片图），一个喂绝对定位元素（SVG 波形）。
 * 若各写一份，两处必然漂 —— 表现是「胶片条是裁剪后的、波形却是整段」，而且**不报错**。
 *
 * 【为什么这条值得独立成文件并单测】映射算错不崩、不破闸，只显示**别的时间**的画面/波形，
 * 看起来还很正常。人工点一遍几乎发现不了（除非恰好剪过又记得原片）。
 */

/** 「常驻层」声明（`dockContract.test.ts` 按此标记禁用 portal / FullscreenShell）：本目录的文件都挂在 App 根 flex 列内、常驻不 portal，故不许登记 modalLayer。 */
// DOCK_IS_PERSISTENT（常驻层声明 · dockContract.test.ts 按此标记禁用 portal）

import { EPS } from '../../core/constants.ts';

/** 片段取用的源区间（`Clip` 的窄结构，刻意不依赖完整 `Clip`：本函数只关心这两个字段）。 */
export interface SourceRange {
  sourceStart: number;
  sourceEnd: number;
}

/**
 * 「整段源的图/波形」相对容器的**几何**（两个百分比，`>100` / `≤0` 是常态）。
 *
 * 设容器宽 `W`、源时长 `D`、片段时长 `d`、入点 `s`：
 *  · `widthPercent = 100 · D/d` —— 整段源要放大到容器宽的这个百分比，
 *    它的 `[s, s+d]` 段才正好铺满容器；
 *  · `leftPercent = -100 · s/d` —— 图左边缘相对容器左边缘的偏移（负 = 往左推出去）。
 */
export interface SourceWindow {
  widthPercent: number;
  leftPercent: number;
}

/**
 * 源区间 → 几何。**本文件唯一的数学实现**（其余函数都只是它的格式化）。
 *
 * 时长用 `max(0, sourceEnd − sourceStart)` —— **与 `core/timelineOps.clipDuration` 同一公式**。
 * 这不是「顺手写一样」：片段在轨上的**盒子宽度**就是 `clipDuration × pps`，
 * 而映射必须与它匹配。若这里另行夹取（比如把负入点的脏数据夹到 0 再算时长），
 * 两个时长就会分歧 —— 结果是**素材被拉伸得与盒子对不上**，且不报错。
 */
export function sourceWindow(clip: SourceRange, sourceDuration: number): SourceWindow {
  const full: SourceWindow = { widthPercent: 100, leftPercent: 0 };
  if (!(sourceDuration > 0)) return full;

  const d = Math.max(0, clip.sourceEnd - clip.sourceStart);
  if (d <= EPS) return full;

  const start = Math.max(0, Math.min(clip.sourceStart, sourceDuration));
  return { widthPercent: (sourceDuration / d) * 100, leftPercent: -((start / d) * 100) };
}

/** CSS `background-size` / `background-position` / `background-repeat`（喂胶片条）。 */
export interface FilmstripPlacement {
  backgroundSize: string;
  backgroundPosition: string;
  backgroundRepeat: string;
}

/**
 * 几何 → CSS `background` 形态。
 *
 * 百分比定位语义：`P%` = 图的 `P%` 点对齐容器的 `P%` 点，位移 `x = (W − W')·P/100`。
 * 要 `x = leftPercent/100 · W` ⇒ `P = leftPercent / (1 − widthPercent/100)`。
 *
 * 【为什么竖向也必须给足余量】`background-size` 的竖向 `100%` 与横向 `>100%` 是**独立缩放**：
 * 裁过的片段横向被放大到 `widthPercent%`，浏览器对横向超大值（`>1000%`）做像素取整，
 * 会在容器左右缘露出**一条底色缝**（透出片段底色 / 轨道底色 = 用户看到的"黑缝"）。
 * 故这里 `repeat-x` 兜底：任何像素级缝隙由图案自身重复补上，杜绝露底（视觉上任一像素都有画面）。
 */
export function filmstripBackground(clip: SourceRange, sourceDuration: number): FilmstripPlacement {
  const { widthPercent, leftPercent } = sourceWindow(clip, sourceDuration);
  const denom = 1 - widthPercent / 100;
  const position = Math.abs(denom) <= EPS ? 0 : clampPercent(leftPercent / denom);
  return {
    // 竖向拉满：`buildFilmstrip` 已按目标行高拼图，再按比例缩放只会留出黑边
    backgroundSize: `${widthPercent}% 100%`,
    backgroundPosition: `${position}% 50%`,
    // 横向平铺兜底（见上）：未裁片段 `widthPercent === 100` 时平铺是**无操作**，不改变现有观感
    backgroundRepeat: 'repeat-x',
  };
}

/** 几何 → 绝对定位元素的 `left` / `width`（喂波形 SVG 外层容器）。 */
export interface WaveformSpan {
  left: string;
  width: string;
}

/** 与 `filmstripBackground` **同源**的另一种表达（同一 `SourceWindow`，只是喂给不同的 CSS 属性）。 */
export function waveformSpan(clip: SourceRange, sourceDuration: number): WaveformSpan {
  const { widthPercent, leftPercent } = sourceWindow(clip, sourceDuration);
  return { left: `${leftPercent}%`, width: `${widthPercent}%` };
}

/** 夹到 `[0, 100]`：CSS 百分比越界会露白。 */
function clampPercent(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

/**
 * 峰值数组 → **对称波形路径**（喂 `viewBox="0 0 peaks.length 100"` + `preserveAspectRatio="none"`）。
 *
 * 中线 = 50，峰高按 `peak × 50` 向上下对称展开 —— 音量是**幅度**，视觉上也该对称（C11.7b 的形态）。
 * 用 SVG `path` 而不是 canvas：矢量路径随行高缩放不失真，也省掉「每帧重算」的像素操作。
 */
export function waveformPath(peaks: ArrayLike<number>): string {
  const n = peaks.length;
  if (n === 0) return '';
  const top: string[] = [];
  const bottom: string[] = [];
  for (let i = 0; i < n; i++) {
    const raw = peaks[i];
    const p = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0;
    const y = p * 50;
    top.push(`${i + 0.5},${(50 - y).toFixed(2)}`);
  }
  // 下半必须**倒着**遍历同一批列（x 递减、y 用同一列的峰值）——
  // 若跟着 i 升序走，x 与 y 会错位，波形整体被水平镜像（回归测试 `waveformPath > 中线 = 50` 抓的就是它）
  for (let i = n - 1; i >= 0; i--) {
    const raw = peaks[i];
    const p = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0;
    bottom.push(`${i + 0.5},${(50 + p * 50).toFixed(2)}`);
  }
  return `M${top.join(' L')} L${bottom.join(' L')} Z`;
}
