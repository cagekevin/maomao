/**
 * 集中配置（env 变量的单一来源）。
 *
 * 所有 import.meta.env 读取必须集中在此文件，禁止散落在业务代码中。
 * 业务代码 import { xxx } from './config.js' 即可。
 *
 * 命名规则：UPPER_SNAKE_CASE，与 env 变量名对齐。
 */

// ── localTool 后端地址 ───────────────────────────────────────────
/** localTool 后端端口（单一来源，其余模块不做裸写 18080） */
export const LOCAL_TOOL_PORT = 18080

/**
 * localTool 后端 API 地址（原 apiBase.js，已合并至此）。
 * 可用 env VITE_API_BASE 覆盖（如局域网/远程 localTool）；缺省回落到本机 127.0.0.1:18080。
 * 生产发布后页面部署到 localTool 18080 端口同源访问，仍可经 env 留空回落。
 */
export const API_BASE =
  import.meta.env?.VITE_API_BASE?.replace(/\/+$/, '') ||
  `http://127.0.0.1:${LOCAL_TOOL_PORT}`

// ── LLM 聊天配置 ─────────────────────────────────────────────────
/** LLM 端点 base URL（空则走 localTool 18080 代理） */
export const LLM_CHAT_BASE_URL = import.meta.env?.VITE_LLM_CHAT_BASE_URL || ''

/** LLM API Key */
export const LLM_CHAT_API_KEY = import.meta.env?.VITE_LLM_CHAT_API_KEY || ''

/** LLM 默认模型 */
export const LLM_CHAT_MODEL = import.meta.env?.VITE_LLM_CHAT_MODEL || 'gpt-4o-mini'

// ── 演示模式 ─────────────────────────────────────────────────────
/** VITE_AGENT_DEMO='1' 时启用演示模式（不发真实 LLM 请求，用规则引擎模拟） */
export const AGENT_DEMO_MODE = import.meta.env?.VITE_AGENT_DEMO === '1'

// ── 调试开关（通用 DEBUG，按模块分类）───────────────────────────────
/** 通用调试开关。logger.debug(cat, act, det, { module }) 仅在对应模块位开启时输出到 console，
 *  默认全部关闭，生产/日常完全安静，不上报后端。
 *  开启方式（任一）：
 *   - 根目录 .env 加 VITE_DEBUG_ALL=1（全开），或 VITE_DEBUG_<MODULE>=1（只开某模块）；
 *   - 运行时设 window.__DEBUG_ALL=true（全开），或 window.__DEBUG_<MODULE>=true（只开某模块）。
 *  模块位约定：'asset'（素材库）/ 'agent'（AI 助手）/ 'image'（图片生成全链路）。新增模块在 DEBUG_MODULES 登记，勿再散起第二个开关。
 *
 *  ⚠️ 演进规则（见 spec/CONTEXT.md §二）：
 *   - 这是「第 2 个模块（agent）加入」后由单模块 DEBUG_ASSET 升级而来——触发条件就是
 *     「≥2 个无关模块要排查日志」，此时不再新增 DEBUG_XXX 散开关，统一走本 DEBUG。
 *   - DEBUG_ASSET 保留为别名（向后兼容既有引用），等价于 DEBUG 的 asset 模块位。 */
export const DEBUG_MODULES = ['asset', 'agent', 'image', 'text', 'project'] // 支持的模块位（新增模块在此登记）；'text'=文本节点复制/落盘链路；'project'=项目切换/快照/备份/同步

const _debugOn = (key, upper) => {
  if (import.meta.env?.[`VITE_DEBUG_${upper}`] === '1') return true
  if (typeof window !== 'undefined' && window[`__DEBUG_${upper}`] === true) return true
  return false
}
// 总开关不在模块顶层缓存（否则运行时设 window.__DEBUG_ALL 不生效）。
// 改由 isDebugModuleOn 每次实时读，使「前端调试总开关 / AI 设 __DEBUG_ALL」立即生效。
// 兼容 env VITE_DEBUG_ALL='1'（_debugOn('all','ALL') 处理）。

/** 判断某模块位是否开启（未传入 module 时默认 false，需显式指定）。
 *  - 总开关实时读 window.__DEBUG_ALL / env VITE_DEBUG_ALL：为 true 时全开；
 *  - 否则按模块位实时读 window.__DEBUG_<MODULE> / env VITE_DEBUG_<MODULE>。
 *  前端「其他设置→调试模式」总开关会同步写 window.__DEBUG_ALL，实现自己一键开/关，不依赖 AI。 */
export function isDebugModuleOn(module) {
  // 实时判断总开关（每次调用都查 window，支持运行时切换）
  if (_debugOn('all', 'ALL')) return true
  if (!module) return false
  const upper = String(module).toUpperCase()
  if (DEBUG_MODULES.includes(module)) return _debugOn(module, upper)
  return false
}

/** [兼容别名] 素材库模块位是否开启（DEBUG_MODULES 里的 'asset'），等价 isDebugModuleOn('asset')。
 *  旧代码引用 DEBUG_ASSET 处无需改动。 */
export const DEBUG_ASSET = isDebugModuleOn('asset')

// ── AI 助手模型列表 ──────────────────────────────────────────────
/** 默认模型列表，env 可覆盖 */
const DEFAULT_AGENT_MODELS = [
  'gpt-4o-mini',
  'gpt-4o',
  'gpt-4o-vision-preview',
  'deepseek-chat',
  'Qwen/Qwen3-14B',
]

/** AI 助手可选模型列表（env VITE_AGENT_MODELS 可覆盖，逗号分隔） */
export const AGENT_MODELS = (() => {
  const env = import.meta.env?.VITE_AGENT_MODELS || ''
  return env ? env.split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_AGENT_MODELS
})()

// ── AI 助手上下文预算默认值（无模型 contextWindow 声明时的保守兜底）────────────
/** 默认上下文窗口（token）。项目模型未声明 contextWindow 时用此值，env VITE_AGENT_CONTEXT_WINDOW 可覆盖。 */
export const AGENT_CONTEXT_WINDOW_DEFAULT = Number(import.meta.env?.VITE_AGENT_CONTEXT_WINDOW) || 128_000
/** 输出预算留白比例：输入预算 = contextWindow × (1 − 该比例)，留出生成空间。 */
export const AGENT_CONTEXT_OUTPUT_BUDGET_RATIO = 0.2

// ── 异步超时（ms）───────────────────────────────────────────────
/** httpClient 默认超时 */
export const HTTP_DEFAULT_TIMEOUT = 15000
/** localTool 探活 / 拖拽文本读取（短超时，快失败） */
export const LOCAL_TOOL_PING_TIMEOUT = 5000
/** 图片 URL → blob 读取（imageUrl.js） */
export const IMAGE_FETCH_TIMEOUT = 10000
/** 图片压缩 / 图像加载（imageCompress.js、asyncGuard.js） */
export const IMAGE_LOAD_TIMEOUT = 10000
/** 通用下载 / 读视频元数据（clipboard.js、VideoProcessNode） */
export const DOWNLOAD_TIMEOUT = 30000
/** 大视频下载（VideoProcessNode） */
export const VIDEO_DOWNLOAD_TIMEOUT = 60000
/** 文件上传（filesApi.js） */
export const UPLOAD_TIMEOUT = 30000
/** 聊天/提示词生成总超时（chatProxy）：2 分钟，超时 abort 并复位 loading，避免动画无限挂起 */
export const CHAT_TIMEOUT = 120000

// ── 生成轮询超时（ms）───────────────────────────────────────────
/** 生图 async 模式轮询总超时 */
export const GEN_TIMEOUT = 300000
/** 视频 async 模式轮询总超时 */
export const VIDEO_TIMEOUT = 600000

// ── 轮询间隔（ms）───────────────────────────────────────────────
export const GEN_POLL_INTERVAL = 3000
export const VIDEO_POLL_INTERVAL = 5000

// ── 并发上限 ────────────────────────────────────────────────────
/** 生图同时真正触发上限（超出跳过，见 taskStore） */
export const GEN_MAX_CONCURRENT = 6

// ── 节点布局（useSizeSync 收口）─────────────────────────────────
/** area-fixed 节点的面积基准：视频生成与图片生图统一尺寸的唯一来源（往这里改，两边都变） */
export const NODE_AREA_FIXED_BASE_SIZE = 380

// ── 节点写回（useNodeData，P0-2 收口）────────────────────────────
/** 节点 data 写回防抖窗口（useNodeData.patchDebounced 用） */
export const NODE_PATCH_DEBOUNCE_MS = 200