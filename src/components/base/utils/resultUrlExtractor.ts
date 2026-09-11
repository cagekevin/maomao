/**
 * P1-B 统一 envelope/URL 解析器 —— 收口散落的图片/视频结果 URL 提取与类型判定（data 流交叉点 φ2）。
 *
 * 【收口什么】此前 ≥4 处独立、不共享的提取逻辑：
 *   - proxyGenerate.readSseUrl（SSE `evt.results[0].url ?? evt.result.images[0].url`）
 *   - proxyGenerate.extractImageUrl / extractVideoUrl（JSON 直返/轮询）
 *   - pollTask.extractResultUrl（网关 task_view 按 type 提 url）
 * 全部委托本模块，杜绝"同一响应样例各处解析结果不一致 / video 被当 image"。
 *   ── 更新(2026-09-03 relay 收口)：下方两处 proxyGenerate 来源已随旧 /api/proxy 出站整文件退役；
 *      relay 链路结果 URL 由后端落盘 /files/ 直接返回，前端不再自提 SSE/JSON url，本模块保留
 *      （仍为 pollTask 恢复、脚本盒 JSON 直返等链路的唯一 URL 提取入口）。
 *
 * 【类型判定规则】已统一到 utils/mediaType.ts（扩展名/mime 唯一真值源）：
 *   本模块只负责「结果 URL 提取」；产出类型一律走 mediaType.resolveMediaType / classifyUrl
 *   （生产方 data.mediaType 优先，否则按扩展名判 —— 消灭静默误分类）。禁止在本模块再判一次类型。
 *
 * 【字段映射】统一按 type 取：
 *   video → result.videos[0].url / results[0].url / 顶层 video_url
 *   image → result.images[0].url / results[0].url / result.url
 *   audio → result.audios[0].url  / results[0].url / result.url
 * 数组可包时统一取 [0]。
 *
 * 注：纯函数单测见 tests/unit/resultUrlExtractor.test.js。
 *
 * ════════════════════════════════════════════════════════════════
 * 【唯一准出口】本模块是全库「结果 URL 提取」的唯一实现（唯一真值源）；
 * 「产出类型判定」的唯一实现是 utils/mediaType.ts（classifyUrl / resolveMediaType / classifyUrlKind）。
 *  · 今后任何节点 / API / 脚本需要从响应里提取结果 URL，一律走本模块（extractResultUrl）。
 *  · 禁止在别处另起实现 / 就地手写字段映射 / 复制本模块逻辑（会导致"同一样例各
 *    处解析不一致 / video 被当 image"，正是当初收口的根因）。
 *  · 唯一例外：responses 协议生图（parseResponsesJson 走 output_text markdown 兜底，原 requestModes
 *    已随 L3b 退役）是不同响应形态，不适用本信封字段表，属合理例外；
 *    其余标准信封（result.images[].url 等）一律强制经本模块。
 * ════════════════════════════════════════════════════════════════
 */
import type { ResultKind } from '@/types';

// 各类型优先选取的字段路径（均取容器 [0]）
const SELECTORS: Record<ResultKind, string[]> = {
  video: ['result.videos[0].url', 'results[0].url', 'video_url'],
  audio: ['result.audios[0].url', 'results[0].url', 'result.url'],
  image: ['result.images[0].url', 'results[0].url', 'result.url'],
};

/** 简单路径取值：'result.images[0].url'；遇缺失返回 undefined。 */
function dig(obj: unknown, path: string): unknown {
  return path.split('.').reduce((acc, seg) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    const m = seg.match(/^(\w+)\[(\d+)\]$/);
    if (m) return acc[m[1]]?.[Number(m[2])];
    return acc[seg];
  }, obj);
}

/** 数组可包时统一取 [0]，否则原值。 */
function unwrap(u: unknown): unknown {
  return Array.isArray(u) ? (u[0] ?? undefined) : u;
}

/**
 * 统一提取结果 URL。
 * @param {object} opts
 * @param {object} [opts.data] 响应体 data（通常 = json.data ?? json，优先）
 * @param {object} [opts.json] 完整响应
 * @param {('image'|'video'|'audio')} [opts.type] 任务类型，默认 image
 * @returns {string|undefined} 命中返回 url（可能已取 [0]），否则 undefined
 */
export function extractResultUrl({
  data,
  json,
  type = 'image',
}: {
  data?: unknown;
  json?: unknown;
  type?: ResultKind;
}): string | undefined {
  const typeKey: ResultKind = type === 'video' ? 'video' : type === 'audio' ? 'audio' : 'image';
  const paths = SELECTORS[typeKey];
  for (const holder of [data, json]) {
    if (!holder || typeof holder !== 'object') continue;
    for (const p of paths) {
      const url = unwrap(dig(holder, p));
      // 仅 typeof string 且非空才收窄为 URL（避免把 number/对象当 string 返回，F26）
      if (typeof url === 'string' && url) return url;
    }
  }
  return undefined;
}
