/**
 * capabilities — 机器可读的能力清单。
 *
 * 目的：让「这个模块到底能干什么」不用翻代码就能查到——
 * 文档站、CLI 自检、UI 面板都可以直接消费这份清单。
 *
 * `relay.capabilities` 就返回这里的内容。
 */

export interface RelayCapability {
  /** 稳定标识，形如 `generate.video`。 */
  id: string;
  /** 所属分组，对应 relay 上的方法组。 */
  group: 'providers' | 'connection' | 'protocol' | 'generate' | 'docs' | 'stations' | 'http';
  /** 一句话说明。 */
  summary: string;
  /** 补充说明：约束、边界或用法提示。 */
  detail?: string;
}

export const RELAY_CAPABILITIES: readonly RelayCapability[] = [
  // ── providers ──
  {
    id: 'providers.list',
    group: 'providers',
    summary: '列出全部内置厂商定义（默认 13 个）及其凭据字段、目录适配器、默认地址',
  },
  {
    id: 'providers.fetchModels',
    group: 'providers',
    summary: '拉取厂商模型目录',
    detail: 'OpenAI 兼容厂商走 GET /models；内置清单厂商直接返回随包清单；失败时退回本地缓存并给出 warning。',
  },
  {
    id: 'providers.newConnectionId',
    group: 'providers',
    summary: '生成连接 ID',
    detail: '内置厂商每种只允许一条连接（ID 即厂商 ID）；自定义接口可多条，带随机后缀。',
  },
  {
    id: 'providers.webSearch',
    group: 'providers',
    summary: '识别与挑选联网搜索厂商（tavily / bocha / zhipu-search / exa）',
  },
  {
    id: 'providers.capCatalogModels',
    group: 'providers',
    summary: '截断模型目录缓存',
    detail: '保留全部已勾选模型，未勾选部分按上限截断；中转站常返回上千个模型，避免配置体积膨胀。',
  },

  // ── connection ──
  {
    id: 'connection.test',
    group: 'connection',
    summary: '验证连接是否可用（只打无计费端点）',
    detail: '优先用厂商声明的只读账户端点（可读余额），否则用 GET /models；自动探测 /v1 并回报真实地址。',
  },
  {
    id: 'connection.export',
    group: 'connection',
    summary: '把一条连接导出为可分享的 JSON 文本',
    detail: '包含模型清单与每个模型的执行协议，**永不包含 API Key**。',
  },
  {
    id: 'connection.import',
    group: 'connection',
    summary: '解析分享文本并还原为连接配置',
    detail: '白名单挑字段、规范化 Base URL、丢弃非法协议；凭据留空由用户补填。',
  },

  // ── protocol ──
  {
    id: 'protocol.validate',
    group: 'protocol',
    summary: '校验一段调用协议并返回全部错误',
    detail: '覆盖 version / mode / auth / 请求路径同源 / 请求头黑白名单 / 结果路径 / 轮询配置。',
  },
  {
    id: 'protocol.parse',
    group: 'protocol',
    summary: '校验并归一化协议（v1 自动升级到 v2）',
  },
  {
    id: 'protocol.fromExamples',
    group: 'protocol',
    summary: '从 curl / fetch / axios / python / 原始 HTTP / OpenAPI 示例生成协议草稿',
    detail: '识别 URL、方法、请求头、请求体、鉴权占位，并把字段名映射到协议变量。',
  },
  {
    id: 'protocol.fromDocument',
    group: 'protocol',
    summary: '从整段文档正文中识别请求与响应示例并生成协议草稿',
  },
  {
    id: 'protocol.previewRequest',
    group: 'protocol',
    summary: '预览协议会发出的请求（密钥脱敏）',
  },
  {
    id: 'protocol.previewResponse',
    group: 'protocol',
    summary: '拿真实响应预览各条结果路径能取出什么',
  },
  {
    id: 'protocol.variables',
    group: 'protocol',
    summary: '查询某类别模型可用的协议变量、字段映射与参考素材变量',
  },

  // ── generate ──
  {
    id: 'generate.text',
    group: 'generate',
    summary: '文本生成（支持系统提示词与图片多模态输入）',
  },
  {
    id: 'generate.image',
    group: 'generate',
    summary: '图片生成（尺寸 / 宽高比 / 画质 / 批量 / 参考图）',
  },
  {
    id: 'generate.video',
    group: 'generate',
    summary: '视频生成（异步任务自动轮询；支持首/尾帧、参考视频与音频）',
    detail: '帧数自动收敛为 8n+1；协议声明了进度路径时可透传进度。',
  },
  {
    id: 'generate.audio',
    group: 'generate',
    summary: '音频生成（TTS 的 voice/format/speed，音乐的 lyrics/title/bpm/duration）',
  },
  {
    id: 'generate.run',
    group: 'generate',
    summary: '直接给协议变量执行（绕过参数映射的逃生舱）',
  },

  // ── docs ──
  {
    id: 'docs.read',
    group: 'docs',
    summary: '读取厂商 / 中转站文档页，拿到正文与同源链接',
    detail: '三级回落：静态 HTML →（首屏空壳）SPA 动态渲染 →（需登录）new-api 公开模型清单。单页 10k 字，可 offset 续读。',
  },
  {
    id: 'docs.discover',
    group: 'docs',
    summary: '★ 一站式中转站探测：给一个地址，返回模型清单 + 协议草稿 + 还缺什么',
    detail: '串起 URL 安全校验、公开接口探测、文档读取、示例解析与协议校验。只读，不写配置、不产生付费生成。',
  },
  {
    id: 'docs.probe',
    group: 'docs',
    summary: '只探 new-api 的 /api/pricing 与 /api/status',
  },
  {
    id: 'docs.safety',
    group: 'docs',
    summary: 'URL 安全校验（HTTPS / 公网 / 无凭据）与链接抽取、同源判断',
    detail: '前端侧形状校验；真正的 SSRF 防护（DNS pinning）在原生侧 rust/provider_docs.rs。',
  },
  {
    id: 'docs.bridge',
    group: 'docs',
    summary: '可注入的文档读取桥接（Tauri 原生 / 静态 mock）',
  },
  {
    id: 'docs.grants',
    group: 'docs',
    summary: '文档访问预算：限制单个任务的页数（24）、链接深度（2）与累计字符数（80k）',
    detail: '已授权地址的同路径子页自动授权，避免首页渲染失败后模型接口页永远读不到。',
  },

  // ── stations ──
  {
    id: 'stations.newApi.pricing',
    group: 'stations',
    summary: '解析 new-api 中转站 /api/pricing 公开模型清单',
  },
  {
    id: 'stations.newApi.status',
    group: 'stations',
    summary: '解析 /api/status 站名与公告',
  },
  {
    id: 'stations.newApi.catalogContent',
    group: 'stations',
    summary: '把模型清单与公告拼成可读正文，供自动生成配置草稿',
  },
  {
    id: 'stations.newApi.group',
    group: 'stations',
    summary: '按 文本/图片/视频/音频 分组输出模型清单',
  },

  // ── http ──
  {
    id: 'http.transport',
    group: 'http',
    summary: '可替换的 HTTP 传输层',
    detail: '默认全局 fetch；Tauri 环境可换成 Rust 原生流式通道绕开 WebView 的 CORS 限制。',
  },
  {
    id: 'http.pollTask',
    group: 'http',
    summary: '通用异步任务轮询（间隔 / 最大次数 / 最大时长 / 取消 / 失败判定）',
  },
  {
    id: 'http.errors',
    group: 'http',
    summary: '统一错误解析',
    detail: '依次尝试 error.message / message / msg / 原始响应体，并对 API Key 类错误追加排查提示。',
  },
];

/** 按分组取能力，便于分区展示。 */
export function capabilitiesByGroup(
  group: RelayCapability['group'],
): readonly RelayCapability[] {
  return RELAY_CAPABILITIES.filter((capability) => capability.group === group);
}

/** 能力清单的可读文本，用于 CLI 自检或日志。 */
export function describeCapabilities(): string {
  return RELAY_CAPABILITIES
    .map((capability) => `- ${capability.id}：${capability.summary}`)
    .join('\n');
}
