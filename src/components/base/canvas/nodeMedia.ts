import type { Node } from '@xyflow/react';
import { classifyAssetUrlKind } from '../utils/assetType.ts';

/* ════════════════════════════════════════════════════════════════
 * 节点媒体提取 / 选中派生（画布基础设施 · 纯函数，零 React / 零 store 依赖）
 * ────────────────────────────────────────────────────────────────
 * 【为什么住在这里（TD-04-25）】这两个提取器 + 派生函数只依赖 Node 数据形态，
 * 属「画布节点数据读取」基础设施。此前 getNodeAssetUrl/getNodeMedia 住在
 * agent/canvas/useCanvasAgentTools.ts（agent 层）——but 它们被画布选中链（App 编排层）
 * 消费，若将来把选中派生收进 base/canvas 就会反向依赖 agent 层（依赖方向倒置）。
 * 故下沉到 base/canvas，agent 层改为消费者（useCanvasAgentTools 不再实现、只引用）。
 * ════════════════════════════════════════════════════════════════ */

/**
 * 提取节点「主图 URL」（纯函数，导出供 AgentPanel/App 引用带图节点用）。
 * 覆盖常见图字段形态：data.assetUrl / data.url（字符串）、data.images / data.assetUrls（数组）。
 * images 数组元素兼容字符串（url）与对象（{ url } 或 { assetUrl }）。无图返回空串。
 * 设计取舍：只取「主图」一个 URL（用户选中节点即引用其首图），保证简单、可复用现有图片附件链路。
 */
export function getNodeAssetUrl(node: Node | null) {
  const d = node?.data || {};
  for (const key of ['assetUrl', 'url']) {
    if (typeof d[key] === 'string' && d[key]) return d[key];
  }
  for (const key of ['images', 'assetUrls']) {
    const arr = Array.isArray(d[key]) ? d[key] : [];
    for (const item of arr) {
      if (typeof item === 'string' && item) return item;
      if (item && typeof item === 'object') {
        const u = item.url || item.assetUrl;
        if (typeof u === 'string' && u) return u;
      }
    }
  }
  return '';
}

/**
 * 提取选中节点的「主媒体」（纯函数，供 App 传给 AgentPanel 待发送区）。
 * 与 getNodeAssetUrl 的区别：视频/音频节点返回【本体】URL 而非封面图，并标记媒体类型。
 * 判定顺序（对齐 AssetNode：`data.assetType || detectAssetType`）：
 *   1. 显式 `data.assetType==='video'|'audio'` → 取本体 url（videoUrl/audioUrl/url/assetUrl）；
 *   2. 存在 `data.videoUrl` / `data.audioUrl` → 判 video / audio（视频生成/提取/处理等节点）；
 *   3. 退化为 getNodeAssetUrl 主图 url → 按扩展名判型（video/audio 原样标记，其余按 image）。
 * 只返回可作 AI 多模态上下文的媒体（image / video / audio），text / 空返回 { type:'', url:'' }。
 */
export type MediaType = 'image' | 'video' | 'audio' | '';

export function getNodeMedia(node: Node | null): { type: MediaType; url: string } {
  const d = (node?.data || {}) as {
    assetType?: string;
    videoUrl?: string;
    audioUrl?: string;
    url?: string;
    assetUrl?: string;
    [k: string]: unknown;
  };
  const kindOf = (u: unknown) => classifyAssetUrlKind(String(u)) || '';
  let explicit = '';
  let url = '';
  if (d.assetType === 'video' || d.assetType === 'audio') {
    explicit = d.assetType;
    url = d.videoUrl || d.audioUrl || d.url || d.assetUrl || '';
  } else if (typeof d.videoUrl === 'string' && d.videoUrl) {
    explicit = 'video';
    url = d.videoUrl;
  } else if (typeof d.audioUrl === 'string' && d.audioUrl) {
    explicit = 'audio';
    url = d.audioUrl;
  }
  if (url) {
    const type = explicit || kindOf(url);
    return { type: type === 'audio' ? 'audio' : type === 'video' ? 'video' : 'image', url };
  }
  const image = getNodeAssetUrl(node);
  if (!image) return { type: '', url: '' };
  const k = kindOf(image);
  return { type: k === 'video' ? 'video' : k === 'audio' ? 'audio' : 'image', url: image };
}

/** 选中派生产物：「选中且带媒体」节点的只读投影（AgentPanel 待引用区消费） */
export interface SelectedAsset {
  nodeId: string;
  nodeType: string | undefined;
  label: string;
  type: MediaType;
  url: string;
  x: number;
  y: number;
}

/**
 * 从 nodes **实时派生**「选中的带媒体节点」列表（纯函数）。
 *
 * 单一事实来源 = `nodes[].selected` + `data` —— 取代原「App 手工副本 + updater 内副作用同步」
 * （TD-04-24/27）。任何导致选中集变化的路径（点击选中、删除节点、undo/redo 写回）都会让
 * `nodes` 变化，调用方以「提交后 effect」重算即可覆盖全部路径，无需逐路径补同步点。
 *
 * 除 nodeId/type/label/url 外，一并带出画布坐标 position(x/y) 与媒体类型 type（对齐参考项目
 * daxiong-canvas-plugins canvas-agent agentBuildAttachmentsFromNodes）：让 LLM 感知参考素材
 * 来自画布哪个位置、是什么形态。
 */
export function deriveSelectedAssets(nodes: Node[] | null | undefined): SelectedAsset[] {
  return (nodes || [])
    .filter((n) => n.selected)
    .map((n) => {
      const media = getNodeMedia(n);
      const label = (n.data?.label ?? n.data?.projectName ?? '') as string;
      return {
        nodeId: n.id,
        nodeType: n.type,
        label: label || '',
        type: media.type,
        url: media.url,
        x: Number(n.position?.x) || 0,
        y: Number(n.position?.y) || 0,
      };
    })
    .filter((a) => a.url);
}

/**
 * 选中资产的「内容签名」。只含 nodeId/type/url —— **不含 x/y**：
 * 拖动节点会让 `nodes` 每帧变化，若签名含坐标则每帧都判定「变了」→ 每帧回写 state → 下游（AgentPanel）
 * 每帧重渲（历史上曾 OOM）。坐标不参与签名，保证拖动期间引用稳定。
 */
export function selectedAssetSig(list: SelectedAsset[]): string {
  return (list || []).map((a) => `${a.nodeId}:${a.type}:${a.url}`).join('|');
}

/**
 * 选中节点 id 的签名（排序后拼串）。供「边关联态（relatedToSelected）」effect 用：
 * 只在**选中集真的变化**时重算边，拖动/挪点时跳过（避免每帧遍历 edges）。
 */
export function selectedNodeIdSig(nodes: Node[] | null | undefined): string {
  return (nodes || [])
    .filter((n) => n.selected)
    .map((n) => n.id)
    .sort()
    .join('|');
}
