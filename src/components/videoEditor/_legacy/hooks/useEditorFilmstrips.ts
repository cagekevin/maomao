/**
 * 胶片条构建 + **会话级缓存** —— `docs/120` C11.10（性能红线）· `docs/123` §二.3 G5 卡。
 *
 * ── 为什么必须缓存，且必须是「会话级」──
 * 一条胶片图要 seek 抽 N 帧（一次元素加载 + N 次 seek），是整条时间轴上**最贵**的渲染准备工作；
 * 而「同一素材入轨多次」是常态（`docs/120` C11.4）。缓存按**解析后 URL** 记，
 * 于是同一素材无论上轨几次、无论基座开合几次，都只抽一次。
 *
 * ── 为什么不发 `previewUrls`（全工程预览 URL 管理器）──
 * `App` 在**切项目**时会 `previewUrls.clear()`（`App.tsx:515/531`）——那会 revoke 掉所有对象 URL。
 * 而本缓存是**跨工程**的（同一份 `/files/` 素材不因换工程而变），缓存里的 URL 一旦被 revoke
 * 就变成死链，且**不回滚**。故这里：
 *  · **缓存 Blob**（贵的那部分，会话级、不随工程清空）；
 *  · **对象 URL 按挂载生命周期创建**（便宜那部分），卸载时自己 revoke —— 两者生命周期不同，不能共用一个管理器。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildFilmstrip, type Filmstrip } from '../../base/utils/captureFrame.ts';

/**
 * 缓存键含**帧高**：换了行高（C7.5 轨道高度可调）必须重抽 ——
 * 否则把按 24px 拼的图拉成 40px，胶片条会糊掉且比例不对（「不报错的错」）。
 */
const stripCache = new Map<string, Promise<Filmstrip | null>>();

function stripOf(url: string, duration: number, frameHeight: number): Promise<Filmstrip | null> {
  const key = `${url}|${frameHeight}`;
  const hit = stripCache.get(key);
  if (hit) return hit;
  const task = buildFilmstrip(url, { duration, frameHeight }).catch((): null => null);
  stripCache.set(key, task);
  // 失败不常驻：一次抽帧失败（网络抖动 / 素材正在被替换）不该让该素材**永久**没有胶片条
  void task.then((strip) => {
    if (!strip) stripCache.delete(key);
  });
  return task;
}

/**
 * 为一批素材准备胶片条，返回 `url → 可直接用于 CSS 的对象 URL`。
 *
 * 抽不到的素材（非视频 / 失败）**不出现在返回的 Map 里** —— 调用方据此回落到朴素片段条，
 * 而不是拿到一个"空的胶片"（那会看起来像"这段没有画面"）。
 */
export function useEditorFilmstrips(
  entries: readonly { url: string; duration: number }[],
  frameHeight: number,
): ReadonlyMap<string, string> {
  const [byUrl, setByUrl] = useState<ReadonlyMap<string, string>>(new Map());
  const ownedRef = useRef<string[]>([]);
  /** 依赖用「url 列表的稳定字符串」，避免数组每次渲染换身份导致重复抽帧。 */
  const key = useMemo(
    () =>
      Array.from(new Set(entries.map((e) => e.url)))
        .sort()
        .join('\n'),
    [entries],
  );

  useEffect(() => {
    if (!key) {
      setByUrl(new Map());
      return;
    }
    const targets = key.split('\n').map((url) => ({
      url,
      // 同 url 的时长必然相同（同一素材）；取第一个即可
      duration: entries.find((e) => e.url === url)?.duration ?? 0,
    }));
    let canceled = false;
    void Promise.all(
      targets.map(async (t) => {
        if (!(t.duration > 0)) return null;
        const strip = await stripOf(t.url, t.duration, frameHeight);
        return strip ? { url: t.url, objectUrl: URL.createObjectURL(strip.blob) } : null;
      }),
    ).then((results) => {
      if (canceled) return;
      const map = new Map<string, string>();
      for (const r of results) if (r) map.set(r.url, r.objectUrl);
      ownedRef.current = Array.from(map.values());
      setByUrl(map);
    });

    return () => {
      canceled = true;
      // 本挂载创建的对象 URL 由本挂载释放（Blob 留在模块缓存里，下个挂载重新建 URL）
      for (const u of ownedRef.current) URL.revokeObjectURL(u);
      ownedRef.current = [];
    };
    // entries 只经 key 参与依赖（见上）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, frameHeight]);

  return byUrl;
}
