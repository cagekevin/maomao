/**
 * lovart_prompt — 双路选模型的自然语言路（冗余兜底）+ 参考图声明。
 *
 * 结构化路：lovart_client.send 经 tool_config.prefer_tool_categories 显式传模型（B5）。
 * 自然语言路：本文件把可读模型名 + 尺寸写进 prompt 文本，确保即使结构化路不被上游采信，
 * 也不至于「裸发默认模型」（B6 / 用户强约束）。
 *
 * 提示词硬约束（对齐 main.py DataFormatter.build_gen_prefix 第533-540行）：模型名**嵌进生成指令句子**
 *   `Generate exactly ONE image using the {readableName} model.`
 * 对所有 IMAGE/VIDEO 模型无条件生效，不依赖 tool 是否存在（nano-bn-2-lite 等无 tool 模型也覆盖）。
 * 与结构化路（tool_config.prefer_tool_categories = 官方 --prefer-models）同发，构成「双保险」。
 *
 * 未知模型（specs 未登记且两个 category 的别名表均未命中）会静默降级：
 * 无 tool_config 且 prompt 无模型硬约束 → 上游按默认模型出图。此类失效必须可见，
 * 故 prompt 路与结构化路各自打点告警（失败可见纪律，禁止静默吞掉模型选择）。
 *
 * 参考图声明（对齐 apimart-gateway/main.py 的 DataFormatter.build_gen_prefix）：图生图/图生视频
 * 时把「是否有参考图」与「生成份数」写进 prompt——
 *   - IMAGE 带参考图：`Reference image attached. Generate exactly ONE image using the {模型} model.`
 *   - IMAGE 无参考图：`Generate exactly ONE image using the {模型} model.`
 *   - VIDEO：`Generate exactly ONE video using the {模型} model.`（参考图经 attachments 携带，main 不在 video 单独声明）
 *   - CHAT：不写生成指令（对话场景）。
 * 措辞刻意不写 "Use reference and edit"，避免引导 Lovart 走 edit_media（改图）而非 generate（生成新图）。
 * 用户原文 prompt 保持在末尾，原样透传。
 */
import {
  LOVART_IMAGE_RULES,
  LOVART_MODEL_SPECS,
  LOVART_PROMPT_MODEL_NAMES,
  LOVART_VIDEO_RULES,
} from './lovart_config.js';

/**
 * 把 model 名翻译为 Lovart 工具偏好结构，对齐 main.py DataFormatter.resolve_prefer_models（354-366行）。
 * - 归一化：lower() + '_'→'-'（如 GPT_Image_2_Low 也能命中）
 * - 别名模糊匹配：any(k in m) 子串包含，按顺序命中即返回（规则表顺序敏感，见 lovart_config 注释）
 * - 工具名为空串 => 官方暂无对应生成工具，仅作提示词驱动，返回 undefined（不下发无效工具名）
 * 返回 { CATEGORY: [tool] } 供 tool_config.prefer_tool_categories 使用。
 */
/**
 * 未知模型告警（失败可见）：模型既不在 specs、别名表也未命中时，模型选择会静默失效
 * ——无 tool_config、prompt 也无模型硬约束，上游按默认模型出图且不报错。
 * 此处打点让「前端选了模型但后端不认识」立刻暴露，而不是默默用错模型。
 */
function warnUnknownModel(modelId: string, phase: string): void {
  console.error(
    `[lovart] 未知模型「${modelId}」（${phase}）：specs 未登记且 IMAGE/VIDEO 别名表均未命中，` +
      `本次不下发 tool_config 且 prompt 无模型硬约束，上游将按默认模型生成。请核对 lovart_config 的别名表。`,
  );
}

export function resolvePreferModels(model: string, category: string): Record<string, string[]> | undefined {
  if (!model || (category !== 'IMAGE' && category !== 'VIDEO')) return undefined;
  const m = model.toLowerCase().replace(/_/g, '-');
  const rules = category === 'IMAGE' ? LOVART_IMAGE_RULES : LOVART_VIDEO_RULES;
  for (const [keys, tool] of rules) {
    if (keys.some((k) => m.includes(k))) {
      if (!tool) return undefined;
      return { [category]: [tool] };
    }
  }
  return undefined;
}

/**
 * 构造最终 prompt，对齐 main.py DataFormatter.build_gen_prefix（514-547行）+ 1258-1259行：
 * - CHAT / 未知模型：不拼前缀、不包裹，直接透传消息文本（对齐 main.py chat 路径 1049-1071）。
 * - IMAGE/VIDEO：前缀（图片 target_size 像素，再接额外参数 duration/aspect_ratio/resolution）
 *   + 生成指令句（内嵌 `using the {model} model` 硬约束）+ <user_prompt> 包裹的原文。
 *   前缀与指令句同时存在时换行合拼（对齐 build_gen_prefix:545-547）。
 *   （视频 ratio 待补，见 build_gen_prefix:526-528）
 */
export function buildLovartPrompt(
  modelId: string,
  userPrompt: string,
  size?: string,
  hasRefs = false,
  extraParams: string[] = [],
): string {
  const spec = LOVART_MODEL_SPECS[modelId];
  const category = spec?.category;
  // CHAT：透传原文，不拼前缀不包裹（对齐 main.py chat 路径 1049-1071）。
  if (category === 'CHAT') return userPrompt ?? '';
  // 未知模型：透传原文，但必须告警——模型硬约束会静默丢失。
  if (!spec) {
    warnUnknownModel(modelId, 'prompt 路');
    return userPrompt ?? '';
  }
  // 可读模型名：查 _PROMPT_MODEL_NAMES（对齐 main.py:1252-1253，key 用 strip().lower()），
  // 未登记则回退 model 原串（对齐 main.py 兜底行为，而非 specs.readableName）。
  const modelName = LOVART_PROMPT_MODEL_NAMES[(modelId ?? '').trim().toLowerCase()] ?? modelId ?? '';
  // 提示词硬约束：模型名嵌进生成指令句子（对齐 main.py build_gen_prefix:533）。
  const modelClause = modelName ? ` using the ${modelName} model` : '';

  // 尺寸/参数前缀，对齐 build_gen_prefix:521-532：
  // 图片只传具体像素 target_size（最精确），不附带 1K/2K/1080p 档位文字（两者同传会冲突）。
  const parts: string[] = [];
  if (category === 'IMAGE' && size) parts.push(`target_size: ${size}`);
  for (const p of extraParams) {
    if (p) parts.push(String(p).trim());
  }
  const prefix = parts.join(', ');

  // 生成指令句子，对齐 build_gen_prefix:534-544。
  let instr = '';
  if (category === 'IMAGE') {
    // 注意：不能写 "Use reference and edit"，那会引导 Lovart 走 edit_media（改图）。
    instr = hasRefs
      ? `Reference image attached. Generate exactly ONE image${modelClause}.`
      : `Generate exactly ONE image${modelClause}.`;
  } else if (category === 'VIDEO') {
    instr = `Generate exactly ONE video${modelClause}.`;
  }
  const head = prefix && instr ? `${prefix}\n${instr}` : (prefix || instr);

  // 用户提示词原文用 <user_prompt> 包裹并追加"原样使用"指令（对齐 main.py:1258-1259）：
  // 让上游 Agent 明确知晓这是原文，须严格原样透传，不做改写或润色；gen_prefix 仍在标签之外。
  const wrappedPrompt = `<user_prompt>\n${userPrompt ?? ''}\n</user_prompt>\n以上为用户提示词原文，直接使用，请勿修改`;
  return head ? `${head}\n${wrappedPrompt}` : wrappedPrompt;
}

/** 按模型规格构造结构化路 tool_config（prompt_only 模型返回 undefined，B7）。 */
export function buildLovartToolConfig(modelId: string): Record<string, unknown> | undefined {
  const spec = LOVART_MODEL_SPECS[modelId];
  // CHAT 不在 main.py 的别名表内，沿用 specs 直接下发。
  if (spec?.category === 'CHAT') {
    return spec.tool ? { prefer_tool_categories: { [spec.category]: [spec.tool] } } : undefined;
  }
  // specs 已登记：按其 category 精确路由到对应别名表。
  if (spec) {
    const prefer = resolvePreferModels(modelId, spec.category);
    return prefer ? { prefer_tool_categories: prefer } : undefined;
  }
  // 未登记（别名变体、大小写/下划线差异）：对齐 main.py:1059 的
  // `resolve(..., "IMAGE") or resolve(..., "VIDEO")`，两个 category 各试一遍，命中即下发。
  const img = resolvePreferModels(modelId, 'IMAGE');
  if (img) return { prefer_tool_categories: img };
  const vid = resolvePreferModels(modelId, 'VIDEO');
  if (vid) return { prefer_tool_categories: vid };
  warnUnknownModel(modelId, '结构化路 tool_config');
  return undefined;
}
