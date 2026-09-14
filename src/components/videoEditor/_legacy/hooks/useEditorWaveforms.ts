/**
 * 波形峰值提取 + **会话级缓存** —— `docs/120` C11.7b（真实波形，M1 必做项）。
 *
 * ── 与 `useEditorFilmstrips` 同一套取舍，只是换了个媒体 ──
 *  · 按**解析后 URL** 缓存（同一素材上轨多次是常态，C11.4）；
 *  · 缓存键含**列数**（列数是按容器宽定标；换宽了必须重算，否则波形横向被拉伸而不报错）；
 *  · 缓存的是**峰值数组**（贵的那部分，且不带 URL / 不解码），失败**不常驻**；
 *  · 字节从素材探测缓存里取（`readSourceBlob`）—— 探测阶段已读过一遍，不重复下载。
 */
import { useEffect, useMemo, useState } from 'react';
import { extractAudioPeaks } from '../../base/utils/audioPeaks.ts';
import { readSourceBlob } from './useEditorSources.ts';

/**
 * 峰值列数。固定值（不随片段宽度变）—— 它决定的是**波形的横向分辨率**，不是显示宽度；
 * 显示宽度由 `clipSourceView.waveformSpan` 映射（裁剪即所见）。
 */
const WAVEFORM_COLUMNS = 640;

const peaksCache = new Map<string, Promise<Float32Array | null>>();

function peaksOf(url: string): Promise<Float32Array | null> {
  const key = `${url}|${WAVEFORM_COLUMNS}`;
  const hit = peaksCache.get(key);
  if (hit) return hit;
  const task = (async () => {
    const blob = await readSourceBlob(url, 'audio');
    return extractAudioPeaks(blob, { columns: WAVEFORM_COLUMNS });
  })().catch((): null => null);
  peaksCache.set(key, task);
  // 失败不常驻：一次解码失败不该让该素材**永久**没有波形
  void task.then((peaks) => {
    if (!peaks) peaksCache.delete(key);
  });
  return task;
}

/**
 * 为一批音频素材准备波形峰值，返回 `url → 峰值数组`。
 *
 * **抽不到的音轨不出现在 Map 里** —— 调用方回落到「无波形」而不是一片 0：
 * 全 0 的波形会被读成「这段是静音」，那是**撒谎**（C11.7b 明令禁止）。
 */
export function useEditorWaveforms(urls: readonly string[]): ReadonlyMap<string, Float32Array> {
  const [byUrl, setByUrl] = useState<ReadonlyMap<string, Float32Array>>(new Map());
  const key = useMemo(() => Array.from(new Set(urls)).sort().join('\n'), [urls]);

  useEffect(() => {
    if (!key) {
      setByUrl(new Map());
      return;
    }
    let canceled = false;
    void Promise.all(
      key.split('\n').map(async (url) => {
        const peaks = await peaksOf(url);
        return peaks ? { url, peaks } : null;
      }),
    ).then((results) => {
      if (canceled) return;
      const map = new Map<string, Float32Array>();
      for (const r of results) if (r) map.set(r.url, r.peaks);
      setByUrl(map);
    });
    return () => {
      canceled = true;
    };
  }, [key]);

  return byUrl;
}
