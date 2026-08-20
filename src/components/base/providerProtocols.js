/**
 * 前端可插拔协议适配器 —— 统一「前端目标 url」的拼装，替代散落在
 * proxyGenerate.buildTargetUrl / agentRuntime 内联判断的重复逻辑。
 * ------------------------------------------------------------
 * 目标：加一个新平台时，前端只需在此新增一个 adapter 并注册，
 * 所有调用方（生图/视频/聊天/AI助手）自动走新逻辑，不用逐个改。
 *
 * 约定（与后端 protocolAdapters.ts 一一对应）：
 *  - openai 协议 → 发伪协议 `openai://<path>`（如 openai://chat/completions），
 *    由 localTool 后端拼 base + 注入 key。
 *  - apimart 协议 → 用 base_url 拼真实 url（后端再重拼吸收 /v1 前缀）。
 *  - 其它协议 → 各自 adapter 定义如何拼 url。
 */

/** 是否 apimart 协议（单一真相：只看 protocol 字段，不做域名嗅探，与后端一致）。 */
export function isApimartProvider(provider) {
  return (provider?.protocol || 'apimart') === 'apimart'
}

/** 协议白名单（与后端 protocolAdapters.ts 的 PROVIDER_PROTOCOLS 一一对应，M1-5 前后端一致）。 */
export const PROVIDER_PROTOCOLS = [
  'openai', 'apimart', 'gemini', 'volcengine', 'runninghub', 'jimeng', 'codex', 'gemini-cli',
]

/** CLI 本地类协议：不走 /api/proxy，用本机登录态。 */
export const CLI_PROTOCOLS = ['jimeng', 'codex', 'gemini-cli']

/** 是否走 /api/proxy 转发：CLI 类返回 false（调用方识别后走 CLI 专用通道）。 */
export function isProxyProtocol(protocol) {
  return !CLI_PROTOCOLS.includes(protocol)
}

/** 前缀吸收：base 已含 /v1|/v2|/v1beta|/api/v3 且 path 同前缀开头 → 去掉 path 前缀，避免 /v1/v1/ */
export function joinWithPrefixAbsorb(base, path) {
  const b = (base || '').replace(/\/$/, '')
  let p = path.startsWith('/') ? path : '/' + path
  const m = b.match(/(\/v1|\/v2|\/v1beta|\/api\/v3)$/)
  if (m) {
    const pre = m[1]
    if (p.startsWith(pre + '/') || p === pre) p = p.slice(pre.length) || '/'
  }
  return b + p
}

// ── 适配器实现 ─────────────────────────────────────────────

/** openai 协议：返回伪协议 openai://<path>，由后端拼 base+key。 */
const openaiAdapter = {
  protocol: 'openai',
  matches: (provider) => (provider?.protocol || 'apimart') === 'openai',
  buildTargetUrl: (provider, path) => `openai://${path}`,
}

/** apimart 协议：用 base_url 拼 /v1/<path>（前缀吸收）。 */
const apimartAdapter = {
  protocol: 'apimart',
  matches: (provider) => (provider?.protocol || 'apimart') === 'apimart',
  buildTargetUrl: (provider, path) => {
    const base = (provider?.base_url || '').replace(/\/$/, '')
    return joinWithPrefixAbsorb(base, '/v1/' + path)
  },
}

/** HTTP 直连类适配器工厂：gemini → /v1beta、volcengine → /api/v3、runninghub → /openapi/v2。 */
function httpAdapter(protocol, prefix) {
  return {
    protocol,
    matches: (provider) => (provider?.protocol || '') === protocol,
    buildTargetUrl: (provider, path) => {
      const base = (provider?.base_url || '').replace(/\/$/, '')
      return joinWithPrefixAbsorb(base, prefix + '/' + path)
    },
  }
}

/** CLI 类适配器：返回专用标记（不走 /api/proxy），供调用方经 isProxyProtocol 识别后走 CLI 通道。 */
function cliAdapter(protocol) {
  return {
    protocol,
    matches: (provider) => (provider?.protocol || '') === protocol,
    buildTargetUrl: (provider, path) => `cli://${protocol}/${path}`,
  }
}

// ── 注册表 ─────────────────────────────────────────────────

/** 协议适配器注册表：加新平台 = 新增一个 adapter 并 push 到这里。 */
const adapters = [
  openaiAdapter,
  apimartAdapter,
  httpAdapter('gemini', '/v1beta'),
  httpAdapter('volcengine', '/api/v3'),
  httpAdapter('runninghub', '/openapi/v2'),
  cliAdapter('jimeng'),
  cliAdapter('codex'),
  cliAdapter('gemini-cli'),
]

/**
 * 目标端点拼装（统一入口）。
 * @param {object} provider
 * @param {string} path 如 'chat/completions' | 'images/generations' | 'tasks/{id}'
 * @returns {string} 目标 url（openai 为伪协议，其余为真实 url）
 */
export function buildTargetUrl(provider, path) {
  const adapter = adapters.find((a) => a.matches(provider))
  if (adapter) return adapter.buildTargetUrl(provider, path)
  // 未知协议：兜底用 base_url 拼 /v1/<path>（对齐 openai 直连行为）
  const base = (provider?.base_url || '').replace(/\/$/, '')
  return joinWithPrefixAbsorb(base, '/v1/' + path)
}
