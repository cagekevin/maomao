/**
 * director3d 工程持久化收口到 localTool KV + uploads/director3d 落盘（docs/45）。
 * ----------------------------------------------------------------------------
 * 为什么单独建这个模块（深模块 · 高内聚）：
 *  - director3d 是第三方模块（CLAUDE.md 最小集成、不纳入测试），本模块是【我方】代码，
 *    把「可测的持久化协议」全部收在这里，director3d 只做最小适应（storage.writeJson 委托 +
 *    normalize 放行 /files/ 地址），业务可测、第三方零污染。
 *  - 本模块依赖的传输全部复用既有唯一入口：
 *      · kvGet/kvSet              —— localToolApi（已登记 contracts.ts apiRegistry）
 *      · saveInlineToLocal        —— filesApi（sha1 幂等落盘）
 *      · withTimeout              —— asyncGuard（项目统一总超时，防无限挂起）
 *      · UPLOAD_DIRS.director3d   —— uploadDirs（uploads/ 目录中央常量表）
 *
 * 写入契约：POST /api/kv/set { key, value }（本地直写做降级，不吞错）
 * 读取契约：GET  /api/kv/get?key=... → 解析后工程对象或 null
 * 路由路径以 contracts.ts apiRegistry 登记为准（/api/kv/get|set|delete，非 docs 方案里的 /api/kv）。
 */

import { kvGet, kvSet } from '../base/api/localToolApi.ts';
import { withTimeout } from '../base/utils/asyncGuard.ts';
import { saveInlineToLocal } from '../base/api/filesApi.ts';
import { UPLOAD_DIRS } from '../base/utils/uploadDirs.ts';
import { logger } from '../base/core/logger.ts';
import { showToast } from '../base/core/toastStore.ts';
import { KV_TIMEOUT } from '../base/core/config.ts';
// 【降级落点统一】本地降级副本走 storageAdapter（sGet/sSet，自动 yimao: 前缀），
// 与 kvStore.storageGet 的降级回读一致，避免「裸 key vs 带前缀」两套副本互不可见（收口缺口）。
import { sGet, sSet } from '../base/storage/index.ts';

/** 工程存储默认键（无 nodeId 独立运行场景，与 director3d/project.ts 一致） */
export const PROJECT_KEY_DEFAULT = 'director3d-project';

/**
 * ── 多开 / 并发覆盖的可见警示（docs/45 R6，非锁，只把"静默覆盖"变成可见）──
 * director3d 单实例为常态（doc 记为低风险、本轮不做真锁），但同一 key 在两个窗口/标签页
 * 同时编辑时，后写覆盖先写 → 静默丢 edit。这里复用与画布 useCanvasSync 相同的 BroadcastChannel
 * 模式：每次 KV 写成功广播 D3D_SAVED；他窗口收到同 key 的较新保存 → 给本窗口一个可见信号，
 * 下一次本窗口保存前提示"可能覆盖其他窗口最新内容"（仅提示一次，防刷屏）。真实锁会侵入
 * director3d 编辑流程，doc 明确不用锁，故最小化到这个"失败可见"层面。
 */
const SAVE_CHANNEL = 'yimao_director3d_kv';
const tabId = (typeof crypto !== 'undefined' && crypto?.randomUUID?.()) || `d3d-${Date.now()}`;
/** 跨窗口广播的消息体 */
interface D3dSavedMessage {
  type: 'D3D_SAVED';
  key: string;
  tabId: string;
  at: number;
}

/** key → 本窗口最近一次成功写 KV 的时间戳（用于判断远端保存是否"更新"） */
const myLastWriteAt = new Map<string, number>();
/** key → 最近一次他窗口更晚保存的时间戳（触发冲突提示后清掉，避免每次保存刷屏） */
const remoteConflictAt = new Map<string, number>();
/**
 * 【疑似历史 bug · 迁移保持行为不变，仅如实标注，勿顺手修】
 * 初始值设计为 null，守卫却写 `!== undefined` → 首次调用即命中 return，下方创建逻辑
 * 实际从未执行，BroadcastChannel 从未建立（announceSaved 静默失效、跨窗口冲突提示形同虚设）。
 * 类型上保留 undefined 分支，正是为了让这处恒真比较合法地原样留存；修复需改 `!== null`
 * 并补测试，属行为变更，不在迁移范围内。
 */
const channelRef: { value: BroadcastChannel | null | undefined } = { value: null };

function getChannel(): BroadcastChannel | null {
  if (channelRef.value !== undefined) return channelRef.value as BroadcastChannel | null;
  try {
    channelRef.value = new BroadcastChannel(SAVE_CHANNEL);
    channelRef.value.onmessage = (event: MessageEvent) => {
      const message = event?.data as D3dSavedMessage | undefined;
      if (!message || message.type !== 'D3D_SAVED' || message.tabId === tabId) return;
      // 只有"他窗口保存且比本窗口最近一次保存更新"才算落后冲突
      if (message.at > (myLastWriteAt.get(message.key) || 0)) {
        remoteConflictAt.set(message.key, message.at);
      }
    };
  } catch {
    channelRef.value = null; // BroadcastChannel 不可用（如部分受限环境）→ 退化为无冲突提示，不影响主流程
  }
  return channelRef.value;
}

function announceSaved(key: string): void {
  const channel = getChannel();
  if (!channel) return;
  try {
    channel.postMessage({ type: 'D3D_SAVED', key, tabId, at: Date.now() });
  } catch {
    /* 广播失败忽略，不影响保存 */
  }
}

/**
 * 稳定 KV 键：沿用业务侧传入的 key（director3d-project / director3d-project-<nodeId>），
 * 不做字符串变换、不造新前缀——同一 key 在 KV 表用 DELETE+INSERT 幂等覆盖。
 * @param {string} [storageKey] 业务存储键；缺省用默认工程键
 * @returns {string} KV 键
 */
export function projectKvKey(storageKey?: string): string {
  return storageKey ?? PROJECT_KEY_DEFAULT;
}

/**
 * 判定某 URL 是否为「可持久化的工程图片地址」——用于 director3d normalize 读工程时放行取值。
 * 放行两类（本地优先、不依赖外网）：
 *  1. data:image/...       旧版存量 base64（迁移前 / 后端不可达降级时仍保留）
 *  2. /files/...           本地落盘文件地址（相对 /files/ 或 http(s)://.../files/，后端收口后常态）
 * 其余（垃圾值/盗链外链）一律拒绝 → 保证读入不污染工程。
 * @param {string} url 待判定的图片地址
 * @returns {boolean} 是否放行
 */
export function isProjectImageUrl(url: unknown): boolean {
  return (
    typeof url === 'string' &&
    url.length > 0 &&
    (url.startsWith('data:image/') || /\/files\//.test(url))
  );
}

/**
 * 工程持久化键判定（T6：隔离姿势库等非工程键）。
 * 只有 director3d-project 开头的键走 KV 收口；director3d-custom-poses 等继续只走 localStorage，
 * 避免无关键（每人自定义姿势、又小又频繁）污染 KV 表。
 * @param {string} key 存储键
 * @returns {boolean} 是否进入 KV 工程通道
 */
export function isProjectPersistenceKey(key: unknown): boolean {
  return typeof key === 'string' && key.startsWith('director3d-project');
}

/**
 * director3d 工程对象形态（本模块只消费这三个字段，其余透传不解析）。
 * externalizeProjectImages 会遍历 reference.image 与 shots[].thumbnail 做 base64 外部化。
 */
export interface D3dProject {
  reference?: { image?: string; [key: string]: unknown };
  shots?: Array<{ thumbnail?: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

/** base64 → 本地文件 URL 的落盘函数（默认 filesApi.saveInlineToLocal） */
export type SaveInlineFn = (dataUrl: string, dir?: string) => Promise<string | null>;

/** 本地降级副本同步读取 + JSON 解析（走 sGet 统一 yimao: 前缀；读失败/脏数据返回 null，不抛） */
function readLocalJson(key: string): D3dProject | null {
  try {
    const raw = sGet(key);
    if (raw == null) return null;
    const parsed: unknown = JSON.parse(raw);
    // JSON.parse 产物为纯数据；D3dProject 含 [key:string]:unknown 索引签名是宽松形状，
    // 仅需「确实是非空对象」守卫即可诚实收窄，避免把 null/基础值谎报成工程对象（F6）。
    return parsed && typeof parsed === 'object' ? (parsed as D3dProject) : null;
  } catch {
    return null;
  }
}

/** 本地降级副本同步写入 JSON（走 sSet 统一 yimao: 前缀；成功 true；失败 false 不抛） */
function writeLocalJson(key: string, value: D3dProject): boolean {
  try {
    sSet(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * 外部化（base64 → 本地文件 URL）（T1/T2）。
 * 遍历工程内持久化图片字段（reference.image + shots[].thumbnail），把 data: base64 经
 * saveInlineToLocal 落盘到 director3d 目录并替换为 /files/ URL；单张落盘失败【保留原 base64】绝不清图。
 * 返回【新对象】，绝不 mutate 入参（React 不可变纪律）；KV 值因此近无 base64 → 规避 sql.js KV 撑大（R4）。
 * @param {object} project 工程对象（入参不修改）
 * @param {(dataUrl: string) => Promise<string|null>} [saveInline] 落盘函数；默认复用 filesApi.saveInlineToLocal
 * @returns {Promise<{project: object, droppedCount: number}>} 替换后的工程副本 + 成功替换数
 */
export async function externalizeProjectImages(
  project: D3dProject,
  saveInline: SaveInlineFn = saveInlineToLocal,
): Promise<{ project: D3dProject; droppedCount: number }> {
  const out = structuredClone(project);
  let droppedCount = 0;

  // 单字段外部化：非 data: 原样返回（已是文件URL/外链不动）；落盘失败或返回原值 → 保留原 base64
  const maybeReplace = async (src: string): Promise<string> => {
    if (typeof src !== 'string' || !src.startsWith('data:')) return src;
    const url = await saveInline(src, UPLOAD_DIRS.director3d);
    if (url && url !== src) {
      droppedCount += 1;
      return url;
    }
    return src; // 落盘失败 → 保留原 base64
  };

  if (out?.reference && isProjectImageUrl(out.reference.image)) {
    out.reference.image = await maybeReplace(out.reference.image);
  }
  if (Array.isArray(out?.shots)) {
    for (const shot of out.shots) {
      if (shot && isProjectImageUrl(shot.thumbnail)) {
        shot.thumbnail = await maybeReplace(shot.thumbnail);
      }
    }
  }
  return { project: out, droppedCount };
}

/**
 * 读取源选择（T4，纯函数、可单测）。
 * 后端 KV 命中 → 以 KV 为权威；KV 空、本地有 → 用本地并需写回 KV（触发一次性迁移）；
 * 都空 → null。
 * @param {*} kvValue 后端 KV 值（可能为对象或 null）
 * @param {*} lsValue 本地 localStorage 值
 * @returns {{project: *, from: 'kv'|'local', migrateToKv: boolean}}
 */
export function pickProjectSource(
  kvValue: D3dProject | null,
  lsValue: D3dProject | null,
): { project: D3dProject | null; from: 'kv' | 'local'; migrateToKv: boolean } {
  if (kvValue != null) return { project: kvValue, from: 'kv', migrateToKv: false };
  if (lsValue != null) return { project: lsValue, from: 'local', migrateToKv: true };
  return { project: null, from: 'local', migrateToKv: false };
}

/**
 * 写工程（收口写入唯一入口）。先外部化 base64→文件，再写 KV；18080 不可达时降级直写 localStorage。
 * 失败不抛、不阻塞编辑（内存态为权威）；返回实际落点供调用方标记（logger 区分「走后端 / 已降级」）。
 * @param {string} storageKey 业务存储键
 * @param {object} project 工程对象
 * @returns {Promise<'kv'|'local'>} 实际落点
 */
export async function writeProject(
  storageKey: string | undefined,
  project: D3dProject,
): Promise<'kv' | 'local'> {
  const key = projectKvKey(storageKey);

  // 并发可见警示：他窗口在此前更晚保存过 → 本次写可能覆盖其较新内容（提示一次后清掉）
  const conflictAt = remoteConflictAt.get(key);
  if (conflictAt != null) {
    logger.warn('d3dPersistence', '检测到其他窗口已更新该工程，本次保存可能覆盖较新内容', {
      key,
      remoteAt: conflictAt,
    });
    // 【签名对齐 + 修实效 bug】showToast 第二参现为 ToastOptions 对象；原传字符串 'error'
    // 会被解构成 `{ type: undefined }` 而降级为默认 'info'，红色错误提示实际从未生效。
    showToast('另一窗口已编辑该导演台工程，本次保存可能覆盖最新内容', { type: 'error' });
  }

  const ext = await externalizeProjectImages(project);

  // 主通道：写 localTool KV（带总超时，防挂起）
  try {
    await withTimeout(kvSet(key, ext.project), KV_TIMEOUT, `director3d KV 写入超时（key=${key}）`);
    logger.debug('d3dPersistence', '工程已写 KV', { key }, {});
    remoteConflictAt.delete(key); // 已消费冲突信号
    myLastWriteAt.set(key, Date.now()); // 记录本窗口写时间，供他窗口判断"更晚"
    announceSaved(key); // 广播，让其他窗口感知
    return 'kv';
  } catch (err) {
    logger.warn('d3dPersistence', 'KV 不可达，降级 localStorage', {
      key,
      reason: err?.message || err,
    });
  }

  // 降级通道：直写 localStorage（后端不可达时保住一份，宁慢勿丢）
  if (writeLocalJson(key, ext.project)) {
    // 【签名对齐】logger.warn 只接 (category, action, detail?) 三参；原第 4 参 {} 运行时本就被忽略，删除等价
    logger.warn('d3dPersistence', '工程已降级写 localStorage', { key });
    return 'local';
  }

  // 双通道都失败：不吞错，明确记录（内存态为权威，编辑不阻塞）
  // 【签名对齐】logger.error 同只接三参；原第 4 参 new Error(...) 运行时被忽略，改并入 detail 以保留信息
  logger.error('d3dPersistence', '工程写入失败：KV 与 localStorage 均不可用', {
    key,
    reason: '双通道写失败',
  });
  return 'local';
}

/**
 * 读/迁移（收口读取唯一入口）。KV 命中 → 用 KV；KV 空、本地有 → 用本地并写回 KV（一次性迁移）；
 * 都空 → null。KV 不可达视为空，避免读路径被后端拖死（带超时）。
 * @param {string} storageKey 业务存储键
 * @returns {Promise<object|null>} 工程对象（未归一化，由调用方 applyProjectSnapshot 归一化）；无则 null
 */
export async function hydrateProject(storageKey?: string): Promise<D3dProject | null> {
  const key = projectKvKey(storageKey);
  const ls = readLocalJson(key);

  let kv: D3dProject | null = null;
  try {
    kv = await withTimeout(kvGet(key), KV_TIMEOUT, `director3d KV 读取超时（key=${key}）`);
  } catch (err) {
    logger.warn('d3dPersistence', 'KV 读取不可达，走本地', { key, reason: err?.message || err });
  }

  const pick = pickProjectSource(kv, ls);

  // 迁移：KV 空 + 本地有 → 写回 KV（外部化后持久化），此后 KV 命中不再触发（天然幂等）
  if (pick.migrateToKv && pick.project) {
    try {
      await writeProject(key, pick.project);
    } catch (err) {
      logger.warn('d3dPersistence', '本地→KV 迁移写回失败（不影响读），', {
        reason: err?.message || err,
      });
    }
  }

  return pick.project;
}
