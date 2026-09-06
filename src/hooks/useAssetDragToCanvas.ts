import { useCallback } from 'react';
import type { DragEvent as ReactDragEvent } from 'react';
import { httpRequest } from '../components/base/api/index.ts';
import { LOCAL_TOOL_PING_TIMEOUT } from '../components/base/core/config.ts';
import { useAssetMoveToFolder } from './useAssetMoveToFolder.ts';
import type {
  AssetMoveItem,
  AssetMoveToFolderOptions,
  AssetDragSourceProps,
} from './useAssetMoveToFolder.ts';

/** 素材最小形状（拖到画布建节点所需字段） */
export interface CanvasAssetLike {
  url?: string;
  name?: string;
  type?: string;
}

/**
 * 素材拖拽到画布的【唯一发起端】公共 hook（对齐官方 H_.jsx onDrop 的素材通道）。
 *
 * 【为什么收敛到这里】
 * 此前「把图片/视频/音频/文字素材拖到画布」的 onDragStart 在多个面板各写一遍：
 *  - AssetLibrary.tsx / GeneratedView.tsx（用 application/x-yimao-asset）
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

// 文字素材内容缓存（模块级，面板间共享）：url → text。避免每次拖拽都重新 fetch。
const textCache = new Map<string, string>();
function fetchText(url: string): Promise<string> {
  if (textCache.has(url)) return Promise.resolve(textCache.get(url));
  return httpRequest(url, { timeoutMs: LOCAL_TOOL_PING_TIMEOUT, retries: 0, parseJson: false })
    .then((r) => (r.ok ? r.text() : ''))
    .then((t) => {
      textCache.set(url, t);
      return t;
    })
    .catch(() => '');
}

/** 素材的完整拖拽格式（统一信封） */
function assetPayload(asset: CanvasAssetLike, text?: string): string {
  return JSON.stringify({ url: asset.url, name: asset.name, type: asset.type, text });
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
): AssetDragSourceProps {
  const dragEnabled = !opts.disable && asset && asset.url;
  return {
    draggable: dragEnabled,
    onDragStart: (e: ReactDragEvent) => {
      if (!dragEnabled) return;
      const text = textCache.get(asset.url);
      e.dataTransfer.setData('application/x-yimao-asset', assetPayload(asset, text));
      e.dataTransfer.effectAllowed = 'copy';
      // 文字内容异步补全（dataTransfer 在拖拽期间可多次 setData）
      if (asset.type === 'text' && !text) {
        fetchText(asset.url).then((t) => {
          if (t) e.dataTransfer.setData('application/x-yimao-asset', assetPayload(asset, t));
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
export function toImgDragProps(props: AssetDragSourceProps) {
  return { ...props, draggable: Boolean(props.draggable) };
}

/**
 * 素材卡片拖拽属性的【唯一组合点】：一次 dragstart 同时写两套 MIME。
 *  - application/x-yimao-move  → 拖到文件夹卡片上做移动归类（useAssetMoveToFolder）
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
 * @param {{ connected: boolean, onRefreshed?: Function }} opts 透传给 useAssetMoveToFolder
 * @returns {{ cardDragProps: (item) => object }}
 */
export function useAssetCardDragProps(opts: AssetMoveToFolderOptions) {
  const { assetDragProps } = useAssetDragToCanvas();
  const { sourceDragProps, folderDropProps } = useAssetMoveToFolder(opts);
  const cardDragProps = useCallback(
    (item: AssetMoveItem) => {
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
// fetchText/textCache 从本模块统一导出，替代各面板各自的副本（AssetLibrary/GeneratedView）
export { textCache, fetchText };
