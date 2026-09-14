/**
 * 音频**真实波形**的峰值提取 —— `docs/120` C11.7b（M1 必做项）。
 *
 * ── 纪律（C11.7b 的原话）──
 * 「音频片段画**真实波形**（从音频解码后的峰值数组绘制）……**禁止**用固定图案冒充波形
 * （会被读成真实音量，属于撒谎）—— 要做就做真的。」
 *
 * ── 两个决定 ──
 * ① **流式解码、不落整段 PCM**：走 mediabunny 的 `AudioBufferSink` 逐块读，
 *    边读边归并到列峰值上。若改用 `AudioContext.decodeAudioData`，一段 5 分钟立体声
 *    会先把 ~115MB 的 Float32 全解到内存里 —— 只为画一根 800 列的柱子，不值。
 * ② **列数固定**（调用方给）：峰值数组是「按列聚合」的产物，列数随容器宽度变。
 *    本模块只负责「怎么算」，**列数由宿主定**（7 步法 Step 3：收口运算、保留判据）。
 *
 * ── 与 `captureFrame.ts` 的关系 ──
 * 两者对称：那是「视频 → 一帧图 / 一条胶片」，这是「音频 → 一列峰值」。都住在 `base/utils/`
 * （与领域无关的媒体操作），都不认 `Track` / `Clip`。
 */

/**
 * 把一段单声道采样**降采样**成 `columns` 列的峰值（每列取其**时间窗内**采样的绝对值最大）。
 *
 * 【为什么单独拎成纯函数】这是整个波形里**唯一有算法**的地方，而它不碰任何 IO ——
 * 于是「峰值算得对不对（不漏掉尖峰、不错位）」可以被单测钉死；外层只剩解码搬运。
 *
 * 【按「时间窗覆盖」而不是「按下标均分」】
 * 第 `i` 列代表信号时间轴上的 `[i/n, (i+1)/n)`；落在该窗内的**所有**采样都归它。
 * 这样列数多于采样数（上采样）时，一个采样自然铺满它覆盖的几列 —— 那是**真实覆盖**，
 * 不是"重复填充"（重复填充发生在"窗是空的却硬塞一个值"）。反之窗内没有采样 → 该列为 0。
 */
export function downsamplePeaks(samples: Float32Array, columns: number): Float32Array {
  const n = Math.max(1, Math.floor(columns));
  const out = new Float32Array(n);
  const len = samples.length;
  if (len === 0) return out;

  for (let i = 0; i < n; i++) {
    const j0 = Math.max(0, Math.floor((i / n) * len));
    const j1 = Math.min(len, Math.ceil(((i + 1) / n) * len));
    let peak = 0;
    for (let j = j0; j < j1; j++) {
      const v = Math.abs(samples[j]);
      if (v > peak) peak = v;
    }
    out[i] = peak > 1 ? 1 : peak;
  }
  return out;
}

/**
 * 就地归并：把一个解码块按它在**整段时长**里的位置，累进列峰值数组。
 *
 * 流式解码时每块只知道自己在整段里的起点（`offsetSeconds`）与采样率，故需要这个映射。
 * 同样按「时间窗覆盖」：第 `i` 列的时间窗与块的时间窗 `[offset, offset+len/rate)` 相交的
 * 那部分采样，才归这一列 —— 块不会越界写、也不会漏写。
 */
export function mergeIntoPeaks(
  peaks: Float32Array,
  chunk: Float32Array,
  offsetSeconds: number,
  sampleRate: number,
  totalSeconds: number,
): void {
  const columns = peaks.length;
  if (columns === 0 || totalSeconds <= 0 || sampleRate <= 0 || chunk.length === 0) return;

  const blockStart = offsetSeconds;
  const blockEnd = offsetSeconds + chunk.length / sampleRate;

  const c0 = Math.max(0, Math.floor((blockStart / totalSeconds) * columns));
  const c1 = Math.min(columns, Math.ceil((blockEnd / totalSeconds) * columns));
  for (let i = c0; i < c1; i++) {
    // 该列与本块时间窗的交集（换算成块内采样下标）
    const t0 = Math.max(blockStart, (i / columns) * totalSeconds);
    const t1 = Math.min(blockEnd, ((i + 1) / columns) * totalSeconds);
    if (t1 <= t0) continue;
    const a = Math.max(0, Math.floor((t0 - blockStart) * sampleRate));
    const b = Math.min(chunk.length, Math.ceil((t1 - blockStart) * sampleRate));
    let peak = peaks[i];
    for (let j = a; j < b; j++) {
      const v = Math.abs(chunk[j]);
      if (v > peak) peak = v;
    }
    peaks[i] = peak > 1 ? 1 : peak;
  }
}

/**
 * 抽一条音频素材的波形峰值（`0..1`，长度 = `columns`）。
 *
 * @param blob 素材字节（调用方从素材探测缓存里拿，别重复下载）
 * @returns 峰值数组；素材没有可解码音轨时返回 **`null`**（调用方据此回落到"无波形"，
 *          而不是拿到一片 0 —— 那会被读成"这段是静音"，是撒谎）
 */
