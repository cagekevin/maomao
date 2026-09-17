import { useCallback } from 'react';
import { tryParse } from '../components/base/utils/asyncGuard.ts';
import type { DragEvent as ReactDragEvent } from 'react';
import { moveFile, canMoveAsset, resolveMovePaths } from '../components/base/api/index.ts';
import { showToast } from '../components/base/core/toastStore.ts';
import { logger } from '../components/base/core/logger.ts';

/** 资源项（素材/生成/文件夹卡片共用的最小形状） */
export interface ResourceMoveItem {
  folder?: string;
  name?: string;
  source?: string;
  type?: string;
  url?: string;
  /** docs/122 #4：素材稳定 contentId（由资源项携带，拖到画布建 asset 时写入节点） */
  contentId?: string;
}

/**
 * 可拖拽属性（卡片作为拖拽源）。
 * 注：draggable 历史实现为 `!disable && asset && asset.url`，有 url 时取到的是 url 字符串
 * 而非布尔真值；此处如实标注为 boolean | string，保持运行时零改动（勿改成 !! 收窄）。
 */
export interface ResourceDragSourceProps {
  draggable: boolean | string;
  onDragStart: (e: ReactDragEvent) => void;
}

/** 落点属性（文件夹卡片作为 drop 目标） */
export interface FolderDropTargetProps {
  onDragOver: (e: ReactDragEvent) => void;
  onDrop: (e: ReactDragEvent) => void;
}

export interface ResourceMoveToFolderOptions {
  /**
   * 本地引擎是否已连接（**必填，勿改回可选**）。
   * ⚠️ 可选 = 缺省永假 ⇒ drop 恒走「请先连接本地引擎」分支并 return = **假交互**
   * （2026-09-17 实证：导入弹窗漏传 → 文件夹落点一直"拖不进去"，用户可见）。
   * 改成必填后由**编译器**兜住"忘传"，不再靠调用方自觉（缺省值本身就是陷阱）。
   */
  connected: boolean;
  onRefreshed?: () => void;
}

/** 移动拖拽专用 MIME（与素材「拖到画布」的 application/x-yimao-asset 区分，互不干扰） */
export const RESOURCE_MOVE_MIME = 'application/x-yimao-move';

function movePayload(item: ResourceMoveItem): string {
  return JSON.stringify({
    folder: item.folder || '',
    name: item.name,
    // 【TD-12-8】携带不可变 url：磁盘定位真源（resolveMovePaths 由它派生 src/dst）
    url: item.url,
    source: item.source,
    type: item.type,
  });
}
function parseMovePayload(str: string): ResourceMoveItem | null {
  // 解析走唯一原语；判别联合 ⇒ **必须判 ok** 才能读 value（2026-09-17 契约收紧）。
  //
  // 【2026-09-17 为什么这里**可以**返回 null】同 `drag-data.getDragData`：本函数是**问句**
  // 「这次拖拽带的是不是本仓资源移动载荷？」——空串＝没带；非空但 JSON 坏＝带了坏的。
  // 对调用方（`if (!it) return`）两者都是"不处理这次拖拽" ⇒ 判别联合零收益。
  // 但**坏 JSON 必须留痕**（写入侧 bug 不能静默），故加 warn。
  const r = tryParse(() => JSON.parse(str) as ResourceMoveItem);
  if (!r.ok) {
    logger.warn('资源移动', '拖拽载荷不是合法 JSON（本次拖拽已忽略）', { error: r.error });
    return null;
  }
  return r.value;
}
/**
 * 目录条目 → **它自身的目录路径**（唯一实现，导出复用）。
 * rescan 把子目录录成条目时 `folder` = 父目录、`name` = 目录名 ⇒ 自身路径 = `folder/name`。
 * 消费方两类：① 本 hook 的 drop 落点；② 面板/弹窗的「点目录进入」（如导入弹窗进入文件夹）。
 * 更新(2026-09-17)：正名自 `moveTargetDirOf` —— 它已不只是"移动目标"，而是**目录条目的路径真源**；
 * 不再有两个消费者各自拼 `currentFolder/name` 的第二份（TD-02-54 同族收口）。
 */
export function folderPathOf(card: ResourceMoveItem): string {
  return card?.folder ? `${card.folder}/${card.name}` : card?.name || '';
}

/**
 * 「把文件拖到文件夹卡片上即归类」的共享实现（素材/生成两 tab 唯一收敛点）。
 *
 * - sourceDragProps(item)：放在「文件卡片」上，使其可拖拽，写移动归类 payload
 *   （application/x-yimao-move）。
 * - folderDropProps(folderCard)：放在「文件夹卡片」上，作为落点；drop 时执行移动 + toast + 回调刷新。
 *
 * 【面板用法】面板一律用 useResourceCardDragProps()（useAssetDragToCanvas.js），它把本 hook 的
 * sourceDragProps 与「拖到画布建节点」的 assetDragProps 合并进同一次 dragstart —— 两者 MIME
 * 不同（x-yimao-move / x-yimao-asset），互不冲突。切勿只挂 sourceDragProps：那样拖到画布时
 * 画布认不出素材，会把素材的本地 URL 当成网页图再下载一份落进 uploads/web（d7ac136 回归）。
 *
 * 直接复用 filesApi（候选 C 后文件域单点）的 canMoveAsset / resolveMovePaths / moveFile，遵守同一套相对路径与边界契约。
 */
export function useResourceMoveToFolder({ connected, onRefreshed }: ResourceMoveToFolderOptions): {
  sourceDragProps: (item: ResourceMoveItem) => Partial<ResourceDragSourceProps>;
  folderDropProps: (folderCard: ResourceMoveItem) => FolderDropTargetProps;
} {
  // 源（文件卡片）拖拽属性：仅移动归类
  const sourceDragProps = useCallback(
    (item: ResourceMoveItem): Partial<ResourceDragSourceProps> => {
      if (item.type === 'folder' || !item.url) return {};
      return {
        draggable: true,
        onDragStart: (e: ReactDragEvent) => {
          e.dataTransfer.setData(RESOURCE_MOVE_MIME, movePayload(item));
          e.dataTransfer.effectAllowed = 'move';
        },
      };
    },
    [],
  );

  // 目标（文件夹卡片）承接 drop
  const folderDropProps = useCallback(
    (folderCard: ResourceMoveItem): FolderDropTargetProps => ({
      onDragOver: (e: ReactDragEvent) => {
        e.preventDefault();
      },
      onDrop: async (e: ReactDragEvent) => {
        e.preventDefault();
        e.stopPropagation(); // 不落到面板层的上传 onDrop
        if (!connected) {
          showToast('请先连接本地引擎', { type: 'warning' });
          return;
        }
        const it = parseMovePayload(e.dataTransfer.getData(RESOURCE_MOVE_MIME));
        if (!it) return;
        const target = folderPathOf(folderCard);
        if (!canMoveAsset(it)) {
          showToast('仅支持移动本地资源', { type: 'warning' });
          return;
        }
        const { src, dst, sameDir } = resolveMovePaths(it, target);
        if (sameDir) {
          showToast('文件已在目标目录', { type: 'warning' });
          return;
        }
        try {
          // 【增量② · context-only】移动到文件夹 = 只改 resource 行的 folder（UI 分类），
          // 磁盘 / url / contentId 不变 → 不广播 url 改写（url 未变则不需 rewrite，改发也会指向不存在的路径）。
          // 移动 only 刷新列表（新 folder 上下文生效）。
          await moveFile(src, dst);
          showToast(`已移动到「${target}」`, { type: 'success' });
          onRefreshed?.();
        } catch (err) {
          showToast((err as { message?: string })?.message || '移动失败', { type: 'error' });
        }
      },
    }),
    [connected, onRefreshed],
  );

  return { sourceDragProps, folderDropProps };
}
