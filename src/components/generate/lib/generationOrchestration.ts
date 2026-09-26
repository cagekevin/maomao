import type { GenerationResult } from '@/types';
import { reportGenerate, type TaskController } from '@/components/base/store/taskStore';
import { saveResultToTasks } from '@/components/base/api/index';
import { classifyError, getRetryableObserved } from '@/components/base/utils/genErrors';
import { reportDegrade } from '@/components/base/core/log/degrade';
import { logger } from '@/components/base/core/log/logger';
import { showToast, toastInfo } from '@/components/base/core/event/toastStore';

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
 *  R4 mutex 不在本原语内：节点侧单节点锁（claimNodeRun）与剧本盒伪 nodeId 各自在调用方。
 *     【2026-09-23 订正 · ADR-0059】原写「本原语保证同 taskNodeId 的旧 running 任务被 reportGenerate
 *     自然结束」——该行为已删（镜像不得筛除真源）；同一 nodeId 的旧行**如实留在镜像里**、跑到自己的终态。
 *  R5 失败三分支内聚：abort（warn，不扰用户）/ 业务 fail（toast）/ 异常（classifyError 记录 + toast）。
 *  R6 超时不在本原语内：底层请求自带超时（chat 用 `CHAT_TOTAL_TIMEOUT` 任务总预算；image/video 的等待上限由**后端** `budgetMs` 给）
 *     + 调用方总闸（剧本盒 withTimeout）。
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
  /**
   * 【2026-09-21】本次**只是前端停止等待**（`GenerationResult.pending` 的上抛形态）：任务仍是 running，
   * 终态由后端写、由 `pollTask` 恢复轮询续读。调用方看到它**不得**当失败处理（不要弹红、不要清 loading
   * 之外的失败态、不要引导重提）。
   */
  pending?: boolean;
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
      // 【必须无条件下发 · 2026-09-26】`settle` 的语义是「成功 ⇒ 通知调用方（写回 URL + 节点 onSuccess）」，
      // **与有没有 URL 无关**。text 结果本体在 `content`（`r.url` 缺失）—— 原 `if (url)` 把它一并挡掉
      // ⇒ 节点 `onSuccess` 永不执行：节点空白 + 无报错 + 任务中心却记成功（实证 2026-09-26 文本节点）。
      // URL 只决定「本地化 / 落盘 / 写回字段」这些**子步骤**，不决定「要不要通知」。
      // 无 URL 时调用方收到 `''`：`writeBackResult` 内部已有 `if (key && url)` 守卫 ⇒ 天然 no-op，安全。
      settle?.(url, r, taskCtl, { localized });
      // ③ 落盘唯一出口（P0-C）：**契约内的无条件一步**，不是可选分支（ADR-0053 / 2026-09-20 深模块化）。
      //
      // 【为什么删掉原来的 `saveToTasks?: boolean`（默认 true）开关】
      //   它是**幽灵开关**：3 个调用方**零处显式传它**，全部吃默认 true ⇒ 从未被真正使用过。
      //   而它的存在本身制造困惑：写新生成路径的 AI 必须**猜**「我这个场景该不该传 false」——
      //   答案是「从来不需要」。可选 boolean 让「忘写」与「有意不落盘」长得一样（同 `timeoutMs` 旧形态）。
      //   删掉后 ⇒ 落盘成为**结构上无法跳过**的一步，新调用方**不可能**漏掉（比加闸更强，见手段优先级：
      //   结构上不可能 ＞ 类型层 ＞ 唯一入口 ＞ 对账测试 ＞ 文档留痕 ＞ 机器闸）。
      //
      // 【三态区分（TD-01-17）】落盘成功→用持久 URL；无需落盘（`skipped`，已是本地）→原样；
      //   **落盘失败→保留原 URL 降级 + 用户可见**（不再并入"成功"）。
      let finalUrl = url;
      if (url) {
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

    // 【停止等待 ≠ 失败 · 2026-09-21】生产者（relay）在等待预算用尽时只声明「我不再等」，并未拿到终态
    // —— 本处是**唯一判据点**，必须与真失败分叉：
    //  · 不 taskCtl.fail（任务行保持 running ⇒ pollTask 的候选集看得见它，续 attach 到后端终态）
    //  · 不 onFail / 不弹红（节点不该显示一个它并不掌握的失败）
    //  · 只留中性日志 + 一次中性提示（否则界面像「什么都没发生」，用户不知道前端已不再等）
    if (r?.pending) {
      const msg = r.error || '仍在生成中';
      // 【为什么这里**完全不碰任务行**】`TaskController.progress` 会无条件把该行写回
      // `status:'running'`（taskStore 的 progress 实现）+ schedule 一次落库 —— 而本分支可能
      // 出现在「恢复轮询刚把该行落成 completed」之后（同一后端真相、两条 attach 并发，窗口数秒：
      // 我方最后一次 poll 遇 transport 抖动折成 running，恢复侧同一时刻读到了 completed）
      // ⇒ 一句"顺手写进度"就会**把终态覆盖回 running 并落库**。
      // 终态原语之所以有 `progressCancels`（completeTask 取消未落进度写）就是为了防这件事；
      // 消费者不该在可能已经终态之后再去写行。停止等待这件事由下面的日志 + 中性提示承担。
      logger.info(logTag, 'contract·pending', { taskNodeId, type, error: msg, ...logCtx });
      toastInfo('等待超时：已停止等待，任务仍在后台进行，完成后会自动回填');
      return { ok: false, pending: true, error: msg };
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
        // 观测（仅排查）：本类错误"本可重试吗"。**非决策依据** —— 真重试判据在 api/httpClient.ts
        retryableObserved: getRetryableObserved(msg),
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
      // 观测（仅排查），同 contract·fail 分支：非决策依据
      retryableObserved: getRetryableObserved(e),
      ...logCtx,
    });
    showToast(msg, { type: 'error' });
    return { ok: false, error: msg };
  }
}
