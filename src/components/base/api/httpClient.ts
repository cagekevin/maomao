/**
 * 统一请求层 —— 所有 fetch 的唯一入口（AbortSignal 治理）。
 *
 * 【为什么存在】项目原先 44+ 处 fetch 裸调：无超时（可能永久挂起）、无取消、
 * 无错误分类。本模块把「超时 / 取消 / 错误分类 / 受限重试」集中到这里，统一消灭
 * 这类 bug。任何新网络请求必须走 httpRequest，禁止再裸写 fetch。
 *
 * 【能力】
 *  - 超时：**无默认值**。需要时限的调用方显式传 timeoutMs（UPLOAD_TIMEOUT /
 *    LOCAL_TOOL_PING_TIMEOUT…）；不传或 <=0 即不掐点。超时抛 TimeoutError（asyncGuard.withTimeout）
 *    并中止底层请求。
 *    更新(2026-09-04)：移除原默认 15000。① 15s 会把上传类长请求掐断（网络差时传不完即失败，真实 bug）；
 *    ② 放大到 3 分钟也救不了——吃到默认值的 37 处全是本机 18080 的 CRUD（毫秒级，15s 与 3min 等价），
 *    而真需要时限的链路早已各自显式声明。兜底值治不了真实问题却给未声明的新请求假安全感，故不设。
 *    详见 config.ts「异步超时」区块。
 *  - 取消：接受外部 signal（组件生命周期），与内部超时 controller 隔离，互不污染。
 *  - 错误分类：TimeoutError / NetworkError / HttpError(status,data) / AbortError。
 *  - 受限重试：仅网络/超时错误自动重试（业务 4xx/5xx 不重试），默认最多 3 次。
 *
 * 【返回】parseJson=true（默认）时返回解析后的 JSON；HTTP 非 2xx 抛 HttpError。
 * 【失败面（TD-18-22 收口，全部诚实可见，不再压成 `{}`）】
 *  - 非 2xx（无论 parseJson）→ `HttpError(status, message, data)`；`message` 优先取错误信封，
 *    非 JSON 错误体则**原文进 message**（TD-03-11 本意，此前因 body 二次读取必拒而从未生效）；
 *  - 2xx 但**读不到体**（响应流中断）→ `logger.error` + 抛错（中止类原样上抛，禁重分类）；
 *  - 2xx 但**体非空且不是合法 JSON**（网关改写 / 传输截断）→ `logger.error` + 抛错；
 *  - 2xx 且**体为空**（如 204）→ 真空，静默返回 `{}`（`CLAUDE.md §5.1①`，不是失败）。
 */
import { withTimeout, isTimeoutError, tryParse } from '../utils/net/asyncGuard.ts';
import { logger } from '../core/log/logger.ts';

/**
 * 「**显式**不设超时」哨兵（ADR-0035 / ADR-0045）—— 传它 = 声明"已判断过：本请求不该掐点"。
 *
 * 【它存在的唯一理由：把"忘了写"与"有意不写"分开】
 * `HttpRequestOptions.timeoutMs` 现为**必填**，故调用方必须二选一：传命名超时常量，或传本哨兵。
 * 漏写 → 编译不过；写本哨兵 → 是一次**可检索、可 review 的判断**（`grep NO_TIMEOUT` 即得全部
 * "不掐点"站点，逐个可复核其理由是否仍成立），而不是静默的窟窿。
 *
 * 【何时合法】① 响应近瞬回（本机 CRUD，毫秒级）；② 该请求的**总超时由外层兜底**
 * （如流式 body 读取：`agentRuntime` 用 `withTimeout` 包整体，内层不重复掐点）。
 * 【何时不合法】"我不确定要多久" —— 那正说明**该链路的时限常量缺失**，去 `base/core/config.ts` 补一个。
 */
export const NO_TIMEOUT = 0;

/**
 * 判定一个 TypeError 是否**由 fetch 自身因网络失败抛出**（TD-03-12，2026-09-13）。
 *
 * 【为什么需要】`fetch` 在网络不可达时抛 `TypeError`，但**JS 代码 bug 也抛 TypeError**
 * （调用未定义函数、属性访问越界）。原实现 `e instanceof TypeError` 无差别归类为 NetworkError →
 * 代码 bug 被伪装成"网络错误"并重试 3 次，类别被篡改、排障被引偏。
 *
 * 【判据】fetch 网络失败的 message 是**各引擎的固定文案**（浏览器/Node 各自一条，跨语言本地化）。
 * 只认这些文案；其余 TypeError 一律视为代码 bug，原样上抛（保留 stack）。
 */
function isFetchNetworkTypeError(e: TypeError): boolean {
  const msg = String(e?.message || '');
  return (
    /failed to fetch/i.test(msg) || // Chrome/Node undici
    /networkerror when attempting to fetch/i.test(msg) || // Firefox
    /load failed/i.test(msg) || // Safari
    /fetch failed/i.test(msg) || // Node
    /network request failed/i.test(msg) // React Native / 其它
  );
}

/** httpRequest 选项（fetch 统一入口的参数契约） */
export interface HttpRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string | FormData | undefined;
  /** 外部取消信号（组件生命周期） */
  signal?: AbortSignal;
  /**
   * 超时毫秒 —— **必填**（ADR-0035 / ADR-0045 深模块化）。
   *
   * 【为什么从「可选」改「必填 · 显式二选一」】
   * 原形态 `timeoutMs?: number` 让"**忘了写**"与"**有意不掐点**"**长得一模一样**（都是不传）。
   * 而 `config.ts:112` 已裁定不设全局默认值（兜底值只给假安全感）⇒ 缺省即「不掐点」，
   * 于是新请求漏写 `timeoutMs` = 一个**永不 settle 的 Promise**，且**零留痕**（AI 静默踩坑）。
   * 这是 ADR-0035「无超时 Promise 的失败形态最坏」的原样复发形态。
   *
   * 【改后契约】调用方**必须显式二选一**，无法"不表态"：
   *   · 有明确时限 → 传该链路的命名常量（`UPLOAD_TIMEOUT` / `LOCAL_CRUD_TIMEOUT` / …，真源 `base/core/config.ts`）；
   *   · 确知不该掐点（如响应近瞬回、总超时由外层 `withTimeout` 兜底）→ 传 `NO_TIMEOUT`
   *     （**显式**声明"我考虑过了，不要超时"，而非"我忘了"）。
   * ⇒ 类型层逼出决策：漏写编译不过；写 `NO_TIMEOUT` 是**做过判断的声明**，可被 review 与检索。
   */
  timeoutMs: number;
  /** 网络/超时自动重试次数，默认 3；业务错误不重试 */
  retries?: number;
  /** 首轮重试等待 ms，默认 500（递增） */
  retryDelay?: number;
  /** 是否解析 JSON，默认 true */
  parseJson?: boolean;
  /** 每次重试前回调（打日志/更新 UI） */
  onRetry?: (attempt: number, err: unknown) => void;
  /** 错误消息上下文 */
  label?: string;
  /**
   * 静默成功（日志降噪 80§十#3）：成功时不再记 [请求] 成功 debug（成功可还原、无排查增量），
   * 仅失败/重试仍记。适用高频低价值写请求(saveTask/kvSet 等 upsert)，避免"每轮回写成功"刷屏。
   * 失败路径不变（失败必须可见）。
   */
  silentSuccess?: boolean;
}

/** 错误信封解析结果 { code, message } */
export interface ErrorDetail {
  code: string;
  message: string;
}

/** 网络错误（fetch 本身失败：断网/连接被拒/跨域），区别于 HTTP 状态错误 */
export class NetworkError extends Error {
  isNetwork = true;
  cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

/** HTTP 非 2xx 错误（携带 status 与响应体 data） */
export class HttpError extends Error {
  status: number;
  data?: unknown;
  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.data = data;
  }
}

/**
 * 统一错误报文解析（B2：错误信封的唯一解析入口，禁止各处手写 data.error||data.detail 拆包）。
 *
 * 输入后端错误信封，输出可决策的 { code, message }：
 *  - `{ error: string }`            → 字符串兜底（B0/B2 兼容后端旧形态，必须保留）
 *  - `{ error: { code, message } }` → 结构化信封（B2 sendError 带 code 形态）
 *  - `{ detail }` / `{ message }`   → 平铺兜底
 * 优先级：error.code > error.message > error.detail > data.detail > data.message。
 * @param {*} data 后端错误响应体（可能为 null/undefined）
 * @returns {{ code: string, message: string }}
 */
export function extractErrorDetail(data: unknown): ErrorDetail {
  const src = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  if (typeof src.error === 'string') {
    // 字符串错误信封兜底：{error:'msg'} → UNKNOWN（后端当前必返字符串，兜底不可删）
    return { code: 'UNKNOWN', message: src.error };
  }
  const e =
    src.error && typeof src.error === 'object' ? (src.error as Record<string, unknown>) : {};
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');
  return {
    // 优先级：error.code > error.message > error.detail > data.detail > data.message
    code: str(e.code) || 'UNKNOWN',
    message: str(e.message) || str(e.detail) || str(src.detail) || str(src.message),
  };
}

/** 2xx 响应体读不到时的**用户可见文案**（生产者发布，调用方只转发、禁止自造）。 */
const RESPONSE_BODY_UNREADABLE_MESSAGE = '响应体读取中断（响应被截断或连接中断），请重试';

/** 2xx 但响应体不是合法 JSON 时的**用户可见文案**（生产者发布，调用方只转发、禁止自造）。 */
const RESPONSE_BODY_INVALID_MESSAGE = '响应体不是合法 JSON（可能被网关改写或传输截断）';

/**
 * **2xx 响应体解析的唯一出口**（TD-18-22）。
 *
 * 【为什么要有它】原实现 `res.ok ? await res.json().catch(() => ({})) : …` 把「2xx 但体不是合法 JSON」
 *   静默压成 `{}` 后**照常下发作成功**（ADR-0019 兜底形态②「压平无留痕」）——调用方拿到空对象、
 *   零日志、无从归因（典型成因：网关/代理改写响应、传输被截断）。失败必须诚实可见。
 *
 * 【两态判据（不是"压平"的两个分支）】
 *  - **真空**：2xx 且无内容体（如 204）→ `{}`。真空静默返回空值是**合法语义**
 *    （`CLAUDE.md §5.1①`），不是失败，不许被报成失败；
 *  - **非法**：体非空却解析不出 → **抛错**（文案由本模块发布，`cause` 保留原始解析错误）。
 *
 * 【读体失败（`read.ok === false`）】= 真失败（响应流中断），不许伪装成"空成功"（原为静默 `{}`）：
 *   `logger.error` 留痕后抛出；**中止类（AbortError）必须原样上抛** —— 换掉类别会让上层「已停止」
 *   判定失效（禁重分类）。
 *
 * @returns 解析后的 JSON。**返回类型 `any` 是既有契约、不是本次新增的宽松面**：原实现走 `res.json()`
 *   （`lib.dom` 亦为 `any`），本层不做 schema 校验 —— 响应体形状只有调用方知道，由调用方声明期望形状。
 *   本次只是把"推断出来的 any"写成"写明的 any"（行为零变化）。
 */
function parseSuccessBodyOf(read: BodyReadResult, res: Response, tag: string, method: string): any {
  if (!read.ok) {
    logger.error('http', '[请求] 响应体读取失败', {
      method,
      url: tag,
      status: res.status,
      cause: (read.error as { message?: string })?.message,
    });
    if ((read.error as { name?: string })?.name === 'AbortError') throw read.error;
    throw new Error(RESPONSE_BODY_UNREADABLE_MESSAGE, { cause: read.error });
  }
  const t = read.text.trim();
  if (!t) return {};
  try {
    return JSON.parse(t);
  } catch (e) {
    // 【一诚实】2xx 但体非空且解析不出 = 真失败：留痕（带体首段作证据）后诚实抛出，绝不压成 `{}`。
    logger.error('http', '[请求] 2xx 响应体不是合法 JSON', {
      method,
      url: tag,
      status: res.status,
      bodyHead: read.text.slice(0, 200),
    });
    throw new Error(RESPONSE_BODY_INVALID_MESSAGE, { cause: e });
  }
}

/**
 * **非 2xx 响应体解析的唯一出口**（文本入口；body 只能消费一次，故与成功态共用同一份文本）。
 *
 * 优先 JSON（OpenAI / 后端错误信封）；非 JSON 时把**原文**装进 `{ message }` —— 这正是 TD-03-11 的本意
 * （排障要看到代理 HTML / 崩溃页原文）。空体 → `{}`（HttpError 仍带 `status`，主事实不丢）。
 *
 * 【原 `readErrorBody(res)` 的缺陷（已删）】它先 `res.json()` 再 `res.text()` 取原文，而真实 Response 的
 * body **只能消费一次** ⇒ 第二条 text 必拒 ⇒ 「保留上游真实错误文本」从未在真实链路成立，
 * 只有允许二次读取的测试替身才会走到那条分支（假绿）。改为文本入口后该能力才真正成立。
 */
function parseErrorBody(text: string): unknown {
  const t = text.trim();
  if (!t) return {};
  const r = tryParse(() => JSON.parse(t));
  return r.ok ? r.value : { message: text };
}

/** 响应体读取结果（判别联合）：`ok:false` 表示**这次读取失败**，不是"体为空"。 */
type BodyReadResult = { ok: true; text: string } | { ok: false; error: unknown };

/**
 * **响应体读取的唯一出口**。body 只能消费一次 ⇒ 全模块只有这一处 `res.text()`。
 *
 * 返回**判别联合**而不是把失败压成 `''`：`''` 会让「读失败」与「体为空」不可区分
 * （正是 ADR-0019 形态②要拆的「压平」），而这两者的正确处置完全相反 ——
 * 体为空是真空（合法），读失败是真失败（2xx 下必须诚实抛出）。
 */
async function readBodyText(res: Response): Promise<BodyReadResult> {
  try {
    return { ok: true, text: await res.text() };
  } catch (error) {
    return { ok: false, error };
  }
}

/**
 * 非 2xx 响应体解析（**唯一出口**）：读失败 → 留痕 + 视为空体。
 *
 * 失败响应的**主事实是 HTTP 状态**：连错误体都读不到时，HttpError 仍带 `status`，
 * 不得把这次读体失败重分类成"读体错误"（禁重分类）—— 但**必须留痕**，否则"错误体为何为空"无从归因。
 */
function parseErrorBodyOf(
  read: BodyReadResult,
  res: Response,
  tag: string,
  method: string,
): unknown {
  if (!read.ok) {
    logger.warn('http', '[请求] 失败响应体读取失败（HttpError 仅带状态码）', {
      method,
      url: tag,
      status: res.status,
      cause: (read.error as { message?: string })?.message,
    });
    return {};
  }
  return parseErrorBody(read.text);
}

/**
 * 统一 HTTP 请求。
 * @param {string} url
 * @param {object} [opts]
 *   - method?: 'GET'|'POST'|...
 *   - headers?: Record<string,string>
 *   - body?: string
 *   - signal?: AbortSignal       外部取消信号（组件生命周期）
 *   - timeoutMs: number          **必填**：该链路命名超时常量，或显式 `NO_TIMEOUT`（见 HttpRequestOptions 注释）
 *   - retries?: number           网络/超时自动重试次数，默认 3；业务错误不重试
 *   - retryDelay?: number        首轮重试等待 ms，默认 500（递增）
 *   - parseJson?: boolean        是否解析 JSON，默认 true
 *   - onRetry?: (attempt, err)  每次重试前回调（用于打日志/更新 UI）
 *   - label?: string             错误消息上下文，如 'fetchTasks' → "fetchTasks failed: HTTP 500"
 * @returns {Promise<any>}        解析后的响应体（parseJson=true）或 Response
 * @throws {TimeoutError|NetworkError|HttpError|AbortError}
 */
export async function httpRequest<_T = unknown>(
  url: string,
  {
    method = 'GET',
    headers,
    body,
    signal,
    timeoutMs = NO_TIMEOUT, // 类型层已要求必填；此默认仅在 JS 调用方/扩测漏传时兜底（= 不掐点）
    retries = 3,
    retryDelay = 500,
    parseJson = true,
    onRetry,
    label,
    silentSuccess = false,
  }: HttpRequestOptions = { timeoutMs: NO_TIMEOUT },
) {
  // 内部 controller：外部 signal 与内部超时都中止它，互不污染（超时不误伤组件其他请求）
  const internalCtrl = new AbortController();
  const onExternalAbort = () => internalCtrl.abort();
  if (signal) {
    if (signal.aborted) internalCtrl.abort();
    else signal.addEventListener('abort', onExternalAbort, { once: true });
  }

  const start = Date.now();
  const tag = label || url;
  // 排查用日志：走 debug（模块位 http），不触发 /api/logs 上报（避免每次请求多一次 fire-and-forget fetch）。
  // 【日志降噪 80§十#1】首次"发出"不再记：一次请求是否成功/失败由下方 [请求] 成功/失败 日志定位，
  // "发出"对正常请求无排查增量，只会让高频请求(轮询/saveTask)每请求多一条噪音。改为仅重试轮记
  // (attempt>0) 的"重试发出"，定位重试链；成功/失败仍带耗时，足够排查。

  try {
    for (let attempt = 0; attempt <= retries; attempt++) {
      // signal 已中止 → 立即抛，不 fetch
      if (internalCtrl.signal.aborted) {
        const err = new Error('The user aborted a request.');
        err.name = 'AbortError';
        throw err;
      }
      if (attempt > 0) {
        logger.debug(
          'http',
          '[请求] 重试发出',
          { method, url: tag, attempt: attempt + 1, timeoutMs, retries },
          { module: 'http' },
        );
      }
      try {
        const res = await withTimeout(
          fetch(url, { method, headers, body, signal: internalCtrl.signal }),
          timeoutMs,
          `请求超时（${timeoutMs}ms）`,
          internalCtrl.signal,
        );
        if (parseJson) {
          // 【TD-18-22 收口】响应体**只读一次**（真实 Response 的 body 只能消费一次），成败两态共用同一份文本。
          // 原实现 `res.ok ? await res.json().catch(() => ({})) : await readErrorBody(res)` 有两处缺陷：
          //  ① 2xx 但体不是合法 JSON → 静默压成 `{}` 照常下发作成功（兜底形态②「压平无留痕」）；
          //  ② `readErrorBody` 的「json 失败再 text 取原文」在真实 Response 上是**死代码**（见其注释）。
          const read = await readBodyText(res);
          if (!res.ok) {
            // HttpError.message 只承载业务 message（B2）；HTTP 状态由 HttpError.status 单独暴露，不再拼前缀
            const data = parseErrorBodyOf(read, res, tag, method);
            const { message } = extractErrorDetail(data);
            throw new HttpError(res.status, message, data);
          }
          // 【一诚实】2xx 却读不到体 = 真失败（响应流中断），体非法 = 真失败（网关改写/截断）——
          // 两者都在 parseSuccessBodyOf 内留痕并诚实抛出，绝不伪装成"空成功"（原为静默 `{}`）。
          const data = parseSuccessBodyOf(read, res, tag, method);
          if (!silentSuccess) {
            logger.debug(
              'http',
              '[请求] 成功',
              { method, url: tag, status: res.status, elapsedMs: Date.now() - start },
              { module: 'http' },
            );
          }
          return data;
        }
        if (!res.ok) {
          // parseJson:false（二进制/流式出口）也要尽量保留上游错误体，避免非 2xx 时错误信息丢失
          const data = parseErrorBodyOf(await readBodyText(res), res, tag, method);
          const { message } = extractErrorDetail(data);
          throw new HttpError(res.status, message, data);
        }
        if (!silentSuccess) {
          logger.debug(
            'http',
            '[请求] 成功',
            { method, url: tag, status: res.status, elapsedMs: Date.now() - start },
            { module: 'http' },
          );
        }
        return res;
      } catch (e: unknown) {
        const err = e as { name?: string; message?: string } | undefined;
        // 外部取消：立即抛，不重试
        if (signal?.aborted || err?.name === 'AbortError') throw e;
        // 仅网络/超时错误可重试；业务错误（HttpError）不重试。
        // 【TD-03-12】TypeError 须再验「是否 fetch 网络失败」——代码 bug 的 TypeError 不重试（重试 3 次也修不好 bug）。
        const retryable =
          e instanceof NetworkError ||
          isTimeoutError(e) ||
          (e instanceof TypeError && isFetchNetworkTypeError(e));
        if (retryable && attempt < retries) {
          onRetry?.(attempt + 1, e);
          await new Promise((r) => setTimeout(r, retryDelay * (attempt + 1)));
          continue;
        }
        // 归类：仅**fetch 自身抛的**网络型 TypeError 才归类为 NetworkError。
        // 【TD-03-12 修复】原来 `if (e instanceof TypeError)` 无差别归类 —— 把**我们代码里的** bug
        // （调用未定义函数 / 属性访问越界，同样抛 TypeError）伪装成"网络错误"、类别被篡改、排障引偏。
        // 现改用 message 白名单识别 fetch 网络失败（浏览器固定文案），代码 bug 原样上抛（保留 stack）。
        if (e instanceof TypeError && isFetchNetworkTypeError(e)) {
          throw new NetworkError(err?.message || '网络错误', e);
        }
        // 传输层事实（状态码/错误类型/耗时）统一记录，便于定位「哪条请求断在哪」
        const status = e instanceof HttpError ? e.status : undefined;
        logger.debug(
          'http',
          '[请求] 失败',
          { method, url: tag, status, error: err?.name || 'Error', elapsedMs: Date.now() - start },
          { module: 'http' },
        );
        throw e;
      }
    }
  } finally {
    signal?.removeEventListener?.('abort', onExternalAbort);
  }
}

/**
 * 快速 JSON 请求助手：POST 且自动序列化 body、带 Content-Type。
 * 用法：httpPost('/api/x', { foo: 1 }, { signal })
 */
export function httpPost<T = unknown>(
  url: string,
  data?: unknown,
  opts: HttpRequestOptions = { timeoutMs: NO_TIMEOUT },
): Promise<T> {
  return httpRequest<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: data == null ? undefined : JSON.stringify(data),
    ...opts,
  });
}

/**
 * 带日志的请求（API 层默认用这个）：失败统一记录到 logger，符合「错误走 logger」约定。
 */
export async function httpRequestLogged<T = unknown>(
  url: string,
  opts: HttpRequestOptions = { timeoutMs: NO_TIMEOUT },
  label = 'http',
): Promise<T> {
  try {
    return await httpRequest(url, opts);
  } catch (e: unknown) {
    // logger.warn 只支持 3 参（category/action/detail）；err.message 原实现即被忽略，故不带入
    logger.warn(label, '请求失败', `${url}`);
    throw e;
  }
}
