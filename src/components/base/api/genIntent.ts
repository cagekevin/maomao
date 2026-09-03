/**
 * genIntent — 前端「发意图」的统一数据契约（docs/100、docs/101）。
 *
 * 【为什么】前端 5 类入口（文本/promote/视频/剧本/AI助手）历史上把「整个 provider 富对象 + 散参数」
 * 塞给门面，再走 /api/proxy。本模块定义统一「意图」：前端只发 capability + providerId + model + 模态参数，
 * providerId = 后端 config/providers/<id>.json 的平台 id（= 13 个服务商之一）；出站细节由后端按 id 查。
 *
 * 【方向】先以本类型为锚点统一前端数据形状（门面逐步改收 GenIntent），再并后端 relay/API 成一个。
 * 换服务商 = 换 providerId = 后端读不同 JSON，前端零逻辑改动。
 *
 * 【唯一出口纪律】前端所有生成/聊天请求，出站细节只经 base/api 门面；本类型是这些请求的标准入参形态。
 */

/** 模态（由节点类型决定要什么产出） */
export type GenCapability = 'image' | 'video' | 'chat'

/**
 * 统一请求意图：前端"要什么"。不含出站/UI 细节；模态差异用可选字段表达。
 *  - image/video 填 prompt（单句）；chat 填 messages（多轮）。
 *  - providerId 必须是后端 config/providers/<id>.json 的平台 id（13 个服务商之一）。
 */
export interface GenIntent {
  /** 模态：image | video | chat（决定后端选哪套预设/能力） */
  capability: GenCapability
  /** 服务商 id（= 后端 config/providers/<id>.json 的 id，如 'lovart'/'google'）。来源：provider.id */
  providerId: string
  /** 模型 id（该服务商模型清单里的 id，如 'gpt-image-2-low'） */
  model: string
  /** 贯穿任务号（前端 task_id；后端写 DB / 恢复用） */
  taskId?: string
  /** image/video：提示词 */
  prompt?: string
  /** chat：多轮消息 */
  messages?: unknown[]
  /** image/video：尺寸像素（如 '1024x1024'） */
  size?: string
  /** 参考图 url（图生图/文生图参考） */
  images?: string[]
}

/** 统一结果信封：{ ok:true, url? } / { ok:true, content? } / { ok:false, error? }；取消标 aborted。 */
export interface GenOutput {
  ok: boolean
  url?: string
  content?: string
  error?: string
  aborted?: boolean
}
