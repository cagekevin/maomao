/**
 * AI 助手附件归一化 / 参考图目录层（M3 下沉 1）。
 *
 * 定位：把 useAgentChat 里「构造 userMsg.attachments + refCatalog 参考图编号目录」的重复实现
 * 抽成独立纯函数，hook 只 import 调用。两处（send LLM 分支 / send 内 runDirectBranch 直连分支）共用统一附件归一出口。
 *
 * 约束：
 * - 【发送统一出口守卫】附件图必经 normalizeImageUrlForSend（含缩略图端点自动还原原图），禁止发 render 小图。
 * - 只认 base64 的 provider（refFormat==='base64'）走 preferBase64 转 base64。
 * - 【E 方案 · docs/72】/files/ 附件经 normalizeImageUrlForSend 在 URL 模式保持相对路径（不转 base64），
 *   会话内存/落盘只存 /files/（KB 级，不触发体积降级）；出站时由 localTool resolveLocalImages
 *   统一读 uploads/ → 压缩≤1920 → base64。决策与边界见 imageUrl.js 文件头「E 方案的抉择」。
 * - 目录编号固定按输入框从左到右（0-based 的 display 用 i+1），AI 在 generations 里用 attachment_indices（0-based）引用。
 * - 本层为纯函数：不 import React / store，一个附件归一函数可作 Promise 返回（内部 await normalizeImageUrlForSend）。
 *
 * 依赖方向（单向）：useAgentChat → agentAttachments → imageUrl。无环。
 */

import { normalizeImageUrlForSend, summarizeImages } from '../../base/utils/imageUrl.ts';
import { logger } from '../../base/core/logger.ts';

/**
 * 归一化附件数组（发送统一出口）：每条 { ...a, url } 经 normalizeImageUrlForSend。
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
  const imgs = (attachments || []).filter((a) => typeof a?.url === 'string' && a.url);
  // 【带图可观测】AI 工具附件走单图版归一化（不经数组版），这里单独在编排层记一条：
  // 本次附件带了几张图、URL 还是 Base64。与 normalizeImageUrlsForSend 的日志语义一致。
  if (imgs.length > 0) {
    const urls = imgs.map((a) => a.url);
    logger.info('agentAttachments', '发送图片', { ...summarizeImages(urls), total: imgs.length });
  }
  return Promise.all(
    attachments.map(async (a) => ({
      ...a,
      url: await normalizeImageUrlForSend(a?.url, { preferBase64 }),
    })),
  );
}

/**
 * 参考图编号目录（refCatalog）：给图片附件顺序编号，供 AI 用 attachment_indices 精确引用「第几张图」。
 * 只对「图片附件」编号（跳过 type==='node'）；nodeId 记录来源便于执行器定位。
 * @param {Array} imgAtts 已过滤出的图片附件数组
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
