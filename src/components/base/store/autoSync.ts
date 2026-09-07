/**
 * 自动云同步（定时推送）调度器 —— 模块级单例，不依赖 React。
 *
 * 【机制决策记录 · 为什么这样做】（CLAUDE.md §决策记录铁律）
 *  - 没有 `running` 重入标志：调度用递归 setTimeout（在 finally 里排下一轮），单标签内天然
 *    不可能重入；跨标签并发由 CloudSyncEngine.isSyncing（fetch 层 throws）兜底。若加 running，
 *    一旦 askChoice 弹窗挂起会让标志永远 true → 自动同步永久死亡（旧稿 A-4）。
 *  - 没有 Leader 选举：本项目同浏览器多标签共享 localStorage（台账、数据同一份），配合
 *    cloudSync 的「内容一致即跳过」（decision.inSync 短路）——两标签同时 tick 都 pull →
 *    都发现一致 → 都跳过，零副作用；最坏情况多推一次 rev+2 → 下一轮一致跳过。Leader 选举
 *    反而引入「后台标签当家 → 全天不轮询」的新故障模式（旧稿 A-5）。
 *  - inSync 短路是地基：双机 rev 空转时若无「内容指纹一致即跳过」，会无限弹假冲突（A-1）。
 *  - 间隔固定 30 分钟（v1 常量）；隐私/网络抖动（cloud-unknown）静默跳过，不计退避。
 *
 * 【数据流】autoSync → uploadConfig/downloadConfig → CloudSyncEngine，单向；弹窗经 confirmStore 中转。
 * 每轮 = 1 次只读探测（pull_data）；仅判定「本地有改动且云端不新」才再发 1 次 push。
 */
import { getSetting } from './appSettings.ts';
import {
  uploadConfig,
  downloadConfig,
  isCloudSyncReady,
  type AutoConflictHandler,
} from './cloudSync.ts';
import { askChoice, askConfirm } from '../core/confirmStore.ts';
import { showToast } from '../core/toastStore.ts';
import { logger } from '../core/logger.ts';

/** 两轮自动同步之间隔（固定 30 分钟；间隔可调留二期，见 docs 方案 §8） */
const INTERVAL_MS = 30 * 60_000;
/** 首次启动延迟：让应用先初始化完（localTool/网关等），避免启动即同步空数据 */
const FIRST_DELAY_MS = 30_000;
/** 连续「稍后」次数达到该值 → 当日退避（次日 00:00 前不再弹） */
const CANCEL_BACKOFF_THRESHOLD = 3;

let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;
let cancelCount = 0;
/** 退避截止时刻（ms）：达到后跳过本轮。只存内存，刷新即清零（见 docs 方案 §8）。 */
let backoffUntil = 0;

/** 排下一轮（递归 setTimeout：单标签内天然串行，无需 running 重入标志） */
function scheduleNext(delay = INTERVAL_MS): void {
  if (timer != null) clearTimeout(timer);
  timer = setTimeout(() => {
    void runTick();
  }, delay);
}

async function runTick(): Promise<void> {
  try {
    // 每轮现读开关 → 改开关无需重启调度器（无 restartAutoSync 接线即无漏接 bug）
    if (!getSetting('autoSyncEnabled')) return;
    if (isBackedOff()) return; // 当日退避：用户连续「稍后」3 次
    if (!navigator.onLine) return; // 离线静默跳过
    if (!isCloudSyncReady()) return; // GAS 未配置 / 正有同步在跑

    // 不传 onProgress：自动同步全程静默，只在「下载完成/失败」弹一次 toast（旧稿 A-7a）
    const r = await uploadConfig(undefined, { onAutoConflict: autoResolveConflict });

    if (r.action === 'download-needed') {
      // 冲突处理器选择了「下载云端」→ 转 downloadConfig（复用手动链路的 askConfirm 门面）。
      const d = await downloadConfig(undefined, { onConfirm: (copy) => askConfirm(copy) });
      cancelCount = 0;
      // 绝不 reload：自动下载若照抄手动链路的 window.location.reload() 会冲掉正在画的画布（旧稿 A-7d）
      if (d.ok)
        showToast(`已下载云端配置（${d.count} 项），部分设置刷新后生效`, { type: 'success' });
      else if (!d.cancelled) showToast(d.error || '下载云端配置失败', { type: 'error' });
    } else if (!r.cancelled) {
      // 静默推送完成（含 skipped / 正常 push）→ 一次成功选择即清零退避计数
      cancelCount = 0;
    }
  } catch (e) {
    logger.warn('自动同步', '本轮异常（静默，不阻塞 UI）', {
      error: (e as Error)?.message || '未知',
    });
  } finally {
    scheduleNext();
  }
}

/**
 * 记录一次「用户选稍后」。达到阈值 → 触发当日退避（次日 00:00 前不再弹），并把计数清零。
 * @returns {boolean} true = 本次触发退避；false = 尚在阈值内
 */
export function registerCancel(): boolean {
  cancelCount += 1;
  if (cancelCount >= CANCEL_BACKOFF_THRESHOLD) {
    const t = new Date();
    t.setHours(24, 0, 0, 0); // 次日 00:00 重置退避
    backoffUntil = t.getTime();
    cancelCount = 0;
    return true;
  }
  return false;
}

/** 任一次「下载/上传」成功 → 清零退避计数（重新给足阈值次数） */
export function clearCancelCountOnSuccess(): void {
  cancelCount = 0;
}

/** 是否处在一轮遇到的当日退避区间内（测试读状态用） */
export function isBackedOff(now = Date.now()): boolean {
  return now < backoffUntil;
}

/**
 * 冲突三选一处理器（供 uploadConfig.onAutoConflict 调用）。
 * 返回 cancel 时区分「用户真的点了稍后」与「不该打扰」：后者不计退避。
 */
const autoResolveConflict: AutoConflictHandler = async (copy, decision) => {
  // 后台标签不打扰：不弹窗，下轮再说（不计退避 —— 用户没看见，不该算拒绝）
  if (typeof document !== 'undefined' && document.hidden) return 'cancel';
  // 网络抖动（cloud-unknown）：GAS 抽风不打扰（不计退避）——旧稿 A-7c
  if (decision.kind === 'cloud-unknown') return 'cancel';
  // 三选一：主按钮 confirmText 由 describeUploadConflict('auto') 置为「上传本地」（= 继续 push 覆盖云端），
  // 这里补 cancelText='稍后' + downloadText='下载云端' 驱动渲染端，三者文案互斥、语义清晰。
  const c = await askChoice({ ...copy, cancelText: '稍后', downloadText: '下载云端' });
  if (c === 'download') return 'download';
  if (c === 'confirm') return 'upload';
  // 用户点了「稍后」→ 计退避
  if (registerCancel()) {
    logger.info('自动同步', `连续${CANCEL_BACKOFF_THRESHOLD}次选稍后，当日不再自动弹`, {});
  }
  return 'cancel';
};

/** 启动自动同步调度（幂等：重复调用只排一轮；首轮延迟 30s）。App 根组件驻留期调用。 */
export function startAutoSync(): void {
  if (started) return;
  started = true;
  scheduleNext(FIRST_DELAY_MS);
}

/** 停止自动同步调度（清定时器 + 复位标志与退避计数，便于测试隔离/重启）。App 根组件卸载时调用。 */
export function stopAutoSync(): void {
  if (timer != null) clearTimeout(timer);
  timer = null;
  started = false;
  cancelCount = 0;
  backoffUntil = 0;
}
