/**
 * 统一错误分类 —— 异步/网络错误的单一分类入口（CONTEXT §三）。
 *
 * 【为什么存在】此前错误判断散落各处（节点自写 if(/网络错误/)、各 API 各写各的），
 * 分类口径不一致。本模块把「错误 → 类型」集中：
 *  - classifyError(e) → { type, message, retryable }
 *  - type ∈ abort | timeout | network | http | business（登记于 contracts.ts GEN_ERRORS）
 *
 * 【retryable 的定位 · 2026-09-16 修正（TD-16-16）】它是**观测字段，不是决策依据** ——
 * 全库消费点均只把它写进 logger 供排查，无任何 `if (retryable)` 分支。
 * **真正的自动重试决策点**是 `api/httpClient.ts`（判据＝NetworkError／TimeoutError／
 * fetch 网络型 TypeError；HttpError 一律不重试，属主动设计「业务失败不重试·防封号」）。
 * 若要新增重试行为，改那里，不要改本字段（改本字段对行为零影响）。
 *
 * 【★ 2026-09-20 深模块化：字段改名 + 类型层禁分支（本仓「让 AI 不用猜」的落地）】
 * 改前它叫 `retryable: boolean` —— 名字像"可以直接用的开关"，类型又是裸 boolean
 * ⇒ AI 看到就会写 `if (err.retryable)`，**恰好是本节反复禁止的用法**（判据只在文档里，
 * 类型层零阻挡 = 要猜）。现按两处结构性修正，使误用**写不出来 / 一看就懂**：
 *   ① **改名** `retryable` → `retryableObserved`：名字自带"这是观测值"的语义；
 *   ② **branded type**：值类型为 `ObservedFlag`（带 `unique symbol` 品牌），
 *      它**不能**直接用于 `if` / `&&` / 三元 —— 想用必须先经 `readObservedFlag()`，
 *      而那一步是**显式且可 grep**的（谁读了观测值当决策，一眼可查，不是静默）。
 *
 * 【用法】调用方拿到 type 后统一决策（abort 原样上抛 / network·timeout 降级 / 其余按业务
 * 处理），禁止再自写 if(/网络错误/) 之类关键词判断。类型登记/文案在 contracts.ts GEN_ERRORS。
 */
import { isTimeoutError } from './net/asyncGuard.ts';
import { GEN_ERRORS } from '../core/contracts.ts';
import type { ErrorKind } from '@/types';

/**
 * 错误分类结果。
 *
 * 【★ 2026-09-20 深模块化：`retryable` 已**整体移出本类型**（不再出现在返回值里）】
 *
 * 【为什么删而不是"加个标记"】本仓「让 AI 不用猜」的目标下，试过让它叫 `retryableObserved`
 * 并加品牌类型 —— **实测无效**：任何非空对象/非空串在 `if` 里恒为真，TS 拦不住 `if (x)`
 * （探针已证：`@ts-expect-error` 报"未使用"= TS 根本没报错）。既然类型层拦不住，
 * "别当决策依据"就**仍然只是文档**，等于没改。
 *
 * 【真正的结构强制 = 让它不出现在返回值里】字段不在 `ClassifiedError` 上 ⇒ 消费方
 * **根本拿不到**它 ⇒ `if (cls.retryable)` 这类误用**写不出来**（比"写了但编译不过"更彻底）。
 * 确需留痕/排查的调用方，经**显式**的 `getRetryableObserved(e)` 观测函数取（该函数名、
 * 调用点都可 grep ⇒ "谁在把观测值当回事"一眼可见，不是静默）。
 *
 * 【判据的落点】自动重试的真决策点始终在 `api/httpClient.ts`（NetworkError／TimeoutError／
 * fetch 网络型 TypeError；HttpError 一律不重试）。本字段对行为**零影响**，改它不改行为。
 */
export type ClassifiedError = { type: ErrorKind; message: string };

/**
 * 观测（仅排查用）：该错误分类上**是否本可重试** —— **不是决策依据**。
 *
 * 真重试决策点在 `api/httpClient.ts`（见 `ClassifiedError` 注释）。本函数只为日志/排查提供
 * "当时本可重试吗"这一观测值；**不要在业务逻辑里 `if (getRetryableObserved(e))`** —— 那会在
 * 消费层造出第二份重试判据（本仓 SSOT 母体）。要改重试行为，改 httpClient。
 */
export function getRetryableObserved(e: unknown): boolean {
  const c = classifyError(e);
  return c.type === 'timeout' || c.type === 'network';
}

/**
 * 把任意错误归入可决策类型。
 * 识别优先级：取消 > 超时 > 网络 > HTTP > 业务兜底。
 */
export function classifyError(e: unknown): ClassifiedError {
  if (!e) return { type: 'business', message: '' };
  const err = e as {
    name?: string;
    message?: string;
    aborted?: boolean;
    isNetwork?: boolean;
    status?: number;
  };
  const name = err?.name;
  const message = err?.message || String(e || '');
  if (name === 'AbortError' || err?.aborted) return { type: 'abort', message };
  if (isTimeoutError(e) || name === 'TimeoutError') return { type: 'timeout', message };
  // fetch 断网以 TypeError 拒绝；历史代码曾用「网络错误」前缀文案，向后兼容一并识别
  if (
    name === 'NetworkError' ||
    err?.isNetwork === true ||
    e instanceof TypeError ||
    message.startsWith('网络错误')
  ) {
    return { type: 'network', message };
  }
  if (name === 'HttpError' || typeof err?.status === 'number') return { type: 'http', message };
  return { type: 'business', message };
}

/** 生成类超时文案：以 GEN_ERRORS.timeout.label 为基底，并保留真实秒数（用户要求不丢弃「超过 X 秒」细节）。
 * 收口：各代理的超时文案统一走这里，禁止写「生成超时/生图超时/轮询超时」等多种变体。
 * @param ms 总超时毫秒，如「请求超时（超过 300 秒未返回）」 */
export function timeoutMessage(ms: number): string {
  return `${GEN_ERRORS.timeout.label}（超过 ${Math.round(ms / 1000)} 秒未返回）`;
}
