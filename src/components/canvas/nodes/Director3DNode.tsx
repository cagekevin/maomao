import React, { useState, useMemo, useCallback } from 'react';
import { logger } from '@/components/base/core/logger';
import { toastWarning } from '@/components/base/core/toastStore';
import { useReactFlow } from '@xyflow/react';
import { createPortal } from 'react-dom';
import { Orbit, Maximize2 } from 'lucide-react';
import NodeShell from '@/components/canvas/parts/NodeShell';
import { IMAGE_BOX_NODE_SIZE } from '@/components/canvas/contract/nodeDefaults';
import { useConnectedInputs } from '@/hooks/useConnectedInputs';
import { useNodeRename } from '@/hooks/useNodeRename';
import { patchNodeDataById } from '@/hooks/useNodeData';
import { toAbsoluteFileUrl, saveInlineToLocal } from '@/components/base/api/index';
import { useRenderAssetResolver } from '@/components/base/utils/assetUrl';
import { Director3DOverlay } from '@/components/director3d/Director3DOverlay';
import { uploadFileToLocal } from '@/components/base/api/index';
import { generateId } from '@/components/base/core/idGen';
import { buildSpawnNodes, spawnAndCommit } from '@/components/canvas/structure/deriveNodes';
import { useCanvasEdges } from '@/components/canvas/structure/CanvasEdgesContext';

interface Director3DNodeData {
  label?: string;
  assetUrl?: string;
  images?: Array<{ url?: string; [key: string]: unknown }>;
  directorProject?: unknown;
}
interface Director3DNodeProps {
  id: string;
  data: Director3DNodeData;
  selected?: boolean;
}
function Director3DNode({ id, data, selected }: Director3DNodeProps) {
  const { setNodes, getNodes, getNode, getEdges, setEdges } = useReactFlow();
  // 标题改名 → 写回 data.label（下游 @名 匹配 / 素材条显示跟随），单一实现收口到 useNodeRename
  const rename = useNodeRename(id);
  const history = useCanvasEdges();
  const connected = useConnectedInputs(id);
  const [open, setOpen] = useState(false);
  const render = useRenderAssetResolver();
  // 缩略图显示：兼容相对 /files/ 路径（刷新后需补全为绝对 URL 才不破图）
  const assetUrl = toAbsoluteFileUrl(data.assetUrl || '') || null;

  // 输入全景图 URL：连接上游图片 或 已保存
  useMemo(() => {
    // 上游图片（图片节点 / 图片盒子 / 视频抽帧等）作为全景背景。
    // 兼容三种形式：http(s) URL / data: base64 / 相对 /files/ 路径（补全为绝对 URL）。
    const src = connected.images?.find((im) => im?.url)?.url;
    return toAbsoluteFileUrl(src || '') || null;
  }, [connected]);

  // 截图输出到图片盒子（对齐全景图节点 / 官方 onCaptureToBox）。
  // 截图是 data: base64，直接塞进图片盒子 → 后端 KV 会外置成相对 /files/ 路径 → 刷新破图。
  // 这里先把每张截图落盘成「绝对」/files/ URL（saveInlineToLocal），刷新不破图且快照变小。
  interface CaptureImage {
    blob?: Blob;
    dataUrl?: string;
    url?: string;
    fileName?: string;
  }
  const onCaptureToBox = useCallback(
    async (images: CaptureImage[]) => {
      if (!images || images.length === 0) return;
      const boxes = getEdges()
        .filter((e) => e.source === id)
        .map((e) => e.target)
        .filter((tid) => getNode(tid)?.type === 'imageBoxNode');
      // 并发落盘：Blob 直传 / data: base64 → /files/ 绝对 URL；已是 http/绝对路径原样保留。
      // 【2026-09-17 判据】失败**不再静默丢图**：原 `filter(Boolean)` 把落盘失败的图直接扔掉，
      // 用户只看到"图集少了几张"且零解释；且 `filter` 后索引移位 ⇒ 下面的 `images[i]` **取错 label**。
      // 现逐张记账（`name` 与图绑定，不再靠索引回查），失败项留痕待报。
      const shotResults = await Promise.all(
        images.map(
          async (im, i): Promise<{ url: string | null; name: string; message?: string }> => {
            const name = im.fileName || `导演台截图 ${i + 1}`;
            if (im.blob) {
              const up = await uploadFileToLocal(
                im.blob,
                'tasks',
                im.fileName || 'director3d-shot.png',
              );
              return up.ok ? { url: up.url, name } : { url: null, name, message: up.message };
            }
            const raw = im.dataUrl || im.url;
            if (raw && raw.startsWith('data:')) {
              const up = await saveInlineToLocal(raw, 'tasks');
              // 落盘失败 → **保留内联 base64**（真兜底：图仍能上屏，不丢图），但原因不吞。
              return up.ok ? { url: up.url, name } : { url: raw, name, message: up.message };
            }
            return { url: toAbsoluteFileUrl(raw || ''), name };
          },
        ),
      );
      const failedShots = shotResults.filter((s) => s.message);
      if (failedShots.length > 0) {
        // 【失败可见】"部分失败"不该静默：留痕给开发者（含**生产者判词**）＋ **用户可见提示**。
        //
        // 【2026-09-17 自查纠错】此处原写的是「⚠️ 已知缺口：本节点没有 toast 出口（只经 NodeShell）
        //  ⇒ 要更彻底需给本节点接一个提示出口」——**那是用注释代替施工**：
        //  `toastStore` 是全仓通用出口，本节点直接 import 即可，"没有出口"是我的臆断。
        //  规范见 `docs/138-彻底施工规范与交接-错误透传与成功判据-2026-09-17.md` §0.1（黑名单措辞）。
        logger.warn('导演台', '部分截图未落盘（失败项已按兜底保留内联/丢弃）', {
          failed: failedShots.map((s) => ({ name: s.name, message: s.message })),
        });
        toastWarning(`${failedShots.length} 张截图未落盘：${failedShots[0].message}`);
      }
      const persisted = shotResults.filter(
        (s): s is { url: string; name: string; message?: string } => Boolean(s.url),
      );
      const newImages = persisted.map((p, i) => ({
        id: `img-${generateId('img')}-${i}`,
        url: p.url,
        label: p.name,
        source: 'gen',
        createdAt: Date.now(),
      }));
      if (boxes.length > 0) {
        const boxId = boxes[0];
        const boxNode = getNode(boxId);
        const existing = (boxNode?.data?.images as Array<{ url?: string }> | undefined) || [];
        const existingUrls = new Set(existing.map((x) => x.url));
        const fresh = newImages.filter((x) => !existingUrls.has(x.url ?? undefined));
        const merged = [...existing, ...fresh];
        patchNodeDataById(setNodes, boxId, { images: merged, activeIndex: merged.length - 1 });
      } else {
        const me = getNode(id);
        const boxId = generateId('imageBoxNode');
        const spawned = buildSpawnNodes(
          {
            id,
            position: {
              x: (me?.position.x ?? 100) + (me?.measured?.width ?? 640) + 60,
              y: me?.position.y ?? 100,
            },
          },
          [
            {
              id: boxId,
              type: 'imageBoxNode',
              position: {
                x: (me?.position.x ?? 100) + (me?.measured?.width ?? 640) + 60,
                y: me?.position.y ?? 100,
              },
              style: { ...IMAGE_BOX_NODE_SIZE }, // 尺寸单源（TD-16-48）；与 Panorama 同档
              data: {
                images: newImages,
                activeIndex: newImages.length - 1,
                expanded: newImages.length > 1,
                label: '图片盒子',
              },
            },
          ],
          { targetHandle: undefined },
        );
        // TD-04-11：统一走 spawnAndCommit（原子提交三连收口），不再手写 applySpawnSnapshot+setNodes/setEdges/record。
        spawnAndCommit(spawned, {
          getNodes,
          getEdges,
          setNodes,
          setEdges,
          history: history ?? undefined,
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, getNodes, getEdges, setNodes, setEdges, history],
  );

  // 视频回写到 AssetNode（图片视频素材节点）：落盘 /files/*.mp4 → 写 assetUrl + assetType:'video'
  interface CaptureVideo {
    blob?: Blob;
    fileName?: string;
  }
  const onVideoToImageNode = useCallback(
    async (videos: CaptureVideo[]) => {
      if (!videos || videos.length === 0) return;
      // 落盘全部视频，取最后一个作为 AssetNode 展示（AssetNode 单媒体）
      let lastUrl: string | null = null;
      let lastFile: string | null = null;
      let failMessage: string | undefined;
      for (const v of videos) {
        if (!v.blob) continue;
        // 【2026-09-17 契约对齐 · 修真 bug】`uploadFileToLocal` 已改判别联合（原 `string|null`），
        // 此处仍按字符串判 `if (fileUrl)` —— 对象恒真 ⇒ `lastUrl` 被赋成**对象**、
        // 下游 `assetUrl` 写成 `[object Object]`（AssetNode 拿到假 url）。必须读 `.ok/.url/.message`。
        const up = await uploadFileToLocal(v.blob, 'tasks', v.fileName || 'director3d-video.mp4');
        if (up.ok) {
          lastUrl = up.url;
          lastFile = v.fileName || 'director3d-video.mp4';
        } else {
          failMessage = up.message; // 逐条记账（同 onCaptureToBox 形态）
        }
      }
      if (!lastUrl) {
        // 【失败可见】此前直接 `return` ⇒ 用户点「导出视频到节点」毫无反应，
        // 分不清"没点上"还是"没落盘"（同文件 onCaptureToBox 已示范该形态）。
        logger.warn('导演台', '视频未落盘，未写回节点', { message: failMessage });
        toastWarning(`视频未落盘：${failMessage || '本地服务可能未启动'}`);
        return;
      }
      const targets = getEdges()
        .filter((e) => e.source === id)
        .map((e) => e.target)
        .filter((tid) => getNode(tid)?.type === 'assetNode');
      if (targets.length > 0) {
        // 已有下游 AssetNode：写最近导出视频
        const targetId = targets[0];
        // 只写 assetUrl（docs/118 §7.3 ⑤ 写侧唯一）：不再双写存量字段 data.url。
        patchNodeDataById(setNodes, targetId, { assetUrl: lastUrl, assetType: 'video' });
      } else {
        // 无下游 AssetNode：新建并连线
        const me = getNode(id);
        const imageId = generateId('assetNode');
        const spawned = buildSpawnNodes(
          {
            id,
            position: {
              x: (me?.position.x ?? 100) + (me?.measured?.width ?? 640) + 60,
              y: (me?.position.y ?? 100) + 320,
            },
          },
          [
            {
              id: imageId,
              type: 'assetNode',
              position: {
                x: (me?.position.x ?? 100) + (me?.measured?.width ?? 640) + 60,
                y: (me?.position.y ?? 100) + 320,
              },
              data: {
                assetUrl: lastUrl,
                assetType: 'video',
                label: lastFile,
                images: [],
              },
            },
          ],
          { targetHandle: undefined },
        );
        // TD-04-11：统一走 spawnAndCommit（原子提交三连收口），不再手写 applySpawnSnapshot+setNodes/setEdges/record。
        spawnAndCommit(spawned, {
          getNodes,
          getEdges,
          setNodes,
          setEdges,
          history: history ?? undefined,
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, getNodes, getEdges, setNodes, setEdges, history],
  );

  // 退出导演台：缩略图落盘 /files/ 写节点 assetUrl，彻底删除旧 directorProject；
  // 图片截图 → 图片盒子，视频 → AssetNode（有则写，无则新建并连线）
  const handleExit = useCallback(
    async ({
      thumbnailDataUrl,
      captures,
    }: {
      thumbnailDataUrl: string | null;
      captures: { type: 'image' | 'video'; blob: Blob; fileName: string }[];
    }) => {
      setOpen(false);
      // 缩略图 URL 化：blob:/data: 落盘成 /files/ 绝对 URL（刷新不破图）
      let persistedThumb = thumbnailDataUrl || null;
      if (persistedThumb && persistedThumb.startsWith('blob:')) {
        try {
          const blobRes = await fetch(persistedThumb);
          const blob = await blobRes.blob();
          const up = await uploadFileToLocal(blob, 'tasks', 'director3d-thumb.png');
          // 【2026-09-17 消费者只转发】失败保留原值（**真兜底**，不阻断），但**原因留痕** ——
          // 原来只在 catch 里 logger.debug，`if (fileUrl)` 的**失败分支完全静默**。
          if (up.ok) persistedThumb = up.url;
          else
            logger.warn('3D 节点', '缩略图落盘失败，保留原值（不阻断）', { message: up.message });
        } catch (e) {
          // 读取失败（fetch blob）保留原值 → **降级必留痕**（保留 dataURL 的体积代价真实存在）。
          logger.warn('3D 节点', '缩略图读取失败，保留原值（不阻断）', e);
        }
      } else if (persistedThumb && persistedThumb.startsWith('data:')) {
        const up = await saveInlineToLocal(persistedThumb, 'tasks');
        if (up.ok) persistedThumb = up.url;
        else logger.warn('3D 节点', '缩略图落盘失败，保留原值（不阻断）', { message: up.message });
      }
      // 写回节点：assetUrl 存缩略图，彻底移除旧 directorProject 字段（patchNodeDataById 浅合并 + undefined 等价删键）
      patchNodeDataById(setNodes, id, {
        assetUrl: persistedThumb || getNode(id)?.data?.assetUrl || null,
        directorProject: undefined,
      });
      // 分类回写：图片 → 图片盒子；视频 → AssetNode
      if (captures && captures.length > 0) {
        const imageCaptures = captures.filter((c) => c.type === 'image');
        const videoCaptures = captures.filter((c) => c.type === 'video');
        if (imageCaptures.length > 0) await onCaptureToBox(imageCaptures);
        if (videoCaptures.length > 0) await onVideoToImageNode(videoCaptures);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, setNodes, onCaptureToBox, onVideoToImageNode],
  );

  return (
    <NodeShell
      id={id}
      label={data.label}
      defaultTitle="3D 导演台"
      icon={<Orbit size={11} className="text-muted" />}
      selected={selected}
      handleVariant="small"
      defaultHeight={260}
      onRename={rename}
    >
      {/* 主显示框（模板写法：背景/圆角/边框/阴影由 NodeShell 提供，children 只写业务内容）
          主体：静态缩略图 / 占位；双击进入全屏 */}
      <div
        className="relative flex flex-col w-full flex-1 min-h-0 cursor-pointer overflow-hidden rounded-xl"
        onDoubleClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        {assetUrl ? (
          <img
            src={render(assetUrl)}
            className="w-full h-full object-cover rounded-xl"
            alt="导演台预览"
            draggable={false}
          />
        ) : (
          <div className="flex flex-col items-center justify-center absolute inset-0 gap-2 text-muted-2 pointer-events-none bg-surface-muted">
            <Orbit size={64} strokeWidth={1.2} />
            <span className="text-caption text-muted">双击打开 3D 导演台</span>
          </div>
        )}
        {/* 悬浮打开按钮（token 化，去裸色） */}
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 bg-overlay text-primary text-caption rounded-full border border-edge-strong shadow-popover opacity-0 hover:opacity-100 transition-opacity cursor-pointer nodrag"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
        >
          <Maximize2 size={13} /> 打开导演台
        </div>
      </div>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-modal" onClick={(e) => e.stopPropagation()}>
            <Director3DOverlay nodeId={id} onExit={handleExit} />
          </div>,
          document.body,
        )}
    </NodeShell>
  );
}
export default React.memo(Director3DNode);
