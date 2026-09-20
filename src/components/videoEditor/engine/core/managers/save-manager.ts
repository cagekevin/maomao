import { videoEditorLogger } from '@/components/videoEditor/lib/videoEditorLogger';
import type { EditorCore } from '@/components/videoEditor/engine/core';
import type { SaveFailure, SaveOutcome } from '@/components/videoEditor/types/project';
import { videoEditorToast } from '@/components/videoEditor/lib/videoEditorToast';
// 更新(2026-09-14)：agent-store 已随 AI 域删除。

type SaveManagerOptions = {
  debounceMs?: number;
};

/**
 * 自动保存 / 显式落盘的**唯一拥有者**。
 *
 * 【为什么成对存在 `inflight` 与判别返回（TD-22-33 收口）】原 `flush()` 直接调 `saveNow()`，
 * 而 `saveNow` 开头 `if (this.isSaving) return` —— 保存进行中调用 flush 会**静默空转**：
 * `await flush()` 返回时最后的变更仍在 800ms 防抖队列里（调用方拿到**假信号**）。
 * 叠加 `ProjectManager.saveCurrentProject` 当时把失败吞掉 → `await flush()` 既不代表
 * 「执行过」也不代表「成功过」。退出协议 / 切工程都靠它 → **退出前最后一次改动丢失**。
 * 现在：`flush()` 先等在途结束、再真正保存一次，并返回**真实结果**；失败由本类给用户可见提示。
 */
export class SaveManager {
  private debounceMs: number;
  private isPaused = false;
  private isSaving = false;
  private hasPendingSave = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribeHandlers: Array<() => void> = [];

  /** 在途保存（`null` = 空闲）。`flush()` 先 await 它，消除「排队一下就返回」的假信号。 */
  private inflight: Promise<SaveOutcome> | null = null;

  /** 连续失败只提示一次（防抖重排不会刷屏）；出现一次成功保存即复位。 */
  private failureReported = false;

  constructor(
    private editor: EditorCore,
    { debounceMs = 800 }: SaveManagerOptions = {},
  ) {
    this.debounceMs = debounceMs;
  }

  start(): void {
    if (this.unsubscribeHandlers.length > 0) {
      return;
    }

    this.unsubscribeHandlers = [
      this.editor.scenes.subscribe(() => {
        this.markDirty();
      }),
      this.editor.timeline.subscribe(() => {
        this.markDirty();
      }),
      // 更新(2026-09-14)：原订阅 agent-store 的 messages 变化以标记 dirty；
      // agent-store 随 AI 域删除，该订阅一并移除（docs/130-cutia搬迁计划书）。
    ];
  }

  stop(): void {
    for (const unsubscribe of this.unsubscribeHandlers) {
      unsubscribe();
    }
    this.unsubscribeHandlers = [];
    this.clearTimer();
  }

  pause(): void {
    this.isPaused = true;
    this.clearTimer();
  }

  resume(): void {
    this.isPaused = false;
    if (this.hasPendingSave) {
      this.queueSave();
    }
  }

  markDirty({ force = false }: { force?: boolean } = {}): void {
    if (this.isPaused && !force) {
      return;
    }
    this.hasPendingSave = true;
    this.queueSave();
  }

  /**
   * 强制立即落盘 —— **返回真实结果**。
   *
   * 语义 = 「确保当前已标记的变更都写进存储」：
   *   ① 先等在途那次保存结束（它可能不含这些变更）；
   *   ② 再真正保存一次。
   * 原实现只做 ②，且在 `isSaving` 时连 ② 都跳过 → `await flush()` ≠ 已落盘。
   */
  async flush(): Promise<SaveOutcome> {
    this.hasPendingSave = true;
    while (this.inflight) {
      await this.inflight;
    }
    return this.runSave();
  }

  getIsDirty(): boolean {
    return this.hasPendingSave || this.isSaving;
  }

  private queueSave(): void {
    if (this.isSaving) return;
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => {
      // 自动保存路径**无调用方等待**（对比 flush）；`performSave` 把一切失败转成判别 + 可见提示，
      // 且自身兜住协议外异常 → 该 promise 不 reject，`void` 成立。
      void this.runSave();
    }, this.debounceMs);
  }

  /** 单飞：同一时刻至多一次在途保存；在途时返回同一个 promise（调用方等到的就是这次的结果）。 */
  private runSave(): Promise<SaveOutcome> {
    if (this.inflight) return this.inflight;

    const promise = this.performSave().finally(() => {
      if (this.inflight === promise) {
        this.inflight = null;
      }
    });
    this.inflight = promise;
    return promise;
  }

  private async performSave(): Promise<SaveOutcome> {
    // 前置条件不满足 = **保存没有执行**：必须如实回答（原实现是静默 `return`，见 TD-22-33）。
    if (!this.hasPendingSave) return { ok: true };
    if (this.isPaused) return { ok: false, reason: 'paused' };
    if (!this.editor.project.getActiveOrNull()) return { ok: false, reason: 'no-project' };
    if (this.editor.project.getIsLoading()) return { ok: false, reason: 'loading' };
    // 【2026-09-16 · TD-02-35 已删】原「迁移进行中不保存」守卫（`reason:'migrating'`）——
    // 迁移器整层已移除 ⇒ 该分支恒不成立。留着就是**死守卫**（守卫数量 = 地基的体温计）。

    this.isSaving = true;
    this.hasPendingSave = false;
    this.clearTimer();

    let outcome: SaveOutcome;
    try {
      outcome = await this.editor.project.saveCurrentProject();
    } catch (error) {
      // saveCurrentProject 的契约是「不抛、返回判别」；此处兜住**协议外**异常，
      // 保证本 promise 永不 reject（`queueSave` 的 `void` 依赖这一点）。
      videoEditorLogger.error('Save failed with an unexpected error:', error);
      outcome = {
        ok: false,
        reason: 'save-failed',
        message: error instanceof Error ? error.message : '保存失败',
      };
    } finally {
      this.isSaving = false;
    }

    if (!outcome.ok) {
      // 失败：**保持 dirty**（`beforeunload` 仍拦得住关闭）。
      // 原实现把 hasPendingSave 清成 false 且不再置回 —— 等于宣告「脏数据已保存」，
      // 这正是 saveCurrentProject 吞掉失败后的直接后果（TD-22-33）。
      this.hasPendingSave = true;
      this.reportSaveFailure(outcome);
      return outcome;
    }

    this.failureReported = false;
    if (this.hasPendingSave) {
      // 保存期间又产生了新变更 → 再排一次。
      this.queueSave();
    }
    return outcome;
  }

  /**
   * 保存失败的**用户可见**提示（唯一读者 = 本类，因为它是自动保存的唯一发起者）。
   * 连续失败只提示一次，直到出现一次成功保存才复位 —— 否则 800ms 防抖重排会刷屏。
   */
  private reportSaveFailure(outcome: SaveFailure): void {
    if (this.failureReported) return;
    this.failureReported = true;

    if (outcome.reason === 'conflict') {
      videoEditorToast.error('作品已在别处被修改', {
        description: '本次改动未保存。请刷新后重试，避免覆盖他人修改。',
        duration: 8000,
      });
      return;
    }
    videoEditorToast.error('作品保存失败', {
      description: outcome.message ?? '本地服务可能未启动，改动未能落盘。',
      duration: 8000,
    });
  }

  private clearTimer(): void {
    if (!this.saveTimer) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = null;
  }
}
