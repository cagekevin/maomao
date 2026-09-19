import { useCallback, useEffect, useState } from 'react';
import type { DragEvent as ReactDragEvent } from 'react';
import { httpRequest } from '../components/base/api/index.ts';
import { LOCAL_TOOL_PING_TIMEOUT } from '../components/base/core/config.ts';
import { reportDegrade } from '../components/base/core/log/degrade.ts';
import { useResourceMoveToFolder } from './useResourceMoveToFolder.ts';
import type {
  ResourceMoveItem,
  ResourceMoveToFolderOptions,
  ResourceDragSourceProps,
} from './useResourceMoveToFolder.ts';

/** 素材最小形状（拖到画布建节点所需字段） */
export interface CanvasAssetLike {
  url?: string;
  name?: string;
  type?: string;
  /** docs/122 #4：素材持有的稳定 contentId（来自后端资源 sha1 列），拖到画布时一并带给 asset 节点 */
  contentId?: string;
}

/**
 * 素材拖拽到画布的【唯一发起端】公共 hook（对齐官方 H_.jsx onDrop 的素材通道）。
 *
 * 【为什么收敛到这里】
 * 此前「把图片/视频/音频/文字素材拖到画布」的 onDragStart 在多个面板各写一遍：
 *  - ResourceLibrary.tsx / GeneratedView.tsx（用 application/x-yimao-asset）
 *  - TaskCenter.tsx（用 text/plain，格式与前者不一致）
 * 接收端统一是 useAssetDropPaste.onDrop（画布侧）。这里把发起端收敛成一份：
 *  - 统一格式：全部写 application/x-yimao-asset（带 url/name/type/text，比 text/plain 信息更全）
 *  - 统一 textCache/fetchText：文字素材异步补全内容，面板间共享缓存
 * 任何面板（素材库/生成素材/任务中心/未来新面板）要支持「拖图到画布」，只用 assetDragProps(asset) 即可。
 *
 * 【用法】
 *  const { assetDragProps } = useAssetDragToCanvas()
 *  <img {...assetDragProps({ url, name, type })} />
 *
 * 【与内部排序拖拽的区别】
 * 本 hook 只负责「拖到画布新建节点」（copy 语义）。画布内部节点/图层重排（move 语义，
 * 如 ImageBox/GridMerge/OverlayEditor 的自定义 MIME）是另一回事，不要混用。
 */

// 文字素材内容缓存（模块级，面板间共享）：url → text。**只缓存成功**。
const textCache = new Map<string, string>();

const TEXT_LAYER = 'assetText';
/** 失败判词（生产者给全，调用方原样转发） */
const TEXT_UNREADABLE = '文字素材内容获取失败';

/**
 * 文字素材内容读取结果 —— **判别联合**（TD-18-17 · 2026-09-18）。
 *
 * 旧实现把「读到空」与「读失败」用同一个 `''` 抹平（`.catch(() => '')` 吞掉一切失败 + 把 `''`
 * **写进 `textCache`**）⇒ ① 用户分不清"文件本来就空"还是"没取到"；② 失败被固化，**永远不再重试**。
 * 判据同 `16-跨区-读失败伪装成空拆兜底-2026-09-17`：**读取函数只负责分清三态（读到内容／读到空／
 * 读失败），「失败怎么呈现」是调用方判据** —— 读取层无权替所有调用方决定失败长什么样。
 *
 * ⚠️ ADR-0021：本仓 `strict:false`，失败分支必须写 `r.ok === false`，禁 `!r.ok`。
 */
export type TextFetchResult = { ok: true; text: string } | { ok: false; error: string };

/**
 * 读文字素材正文（唯一入口）。失败 → `reportDegrade` 留痕（**不弹 toast**：可见性归调用方）+ `{ok:false}`，
 * 且**不入缓存**。
 * 注：`httpRequest` 对非 2xx **一律 throw**（`httpClient.ts:228/244`）⇒ 旧 `r.ok ? r.text() : ''` 的 `: ''` 是死分支，已删。
 */
export async function fetchText(url: string): Promise<TextFetchResult> {
  const cached = textCache.get(url);
  if (cached !== undefined) return { ok: true, text: cached };
  try {
    const res = await httpRequest(url, {
      timeoutMs: LOCAL_TOOL_PING_TIMEOUT,
      retries: 0,
      parseJson: false,
    });
    const text = await res.text();
    textCache.set(url, text);
    return { ok: true, text };
  } catch (e) {
    reportDegrade({
      layer: TEXT_LAYER,
      key: url,
      e: e instanceof Error ? e : new Error(String(e)),
    });
    return { ok: false, error: TEXT_UNREADABLE };
  }
}

/**
 * 文字素材读取的**三态**（加载中／读到／读失败），取代 3 处面板手写的 `useState('') + fetchText().then(setText)`
 * —— 旧形态把三态压成一个字符串，失败与真空都渲染成同一个"加载中..."。
 * 属 Step 3 **探测重复**（怎么读）⇒ 收口为唯一实现；**呈现成什么仍归各消费方**。
 */
export type TextAssetState =
  { phase: 'loading' } | { phase: 'ok'; text: string } | { phase: 'failed'; error: string };

export function useTextAsset(url: string): TextAssetState {
  const [state, setState] = useState<TextAssetState>({ phase: 'loading' });
  useEffect(() => {
    let alive = true;
    setState({ phase: 'loading' });
    fetchText(url).then((r) => {
      if (!alive) return;
      setState(
        r.ok === false ? { phase: 'failed', error: r.error } : { phase: 'ok', text: r.text },
      );
    });
    return () => {
      alive = false;
    };
  }, [url]);
  return state;
}

/** 素材的完整拖拽格式（统一信封） */
function assetPayload(asset: CanvasAssetLike, text?: string): string {
  return JSON.stringify({
    url: asset.url,
    name: asset.name,
    type: asset.type,
    contentId: asset.contentId,
    text,
  });
}

/**
 * 生成统一拖拽属性的【纯函数】（不依赖 React，非 hook 组件如 TaskCard 也可直接用）。
 * @param {{url:string, name?:string, type?:string}} asset
 * @param {{disable?:boolean}} [opts] opts.disable 为 true 时不启用拖拽（如文件夹）
 * @returns {{ draggable:boolean, onDragStart:(e)=>void }}
 */
export function makeAssetDragProps(
  asset: CanvasAssetLike,
  opts: { disable?: boolean } = {},
): ResourceDragSourceProps {
  const dragEnabled = !!asset && !!(!opts.disable && asset.url);
  return {
    draggable: dragEnabled,
    onDragStart: (e: ReactDragEvent) => {
      if (!dragEnabled) return;
      const url = asset.url!;
      const text = textCache.get(url);
      e.dataTransfer.setData('application/x-yimao-asset', assetPayload(asset, text));
      e.dataTransfer.effectAllowed = 'copy';
      // 文字内容异步补全（dataTransfer 在拖拽期间可多次 setData）
      if (asset.type === 'text' && !text) {
        fetchText(url).then((r) => {
          if (r.ok === false) {
            // 呈现归调用方：拖拽发起端知道用户正在拖，负责让失败可见（生产者已给全文案，此处只转发）
            reportDegrade({ layer: TEXT_LAYER, key: url, toast: `${r.error}，拖入的节点不含正文` });
            return;
          }
          if (r.text)
            e.dataTransfer.setData('application/x-yimao-asset', assetPayload(asset, r.text));
        });
      }
    },
  };
}

/** hook 版：与 makeAssetDragProps 等价，供 React 组件内取引用一致的版本 */
export function useAssetDragToCanvas(): { assetDragProps: typeof makeAssetDragProps } {
  return { assetDragProps: makeAssetDragProps };
}

/**
 * 把 assetDragProps 的结果适配到 <img>（素材库 / 生成 两个面板共用）：
 * 源 `draggable` 是 `string | boolean`（url 非空即真 —— 勿在源头 `!!` 收窄，见 makeAssetDragProps），
 * 而 React 的 img.draggable 只接受 Booleanish，故在消费端按真值收窄。
 * React 对 draggable 一律渲染成 "true"/"false"，DOM 产物与收窄前完全一致，零行为变化。
 */
export function toImgDragProps(props: ResourceDragSourceProps) {
  return { ...props, draggable: Boolean(props.draggable) };
}

/**
 * 素材卡片拖拽属性的【唯一组合点】：一次 dragstart 同时写两套 MIME。
 *  - application/x-yimao-move  → 拖到文件夹卡片上做移动归类（useResourceMoveToFolder）
 *  - application/x-yimao-asset → 拖到画布上建节点（useAssetDropPaste 接收）
 *
 * 【为什么必须合并、不能二选一】
 * d7ac136 把卡片的 assetDragProps 换成只写 move MIME 的 sourceDragProps 后，拖到画布时
 * useAssetDropPaste 读不到 x-yimao-asset、也没有 files，就退回「拖入 URL」分支：
 * 素材的本地 URL（http://127.0.0.1:18080/files/migrated/...）被 isAssetUrl 判为图片 URL，
 * 走 addImageNodeFromUrl → downloadRemoteToLocal(folder:'web')，后端把本机文件再下载一份
 * 落进 uploads/web —— 于是「拖进素材库的图莫名跑到 web 目录」。
 * 画布侧已加本地 URL 兜底拦截（filesApi.downloadRemoteToLocal），这里补回来源才是根治。
 *
 * @param {{ connected: boolean, onRefreshed?: Function }} opts 透传给 useResourceMoveToFolder
 * @returns {{ cardDragProps: (item) => object }}
 */
export function useResourceCardDragProps(opts: ResourceMoveToFolderOptions) {
  const { assetDragProps } = useAssetDragToCanvas();
  const { sourceDragProps, folderDropProps } = useResourceMoveToFolder(opts);
  const cardDragProps = useCallback(
    (item: ResourceMoveItem) => {
      // 文件夹卡片是「移动落点」，不是拖拽源
      if (item.type === 'folder') return folderDropProps(item);
      if (!item.url) return {};
      const move = sourceDragProps(item);
      const toCanvas = assetDragProps(item);
      return {
        draggable: true,
        onDragStart: (e: ReactDragEvent) => {
          move.onDragStart?.(e);
          toCanvas.onDragStart?.(e);
        },
      };
    },
    [sourceDragProps, folderDropProps, assetDragProps],
  );
  return { cardDragProps, sourceDragProps, folderDropProps, assetDragProps };
}

// 供非 hook 场景（如纯函数封装）复用；面板一律走 useAssetDragToCanvas()/makeAssetDragProps()
// textCache / fetchText / useTextAsset 从本模块统一导出，替代各面板各自的副本（ResourceLibrary/GeneratedView）
export { textCache };
