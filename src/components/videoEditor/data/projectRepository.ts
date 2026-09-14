/**
 * 工程持久化 —— **`tracks` 的唯一写者**（`docs/120` C2.4 红线 / `docs/123` §一.7）。
 *
 * 键：`video-editor-project-{projectId}`（G0 已登记；前缀常量 `VIDEO_EDITOR_PROJECT_PREFIX`）。
 * 读入口：`core/normalizeProject`（**唯一**解析入口，它是唯一知道"什么算合法工程"的地方）。
 * 通道：`contentStore` 的 **KV 严格族**（`contentKvGetVersion` + `contentKvSetCas`）——
 *       CAS 保证多窗口并发写**不静默覆盖**（`docs/120` C2.7；机制复用 `118` 的现成形态，
 *       与 `projectStore` 的画布快照写盘同口径）。
 *
 * ── 与 `docs/123` §一.7「读原语 = contentGetAsync / contentSetAsync」的取舍 ──
 * §一.7 同一张表的「并发」行写的是「复用 `118` 的 CAS + 冲突可见，**不静默覆盖**」。
 * 两行冲突时取后者：`contentSetAsync` 是尽力而为族（可能降级写本地副本），
 * 用它写工程记录会让「别人刚改过」这一事实**消失**——正是 C2.7 要禁的静默覆盖。
 * 故读用 `contentGetAsync`（§一.7 指定）+ `contentKvGetVersion`（取 CAS 基线），写用 `contentKvSetCas`。
 *
 * ── 为什么不在这里做「落盘节流」（docs/120 C2.2 的 createDebouncedPersist）──
 * 节流会把 `saveProject` 变成"发射后不管"，于是**CAS 冲突的结果（409）没有返回路径**，
 * 「不静默覆盖」当场失效。节流属**调用方（editorStore）**的策略，且必须建立在能拿到
 * 冲突结果的前提下；本模块只提供**可等待、结果可判别**的持久化原语。
 */
import { HttpError } from '../../base/api/httpClient.ts';
import { VIDEO_EDITOR_PROJECT_PREFIX } from '../../base/core/contracts.ts';
import {
  contentGetAsync,
  contentKvGetVersion,
  contentKvSetCas,
} from '../../base/core/contentStore.ts';
import { logger } from '../../base/core/logger.ts';
import { normalizeProject } from '../core/normalize.ts';
import type { Project } from '../core/types.ts';

/** 工程记录在 KV 里的键（模板照 `canvas-state-v1-{projectId}`）。 */
export function projectStorageKey(projectId: string): string {
  return `${VIDEO_EDITOR_PROJECT_PREFIX}${projectId}`;
}

/**
 * 读结果。
 *
 * 「无工程」是一个**合法状态**（不是失败），且 `docs/120` C1 明确要求
 * 「读到更高版本按『无工程』处理，**不按缺字段渲染**」；故键不存在 / 版本过高 / 结构损坏
 * 都归到 `none`，但**带上原因**——原因给开发者（logger），用户侧只应看到「没有工程」。
 */
export type LoadProjectResult =
  { status: 'ok'; project: Project; version: number } | { status: 'none'; reason: string };

/**
 * 读工程 + 取 CAS 基线版本。
 *
 * 版本基线的取法与 `118`（`projectStore` 画布快照）同口径：**读内容前后各取一次版本**，
 * 不一致说明期间被别人改过 → 重读。宁多读一次，也不要拿一个"配错对"的
 * （内容, 版本）组合去写 —— 那会让后续 CAS 永远 409（假冲突）。
 */
export async function loadProject(projectId: string): Promise<LoadProjectResult> {
  const key = projectStorageKey(projectId);

  let version = await contentKvGetVersion(key);
  let raw = await contentGetAsync(key);
  // 最多重试 2 次（与 projectStore 的 ≤3 次同思路；这里读取方是单次加载，2 次足够）
  for (let attempt = 0; attempt < 2; attempt++) {
    const after = await contentKvGetVersion(key);
    if (after === version) break;
    version = after;
    raw = await contentGetAsync(key);
  }

  if (raw === undefined || raw === null) {
    return { status: 'none', reason: '该工程从未落盘（键不存在）' };
  }

  const normalized = normalizeProject(raw);
  if (normalized.status === 'reject') {
    logger.warn('视频剪辑器', '工程记录不可用 → 按「无工程」处理（不按缺字段渲染）', {
      projectId,
      reason: normalized.reason,
    });
    return { status: 'none', reason: normalized.reason };
  }
  return { status: 'ok', project: normalized.value, version };
}

/**
 * 写选项 —— **判别联合，使"无条件覆盖"不可能被忘记传参而误触发**。
 *
 * 想写就必须二选一：给出 `ifVersion`（正常路径，版本不符即 409 不落盘），
 * 或显式声明 `force`（备份导入 / 强制覆盖，服务端仍会自增版本）。
 */
export type SaveOptions = { force: true } | { ifVersion: number };

/** 写结果：`ok`（含新版本，可作下次 CAS 基线）或 `conflict`（**本次一个字节都没写**）。 */
export type SaveProjectResult =
  { status: 'ok'; version?: number } | { status: 'conflict'; expected: number };

/**
 * 写工程（唯一写者）。
 *
 * @returns `ok` = 已落盘（`version` 为新基线）；`conflict` = 服务端版本不符，**本次未落盘**，
 *          调用方应重载工程并向用户可见地提示冲突（绝不静默重试覆盖）。
 */
export async function saveProject(
  projectId: string,
  project: Project,
  opts: SaveOptions,
): Promise<SaveProjectResult> {
  const key = projectStorageKey(projectId);
  const casOpts = 'force' in opts ? {} : { ifVersion: opts.ifVersion };
  try {
    const res = await contentKvSetCas(key, project, casOpts);
    return { status: 'ok', version: res.version };
  } catch (e) {
    if (e instanceof HttpError && e.status === 409) {
      const expected = 'ifVersion' in opts ? opts.ifVersion : 0;
      logger.warn('视频剪辑器', '工程写入被服务端拒绝：版本冲突（一个字节未写）', {
        projectId,
        expected,
      });
      return { status: 'conflict', expected };
    }
    // 非 409（网络 / 5xx / 代码 bug）必须**原样炸开** —— 重分类会把代码 bug
    // 当成"可重试的网络错误"，也会静默吞掉真问题（7 步法 Step 4 禁重分类 / 禁静默吞）。
    throw e;
  }
}
