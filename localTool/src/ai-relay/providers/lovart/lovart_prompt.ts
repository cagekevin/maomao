/**
 * lovart_prompt — 双路选模型的自然语言路（冗余兜底）+ 参考图声明。
 *
 * 结构化路：lovart_client.send 经 tool_config.prefer_tool_categories 显式传模型（B5）。
 * 自然语言路：本文件把可读模型名 + 尺寸写进 prompt 文本，确保即使结构化路不被上游采信，
 * 也不至于「裸发默认模型」（B6 / 用户强约束）。
 *
 * 参考图声明（对齐 apimart-gateway/main.py 的 DataFormatter.build_gen_prefix）：图生图/图生视频
 * 时把「是否有参考图」与「生成份数」写进 prompt——
 *   - IMAGE 带参考图：`Reference image attached. Generate exactly ONE image.`
 *   - IMAGE 无参考图：`Generate exactly ONE image.`
 *   - VIDEO：`Generate exactly ONE video.`（参考图经 attachments 携带，main 不在 video 单独声明）
 *   - CHAT：不写生成指令（对话场景）。
 * 措辞刻意不写 "Use reference and edit"，避免引导 Lovart 走 edit_media（改图）而非 generate（生成新图）。
 * 用户原文 prompt 保持在末尾，原样透传。
 */
import { LOVART_MODEL_SPECS } from './lovart_config.js';

/**
 * 构造最终 prompt：前缀写 [model: 可读名] 与可选 [size: ...]，再按模态写参考图声明 + 生成份数，
 * 最后接用户原 prompt。
 * - 含可读模型名（B6 机检）
 * - 含尺寸标识（C3 尺寸归一）
 * - 带参考图时正确声明参考图（hasRefs）
 */
export function buildLovartPrompt(modelId: string, userPrompt: string, size?: string, hasRefs = false): string {
  const spec = LOVART_MODEL_SPECS[modelId];
  const category = spec?.category;
  const prefixParts: string[] = [];
  if (spec) prefixParts.push(`[model: ${spec.readableName}]`);
  if (size) prefixParts.push(`[size: ${size}]`);
  const prefix = prefixParts.length ? `${prefixParts.join(' ')}\n` : '';

  let instr = '';
  if (category === 'IMAGE') {
    instr = hasRefs
      ? 'Reference image attached. Generate exactly ONE image.'
      : 'Generate exactly ONE image.';
  } else if (category === 'VIDEO') {
    instr = 'Generate exactly ONE video.';
  }
  const head = `${prefix}${instr ? `${instr}\n` : ''}`;
  return `${head}${userPrompt ?? ''}`;
}

/** 按模型规格构造结构化路 tool_config（prompt_only 模型返回 undefined，B7）。 */
export function buildLovartToolConfig(modelId: string): Record<string, unknown> | undefined {
  const spec = LOVART_MODEL_SPECS[modelId];
  if (!spec || !spec.tool) return undefined;
  return { prefer_tool_categories: { [spec.category]: [spec.tool] } };
}
