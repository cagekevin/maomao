/**
 * provider 与生成结果信封共享类型（generate.ts 门面出口契约；原 chatApi/imageApi/videoApi 三份门面已并入 generate.ts，L3 收口）。
 * 收口于 src/types/ 目录（由 index.ts barrel 统一导出）。
 * 【真相合规】provider 完整契约单一真相在 localTool/src/routes/providers.ts 的 ApiProvider；
 *          本处仅覆盖前端「出站组 body / 参考图归一」用到的字段，避免引入整表过大契约。
 */

/** 前端 provider 对象子集（出站组 body / refFormat 判定用）。完整契约见 localTool ApiProvider */
export interface GenerationProvider {
  id?: string;
  name?: string;
  base_url?: string;
  /** 协议身份（openai/apimart/gemini/cli...）；发请求走 localTool 分派，前端只透传 */
  protocol?: string;
  /** 图片请求形态（openai/openai-json/openai-video-proxy/openai-responses） */
  image_request_mode?: string;
  /** 聊天请求形态（chat/completions vs responses） */
  chat_request_mode?: 'chat' | 'responses' | string;
  /** 生图同步/异步（sync=SSE 同步 / async=提交后轮询） */
  image_mode?: 'sync' | 'async' | string;
  /** 参考图发送编码偏好（'base64'=只认 base64 的后端；缺省=URL） */
  refFormat?: 'url' | 'base64' | string;
  /** 其余未显式建模字段透传（兼容 providerStore 扩展字段） */
  [key: string]: unknown;
}

/**
 * 生成/聊天统一结果信封：{ ok:true, url } / { ok:false, error }，
 * 聊天另含 content/aborted。对齐 relay（relayProxy）返回的 ok/fail 契约。
 *
 * 【L3c 单一真源】relayProxy 的 RelayGenerationResult / useNodeGeneration 的 NodeGenerationResult
 * 均为本类型别名（`export type X = GenerationResult`），禁止再另立 interface（check-arch 规则 3 拦截）。
 */
export interface GenerationResult {
  ok: boolean;
  url?: string;
  content?: string;
  error?: string;
  aborted?: boolean;
}
