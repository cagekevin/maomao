import React, { useState } from 'react';
import { X, Link as LinkIcon } from 'lucide-react';
import LazyImage from '@/components/base/ui/display/LazyImage';
import { imageKeyOf } from '@/components/base/utils/media/imageIdentity';

/**
 * 素材缩略图条（生图/文本/视频等节点的「下方素材参考区」通用组件）。
 *
 * 以生图节点（ImageGenerate）素材区为标准统一：三节点共用此组件，避免各自复制导致样式不一致。
 * 形态：
 *  - 图片/媒体缩略图：方形缩略图 + 底部蓝色「@名」插入按钮 + 右上角红色 ×（hover 显示，断开连线）
 *  - 文本素材：胶囊标签 + 右上角红色 ×（hover 显示，断开连线）
 *
 * 断线规则：
 *  - 只有带 sourceNodeId 的素材（来自 useConnectedInputs 的真实上游连线）才显示红色 × 可断开；
 *  - data.images 塞进来的剧本盒子资产（无 sourceNodeId）不显示 ×，不能断开（它不是连线来源）。
 *
 *  @param props
 *  - images   [{url, sourceNodeId?, label?, id?}] 图片/媒体素材
 *  - texts    [{sourceNodeId?, label?, text?, id?}] 文本素材
 *  - onInsert (asset) => void  点击蓝色 @标签插入到提示词/文本框。
 *      asset = { id, label, url?, kind: 'image'|'text' }（富文本芯片所需完整信息，
 *      不再只传 name——让 @素材 能渲染成带缩略图的小图芯片，见 promptChips.js）
 *  - onDisconnect (sourceNodeId) => void   点击红色 × 断开该来源节点 → 本节点的连线
 *  - readOnly boolean         只读展示：去掉「点击 @插入」交互，仅显示缩略图/文字标签（含 × 断线）
 *
 * 更新(2026-11-01 · docs/plan/151 §5.2 1-4)：`onInsert` 的 `id` 兜底从**下标**改为
 * **唯一实现** `imageKeyOf({ url })`（内容派生的退化键，同 url 同键）。下标当身份在断线重连 / 重排 /
 * Agent 重写 data 后会指向另一张图，而它会被写进 `data.prompt` 的 `@{id}` 芯片并跨会话存活。
 * 无 id 也无 url 的脏项**不参与插入**（它本就拼不出合法芯片）；渲染 key 同期改用同一身份键
 * （它只影响渲染复用，不写进任何持久化数据）。
 *
 * 更新(2026-11-01 · docs/plan/151 §8.3 3-3)：新增可选 `onReorder(fromIndex, toIndex)`。
 * 仅当传入时才挂原生 HTML5 拖拽（**不引 DnD 库**，范本 = `ImageBoxNode` 的 draggable/onDragEnter/onDrop）；
 * 缺省 / `readOnly` ⇒ 行为**逐字不变**（其余 5 个调用点零影响）。`nodrag nopan` 保留（否则画布跟着拖）。
 * 换序只上报下标，**不在这里改数据** —— 写回 `data.imageOrder` 是调用方的事（顺序表真源只有一个）。
 */
export interface ResourceStripProps {
  images?: Array<{
    id?: string;
    label?: string;
    url?: string;
    kind?: string;
    sourceNodeId?: string;
  }>;
  texts?: Array<{
    id?: string;
    label?: string;
    kind?: string;
    text?: string;
    sourceNodeId?: string;
  }>;
  onInsert?: ((item: unknown) => void) | undefined;
  onDisconnect?: ((sourceNodeId: string) => void) | undefined;
  readOnly?: boolean | undefined;
  /**
   * 拖拽换序（可选，docs/plan/151 §8.3 3-3）。
   * 仅当传入时才挂 DnD —— 缺省（其余 5 个调用点）行为**逐字不变**。
   * 原生 HTML5 拖拽，**不引库**（范本 = ImageBoxNode 的 draggable/onDragEnter/onDrop）。
   */
  onReorder?: ((fromIndex: number, toIndex: number) => void) | undefined;
}

function ResourceStrip({
  images = [],
  texts = [],
  onInsert,
  onDisconnect,
  readOnly = false,
  onReorder,
}: ResourceStripProps) {
  // 拖拽换序的**瞬态**状态（不落盘）：dragFrom = 正在拖的下标，dragTo = 当前悬停的下标。
  // 用 state 而非 ref：高亮要跟着变，需要重渲染。
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragTo, setDragTo] = useState<number | null>(null);
  if (images.length === 0 && texts.length === 0) return null;
  // 仅当调用方给了 onReorder 才挂 DnD（缺省行为逐字不变，见 props 注释）
  const draggable = !!onReorder && !readOnly;
  return (
    // 不带任何左侧偏移样式（无 mb / 无 paddingLeft）——左边界完全由父容器统一 padding 决定，
    // 与 PromptInput 正文共享同一条左基准线，避免各自 2px/4px 偏移导致视觉差 1~2px。
    <div className="flex flex-wrap gap-2">
      {images.map((img, i) => {
        const name = img.label || `图片${i + 1}`;
        const canDisconnect = !!img.sourceNodeId;
        const isDropTarget = dragTo === i && dragFrom !== null && dragFrom !== i;
        return (
          <div
            key={imageKeyOf({ id: img.id, url: img.url })}
            /* 拖拽换序（3-3）：`nodrag nopan` 必须保留 —— 否则画布会跟着一起拖/平移。
               onDragStart 记源下标，onDragEnter/onDragOver 记目标，onDrop 才真正回调。 */
            {...(draggable
              ? {
                  draggable: true,
                  onDragStart: (e: React.DragEvent) => {
                    e.stopPropagation();
                    e.dataTransfer.effectAllowed = 'move';
                    setDragFrom(i);
                  },
                  onDragEnter: (e: React.DragEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (dragFrom !== null && dragFrom !== i) setDragTo(i);
                  },
                  onDragOver: (e: React.DragEvent) => {
                    if (dragFrom !== null) {
                      e.preventDefault();
                      e.stopPropagation();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragTo !== i) setDragTo(i);
                    }
                  },
                  onDragLeave: (e: React.DragEvent) => {
                    if (dragFrom !== null) e.stopPropagation();
                  },
                  onDrop: (e: React.DragEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (dragFrom !== null && dragFrom !== i) onReorder(dragFrom, i);
                    setDragFrom(null);
                    setDragTo(null);
                  },
                  onDragEnd: (e: React.DragEvent) => {
                    e.stopPropagation();
                    setDragFrom(null);
                    setDragTo(null);
                  },
                }
              : {})}
            className={`w-10 h-10 rounded-md overflow-hidden relative group bg-black cursor-grab active:cursor-grabbing nodrag nopan${
              isDropTarget ? ' ring-2 ring-blue-400' : ''
            }${dragFrom === i ? ' opacity-40' : ''}`}
            title={canDisconnect ? '已连线的素材' : '上传的素材'}
          >
            <LazyImage
              src={img.url}
              alt={name}
              className="w-full h-full"
              imgClassName="w-full h-full object-cover opacity-80 pointer-events-none"
              /* 40×40 小缩略图：立即加载（解码成本≈0）。走 IO 懒加载时，画布 transform 容器里
                 一旦可见性判定不触发就是「永久黑块」——懒加载是优化，不该卡住显示 */
              eager
            />
            <div className="absolute inset-0 bg-blue-500/10 pointer-events-none" />
            {!readOnly && (
              <button
                type="button"
                className="absolute bottom-0 left-0 right-0 bg-blue-500/80 hover:bg-blue-500 text-2xs text-white text-center py-0.5 truncate cursor-pointer transition-colors"
                title={`点击插入 @${name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onInsert?.({
                    // id · docs/plan/151 §5.2 1-4（2026-11-01）：原为**下标**（违反 §2 R2）。
                    // 现走唯一实现 imageKeyOf 的退化键（同 url 同键，与 `data.prompt` 芯片 id 口径一致）。
                    // 无 id 也无 url 的脏项**直接不插入** —— 它本就拼不出合法芯片
                    // （buildChipEl 拿到空 id 会产出 `@{:label}` 的坏格式）。
                    id: imageKeyOf({ id: img.id, url: img.url }),
                    label: name,
                    url: img.url,
                    kind: 'image',
                  });
                }}
              >
                {name}
              </button>
            )}
            {canDisconnect && (
              <span
                className="absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all"
                title="断开连线"
                onClick={(e) => {
                  e.stopPropagation();
                  onDisconnect?.(img.sourceNodeId ?? '');
                }}
              >
                <X size={10} className="text-white" />
              </span>
            )}
          </div>
        );
      })}
      {texts.map((t, i) => {
        const name = t.label || `文本${i + 1}`;
        const canDisconnect = !!t.sourceNodeId;
        return (
          <div
            key={t.id || i}
            className={`h-8 px-2 bg-surface-hover border border-edge-muted rounded flex items-center gap-1 text-caption text-body relative ${readOnly ? '' : 'hover:bg-surface-hover-strong hover:border-blue-500 hover:text-blue-400 transition-colors group/text cursor-pointer'}`}
            title={t.text || name}
            onClick={
              readOnly
                ? undefined
                : (e) => {
                    e.stopPropagation();
                    onInsert?.({ id: t.id || `text-${i}`, label: name, kind: 'text' });
                  }
            }
          >
            <LinkIcon size={10} />
            <span className="max-w-[80px] truncate">
              {name}
              {t.text ? ` (${t.label || ''})` : ''}
            </span>
            {canDisconnect && (
              <span
                className="absolute -top-1 -right-1 p-0.5 bg-black hover:bg-red-500 rounded-full cursor-pointer opacity-0 group-hover/text:opacity-100 transition-all"
                title="断开连线"
                onClick={(e) => {
                  e.stopPropagation();
                  onDisconnect?.(t.sourceNodeId ?? '');
                }}
              >
                <X size={10} className="text-white" />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default React.memo(ResourceStrip);
