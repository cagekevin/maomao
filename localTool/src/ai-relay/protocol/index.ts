/**
 * protocol/index — 声明式调用协议引擎的统一再导出。
 * 外部用 buildModelProtocolRequest / submitModelProtocol / executeModelProtocol
 * 即可驱动任意 12 个中转的同步 / 异步调用，无需关心各自请求格式。
 */

export {
  parseModelExecutionProtocol,
  validateModelExecutionProtocol,
  validateAuthentication,
  previewModelProtocolResponse,
} from './validation.js';
export {
  renderTemplate,
  renderTemplateString,
} from './template.js';
export {
  buildModelProtocolRequest,
  buildSameOriginUrl,
  applyQueryAuthentication,
  renderRequestHeaders,
  renderRequestBody,
  previewModelProtocolRequest,
} from './request.js';
export {
  readModelProtocolPathValues,
  readModelProtocolFirstScalar,
  readModelProtocolUrls,
  previewNormalizedModelProtocolResponse,
} from './response.js';
export {
  ModelProtocolHttpError,
  readJsonResponse,
  ensureSuccessfulRawResponse,
  encodeBytesBase64,
  normalizeBase64Result,
  fetchSameOriginResultUrls,
} from './http.js';
export {
  serializeModelProtocolBody,
  redactModelProtocolMultipartPreview,
} from './body.js';
export {
  resolvePoll,
  pollResolvedModelProtocol,
  pollModelProtocolOnce,
  getDefaultModelProtocolPollRetryConfig,
} from './poll.js';
export { pollTask } from './pollTask.js';
export {
  submitModelProtocol,
  executeModelProtocol,
  resolveModelExecutionProfile,
  modelProtocolUsesVariable,
  collectModelProtocolTemplatePaths,
  collectModelProtocolForEachVariables,
} from './engine.js';
export {
  getModelProtocolPreset,
  getModelProtocolPresetVideoCapability,
  normalizeFrames8n1,
  getDefaultCustomProtocol,
} from './presets.js';
export {
  TEMPLATE_RE,
  FULL_TEMPLATE_RE,
  OMIT_TEMPLATE_VALUE,
  FOR_EACH_KEY,
  WHEN_PRESENT_KEY,
  CONDITIONAL_VALUE_KEY,
  FOR_EACH_VARIABLE_ROOTS,
  MODEL_PROTOCOL_MAX_FOR_EACH_ITEMS,
  ALLOWED_VARIABLE_ROOTS,
  BLOCKED_PATH_SEGMENTS,
  BLOCKED_HEADER_NAMES,
  HEADER_NAME_RE,
  DEFAULT_RETRY_HTTP_STATUSES,
  MIME_TYPE_RE,
  isRecord,
  resolveAuthentication,
  validateRelativePath,
  validateHeaderName,
} from './shared.js';
export { PROTOCOL_VARIABLE_NAMES } from './variables.js';
