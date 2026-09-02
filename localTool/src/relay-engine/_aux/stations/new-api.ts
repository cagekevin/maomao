/**
 * new-api（New API / One API 系）中转站的公开接口解析。
 *
 * 这类中转站的文档页通常是需要登录的后台 SPA，匿名读不到正文；但站点会公开
 * `/api/pricing`（模型清单与价格）和 `/api/status`（站名与公告）两个接口。
 * 这里把它们解析成可直接用于生成配置草稿的结构化数据，并拼成可读文本。
 *
 * 抽取自 AI-Canvas-tauri 的 `src/services/providerDocsService.ts`，去掉了文档抓取与
 * Tauri invoke 依赖，只保留纯函数部分。
 */

export interface NewApiPricingItem {
  model_name?: unknown;
  display_name?: unknown;
  description?: unknown;
  model_price?: unknown;
  supported_endpoint_types?: unknown;
}

export interface NewApiStatusInfo {
  systemName?: string;
  announcements: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeText(value: string): string {
  return value
    .replace(/\r/g, '')
    .replace(/[\t ]+\n/g, '\n')
    .replace(/\n[\t ]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * 从模型 ID、显示名与端点类型推断模型类别，返回中文标签，供模型映射到
 * text / image / video / audio 配置枚举。
 */
export function inferRelayModelCategory(item: NewApiPricingItem): string {
  const types = Array.isArray(item.supported_endpoint_types)
    ? item.supported_endpoint_types
      .filter((value): value is string => typeof value === 'string')
      .join(' ')
      .toLowerCase()
    : '';
  const idName = `${String(item.model_name ?? '')} ${String(item.display_name ?? '')}`.toLowerCase();
  const haystack = `${types} ${idName}`;
  if (/video|seedance|sora|veo|kling|hailuo|wan\d|skyreels|vidu|minimax/.test(haystack)) return '视频';
  if (/image|seedream|imagen|flux|banana|midjourney|recraft|dall-e|drawing/.test(haystack)) return '图片';
  if (/audio|tts|speech|music|voice|whisper|transcri/.test(haystack)) return '音频';
  return '文本';
}

/** 解析 /api/pricing 响应，返回 new-api 模型项；非 new-api 结构返回 null。 */
export function parseNewApiPricingPayload(body: string): NewApiPricingItem[] | null {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return null;
  }
  if (!isRecord(payload) || !Array.isArray(payload.data)) return null;
  const items = payload.data
    .filter(isRecord)
    .filter((item) => typeof item.model_name === 'string' && item.model_name.trim() !== '');
  return items.length > 0 ? (items as unknown as NewApiPricingItem[]) : null;
}

/** 解析 /api/status 响应，提取站名与公告；非 new-api 结构返回 null。 */
export function parseNewApiStatusPayload(body: string): NewApiStatusInfo | null {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return null;
  }
  if (!isRecord(payload) || !isRecord(payload.data)) return null;
  const data = payload.data;
  const announcements = Array.isArray(data.announcements)
    ? data.announcements
      .filter(isRecord)
      .map((item) => (typeof item.content === 'string' ? item.content.trim() : ''))
      .filter(Boolean)
    : [];
  const systemName = typeof data.system_name === 'string' ? data.system_name.trim() : undefined;
  if (!systemName && announcements.length === 0) return null;
  return { systemName, announcements };
}

/** 把 new-api 模型清单与公告拼成可读文档正文。 */
export function buildRelayCatalogContent(
  rawUrl: string,
  pricing: NewApiPricingItem[],
  status: NewApiStatusInfo | null,
): { title: string; text: string } {
  const hostname = new URL(rawUrl).hostname;
  const title = status?.systemName || hostname;
  const lines = [
    `这是 new-api（New API）中转站「${title}」的公开模型清单。`,
    '该站文档页是登录后台，无法匿名读取正文；以下信息来自公开接口 /api/pricing 与 /api/status，可直接用于生成配置草稿。',
    '',
    `模型清单（共 ${pricing.length} 个）：`,
  ];
  pricing.forEach((item, index) => {
    const id = String(item.model_name ?? '').trim();
    const name = typeof item.display_name === 'string' && item.display_name.trim()
      ? item.display_name.trim()
      : id;
    const endpointTypes = Array.isArray(item.supported_endpoint_types)
      ? item.supported_endpoint_types.filter((value): value is string => typeof value === 'string')
      : [];
    lines.push(`${index + 1}. ${id}`);
    lines.push(`   显示名：${name}`);
    lines.push(`   类型：${inferRelayModelCategory(item)}`);
    if (endpointTypes.length > 0) lines.push(`   端点类型：${endpointTypes.join('、')}`);
    if (typeof item.model_price === 'number') lines.push(`   价格：¥${item.model_price}/次`);
    if (typeof item.description === 'string' && item.description.trim()) {
      lines.push(`   说明：${item.description.trim().replace(/\s+/g, ' ')}`);
    }
  });
  if (status && status.announcements.length > 0) {
    lines.push('', '站内公告（来源 /api/status，含最新模型与请求提示）：');
    for (const announcement of status.announcements.slice(0, 15)) {
      const condensed = normalizeText(announcement).slice(0, 400);
      if (condensed) lines.push(`- ${condensed}`);
    }
  }
  lines.push(
    '',
    '【请求体字段务必以该模型自己的文档为准】',
    '中转站聚合了各家上游，同一类模型的字段名差异很大（宽高比可能叫 aspect_ratio / size / ratio，',
    '参考图可能叫 images / image_urls / image）。请求体里出现该模型不认识的字段，接口会直接返回',
    '400 unsupported field，所以：',
    '- 文档给了「请求示例」JSON 时，原样把它作为 submitRequest 传给 provider_config_preview，不要改字段名、不要补字段。',
    '- 文档只给了参数表时，只写表里列出的字段；表里没有的一律不写。',
    '- 文档标注为「固定能力」的参数（如固定时长、枚举取值、参考图上限），用 videoCapability 声明出来（视频模型），别只写进请求体。',
    '',
    '仅在完全读不到该模型文档时，才可退回到以下 new-api 通用约定（读得到文档就不要用）：',
    '- 文本：POST /v1/chat/completions，OpenAI 标准 {model, messages}。',
    '- 图片：POST /v1/images/generations，OpenAI 标准 {model, prompt, size, n}。',
    '- 视频：POST /v1/videos，异步任务，用 /v1/videos/{任务ID} 轮询。',
    '- 音频：POST /v1/audio/speech，OpenAI 标准 {model, input, voice}。',
    '',
    '本项目按字段名把画布上的宽高比、分辨率、时长、数量与连线的参考素材映射进请求体；',
    '文档里没有参考素材字段，就说明该模型不接参考图，不要自己编一个。',
  );
  return { title, text: lines.join('\n') };
}

/**
 * 把公开模型清单按 文本/图片/视频/音频 分好组，供上层原样转述。
 * 让调用方转述现成结构，而不是从上万字正文里自己归纳。
 */
export function buildGroupedModelChoiceList(pricing: NewApiPricingItem[]): string {
  const groups = new Map<string, string[]>();
  for (const item of pricing) {
    const id = String(item.model_name ?? '').trim();
    if (!id) continue;
    const name = typeof item.display_name === 'string' && item.display_name.trim()
      ? item.display_name.trim()
      : id;
    const category = inferRelayModelCategory(item);
    const lines = groups.get(category) ?? [];
    groups.set(category, lines);
    lines.push(`  - ${name} —— ${id}`);
  }
  const ordered = ['文本', '图片', '视频', '音频'].filter((category) => groups.has(category));
  if (ordered.length === 0) return '';
  return ordered
    .map((category) => [`【${category}】`, ...(groups.get(category) ?? [])].join('\n'))
    .join('\n');
}
