/**
 * 胶片条的**视图映射**（纯函数，零 React / 零 IO）—— `docs/120` C11.10「裁剪即所见」。
 *
 * ── 它回答的问题 ──
 * 一条胶片图覆盖的是**整段源素材**；而片段的胶片条要显示的是它**取用的那一段**
 * （`sourceStart`…`sourceEnd`）。把「源内区间」映射成「一张图该怎么摆」就是本文件的全部内容。
 *
 * 为什么值得独立成文件并单测：这是**唯一**决定「你看到的画面是不是这一段的」的地方。
 * 算错不会报错、不会崩，只会**显示别的时间的画面** —— 而且看起来很正常（正是最难发现的一类错）。
 */
import { EPS } from '../../core/constants.ts';

/** 片段取用的源区间（`Clip` 的窄结构，刻意不依赖完整 `Clip`：本函数只关心这两个字段）。 */
export interface SourceRange {
  sourceStart: number;
  sourceEnd: number;
}

/** 摆法（直接喂给 CSS）。 */
export interface FilmstripPlacement {
  backgroundSize: string;
  backgroundPosition: string;
}

/**
 * 源区间 → `background-size` / `background-position`。
 *
 * ── 推导（不是试出来的）──
 * 设片段显示宽 `W`、源时长 `D`、片段时长 `d = sourceEnd - sourceStart`。
 * 要让「图的 `[sourceStart, sourceEnd]` 段」正好铺满 `W`，图的缩放宽 `W'` 必须满足
 * `W' · d/D = W` ⇒ `W' = W · D/d`，即 `background-size: (D/d)·100%`。
 * 再用 CSS 的百分比定位语义（`P%` = 图的 `P%` 点对齐容器的 `P%` 点，位移 `x = (W - W')·P/100`）
 * 要求 `x = -W' · sourceStart/D`，解得 **`P = 100 · sourceStart / (D - d)`**。
 *
 * 边界：`D = d`（整段未裁）时 100%/0% 即可（0/0 无意义，故直接短路）。
 */
export function filmstripBackground(clip: SourceRange, sourceDuration: number): FilmstripPlacement {
  const full: FilmstripPlacement = { backgroundSize: '100% 100%', backgroundPosition: '0% 50%' };
  if (!(sourceDuration > 0)) return full;

  /**
   * 时长用 `max(0, sourceEnd − sourceStart)` —— **与 `core/timelineOps.clipDuration` 同一公式**。
   *
   * 这不是"顺手写一样"，而是必须一样：片段在轨上的**盒子宽度**就是 `clipDuration × pps`，
   * 而胶片图的放大倍率必须与之匹配。若这里另行夹取（比如把负入点的脏数据夹到 0 再算时长），
   * 两个时长就会分歧 —— 结果是**图片被拉伸得与盒子对不上**，且不报错。
   */
  const d = Math.max(0, clip.sourceEnd - clip.sourceStart);
  if (d <= EPS) return full;

  const start = Math.max(0, Math.min(clip.sourceStart, sourceDuration));
  const sizePercent = (sourceDuration / d) * 100;
  const position = (() => {
    const span = sourceDuration - d;
    if (span <= EPS) return 0;
    return Math.max(0, Math.min(100, (start / span) * 100));
  })();

  return {
    // 竖向拉满：`buildFilmstrip` 已按目标行高拼图，再按比例缩放只会留出黑边
    backgroundSize: `${sizePercent}% 100%`,
    backgroundPosition: `${position}% 50%`,
  };
}
