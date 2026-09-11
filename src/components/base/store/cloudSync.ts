/**
 * 云端全量同步适配层（对接标准同步引擎 CloudSyncEngine）。
 *
 * 【设计意图】把「数据同步到云端」的载体隔离在这里，TopNav 只调 upload/download，
 * 不关心云端到底是什么。
 *  - 载体：CloudSyncEngine（Google Apps Script，见下方引擎代码）。
 *  - 之前是 localStorage 模拟假数据；现直接替换为真实云端收发（引擎代码原样保留）。
 *
 * 【同步内容】全量配置/用户数据同步（用户确认体积小，全部进云端）：
 *  - localStorage 用户数据/配置：由 contracts.ts STORAGE_KEYS 权威登记生成
 *    （getLocalKeys() 减去下方 SYNC_EXCLUDE 不同步清单；项目、应用设置、自定义 Skill、预设、节点偏好、账号环境等）
 *  - API 配置（providers）：走 localTool /api/providers（独立于 localStorage）
 *
 * 【不同步】画布/会话性/本机临时数据：
 *  - 所有项目画布快照（canvas-state-v1-*）：画布内容属业务数据，仅留在本机 localTool，不同步。
 *  - 项目列表（projects）：有独立跨端真通道（projectStore → localTool /api/projects backend + KV 画布快照），
 *    不进云同步（[F-云B] 2026-09-11：再经 GAS 云同步 = 造第二真相源，SSOT 裂痕）。
 *  - AI 对话历史（agent_conversations）与当前对话 id（agent_active_conversation_id）：含隐私。
 *  - lastOpenedProject（上次打开哪个项目）：本机会话偏好。
 *  - yimao_asset_library（素材库）：存的是本地 URL 引用（http://127.0.0.1:18080/files/...），
 *    指向本机 localTool 磁盘文件，跨设备无意义，不同步。
 *  - agent_draft / mutiwindow-clipboard：临时数据（输入草稿 / 跨窗口剪贴板），不同步。
 *
 * ⚠️ 含用户数据（账号环境/API key 等），同步到云端需注意保密。
 */
import { getLocalKeys, STORAGE_KEYS } from '../core/contracts.ts';
import { providerApi } from '../api/localToolApi.ts';
import { contentGet, contentSet, contentGetAsync, contentSetAsync } from '../core/contentStore.ts';
import { logger } from '../core/logger.ts';
import { CLOUD_SYNC_GAS_URL } from '../core/config.ts';
import { stableStringify, contentFingerprint, formatTime } from '../core/utils.ts';
// [TD-13] 下载云端后重水合 store 内存态（rehydrateStoresAfterCloudPull，原独立模块 cloudRehydrate.ts 已于 2026-09-11 并入本文件）。
// 循环依赖安全：accountsStore/appSettings/providerStore 均不 import 本文件（仅 App/autoSync import 本文件），故此处 import 它们无环。
import { reloadAppSettings } from './appSettings.ts';
import { reloadAccounts } from './accountsStore.ts';
import { reloadProviders } from './providerStore.ts';

/* ======================================================================
 * 【标准同步引擎】原样保留，勿改动内部通讯逻辑。
 * 终点 URL 已移入 config.ts 的 CLOUD_SYNC_GAS_URL（P2-H 透明化，便于替换/审计）。
 * ====================================================================== */
const CloudSyncEngine = {
  config: {
    gasUrl: CLOUD_SYNC_GAS_URL,
  },
  isSyncing: false,

  async callGateway(action, data = null) {
    if (!this.config.gasUrl || this.config.gasUrl.includes('填入'))
      throw new Error('未配置有效的 GAS URL');
    if (this.isSyncing) throw new Error('系统正在通信中，请勿频繁操作');

    this.isSyncing = true;
    try {
      const res = await fetch(this.config.gasUrl, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: action, data: data }),
      });

      const text = await res.text();
      if (text.includes('<html')) {
        throw new Error('权限拦截，请确保 GAS 设为了【所有人】访问');
      }

      const jsonRes = JSON.parse(text);
      if (jsonRes.error) throw new Error(jsonRes.error);
      return jsonRes;
    } catch (err) {
      // [F-云C] 保留原始错误根因：直接上浮原始 Error（保留类型/stack/network），
      // 仅当非 Error（如 throw 字符串）时兜底包一层并附 cause；不再 throw new Error(err.message) 压平。
      if (err instanceof Error) throw err;
      throw new Error(`网关异常：${String(err)}`, { cause: err });
    } finally {
      this.isSyncing = false;
    }
  },

  async push(dataObj, onProgress, onSuccess, onError) {
    if (onProgress) onProgress('正在同步至云端...');
    try {
      const res = await this.callGateway('push_data', dataObj);
      if (onSuccess) onSuccess(res.msg || '同步成功');
      return true;
    } catch (e) {
      if (onError) onError(e.message);
      return false;
    }
  },

  async pull(onProgress, onSuccess, onError) {
    if (onProgress) onProgress('正在从云端读取数据...');
    try {
      const res = await this.callGateway('pull_data');
      if (onSuccess) onSuccess('拉取成功');
      return res.data;
    } catch (e) {
      if (onError) onError(e.message);
      return null;
    }
  },
};
/* ===================== 引擎代码结束（勿改动以上内容） ===================== */

/* ======================================================================
 * 【防覆盖保护】版本体系 + 云端包解析 + 冲突检测 + 本地台账
 *
 * 背景：此前 upload/download 都是「谁后点谁赢」的直接覆盖。现在改为——
 *  上传前：先读云端版本，云端比我新就先问用户；
 *  下载前：先算本地哪些项会受影响，有冲突就列出清单先问用户。
 * 冲突判定全部收敛在本区块（纯函数，可单测），是否弹窗由调用方（App）决定。
 *
 * 【版本依据：为什么不是云端已有的 version:5】
 *  - version 是**结构版本号**（包格式版本），所有包恒为 5，判断不了数据新旧。
 *  - rev 是**数据修订号**：push 前先 pull 云端 rev → 新包 rev = 云端 rev + 1，单调递增。
 *    与时钟无关——updatedAt 是「上传者本机时钟」写的，跨设备可能偏差，故只用于给人看。
 *  - 先例：画布快照的 `canvas-state-v1-{projectId}_version`（contracts.ts）就是同款单调版本号。
 * ====================================================================== */

/** 本地同步台账存储键（已登记 contracts.ts；不进云端，见 SYNC_EXCLUDE） */
const LEDGER_KEY = 'yimao_cloud_sync_ledger';
/**
 * 云端包 data 内的元字段键（双写）。
 *
 * 背景：GAS 是第三方黑盒，必须假设两种回包形态都能工作——
 *   形态 A（完整包）：拿到外层 { type, version, rev, updatedAt, data } → 元字段直接取；
 *   形态 B（只剩 data）：外层元字段已丢 → 靠 data.__meta 兜底取回 rev/updatedAt。
 *
 * 【实测结论（tests/unit/cloudSync.test.ts 端到端用例）】走的是形态 A：
 *   CloudSyncEngine.pull 返回的是 `res.data`，而 push 上传的是整个包对象，
 *   即 GAS 回包形如 `{ data: <完整同步包> }` → 外层元字段（含 rev）可原样取回。
 *   __meta 是 GAS 行为变更时的兜底，成本仅一个键，予以保留。
 *
 * 两种形态由 normalizeCloudPayload 统一归一，其余代码只见 CloudSnapshot，不感知差异。
 */
const CLOUD_META_KEY = '__meta';

/** 本地同步台账：记住「上次同步到云端哪一版 + 当时本地数据长什么样」 */
export interface SyncLedger {
  /** 上次同步时云端的修订号 */
  rev: number;
  /** 上次成功同步的时刻 */
  syncedAt: number;
  /** 上次同步时本地数据的内容指纹（判断「本地改没改过」的唯一依据） */
  localHash: string;
}

/** 云端快照：normalizeCloudPayload 的产物，屏蔽 GAS 两种回包形态的差异 */
export interface CloudSnapshot {
  /** 云端数据修订号（0 = 云端无版本信息，如旧版包） */
  rev: number;
  /** 云端包更新时间（0 = 未知） */
  updatedAt: number;
  /** 实际数据（已剔除 __meta 元字段） */
  data: Record<string, unknown>;
  /** 云端包是否带外层元字段层（false = GAS 只回了裸 data，rev/updatedAt 取自 __meta） */
  hasMeta: boolean;
}

/** 上传冲突判定结果 */
export type UploadConflictKind =
  | 'none' /** 无需提示：云端为空 / 云端不比我新 / 首次同步无基线 */
  | 'cloud-newer' /** 云端比我新，但我本地没改过 */
  | 'both-changed' /** 云端比我新，且我本地也改过（真冲突） */
  | 'cloud-unknown'; /** 读不到云端版本，无法判断（网络/网关失败）→ 交用户决定 */

export interface UploadDecision {
  kind: UploadConflictKind;
  cloudRev: number;
  cloudUpdatedAt: number;
  /** 上次同步的云端修订号（null = 无台账，视为首次同步） */
  ledgerRev: number | null;
  /** 本地自上次同步后是否有改动 */
  localDirty: boolean;
  /** 云端内容指纹 == 本地内容指纹 → 双方数据完全一致（与 rev 无关）：不推、不弹 */
  inSync: boolean;
}

/** 单条键级差异 */
export interface SyncKeyDiff {
  key: string;
  /** 面向用户的可读名（见 SYNC_LABELS） */
  label: string;
}

/** 本地 vs 云端的差异清单 */
export interface SyncDiff {
  /** 双方都有且值不同 → 本地将被云端覆盖（核心告警项） */
  conflicts: SyncKeyDiff[];
  /** 仅云端有 → 将新增到本地（不算覆盖，不告警） */
  cloudOnly: SyncKeyDiff[];
  /** 仅本地有 → 云端没有，本地保留（不告警） */
  localOnly: SyncKeyDiff[];
}

/** 确认弹窗文案（交给 confirmStore.askConfirm 直接消费） */
export interface ConfirmCopy {
  title: string;
  message?: string;
  /** 受影响条目清单（覆盖类操作必须让用户看见「到底动了哪些」） */
  items?: string[];
  confirmText: string;
  danger: boolean;
}

/**
 * 上传冲突确认回调。返回 false = 用户取消 → 中止上传。
 * 由调用方（App）实现为 `copy => askConfirm(copy)`：cloudSync 只负责判定与出文案，
 * 不反向依赖任何 UI 模块（数据单向：UI → cloudSync → 引擎）。
 */
export type UploadConfirmHandler = (
  copy: ConfirmCopy,
  decision: UploadDecision,
) => Promise<boolean>;
/** 下载覆盖确认回调。返回 false = 用户取消 → 不写回任何数据。 */
export type DownloadConfirmHandler = (copy: ConfirmCopy, diff: SyncDiff) => Promise<boolean>;

/** uploadConfig 的返回结构（显式声明，避免推断联合在调用方分支收窄时塌缩成 never）。 */
export interface UploadResult {
  ok: boolean;
  count: number;
  /** 手动/自动链路冲突取消（未 push）；自动链路「稍后」亦为 cancelled */
  cancelled?: boolean;
  error?: string;
  /** 自动链路冲突选择「下载云端」→ 本函数未 push，交调用方转 downloadConfig */
  action?: 'download-needed';
  /** 内容一致零副作用跳过（未 push、rev 未变） */
  skipped?: boolean;
  /** [F-云A] 部分域因读取失败未纳入上传（providers/accounts 人类可读名）；调用方必须告警，不得冒充完整上传 */
  partial?: { skipped: string[] };
}

/** 下载配置结果（显式声明，调用方据此分支收敛成败与告警）。 */
export interface DownloadResult {
  ok: boolean;
  count: number;
  hasCloud: boolean;
  /** 用户取消覆盖 → 本地未被改写 */
  cancelled?: boolean;
  error?: string;
  /** [F-云A] 部分域写回失败（恢复了本地 LS，但 providers/accounts 等网络/KV 域失败）→ 调用方必须告警 */
  partial?: { failed: string[] };
}

/** 自动同步冲突三选一的用户抉择。 */
export type ConflictResolution = 'upload' | 'download' | 'cancel';
/**
 * 自动同步冲突处理回调（AutoConflictHandler）。
 * 与 UploadConfirmHandler（二态 boolean）不同，自动链路需要三选一：
 *  'upload'   → 用户选「上传本地」→ uploadConfig 继续 push；
 *  'download' → 用户选「下载云端」→ uploadConfig 返回 action:'download-needed'，由调用方转 downloadConfig；
 *  'cancel'   → 用户选「稍后」/后台不打扰 → 中止本轮 push。
 */
export type AutoConflictHandler = (
  copy: ConfirmCopy,
  decision: UploadDecision,
) => Promise<ConflictResolution>;

/** 修订号：非法/缺省 → 0（表示「云端无版本信息」） */
function toRev(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** 时间戳：非法/缺省 → 0（表示「未知时间」） */
function toTs(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * 云端回包 → 归一化快照（唯一解析入口）。
 * 为什么必须收口：GAS 回包形态未知（见 CLOUD_META_KEY 注释），若各调用点就地 `raw.data`
 * 或 `raw`，一旦形态是另一种就会静默读到 undefined / 把元字段当数据，属于典型脏数据源头。
 * @param raw CloudSyncEngine.pull 的原始返回
 * @returns 归一化快照；无有效数据（null/空对象）→ null，代表「云端无数据」
 */
export function normalizeCloudPayload(raw: unknown): CloudSnapshot | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const rawData = obj.data;
  // 形态 A：完整包（外层元字段 + data）
  if (rawData && typeof rawData === 'object' && !Array.isArray(rawData)) {
    const data = { ...(rawData as Record<string, unknown>) };
    delete data[CLOUD_META_KEY];
    return { rev: toRev(obj.rev), updatedAt: toTs(obj.updatedAt), data, hasMeta: true };
  }
  // 形态 B：GAS 只回了裸 data 内容 → 元字段从 data.__meta 兜底取回
  const data = { ...obj };
  const meta = data[CLOUD_META_KEY];
  delete data[CLOUD_META_KEY];
  const m = (meta && typeof meta === 'object' ? meta : {}) as Record<string, unknown>;
  return { rev: toRev(m.rev), updatedAt: toTs(m.updatedAt), data, hasMeta: false };
}

/** 读本地台账（无 / 结构损坏 → null，等价于「首次同步」） */
function readLedger(): SyncLedger | null {
  const v = readLS(LEDGER_KEY);
  if (!v || typeof v !== 'object') return null;
  const l = v as Partial<SyncLedger>;
  if (typeof l.localHash !== 'string' || !l.localHash) return null;
  return {
    rev: toRev(l.rev),
    syncedAt: toTs(l.syncedAt),
    localHash: l.localHash,
  };
}

/** 写本地台账（上传/下载成功后调用，把「刚同步的这一版」记为新基线） */
function writeLedger(next: SyncLedger): void {
  writeLS(LEDGER_KEY, next);
}

/**
 * 上传前的冲突判定（纯函数）。
 * @param input.cloudReadable 云端能否读到（false → 'cloud-unknown'）
 * @param input.cloudExists  云端是否有数据（false → 'none'，首次上传）
 * @param input.cloudRev     云端修订号
 * @param input.ledger       本地台账（null → 无台账；云端有数据则 → 'cloud-newer' 必须问一次，见 A-2）
 * @param input.localHash    当前本地数据指纹
 * @param input.cloudHash    云端内容指纹（'' = 云端空/读不到；与 localHash 同由 contentFingerprint 产出，可直接比）
 *       可选 → 老调用方（含现有单测）不传时行为与旧版完全一致（inSync=false），增量安全。
 */
export function decideUpload(input: {
  cloudReadable: boolean;
  cloudExists: boolean;
  cloudRev: number;
  cloudUpdatedAt: number;
  ledger: SyncLedger | null;
  localHash: string;
  cloudHash?: string;
}): UploadDecision {
  // 无台账 → 无从判断本地是否改过，保守视为「脏」（宁可多问一次，不可静默覆盖）
  const localDirty = !input.ledger || input.ledger.localHash !== input.localHash;
  // 【A-1】内容维度：指纹一致即视为「完全一致」（双机 rev 空转时内容相同 → 不打扰、不推）
  const inSync = !!input.cloudHash && input.cloudHash === input.localHash;
  const base: UploadDecision = {
    kind: 'none',
    cloudRev: input.cloudRev,
    cloudUpdatedAt: input.cloudUpdatedAt,
    ledgerRev: input.ledger?.rev ?? null,
    localDirty,
    inSync,
  };
  // 读不到云端：不硬阻断（否则一次网络抖动就无法上传），但把风险告知用户由其决定
  if (!input.cloudReadable) return { ...base, kind: 'cloud-unknown' };
  // 【A-1】内容完全一致 → 无论 rev 谁大都不打扰、不推（否则双机 rev 空转会无限弹假冲突）
  if (inSync) return base;
  // 云端空 → 首次上传，静默
  if (!input.cloudExists) return base;
  // 【A-2】云端有数据但本机无台账 → 关系未知，必须问一次，不可盲推覆盖
  if (!input.ledger) return { ...base, kind: 'cloud-newer' };
  // 云端 rev 更大 = 云端自上次同步后被别人改过。
  // 注：云端 rev 倒退（被无 rev 的旧版客户端覆盖成 0）时不告警——此时本地更新，上传是正确方向。
  if (input.cloudRev > input.ledger.rev) {
    return { ...base, kind: localDirty ? 'both-changed' : 'cloud-newer' };
  }
  return base;
}

/**
 * 逐键比对本地与云端，得出「哪些会被覆盖」（纯函数）。
 * 比对走 stableStringify（键序无关），避免键序不同就误报冲突。
 * @param cloudData 云端数据（应已剔除 __meta）
 * @param localData 本地当前数据
 */
export function diffWithLocal(
  cloudData: Record<string, unknown>,
  localData: Record<string, unknown>,
): SyncDiff {
  const conflicts: SyncKeyDiff[] = [];
  const cloudOnly: SyncKeyDiff[] = [];
  const localOnly: SyncKeyDiff[] = [];
  const keys = new Set([...Object.keys(localData), ...Object.keys(cloudData)]);
  for (const key of keys) {
    if (key === CLOUD_META_KEY) continue; // 元字段不是数据项
    const lv = localData[key];
    const cv = cloudData[key];
    const hasL = lv !== undefined && lv !== null;
    const hasC = cv !== undefined && cv !== null;
    if (hasL && hasC) {
      if (stableStringify(lv) !== stableStringify(cv))
        conflicts.push({ key, label: syncLabel(key) });
    } else if (hasC) {
      cloudOnly.push({ key, label: syncLabel(key) });
    } else if (hasL) {
      localOnly.push({ key, label: syncLabel(key) });
    }
  }
  return { conflicts, cloudOnly, localOnly };
}

/**
 * 上传冲突 → 弹窗文案（含云端更新时间，让用户判断「该上传还是该先下载」）。
 * @param mode 'manual' = TopNav 手动链路的二态文案（维持现状一字不改）；
 *             'auto'   = 自动同步链路的文案：标题更精炼（按钮由 autoSync 补 downloadText/cancelText 三选一）。
 * 三态（auto）都 danger:true，突出覆盖/下载都是不可逆的动作。
 */
export function describeUploadConflict(
  d: UploadDecision,
  mode: 'manual' | 'auto' = 'manual',
): ConfirmCopy {
  const time = d.cloudUpdatedAt ? formatTime(d.cloudUpdatedAt) : '未知时间';
  if (mode === 'auto') {
    if (d.kind === 'both-changed') {
      return {
        title: '云端和本地都有更新',
        message: `云端内容更新于 ${time}，你本地在同步之后也改过。点「上传本地」会用本地内容覆盖云端的新内容。`,
        confirmText: '上传本地',
        danger: true,
      };
    }
    if (d.kind === 'cloud-newer') {
      return {
        title: '云端有更新',
        message: `云端内容更新于 ${time}，而你本地没有可上传的改动。点「上传本地」会用本地内容覆盖云端的更新。`,
        confirmText: '上传本地',
        danger: true,
      };
    }
    // cloud-unknown
    return {
      title: '无法确认云端是否有更新',
      message: '读取云端版本失败，点「上传本地」有可能覆盖云端的新内容。',
      confirmText: '上传本地',
      danger: true,
    };
  }
  // ---- manual：与改造前逐字一致（TopNav 手动链路零回归） ----
  if (d.kind === 'both-changed') {
    return {
      title: '云端和本地都有更新，上传会覆盖云端',
      message: `云端内容更新于 ${time}（比你上次同步的新），你本地在同步之后也改过。继续上传会用本地内容覆盖云端的新内容。`,
      confirmText: '仍要上传覆盖',
      danger: true,
    };
  }
  if (d.kind === 'cloud-newer') {
    return {
      title: '云端内容比你本地新，确定要覆盖吗？',
      message: `云端内容更新于 ${time}，而你从上次同步至今本地没有改动。这种情况通常应该点「从云端拉取」，而不是上传。`,
      confirmText: '仍要上传覆盖',
      danger: true,
    };
  }
  return {
    title: '无法确认云端是否有更新',
    message: '读取云端版本失败，继续上传有可能覆盖云端的新内容。',
    confirmText: '仍要上传',
    danger: true,
  };
}

/** 下载冲突 → 弹窗文案（列出将被覆盖的条目）；无冲突返回 null（静默下载） */
export function describeDownloadConflict(diff: SyncDiff): ConfirmCopy | null {
  if (diff.conflicts.length === 0) return null;
  return {
    title: `本地有 ${diff.conflicts.length} 项与云端不一致，下载后将被覆盖`,
    message: '以下内容的本地版本与云端不同，下载后一律以云端为准（本地改动会丢失）：',
    items: diff.conflicts.map((c) => c.label),
    confirmText: '覆盖并下载',
    danger: true,
  };
}
/* ===================== 防覆盖保护结束 ===================== */

/** 读取本地某个 key（容错，contentGet 已内置 JSON 解析） */
function readLS(k) {
  try {
    const v = contentGet(k);
    if (v === null || v === undefined) return undefined;
    return v;
  } catch {
    return undefined;
  }
}
/** 写本地某个 key（contentSet 已内置 JSON 序列化；失败上浮由 restoreLocal 记录，不再静默吞） */
function writeLS(k, v) {
  contentSet(k, v);
}

/** 上传云端的包结构（version 是结构版本号，rev 才是数据修订号） */
export interface CloudPayload {
  type: 'cloud_config';
  /** 结构版本号：变更包结构时递增，与数据新旧无关 */
  version: number;
  /** 数据修订号：单调递增，判断云/地新旧（见【防覆盖保护】） */
  rev: number;
  updatedAt: number;
  data: Record<string, unknown>;
}

/**
 * 收集本地全部要同步的数据（纯数据，不含包元字段）。
 * 单独抽出的理由：上传时除「打包」外，还要拿这份数据算内容指纹、并与云端做逐键冲突比对；
 * 若直接复用打包函数再剥元字段，容易漏剥（典型脏数据源头）。这里让「取数据」成为唯一入口。
 * @returns { ls, skipped } ls=纯数据；skipped=读取失败故本次未纳入的域（providers/accounts），
 *   调用方必须如实上抛，绝不以"完整上传"假象掩盖（[F-云A] 错误真实透传）。
 */
async function collectLocalData(): Promise<{ ls: Record<string, unknown>; skipped: string[] }> {
  const ls: Record<string, unknown> = {};
  const skipped: string[] = [];
  // 1) localStorage 全量用户数据/配置：复用 backupStore 权威清单，按领域开关过滤
  for (const k of LS_KEYS) {
    if (!domainSwitchEnabled(k)) continue; // 领域关闭（如 projects）→ 该键不进云端
    const v = readLS(k);
    if (v !== undefined) ls[k] = v;
  }
  // 2) API 配置：从 localTool /api/providers 读（key 已脱敏，同步配置结构）
  try {
    const { data: pd } = await providerApi.getProviders();
    const providers = Array.isArray(pd?.providers) ? pd.providers : null;
    if (Array.isArray(providers) && providers.length) ls.providers = providers;
  } catch (e) {
    // [F-云A] 读取失败=未纳入本次上传，记录并上浮，不再静默当"无 providers"
    skipped.push('providers');
    logger.warn('同步', '[上传] providers 读取失败，本次不上传 API 配置', {
      error: e?.message || '未知',
    });
  }
  // 3) 账号环境：走 KV（backend:'kv'，不在 LS_KEYS），领域开关开则专门收集上传
  try {
    if (SYNC_DOMAIN_SWITCHES.account) {
      const acc = await contentGetAsync('yimao_accounts');
      if (Array.isArray(acc) && acc.length) ls.accounts = acc;
    }
  } catch (e) {
    skipped.push('accounts');
    logger.warn('同步', '[上传] 账号读取失败，本次不上传账号', { error: e?.message || '未知' });
  }

  return { ls, skipped };
}

/**
 * 本地数据 → 云端包（补全版本元字段）。
 * @param ls collectLocalData() 产出的纯数据
 * @param rev 本次包的修订号，由调用方按「云端当前 rev + 1」传入（单调递增）
 * @note data 内双写 __meta：兜底 GAS 只保存 data 内容的形态（见 CLOUD_META_KEY 注释）。
 *       解析端 normalizeCloudPayload 会把它剔除，restoreLocal 只写 LS_KEYS 白名单也天然跳过它。
 */
function buildCloudPayload(ls: Record<string, unknown>, rev: number): CloudPayload {
  const updatedAt = Date.now();
  return {
    type: 'cloud_config',
    version: 5,
    rev,
    updatedAt,
    data: { ...ls, [CLOUD_META_KEY]: { rev, updatedAt, version: 5 } },
  };
}

/**
 * 把云端 JSON 覆盖写回本地。
 * @returns { written, failed } written=成功写回条目数；failed=写回失败的域（人类可读名）。
 *   失败域必须如实上抛，绝不以"ok:true"掩盖（[F-云A] 错误真实透传）。
 */
async function restoreLocal(cloud): Promise<{ written: number; failed: string[] }> {
  const ls = cloud?.data;
  const failed: string[] = [];
  if (!ls || typeof ls !== 'object') return { written: 0, failed };
  let written = 0;
  // 1) localStorage 全量覆盖（只写我们备份清单里、且领域开关开启的键，避免误写未知/关闭领域键）
  for (const k of LS_KEYS) {
    if (ls[k] !== undefined && domainSwitchEnabled(k)) {
      try {
        writeLS(k, ls[k]);
        written++;
      } catch (e) {
        failed.push(syncLabel(k));
        logger.warn('同步', '[下载] 本地键写回失败', { key: k, error: e?.message || '未知' });
      }
    }
  }
  // 2) API 配置：全量保存到 localTool（config/providers/<id>.json 即唯一真源）
  if (Array.isArray(ls.providers)) {
    try {
      await providerApi.saveProviders(ls.providers);
      written++;
    } catch (e) {
      failed.push(syncLabel('providers'));
      logger.warn('同步', '[下载] providers 写回失败', { error: e?.message || '未知' });
    }
  }
  // 4) 账号环境：走 KV（backend:'kv'），领域开关开则恢复写回 KV
  try {
    if (SYNC_DOMAIN_SWITCHES.account && Array.isArray(ls.accounts)) {
      await contentSetAsync('yimao_accounts', ls.accounts);
      written++;
    }
  } catch (e) {
    failed.push(syncLabel('accounts'));
    logger.warn('同步', '[下载] 账号写入失败', { error: e?.message || '未知' });
  }
  return { written, failed };
}

/**
 * 上传云端：收集本地全量配置/用户数据 → 判冲突（必要时先问用户）→ CloudSyncEngine.push 同步到云端。
 *
 * 【与旧版的行为差异】上传前会先 pull 一次云端读版本（多一次网络往返——判断新旧的必要代价，
 * 且能顺带识别「云端为空 → 首次上传免提示」）。成功后把这一版写进本地台账作为新基线。
 *
 * @param {Function} [onProgress] 进度回调（showToast 用）
 * @param {object} [opts]
 * @param {UploadConfirmHandler} [opts.onConfirm]
 *        冲突确认回调（手动链路）：返回 false = 用户取消 → 中止上传（返回 { cancelled: true }，不发起 push）。
 *        不传则沿用旧行为直接上传（无头/测试场景），并在日志留痕。
 * @param {AutoConflictHandler} [opts.onAutoConflict]
 *        冲突处理回调（自动链路）：三选一（upload/download/cancel）。
 *        download → 返回 { action:'download-needed' } 且不发起 push，交调用方转 downloadConfig；
 *        cancel   → 返回 { cancelled:true } 且不发起 push。
 *        onAutoConflict 优先于 onConfirm（自动链路传的是前者）。
 * @returns {Promise<{ ok:boolean, count:number, cancelled?:boolean, error?:string,
 *        action?:'download-needed', skipped?:boolean }>}
 *        action:'download-needed' = 冲突处理器要求转下载（本函数未 push）；
 *        skipped:true            = 内容一致，零副作用跳过（未 push、未弹窗、rev 未变）。
 */
export async function uploadConfig(
  onProgress,
  opts: { onConfirm?: UploadConfirmHandler; onAutoConflict?: AutoConflictHandler } = {},
): Promise<UploadResult> {
  const { onConfirm, onAutoConflict } = opts;
  const { ls, skipped: skippedUp } = await collectLocalData();
  if (Object.keys(ls).length === 0) {
    logger.debug('同步', '[上传] 无可同步数据', {}, { module: 'project' });
    return { ok: false, count: 0, error: '本地没有可同步的数据' };
  }
  const localHash = contentFingerprint(ls);
  const ledger = readLedger();

  // 1) 读云端版本。失败不硬阻断（否则一次网络抖动就永远无法上传），降级为 'cloud-unknown' 交给用户定夺。
  let cloud = null;
  let cloudReadable = true;
  try {
    const raw = await CloudSyncEngine.pull(
      () => {},
      () => {},
      (msg) => {
        throw new Error(msg);
      },
    );
    cloud = normalizeCloudPayload(raw);
  } catch (e) {
    cloudReadable = false;
    logger.warn('同步', '[上传] 读取云端版本失败，降级为未知', { error: e?.message || '未知' });
  }

  // 2) 判冲突 → 需要提示就问用户（取消则到此为止，绝不发起 push）
  // 云端内容指纹：与 localHash 同由 contentFingerprint(纯数据) 产出，可直比（A-1 内容维度判定）。
  const cloudHash = cloud ? contentFingerprint(cloud.data) : '';
  const decision = decideUpload({
    cloudReadable,
    cloudExists: !!cloud,
    cloudRev: cloud?.rev ?? 0,
    cloudUpdatedAt: cloud?.updatedAt ?? 0,
    ledger,
    localHash,
    cloudHash,
  });
  if (decision.kind !== 'none') {
    logger.debug('同步', '[上传] 检测到冲突', {
      kind: decision.kind,
      cloudRev: decision.cloudRev,
      ledgerRev: decision.ledgerRev,
      localDirty: decision.localDirty,
    });
    if (onAutoConflict) {
      // 自动链路：三选一（downloadText/cancelText 由弹窗渲染端读 request.downloadText 显示）
      const r = await onAutoConflict(describeUploadConflict(decision, 'auto'), decision);
      if (r === 'cancel') {
        logger.debug('同步', '[上传] 自动同步取消本轮', { kind: decision.kind });
        return { ok: false, count: 0, cancelled: true };
      }
      if (r === 'download') {
        logger.debug('同步', '[上传] 自动同步要求转下载', { kind: decision.kind });
        return { ok: false, count: 0, action: 'download-needed' as const };
      }
      // 'upload' → 落到下面 push
    } else if (onConfirm) {
      if (!(await onConfirm(describeUploadConflict(decision), decision))) {
        logger.debug('同步', '[上传] 用户取消', { kind: decision.kind }, { module: 'project' });
        return { ok: false, count: 0, cancelled: true };
      }
    } else {
      logger.warn('同步', '[上传] 有冲突但未提供确认回调，按旧行为直接上传', {
        kind: decision.kind,
      });
    }
  } else if (decision.inSync) {
    // 【A-1】内容一致 → 零副作用跳过（不 push、不 +rev、不弹窗）。地基：双机 rev 空转不产生假冲突。
    logger.debug('同步', '[上传] 内容一致，跳过', {}, { module: 'project' });
    return { ok: true, count: 0, skipped: true };
  }

  // 3) 打包推送（rev = 云端 rev + 1，单调递增）
  const nextRev = (cloud?.rev ?? 0) + 1;
  const payload = buildCloudPayload(ls, nextRev);
  try {
    const ok = await CloudSyncEngine.push(
      payload,
      onProgress,
      () => {},
      (msg) => {
        throw new Error(msg);
      },
    );
    if (!ok) {
      logger.warn('同步', '[上传] 失败（引擎返回失败）', { rev: nextRev });
      return { ok: false, count: 0, error: '同步失败（引擎返回失败）' };
    }
    // 条目数不含 __meta 元字段（它只是版本兜底载体，不是数据项）
    const n = Object.keys(payload.data || {}).length - 1;
    // 4) 成功 → 记台账：本次上传的这一版 = 新基线
    writeLedger({ rev: nextRev, syncedAt: payload.updatedAt, localHash });
    // 【P0 埋点】云同步上传成功（排查「同步失败无痕」：确认上传发生且带条目数/修订号）
    logger.info('同步', '[上传] 成功', { count: n, rev: nextRev });
    // [F-云A] 若有域因读取失败未纳入，如实带上，绝不冒充"完整上传"
    return {
      ok: true,
      count: n,
      partial: skippedUp.length ? { skipped: skippedUp.map(syncLabel) } : undefined,
    };
  } catch (e) {
    logger.warn('同步', '[上传] 异常', { error: e?.message || '同步失败' });
    return { ok: false, count: 0, error: e?.message || '同步失败' };
  }
}

/**
 * 从云端拉取：CloudSyncEngine.pull → 归一化解析 → 算受影响项（必要时先问用户）→ 覆盖恢复本地。
 *
 * 【与旧版的行为差异】写回本地前先逐键比对，若「本地有值且与云端不同」则列出清单先问用户，
 * 用户取消则不写任何东西（返回 { cancelled: true }）。无冲突时静默恢复，不打扰。
 *
 * @param {Function} [onProgress] 进度回调（showToast 用）
 * @param {object} [opts]
 * @param {DownloadConfirmHandler} [opts.onConfirm]
 *        覆盖确认回调：返回 false = 用户取消 → 不写回任何数据。不传则沿用旧行为直接覆盖。
 * @returns {Promise<{ ok:boolean, count:number, hasCloud:boolean, cancelled?:boolean, error?:string }>}
 */
export async function downloadConfig(
  onProgress,
  opts: { onConfirm?: DownloadConfirmHandler } = {},
): Promise<DownloadResult> {
  const { onConfirm } = opts;
  let cloud = null;
  try {
    const raw = await CloudSyncEngine.pull(
      onProgress,
      () => {},
      (msg) => {
        throw new Error(msg);
      },
    );
    cloud = normalizeCloudPayload(raw);
  } catch (e) {
    logger.warn('同步', '[下载] 拉取异常', { error: e?.message || '拉取失败' });
    return { ok: false, count: 0, hasCloud: false, error: e?.message || '拉取失败' };
  }
  if (cloud == null) {
    logger.debug('同步', '[下载] 云端无数据', {}, { module: 'project' });
    return { ok: false, count: 0, hasCloud: false, error: '云端没有数据' };
  }
  // 1) 写回前先算「哪些本地内容会被覆盖」→ 有冲突就先把清单交给用户
  const diff = diffWithLocal(cloud.data, (await collectLocalData()).ls);
  const copy = describeDownloadConflict(diff);
  if (copy) {
    logger.debug('同步', '[下载] 检测到将被覆盖项', {
      count: diff.conflicts.length,
      keys: diff.conflicts.map((c) => c.key),
    });
    if (!onConfirm) {
      logger.warn('同步', '[下载] 有覆盖项但未提供 onConfirm，按旧行为直接下载', {
        count: diff.conflicts.length,
      });
    } else if (!(await onConfirm(copy, diff))) {
      logger.debug(
        '同步',
        '[下载] 用户取消',
        { count: diff.conflicts.length },
        { module: 'project' },
      );
      return { ok: false, count: 0, hasCloud: true, cancelled: true };
    }
  }
  try {
    const { written, failed } = await restoreLocal(cloud);
    if (written === 0 && failed.length === 0) {
      logger.debug('同步', '[下载] 云端无新数据', {}, { module: 'project' });
      return { ok: false, count: 0, hasCloud: true, error: '云端没有新的数据' };
    }
    // [TD-13] 写回成功后精准重水合各 store 内存态（替换旧整页 reload 末端补丁）：
    // 手动/自动两路下载都经 downloadConfig，故在此统一触发，调用方无需各自 rehydrate；
    // 仅在有实际写回时执行（written>0），「云端无新数据」已在上方面 return，不触发无谓刷新。
    await rehydrateStoresAfterCloudPull();
    // 2) 记台账：云端这一版 = 新基线。指纹按「写回后的本地实际值」重新采集——
    //    若直接用云端包指纹，领域开关关闭的键（如 projects 不写回）会造成基线偏差，
    //    下次上传就会误报「本地改过」而多弹一次确认。
    writeLedger({
      rev: cloud.rev,
      syncedAt: Date.now(),
      localHash: contentFingerprint((await collectLocalData()).ls),
    });
    if (failed.length > 0) {
      // [F-云A] 部分域写回失败：恢复了本地 LS，但网络/KV 域失败 → 诚实返回 partial，由调用方告警；绝不 ok:true 掩盖
      const msg = `部分配置未恢复：${failed.join('、')}`;
      logger.warn('同步', '[下载] 部分域写回失败', { failed });
      if (written === 0) return { ok: false, count: 0, hasCloud: true, error: msg };
      return { ok: true, count: written, hasCloud: true, partial: { failed } };
    }
    // 【P0 埋点】云同步下载成功（排查「拉取后数据没恢复」：确认恢复条目数/修订号）
    logger.info('同步', '[下载] 成功', { count: written, rev: cloud.rev });
    return { ok: true, count: written, hasCloud: true };
  } catch (e) {
    logger.warn('同步', '[下载] 解析失败', { error: e?.message || '云端数据解析失败' });
    return { ok: false, count: 0, hasCloud: true, error: '云端数据解析失败' };
  }
}

// 保留引擎导出（供需要直接调用引擎的调用方用），但日常同步请走 uploadConfig/downloadConfig。
export { CloudSyncEngine };

/**
 * 云同步「下载云端」后精准重水合各 store 内存态（原独立模块 cloudRehydrate.ts，2026-09-11 并入本文件）。
 *
 * 根因：accountsStore / appSettings / providerStore 是「模块级内存态 + useSyncExternalStore」，只在 load() 读一次、
 * 不订阅 contentStore 变更；restoreLocal 直写 contentStore / providerApi 后内存态过期 → KV 新/内存旧（SSOT 裂痕，TD-13）。
 *
 * 触发点：downloadConfig 写回成功后调用（手动 handlePullFromCloud + 自动 autoSync 两路复用），精准重水合，
 * 不冲画布、配置当轮一致，替换旧整页 window.location.reload() 末端补丁。
 *
 * 覆盖范围：仅 3 个有模块级缓存的 store（reloadAppSettings / reloadAccounts / reloadProviders）。
 * skillStore / agentModelStore 走 contentSubscribe 订阅、promptManager / scriptBoxPlaybookStore 走 contentGet 直读，
 * 均无模块级缓存，天然跟随 contentStore，无需在此 rehydrate（避免误加造成双读）。
 * 任一个 reload 失败不影响其余（Promise.allSettled）。
 */
export async function rehydrateStoresAfterCloudPull(): Promise<void> {
  await Promise.allSettled([
    Promise.resolve(reloadAppSettings()),
    reloadAccounts(),
    reloadProviders(),
  ]);
}

/**
 * 云同步是否可用：GAS URL 已配置（非占位）且当前无同步在跑。
 * 自动调度（autoSync.ts）与手动按钮共用的唯一就绪判定——统一到一个入口，避免两边对
 * 「是否可同步」给出矛盾答案（旧稿曾各自判断，漏一种状态就会调度/按钮行为不一致）。
 */
export function isCloudSyncReady(): boolean {
  const url = CloudSyncEngine.config.gasUrl;
  return !!url && !url.includes('填入') && !CloudSyncEngine.isSyncing;
}

/* ── localStorage 同步清单：由 contracts.ts STORAGE_KEYS 权威登记生成（getLocalKeys()），
 * 显式排除不适合跨设备同步的键（与文件头【不同步】原则一致）：
 *  - lastOpenedProject / agent_draft：本机/临时偏好（不同步）
 *  - projects：项目列表有独立跨端真通道（projectStore → localTool /api/projects backend + KV 画布快照），
 *    再经 GAS 云同步 = 造第二真相源（SSOT 裂痕）→ 从源头排除，不传不收（[F-云B] 2026-09-11）。
 *  - yimao_asset_library：本地 URL 引用，跨设备无意义（不同步）
 *  - mutiwindow-clipboard：跨窗口临时剪贴板（不同步）
 *  - agent_panel_width / agent_split_width：AI 助手面板/表格分栏宽度（本机 UI 偏好，跨设备无意义，不同步）
 *  - agent_input_mode / agent_work_mode：9-05 模式精简后的历史遗留死键（input_mode / work_mode 不再产出），同步无意义（不同步）。
 *  - canvasAgentGenParams：AI 生图默认参数（本机 UI 偏好，跨设备无意义，不同步）
 *  - yimao_node_prefs：节点「上次参数」记忆（domain: 'pref'，本机 UI 偏好，跨设备无意义，不同步）。
 *  - yimao_prompt_hub_cache：提示词社区库缓存（带 fetchedAt/signature，每台机重拉即可，跨设备同步既无意义又可能污染缓存判断，不同步）。
 *  - yimao_preset_recent：最近使用预设（本机使用痕迹，与节点参数记忆同性质，跨设备无意义，不同步）。
 *  AI 会话键含隐私：pattern 键（agent_conversations_{agentKey} / agent_active_conversation_id_{agentKey}）本就不在
 *  getLocalKeys() 内；遗留单数键（agent_conversations / agent_active_conversation_id）虽已迁移不再写入，仍显式列入
 *  下方 SYNC_EXCLUDE 双保险，杜绝明文上云（[TD-14] 2026-09-11）。
 * 账号（yimao_accounts）为 KV 后端，本就不在 getLocalKeys()，由 S4 领域开关在 collect/restore 单独处理。
 * 同步台账（yimao_cloud_sync_ledger）：本机基线，随备份走但**绝不能进云端**（每台机器基线不同，
 *   同步它会互相污染新旧判断）→ 显式排除。 */
const SYNC_EXCLUDE = new Set([
  'lastOpenedProject',
  // projects：项目列表有独立跨端真通道（projectStore → localTool /api/projects backend + KV 画布快照），
  //   再进云同步 = 造第二真相源（SSOT 裂痕）→ 从源头排除，下载端亦不复写（见 restoreLocal）。[F-云B]
  'projects',
  'yimao_asset_library',
  // agent_draft：**已退役**（TD-17，2026-09-11）。草稿唯一真源 = 会话内 `conv.draft`（随会话走 KV 同步），
  //   独立键不再有任何读写方、STORAGE_KEYS 登记亦已删。此处置保留仅为「旧机器残留本地键」双保险，勿据此恢复该键。
  'agent_draft',
  'mutiwindow-clipboard',
  'agent_panel_width',
  'agent_split_width',
  'agent_input_mode',
  'canvasAgentGenParams',
  'agent_skill_usage',
  'yimao_node_prefs',
  'yimao_prompt_hub_cache',
  'yimao_preset_recent',
  // [TD-14] 遗留单数 AI 会话键：已迁移到 pattern 键、不再写入，但静态登记在 STORAGE_KEYS 且 backend:'local'，
  // 若旧数据残留会被 getLocalKeys() 纳入云同步（明文上 GAS = 隐私泄漏）→ 显式排除双保险。
  'agent_conversations',
  'agent_active_conversation_id',
  LEDGER_KEY,
]);
const LS_KEYS = getLocalKeys().filter((k) => !SYNC_EXCLUDE.has(k));

/**
 * 同步键 → 面向用户的可读名。
 * 冲突清单要让人看懂「到底动了什么」，直接甩存储键名（yimao_preset_prompts）等于没说。
 * 未登记的键兜底显示键名本身——宁可显示原始 key，也绝不静默省略条目（漏报比难看危险）。
 */
const SYNC_LABELS = {
  app_settings: '应用设置',
  scriptbox_playbooks: '剧本盒子 Playbook',
  agent_chat_model: 'AI 聊天模型配置',
  agent_history_turns: 'AI 历史回传轮数',
  agent_skills: '自定义 Skill',
  agent_skill_usage: 'Skill 使用统计',
  agent_skill_enabled: 'Skill 启用状态',
  agent_panel_width: 'AI 面板宽度',
  agent_input_mode: 'AI 输入模式',
  yimao_preset_prompts: '提示词预设',
  yimao_preset_recent: '最近使用预设',
  yimao_prompt_hub_cache: '提示词社区库缓存',
  yimao_node_prefs: '节点参数记忆',
  yimao_accounts: '多开账号环境',
  providers: 'API 供应商配置',
};

/** 取同步键的可读名（未登记 → 回退键名） */
function syncLabel(key) {
  return SYNC_LABELS[key] || key;
}

/**
 * 云同步领域开关（开发者配置常量，集中治理「哪些领域允许进云端」）。
 * KEY 对应 contracts.ts STORAGE_KEYS.entry.domain（如 account，而非存储键名）。
 *  - account：true，账号环境走 KV，需专门上传/下载（见 collectLocal/restoreLocal）。
 *  - projects 域已整体移出云同步（见 SYNC_EXCLUDE，[F-云B] 2026-09-11），不再经本开关。
 * 未在本表登记的领域默认放行（维持既有行为）。
 */
const SYNC_DOMAIN_SWITCHES = {
  account: true,
};

/** 某存储键所属领域是否开启云同步（按 STORAGE_KEYS.entry.domain 判定；未登记/未切换领域默认开启） */
function domainSwitchEnabled(k) {
  const domain = STORAGE_KEYS[k]?.domain;
  if (domain && domain in SYNC_DOMAIN_SWITCHES) return !!SYNC_DOMAIN_SWITCHES[domain];
  return true;
}
