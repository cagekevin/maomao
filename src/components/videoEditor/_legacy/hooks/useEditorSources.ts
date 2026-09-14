/**
 * 素材解析 + 探测缓存 —— `docs/120` C3（素材 URL 唯一出口 · C3.2 探测缓存）· C13（断链判定）
 * · `docs/123` §一.2 R1 + §二.7 P4。
 *
 * ── 它解决的那个母体 ──
 * 「这个片段能不能读」是**一个**事实。结构解析（`sourceUrl`/`assetId` 有没有）与
 * 真实可读性（文件的字节取不取得到）如果分别实现，必然漂：一处说能读、另一处说读不到。
 * 故本模块只把 `data/sourceResolver::resolveClipSource` 包一层 React 绑定，
 * **探测结果作为它的 probe 入参**（同一个裁决点），**不新增判据**。
 *
 * ── 探测缓存（C3.2）──
 * 以**解析后 URL** 为键、会话级 memo：同源片段（同一素材入轨多次，`docs/120` C11.4 是常态）
 * 只探测一次。缓存是 `Promise` 而不是结果 —— 并发请求同一个 URL 时只发一次网络往返。
 *
 * ── 「节点被删」为什么不判红（`docs/123` §一.9 Q5 / `docs/120` C13.3）──
 * 本模块完全不看 `nodeId`：`sourceUrl` 在入轨时已持久化，来源节点被删**不影响可读性**。
 * 只有**真的读不到**才红 —— 节点删了但 `/files/` 还在是常态，判它断链是假报警。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { probeMediaTrack } from '../../base/utils/videoEngine.ts';
import { DEFAULT_IMAGE_CLIP_DURATION } from '../core/constants.ts';
import type { ClipKind, Project } from '../core/types.ts';
import type { MediaProfile } from '../core/routeClip.ts';
import { resolveClipSource, type ClipSource } from '../data/sourceResolver.ts';

/** 一个片段的素材状态（UI 与导出共用一份事实）。 */
export interface EditorClipSource {
  /** 结构 + 可读性的**合并裁决**（`sourceResolver` 唯一出口的产物）。 */
  resolved: ClipSource;
  /** 探测画像（异构判定用，`docs/120` C12.1）。探测不到时缺省 —— 缺省不参与判定（不猜）。 */
  profile?: MediaProfile;
  /** 源素材时长（秒）。**入轨「用源素材整段」必需**（C11.6）；图片为默认图片时长。 */
  duration?: number;
  /** 是否含内联音轨（docs/120 C4.7，🔊 角标真源）。缺省=未知（探测未落定）；**未知≠无声音**。 */
  hasAudio?: boolean;
}

/** 缓存里的条目（缓存 promise，见文件头）。 */
type Probed = { source: EditorClipSource; blob: Blob } | { source: EditorClipSource; blob: null };

/**
 * 会话级探测缓存：URL → Promise。
 *
 * 为什么是模块级（而不是 hook 内 state）：**跨基座开合、跨 project 切换**都应复用
 * —— 同一份 `/files/` 素材的字节不会因为换了工程就变了。清空时机见 `clearSourceCache`。
 */
const mediaCache = new Map<string, Promise<Probed>>();

/**
 * 取素材字节 + 探测（按 URL memo）。
 *
 * 探测结果**同时**给出三样东西，且它们必须来自同一次读取：
 * ① 可读性（断链判定）；② 画像（异构判定）；③ 时长（入轨整段落轨）。
 * 分成三次读取会让三者有机会互不一致。
 *
 * 返回值里的 `blob` 供导出复用（避免「探测下载一次、导出再下载一次」）。
 */
export function loadEditorSource(url: string, kind: ClipKind): Promise<Probed> {
  const hit = mediaCache.get(url);
  if (hit) return hit;

  const task = (async (): Promise<Probed> => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();

      if (kind === 'image') {
        const bitmap = await createImageBitmap(blob);
        const width = bitmap.width;
        const height = bitmap.height;
        bitmap.close();
        return {
          blob,
          source: {
            resolved: { status: 'ok', url },
            profile: { width, height, mimeType: blob.type || undefined },
            // 图片没有「时长」概念：落轨用默认图片时长（C11.6 / constants 单一出处）
            duration: DEFAULT_IMAGE_CLIP_DURATION,
          },
        };
      }

      const probe = await probeMediaTrack(blob);
      if (probe.status === 'failed') {
        return { blob: null, source: { resolved: { status: 'broken', reason: probe.reason } } };
      }
      return {
        blob,
        source: {
          resolved: { status: 'ok', url },
          profile:
            probe.width !== undefined && probe.height !== undefined
              ? { width: probe.width, height: probe.height, mimeType: blob.type || undefined }
              : undefined,
          duration: probe.duration,
          hasAudio: probe.hasAudioTrack,
        },
      };
    } catch (e) {
      return {
        blob: null,
        source: {
          resolved: {
            status: 'broken',
            reason: e instanceof Error ? e.message : '素材读取失败',
          },
        },
      };
    }
  })();

  mediaCache.set(url, task);
  // 失败**不留在缓存里**：一次网络抖动不该让「素材失效」永久生效（用户重试应当真的重试）。
  // 这里用 `then` 而不是 `catch`：只清缓存，不吞掉调用方拿到的失败结果。
  void task.then((probed) => {
    if (probed.source.resolved.status === 'broken') mediaCache.delete(url);
  });
  return task;
}

/**
 * 取素材字节 —— **命中探测缓存就不重复下载**。
 *
 * 为什么需要它：探测阶段已经把整个文件读过一遍了；导出（`export/pipeline` 的 `fetchBlob` 端口）
 * 拿同一份字节即可。不对接这一步，一个 4K 源在「探测 + 导出」里会被下载两遍。
 */
export async function readSourceBlob(url: string, kind: ClipKind): Promise<Blob> {
  const probed = await loadEditorSource(url, kind);
  if (!probed.blob) throw new Error('素材读不到（探测阶段已失败）');
  return probed.blob;
}

/**
 * 把工程里的每个片段解析成「能不能读 + 多长 + 多大」。
 *
 * 返回 `byClipId` 是**结构解析的即时结果**（同步，立即可渲染），
 * 探测在后台补齐后**原地替换**（`ready` 变 true）—— 这样 UI 不会因为网络慢就空屏。
 */
export function useEditorSources(project: Project | null): {
  byClipId: ReadonlyMap<string, EditorClipSource>;
  /** 探测是否全部落定（未落定 = 断链红标可能还不准，UI 据此可显示「检测中」）。 */
  ready: boolean;
} {
  const [ready, setReady] = useState(false);
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  /** 结构解析：同步、纯、不依赖 IO（探测结果稍后叠加）。 */
  const structural = useMemo(() => {
    const map = new Map<string, EditorClipSource>();
    for (const track of project?.tracks ?? []) {
      for (const clip of track.clips) {
        map.set(clip.id, { resolved: resolveClipSource(clip) });
      }
    }
    return map;
  }, [project]);

  const [probed, setProbed] = useState<ReadonlyMap<string, EditorClipSource>>(new Map());

  useEffect(() => {
    if (!project) {
      setProbed(new Map());
      setReady(true);
      return;
    }
    const targets: { id: string; url: string; kind: ClipKind }[] = [];
    for (const track of project.tracks) {
      for (const clip of track.clips) {
        const url = resolveClipSource(clip);
        // 结构上就断链的片段不用探测（`resolveClipSource` 已是唯一裁决点，这里只是省一次 IO）
        if (url.status === 'ok') targets.push({ id: clip.id, url: url.url, kind: clip.kind });
      }
    }
    if (targets.length === 0) {
      setProbed(new Map());
      setReady(true);
      return;
    }

    let canceled = false;
    setReady(false);
    void Promise.all(
      targets.map(async (t) => ({
        id: t.id,
        // 探测失败也是断链的一个触发点 —— 回到同一个裁决点收口（§二.7 P4）
        source: (await loadEditorSource(t.url, t.kind)).source,
      })),
    ).then((results) => {
      if (canceled || !aliveRef.current) return;
      const next = new Map<string, EditorClipSource>();
      for (const r of results) next.set(r.id, r.source);
      setProbed(next);
      setReady(true);
    });

    return () => {
      canceled = true;
    };
  }, [project]);

  const byClipId = useMemo(() => {
    const merged = new Map(structural);
    for (const [id, source] of probed) {
      // 探测结果只在结构层判定为「结构上可读」时叠加；两者都不可读时保留结构层的原因（更具体）
      const base = merged.get(id);
      if (!base) continue;
      merged.set(id, {
        resolved: base.resolved.status === 'ok' ? source.resolved : base.resolved,
        profile: source.profile ?? base.profile,
        duration: source.duration ?? base.duration,
        hasAudio: source.hasAudio ?? base.hasAudio,
      });
    }
    return merged;
  }, [structural, probed]);

  return { byClipId, ready };
}
