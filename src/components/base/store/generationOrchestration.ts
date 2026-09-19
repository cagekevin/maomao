import type { GenerationResult } from '@/types';
import { reportGenerate, type TaskController } from './taskStore.ts';
import { saveResultToTasks } from '../api/index.ts';
import { classifyError } from '../utils/genErrors.ts';
import { reportDegrade } from '../core/degrade.ts';
import { logger } from '../core/logger.ts';
import { showToast } from '../core/toastStore.ts';

/* ════════════════════════════════════════════════════════════════
 * 生成编排原语（纯 TS）—— 任务中心编排序列的**唯一实现**（TD-01-8 收口）
 * ────────────────────────────────────────────────────────────────
 * 【为什么要有它】「提交任务 → 进度 → 执行 → 本地化 → 落盘 → 写回 → done/fail 分类」
 * 这串序列此前存在两份：节点侧 `useNodeGeneration.start`（React hook）与剧本盒
 * `scriptBoxEngine` 内手写（资产图 5 步、尾帧图完全裸绕）。两份必然漂移（signal 断链 / 缺 recover /
 * 缺失败分类 / 缺 reportGenerate 都是这么来的）。
 *
 * 【为什么是纯 TS 而不是再造一个 hook】剧本盒是纯 TS 引擎、无组件实例；节点 hook 的
 * React 部分（loading 状态 / recover 订阅 / 卸载退订）本就属 React，**不下沉**。
 * 故本原语只承载「与框架无关的编排」，两边都消费它 → 真正的一份。
 *
 * 【正确性约束（七轮 R1–R8，逐条落在此）】
 *  R1 signal 贯穿：`signal` 由调用方创建并传入，run 必须把它透传到底层 API（修「幽灵中止」）。
 *  R2 收完整结果：`settle/onPersisted` 收完整 `GenerationResult`（尾帧图等需复杂特化写回）。
 *  R3 persist 顺序固化：**本地化 → settle(应显示 URL) → 落盘 tasks → onPersisted(持久 URL) → done(最终)**
 *     禁止调用方乱序（防临时 URL 进任务中心）。
 *  R4 mutex 不在本原语内：节点侧单节点锁（claimNodeRun）与剧本盒伪 nodeId 各自在调用方，本原语只保证
 *     「同 taskNodeId 的旧 running 任务被 reportGenerate 自然结束」。
 *  R5 失败三分支内聚：abort（warn，不扰用户）/ 业务 fail（toast）/ 异常（classifyError 记录 + toast）。
 *  R6 超时不在本原语内：底层请求自带超时（GEN_TIMEOUT/CHAT_TIMEOUT）+ 调用方总闸（剧本盒 withTimeout）。
 *  R7 文本例外：文本无 resultUrl、`done('')` 不广播（taskCompletionBus 校验空 URL 拒发）→
 *     非异步任务不要走本原语（它假定"有结果 URL"）。
 *  R8 伪 nodeId：`taskNodeId` 由调用方给（剧本盒用 `${nodeId}-asset-${assetId}` 保证每资产一卡）。
 * ════════════════════════════════════════════════════════════════ */

/** run 执行器入参（与节点侧历史签名一致） */
export interface GenerationOrchestrationRunArgs {
  progress: (percent: number, stage?: string) => void;
  signal: AbortSignal;
  taskId: string;
}

export interface GenerationOrchestrationArgs {
  /** 任务中心 nodeId（节点=自身 id；剧本盒=伪 id，保证每资产一张卡） */
  taskNodeId: string;
  /** 任务类型（image/video/text…），透传给 reportGenerate 与 saveResultToTasks */
  type: string;
  prompt?: string;
  modelName?: string;
  /** R1：由调用方创建（它还要拿去做 stop()），本原语只负责透传 */
  signal: AbortSignal;
  /** 真执行器（调底层 API） */
  run: (a: GenerationOrchestrationRunArgs) => Promise<GenerationResult | undefined>;
  /**
   * 结果本地化（可选）：上游 URL → 持久 URL（剧本盒=落素材库分类目录 / 尾帧变体目录）。
   * 抛错或返回空 → **降级保留原 URL**（reportDegrade 留痕，不判定失败）。
   */
  localize?: (url: string, result: GenerationResult) => Promise<string | null | undefined>;
  /**
   * 结果写回（R3 第二步）：写「应显示的 URL」。节点=patchData(resultKey)；剧本盒=commit assets。
   * `ctx.localized` = **本地化是否真的发生**（`localize` 抛错或返空即降级保留原 URL ⇒ false）。
   * 【为什么必须给出来（TD-01-25 · 生产者给全）】调用方要据此定**状态位**（如剧本盒的「已归档素材库」）；
   * 不给就只能拿"URL 像不像本地地址"去反解析（ADR-0004 明禁）或干脆盲补 —— 两者都是在拼第二份真相。
   */
  settle?: (
    url: string,
    result: GenerationResult,
    taskCtl: TaskController,
    ctx: { localized: boolean },
  ) => void;
  /** 落盘后的追加写回（R3 第四步，可选）：节点用它把外链覆盖成 /files/ 持久 URL；剧本盒不需要。 */
  onPersisted?: (persistedUrl: string, result: GenerationResult, taskCtl: TaskController) => void;
  /** 是否把结果落盘到 tasks 目录（默认 true；对齐 P0-C「落盘唯一出口」） */
  saveToTasks?: boolean;
  /** 失败回调（节点=updateNodeRuntime(error)；剧本盒=commit loading:false） */
  onFail?: (errorMsg: string) => void;
  /** 中止回调（用户停止；节点=清 error；剧本盒=清 loading） */
  onAbort?: () => void;
  /** 失败 toast 文案（中止不弹 toast） */
  toastFail?: string;
  /** 日志标签（如 '生成' / 'scriptBox'） */
  logTag?: string;
  /**
   * 降级留痕（`reportDegrade`）的 `layer` —— **与 `logTag` 是两种读者**：`logTag` 供日志检索，
   * `layer` 供降级观测 / 存储健康按「层」归组。缺省回退 `logTag`（简单调用方无需关心）。
   */
  degradeLayer?: string;
  /** 日志上下文（nodeId/assetId 等，供全链路排查） */
  logCtx?: Record<string, unknown>;
}

export interface GenerationOrchestrationOutcome {
  ok: boolean;
  resultUrl?: string;
  error?: string;
  aborted?: boolean;
}

/**
 * 跑一次生成编排（含任务中心上报 / 进度 / 本地化 / 落盘 / 写回 / done-fail 分类）。
 *
 * 调用方**只需要**负责：前置校验、loading 状态、互斥锁、创建 signal、提供 run 与写回回调。
 */
export async function runGenerationOrchestration({
  taskNodeId,
  type,
  prompt,
  modelName,
  signal,
  run,
  localize,
  settle,
  onPersisted,
  saveToTasks = true,
  onFail,
  onAbort,
  toastFail = '生成失败',
  logTag = '生成',
  degradeLayer = logTag,
  logCtx = {},
}: GenerationOrchestrationArgs): Promise<GenerationOrchestrationOutcome> {
  const taskCtl = reportGenerate(taskNodeId, type, prompt, { modelName });
  taskCtl.progress(5, '准备中…');

  try {
    const r = await run({
      progress: (p, stage) => taskCtl.progress(p, stage),
      signal,
      taskId: taskCtl.taskId || '',
    });

    if (r?.ok) {
      let url = typeof r.url === 'string' ? r.url : '';
      let localized = false;
      // ① 本地化（可选）：失败降级保留原 URL（不阻断）
      if (localize && url) {
        try {
          const localizedUrl = await localize(url, r);
          if (localizedUrl) {
            url = localizedUrl;
            localized = true;
          }
        } catch (e) {
          const err = e instanceof Error ? e : new Error(String(e));
          reportDegrade({ layer: degradeLayer, key: 'localize', e: err });
        }
      }
      // ② 写回「应显示的 URL」，并把「本地化是否真的发生」一并交出（消费方据此定状态，不靠猜）
      if (url) settle?.(url, r, taskCtl, { localized });
      // ③ 落盘唯一出口（P0-C）：保持「失败不阻断主流程」，但**区分三态**（TD-01-17）——
      //    落盘成功→用持久 URL；无需落盘→原样；**落盘失败→保留原 URL 降级 + 用户可见**（不再并入"成功"）。
      let finalUrl = url;
      if (saveToTasks && url) {
        const outcome = await saveResultToTasks(url, type);
        if (outcome.ok) {
          finalUrl = outcome.url;
          // ④ 持久 URL 与显示 URL 不同 → 追加写回（节点覆盖外链，仅真正落盘成功时）
          if (!outcome.skipped && outcome.url !== url) onPersisted?.(outcome.url, r, taskCtl);
        } else {
          // 生成成功、保存失败：保留原始结果地址（ADR 0005「保留远端产物地址」）+ 分开报告。
          // 【为什么不把整体判 fail】模型确已生成，结果地址仍可用（可能临时）→ 判 fail 会误导用户"没生成"。
          // 【为什么必须 toast】原实现只 reportDegrade（无 toast）= 用户不可见 = 假成功（刷新后才丢）。
          reportDegrade({
            layer: degradeLayer,
            key: 'saveResultToTasks',
            e: outcome.message ? new Error(outcome.message) : undefined,
            toast: '结果已生成，但未能保存到本地（结果地址已保留，刷新后可能失效）',
          });
        }
      }
      taskCtl.done(finalUrl);
      logger.info(logTag, 'contract·success', {
        taskNodeId,
        type,
        urlHead: finalUrl.slice(0, 80),
        ...logCtx,
      });
      return { ok: true, resultUrl: finalUrl };
    }

    // 业务失败（run 返回 ok:false）
    const msg = r?.error || toastFail;
    const cls = classifyError(msg);
    taskCtl.fail(msg);
    onFail?.(msg);
    if (r?.aborted) {
      logger.warn(logTag, 'contract·已中止', { taskNodeId, type, ...logCtx });
    } else {
      logger.error(logTag, 'contract·fail', {
        taskNodeId,
        type,
        error: msg,
        errType: cls.type,
        retryable: cls.retryable,
        ...logCtx,
      });
      showToast(msg, { type: 'error' });
    }
    return { ok: false, error: msg, aborted: !!r?.aborted };
  } catch (e) {
    // R5：中止判定统一走 classifyError（唯一入口，看 e.name）
    if (classifyError(e).type === 'abort') {
      taskCtl.fail('已停止');
      onAbort?.();
      logger.warn(logTag, 'contract·已中止', { taskNodeId, type, ...logCtx });
      return { ok: false, error: '已停止', aborted: true };
    }
    const msg = (e as { message?: string } | null)?.message || toastFail;
    const cls = classifyError(e);
    taskCtl.fail(msg);
    onFail?.(msg);
    logger.error(logTag, 'contract·error', {
      taskNodeId,
      type,
      error: msg,
      errType: cls.type,
      retryable: cls.retryable,
      ...logCtx,
    });
    showToast(msg, { type: 'error' });
    return { ok: false, error: msg };
  }
}
