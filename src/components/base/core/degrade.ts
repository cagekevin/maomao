/**
 * 降级透明度统一入口（P1-3）。
 *
 * 【为什么存在】此前「降级」散落各处：有的只 logger.warn（用户不可见）、有的各自写 toast
 * 文案（不一致）。本模块收口「两层降级」：
 *   - reportDegrade(layer, key, e)：统一记录降级日志（logger.warn），供排查；
 *   - reportDegrade({ layer, key, e, toast: '文案' })：除日志外再弹一次全局 toast，
 *     用于关键降级（如画布 KV → localStorage：用户保存的画布没进跨端 SQLite，需感知，
 *     否则换设备/重装后画布"失踪"）。
 *
 * 【节流归展示层（2026-09-17 收口）】同类降级 toast 的合并（默认 5s 窗口最多一次，避免高频落盘失败
 *   刷屏）由 `showToast` 的 `coalesceMs` **在展示层执行**；本模块**只转发**，自身不留任何窗口状态
 *   （原在此持一个模块级全局单槽 throttle = 转发原语替所有生产者决定用户可见性 = 消费者越权，
 *   与已删的 `persist:failed` 全局吸收层同形态）。logger 留痕**永远**发生，不受窗口影响。
 *
 * 【依赖分类】In-process。唯一外部依赖为 logger / toastStore（模块级引用），无 React。
 * 非 UI、可单测。
 */
import { logger } from './logger.ts';
import { showToast } from './toastStore.ts';
import { THROTTLE_MS } from './config.ts';
import type { PersistWriteOutcome } from '../storage/storageAdapter.ts';

/** 对象形态入参 */
interface ReportDegradeArgs {
  layer: string;
  key?: string;
  e?: Error;
  toast?: string;
  throttleMs?: number;
}

export function reportDegrade(args: ReportDegradeArgs): void {
  const {
    layer, // 降级发生的层/模块（如 'kvStore'）
    key, // 降级对象标识（如存储键 / 资源 url）
    e, // 底层异常（可选，仅用于日志）
    toast, // 可选：需要弹 toast 时的文案；不传则只记录日志不明示用户
    throttleMs = THROTTLE_MS,
  } = args;

  // 留痕**永远**发生（在合并判断之前，不受任何窗口影响）—— 降级不得静默，这是铁律。
  logger.warn(layer, `降级: ${key || ''}`, e?.message || e);

  if (toast) {
    // 只转发：把「能不能合并、合并多久」交给**展示层**（窗口状态由 toastStore 持有并执行）。
    showToast(toast, { type: 'warning', coalesceMs: throttleMs });
  }
}

/**
 * 落盘结果**自确认**原语（TD-24-4 阶段1 · 2026-09-17）。
 *
 * 【为什么存在】生产者（`contentStore`/`storageAdapter`）已把落盘事实给全（`PersistWriteOutcome`：
 * `landed: 'local'|'kv'|'memory'|'pending'` / `ok:false+message`），但"失败给谁看"是**每个站点自己的
 * 职责** —— 不许再依赖 `persist:failed` 全局总线兜底（用户裁定：凭什么让一个总的替它们兜底）。
 * 本原语把「同一语义」收口成一份实现，调用点各 1~2 行，禁止各站点再手写 try/catch 猜结果
 * （实证：生产者不给结果的时代，3 处消费链写出了**永不触发**的假兜底）。
 *
 * 【判据（写站点前先回答"这个键丢了用户痛不痛"）】
 *  - `ok:false`（确认失败）→ `reportDegrade`：logger 留痕 + toast 节流（给了 toast 文案才弹）；
 *  - `landed:'memory'`（**只进内存、刷新即丢**，localStorage 不可用的受限环境）→ 只 logger.warn
 *    留痕（浏览器正常环境不该发生；发生了必须可查，但不该刷屏）；
 *  - `landed:'local'|'kv'` → 真持久，无动作。
 *
 * ⚠️ KV 键经 `contentSetAsync` 降级到 `'local'` 时，`kvWriteOp` **已 reportDegrade 提示过**
 * "跨设备同步可能丢失" —— 调用方**不要再报一次**（同一失败两处各说一句 = 噪音）。
 *
 * @returns 是否**真持久**（调用方据此决定后续动作；不要拿它"记成功"——那是假成功的入口）。
 */
export function confirmPersist(
  outcome: PersistWriteOutcome,
  opts: { layer: string; key?: string; toast?: string },
): boolean {
  if (outcome.ok) {
    if (outcome.landed === 'local' || outcome.landed === 'kv') return true;
    logger.warn(opts.layer, `落盘未持久（数据仅在内存，刷新将丢失）`, {
      key: opts.key,
      landed: outcome.landed,
    });
    return false;
  }
  reportDegrade({
    layer: opts.layer,
    key: opts.key,
    e: new Error(outcome.message),
    toast: opts.toast,
  });
  return false;
}

/**
 * 「**回写成功**」统一判据（恢复/导入/同步回写类消费方共用，禁止各写一份）。
 *
 * 【为什么需要一个统一判据（2026-09-17 · TD-24-4 / TD-16-33 收尾）】`PersistWriteOutcome` 的
 * `landed` 只回答"落到哪"，**"这次回写算不算成功"取决于目标后端** —— 两处（`backupStore.importAll`、
 * `cloudSync.restoreLocal`）都靠"有没有抛异常"当成功判据，于是 `landed:'local'`（降级到本机副本）
 * 被计成成功，最终报「导入/同步成功」而真源其实没恢复。
 *
 * 【两种口径（同一真相的两种目标，不是两份判据）】
 *  - `backend:'local'`：`landed:'local'` = **已确认落进浏览器持久层** → 成功；
 *  - `backend:'kv'`：**只有 `landed:'kv'` 才算成功** —— `landed:'local'` 表示引擎不可用时降级写了
 *    **本机副本**，跨端/换机看不到，引擎恢复后也不会自动回灌 → 对"写回真源"而言就是**没恢复**。
 *
 * `landed:'memory'`（刷新即丢）与 `'pending'`（本调用无法确认）**一律不算成功**。
 */
export function isWriteBackOk(outcome: PersistWriteOutcome, backend: 'local' | 'kv'): boolean {
  if (!outcome.ok) return false;
  return backend === 'kv' ? outcome.landed === 'kv' : outcome.landed === 'local';
}
