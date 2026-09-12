/**
 * AI 助手附件归一化 / 参考图目录层（M3 下沉 1）。
 *
 * 定位：把 useAgentChat 里「构造 userMsg.attachments + refCatalog 参考图编号目录」的重复实现
 * 抽成独立纯函数，hook 只 import 调用。两处（send LLM 分支 / send 内 runDirectBranch 直连分支）共用统一附件归一出口。
 *
 * 约束：
 * - 【发送统一出口守卫】附件图必经 normalizeImageUrlForSend（含缩略图端点自动还原原图），禁止发 render 小图。
 * - 只认 base64 的 provider（refFormat==='base64'）走 preferBase64 转 base64。
 * - 【视频/音频原样发送】多模态扩展：type==='video'|'audio' 的附件【不做图片压缩/转 base64/缩略图还原】——
 *   仅把相对 /files/ 补全为绝对路径，其余 URL 形态原样透传（由网关/模型自行消费）。图片逻辑完全不变。
 * - 【E 方案 · docs/72】/files/ 附件经 normalizeImageUrlForSend 在 URL 模式保持相对路径（不转 base64），
 *   会话内存/落盘只存 /files/（KB 级，不触发体积降级）；出站时由 localTool resolveLocalImages
 *   统一读 uploads/ → 压缩≤1920 → base64。决策与边界见 imageUrl.js 文件头「E 方案的抉择」。
 * - 目录编号固定按输入框从左到右（0-based 的 display 用 i+1），AI 在 generations 里用 attachment_indices（0-based）引用。
 * - 本层为纯函数：不 import React / store，一个附件归一函数可作 Promise 返回（内部 await normalizeImageUrlForSend）。
 *
 * 依赖方向（单向）：useAgentChat → agentAttachments → imageUrl / 其它 utils。无环。
 */

import {
  normalizeImageUrlForSend,
  toAbsoluteFileUrl,
  summarizeImages,
} from '../../base/utils/imageUrl.ts';
import { logger } from '../../base/core/logger.ts';

/**
 * 视频/音频附件归一（原样发送）：
 * - type==='video'|'audio' 的附件只做最小必要的可访问性归一——相对 /files/ 补全为绝对路径，
 *   不动内容、不压缩、不转 base64（视频/音频 base64 体积巨大，且图片压缩管线假收窄不适用于媒体）。
 * - 其余（http/blob/data/相对）原样返回，透传给网关/模型消费。
 *
 * ═══ 平台分叉设计（决策留痕，2026-09-12，见 agentCore.toMediaContentBlocks）═══
 * 「支持视频的平台（lovart）」在此原样归一后由 lovart 端提取为附件上传 CDN；
 * 「其它平台」视频的「抽帧转多图」由【后端】做（当前未实现），不在此后端归一（本层仍保持原样）。
 * @param {string} [url]
 * @returns {string}
 */
function normalizeMediaUrlForSend(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('/files/')) return toAbsoluteFileUrl(url);
  return url;
}

/**
 * 归一化附件数组（发送统一出口）：每条 { ...a, url } 按媒体类型走对应归一管线。
 *  - 图片（type==='image' 或未标 type）→ normalizeImageUrlForSend（压缩/缩略图还原/E 方案相对路径/preferBase64）
 *  - 视频/音频（type==='video'|'audio'）→ normalizeMediaUrlForSend（原样，仅相对 /files/ 补全绝对）
 * @param {Array}  attachments 附件数组 [{ type, url, ... }]
 * @param {object} [opts]  { preferBase64?: boolean } 只认 base64 的 provider 传 true
 * @returns {Promise<Array>} 归一后的附件数组（url 已归一化）
 */
/** 附件条目（type/url/label/name/nodeId 为本层消费字段，其余透传） */
export interface SendAttachment {
  type?: string;
  url?: string;
  label?: string;
  name?: string;
  nodeId?: string;
  [key: string]: unknown;
}

export async function normalizeAttachmentsForSend(
  attachments: SendAttachment[],
  { preferBase64 = false }: { preferBase64?: boolean } = {},
): Promise<SendAttachment[]> {
  const items = (attachments || []).filter((a) => typeof a?.url === 'string' && a.url);
  // 【带图可观测】记录本次附件的媒体形态：几张图片（URL/Base64）+ 多少个视频/音频。
  // 与 normalizeImageUrlsForSend 的日志语义一致，只记形态不携带内容。
  if (items.length > 0) {
    const imgUrls = items.filter((a) => !a.type || a.type === 'image').map((a) => a.url);
    const mediaCounts = items.reduce(
      (acc, a) => {
        if (a.type === 'video' || a.type === 'audio') acc[a.type] = (acc[a.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    logger.info('agentAttachments', '发送附件', {
      ...summarizeImages(imgUrls),
      total: items.length,
      mediaCounts,
    });
  }
  return Promise.all(
    attachments.map(async (a) => ({
      ...a,
      url:
        a?.type === 'video' || a?.type === 'audio'
          ? normalizeMediaUrlForSend(a?.url)
          : await normalizeImageUrlForSend(a?.url, { preferBase64 }),
    })),
  );
}

/**
 * 参考图编号目录（refCatalog）：给图片附件顺序编号，供 AI 用 attachment_indices 精确引用「第几张图」。
 * ⚠️ 调用方（useAgentChat）须先过滤为【仅图片】附件（type==='image' || 未标 type）再传入——
 * 视频/音频不参与图生图引用，本函数只按传入顺序编号，不再做类型过滤。nodeId 记录来源便于执行器定位。
 * @param {Array} imgAtts 已过滤为仅图片的附件数组
 * @returns {string} 目录文本（无图片附件时返回空串）
 */
export function buildRefCatalog(imgAtts: SendAttachment[] | null | undefined): string {
  if (!imgAtts || imgAtts.length === 0) return '';
  const lines = ['【本轮参考图顺序（仅作为编号数据）】'];
  imgAtts.forEach((a, i) => {
    lines.push(
      `参考图${i + 1}：${a.label || a.name || `Image${i + 1}`}` +
        (a.nodeId ? `（画布节点 ${a.nodeId}）` : ''),
    );
  });
  lines.push(
    '编号固定按输入框从左到右排列。引用某张图做图生图时，在 generations 里用 attachment_indices 指向其编号（0-based：参考图1→0）。',
  );
  return lines.join('\n');
}
