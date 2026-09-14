/**
 * 静默 catch 豁免理由登记表（单一真源 · SSOT）。
 *
 * 【为什么存在】`scripts/check-silent-catch.mjs` 要求：每一处「空 catch」必须带
 * `catch-ok: <CODE>` 标记，且 CODE 必须来自本登记表。理由从「自由文本」收紧为
 * 「有限面登记表项」——理由可审计、不可一句话绕过（TD-02-26 偿还：原豁免通道是自由
 * 文本 + 只判存在性，可一句话绕过、理由永不验证）。本仓其余同类判据
 * （STORAGE_KEYS / EVENTS / NODE_TYPES / apiRegistry / NODE_HANDLE_CONTRACT）均走
 * 「单一真源登记表 + 双向校验」，唯 `catch-ok` 曾游离，本条把它收口回同一模式。
 *
 * 【闸如何使用】闸从本文件抽取 CATCH_OK 的值集合做白名单校验。新增一个理由码 = 在此
 * 加一项（key 与 value 同名）+ 在此写清「何时适用 / 何时不适用」+ 补一条行为测试或
 * 登记表说明。新增码是 review 可见的跨文件动作，不是随手一行注释。
 *
 * 【守卫 vs catch 职责边界（最高优先，违反即回潮）】
 *   · 守卫（guard）：只管「契约违约」→ 必须 fail-fast（抛错）。用「前置守卫」去预防
 *     运行时意外（IO/网络/解析/浏览器 API）是**假守卫**——代价更高、还防不住。
 *   · catch：只管「运行时可预期失败」（IO / 网络 / 解析 / 浏览器 API 预期不可用）→
 *     必须 `logger.warn` / `reportDegrade` 留痕，或标 `catch-ok: <CODE>` 且 CODE
 *     确属下方结构性豁免。绝不允许「代码 bug 的 TypeError 被当网络错误重试 / 静默吞」。
 *   详见 spec/CONTEXT.md §三「异步与一致性 · 错误透传」。
 *
 * 【反模式（出现即债）】
 *   · `catch {}` 无任何标记 —— 失败就地消失，闸直接判违规。
 *   · `catch-ok: 随便写` —— 自由文本，闸判违规（CODE 不在本表）。
 *   · 把本应「失败可见」的结果用空 catch 吃掉（如读取失败却不回退/不报错）。
 *   · 在非空 catch 上贴 `catch-ok:`（标记已退化为「备注」，见 TD-02-26 症状①）。
 */
export const CATCH_OK = {
  /** 写锁链防断：catch 令 promise 链永不 reject（结构性必需），如 locks 链 / finally 清理。 */
  LOCK_CHAIN: 'LOCK_CHAIN',
  /** 防递归：logger / 上报自身异常不能再调 logger（会递归），必须静默。 */
  RECURSION_GUARD: 'RECURSION_GUARD',
  /** 浏览器 API 预期不可用（autoplay 拒绝 / 跨域污染 / 浏览器兼容）：失败属环境预期，非缺陷。 */
  BROWSER_API: 'BROWSER_API',
  /** 析构 / 释放失败不阻断主流程（close / stop / abort / dispose 异常）。 */
  RELEASE_FAIL: 'RELEASE_FAIL',
  /** 解析失败兜底（JSON / DOMParser / 错误体解析失败 → 落下一分支 / 默认文案）。 */
  PARSE_FALLBACK: 'PARSE_FALLBACK',
  /** 读取失败回退默认 / 容错（配置 / 偏好 / 订阅回调读不到 → 用默认值）。 */
  READ_FALLBACK: 'READ_FALLBACK',
  /** 失败已由他处可见（引擎内部已 toast / logger 已留痕），此处仅防 unhandled rejection。 */
  ALREADY_REPORTED: 'ALREADY_REPORTED',
  /** 存量迁移 / 旧键兜底语义（旧键迁移超时等一次性迁移）。 */
  MIGRATION: 'MIGRATION',
  /** 有意的非阻塞副作用（fire-and-forget / 清理 / 轮询失败不阻断主链路）。仅当确有留痕或幂等。 */
  NON_BLOCKING: 'NON_BLOCKING',
  /** 落盘 / 回传失败保留原值（降级不阻断，原值已是最新可用状态）。 */
  KEEP_ORIGINAL: 'KEEP_ORIGINAL',
  /** 剪贴板 API 权限 / 被拒（写被拒 → execCommand 兜底 / 读被拒 → 调用方回退）。 */
  CLIPBOARD: 'CLIPBOARD',
} as const;

/** catch-ok 理由码联合类型（闸白名单的 TS 镜像，供测试 / 调用方引用）。 */
export type CatchOkCode = (typeof CATCH_OK)[keyof typeof CATCH_OK];

/** 全部合法理由码（供闸白名单校验；顺序无关）。 */
export const CATCH_OK_CODES: readonly string[] = Object.values(CATCH_OK);
