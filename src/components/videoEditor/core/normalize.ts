/**
 * E 组 · 规范化（最底层，最先做）—— `docs/123` §一.4 E 组。
 *
 * `normalizeProject` 是**加载期的唯一入口**：任何来源的工程记录（磁盘 / 云端 / 导入）
 * 都必须经它才能变成 `Project`。它同时承担 schemaVersion 守门。
 *
 * ── 语义必须一分为二（`docs/123` §一.4 / §二.9 第 7 行）──
 *  ① `schemaVersion` **低于当前** → 走**迁移**（旧结构有已知语义，补默认是对的）；
 *  ② 版本**缺失 / 高于当前 / 结构损坏** → **拒载并明示**。
 *
 * 【为什么不能「缺字段一律补默认」】那是把「**旧版本**」与「**数据损坏**」当同一件事：
 * 损坏的工程会被静默补成半截工程上屏，用户看到「我加的片段没了」却没有任何提示 —— 假成功（7 步法 Step 4 禁令 2）。
 *
 * 【为什么没有「重复 id 重铸」】`docs/123` §二.9 第 1 行已删：本仓 id 一律 `generateId()`，
 * 它含 6 位随机段（`base/core/idGen.ts`），N 仓库那起事故的根因（归零自增序列）在本仓不存在。
 * 为不会发生的碰撞加防卫 = 虚构（铁律 5）。
 */
import { generateId } from '../../base/core/idGen.ts';
import {
  DEFAULT_AUDIO_TRACK_NAME,
  DEFAULT_DOCK_HEIGHT,
  DEFAULT_FPS,
  DEFAULT_IMAGE_CLIP_DURATION,
  DEFAULT_PROJECT_HEIGHT,
  DEFAULT_PROJECT_WIDTH,
  DEFAULT_VIDEO_TRACK_NAME,
  VIDEO_EDITOR_SCHEMA_VERSION,
} from './constants.ts';
import type { OpResult } from './result.ts';
import type { Clip, ClipKind, Project, Track, TrackKind } from './types.ts';

/* ────────────────────────────────────────────────────────────
 * 宽入严出的小工具：把「外部来的 unknown」逐层收成类型
 * ──────────────────────────────────────────────────────────── */

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** 有限数才认；`NaN` / `Infinity` / 字符串一律回默认值（NaN 会静默污染所有时间运算）。 */
function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.length > 0 ? v : fallback;
}

/**
 * 内部哨兵：结构损坏时用它中断深递归，由最外层统一转成 `reject`。
 * 不用抛任意 `Error` —— 那会与「代码 bug」混淆（7 步法 Step 4 禁令：禁重分类）。
 */
class ProjectDataError extends Error {}

/* ────────────────────────────────────────────────────────────
 * 建空工程
 * ──────────────────────────────────────────────────────────── */

/**
 * 空工程：fps 30 / playhead 0 / **固定双轨**（视频 ×1 磁吸 + 音频 ×1 自由）。
 *
 * 为什么固定双轨而不是空数组：`docs/123` §一.9 Q3 裁定 M1 轨道集合固定；
 * 增删轨（`createTrack`/`removeTrack`）属 M2，**只定义不暴露**。
 * 空工程是合法状态（`docs/120` C11.9：不设最少片段数），故 `clips` 为空数组。
 */
export function createEmptyProject(): Project {
  return {
    schemaVersion: VIDEO_EDITOR_SCHEMA_VERSION,
    fps: DEFAULT_FPS,
    playhead: 0,
    tracks: [createEmptyTrack('video'), createEmptyTrack('audio')],
    settings: { width: DEFAULT_PROJECT_WIDTH, height: DEFAULT_PROJECT_HEIGHT },
    ui: { dockHeight: DEFAULT_DOCK_HEIGHT },
  };
}

/** 建一条空轨（主视频轨 `overlay:false` 磁吸；音频轨 `overlay:true` 自由）。 */
function createEmptyTrack(kind: TrackKind): Track {
  return {
    id: generateId(kind === 'video' ? 'track-v' : 'track-a'),
    name: kind === 'video' ? DEFAULT_VIDEO_TRACK_NAME : DEFAULT_AUDIO_TRACK_NAME,
    kind,
    // 音频轨天然是自由轨（不压实）；视频轨是主轨（磁吸）。
    overlay: kind === 'audio',
    locked: false,
    hidden: false,
    muted: false,
    clips: [],
  };
}

/* ────────────────────────────────────────────────────────────
 * 加载期唯一入口
 * ──────────────────────────────────────────────────────────── */

/**
 * 规范化工程记录 —— 加载期**唯一**入口（`docs/123` §一.7 读入口）。
 *
 * @param raw 任意来源的原始值（KV 读回 / 导入 JSON）。
 * @returns 三态（`docs/123` §一.5）：
 *  - `ok`       → 可直接使用（含「低版本已迁移」）；
 *  - `reject`   → **没做，且说清为什么**（版本缺失 / 高于当前 / 结构损坏）。
 *
 * 消费方（`data/projectRepository`）对 `reject` 的处置：按「**无工程**」处理（`docs/120` C1），
 * 并把 `reason` 交给开发者 `logger`；用户侧只应看到「没有工程」，不看到半截工程。
 */
export function normalizeProject(raw: unknown): OpResult<Project> {
  try {
    if (!isPlainObject(raw)) {
      return {
        status: 'reject',
        reason: '工程记录不是对象（可能为空 / 被截断）',
        expected: 'Project 对象',
      };
    }

    // ── 版本守卫（§一.4 ②）：缺失 / 非数 / 高于当前 → 拒载 ──
    const ver = raw.schemaVersion;
    if (typeof ver !== 'number' || !Number.isFinite(ver)) {
      return {
        status: 'reject',
        reason: '工程记录缺少 schemaVersion，无法判定版本',
        expected: `schemaVersion: ${VIDEO_EDITOR_SCHEMA_VERSION}`,
      };
    }
    if (ver > VIDEO_EDITOR_SCHEMA_VERSION) {
      return {
        status: 'reject',
        reason: `工程记录版本 ${ver} 高于当前支持的 ${VIDEO_EDITOR_SCHEMA_VERSION}`,
        expected: `<= ${VIDEO_EDITOR_SCHEMA_VERSION}`,
      };
    }

    // ── ① 低版本 → 迁移链 ──
    // 当前 schemaVersion = 1 是首版，**不存在更低版本**，故迁移链为空。
    // 不预置空 map / 空函数（零消费方的抽象 = 假接缝，铁律 5）；将来抬版本时在此逐级迁移。
    const migrated = raw;

    return { status: 'ok', value: fromRecord(migrated) };
  } catch (e) {
    if (e instanceof ProjectDataError) {
      return { status: 'reject', reason: e.message, expected: '结构完整的工程记录' };
    }
    // catch-ok: 非 ProjectDataError = 本函数的代码 bug，必须原样炸开（重抛），不静默吞、不重分类。
    throw e;
  }
}

/** 已通过版本守卫的记录 → `Project`（缺字段补全；结构不可用则抛 `ProjectDataError`）。 */
function fromRecord(raw: Record<string, unknown>): Project {
  const tracksRaw = raw.tracks;
  if (tracksRaw !== undefined && !Array.isArray(tracksRaw)) {
    throw new ProjectDataError('tracks 不是数组');
  }
  const trackList: unknown[] = Array.isArray(tracksRaw) ? tracksRaw : [];
  const tracks = trackList.map((t, i) => fromTrack(t, i));

  const settingsRaw = isPlainObject(raw.settings) ? raw.settings : {};
  const uiRaw = isPlainObject(raw.ui) ? raw.ui : {};

  return {
    schemaVersion: VIDEO_EDITOR_SCHEMA_VERSION,
    fps: num(raw.fps, DEFAULT_FPS),
    playhead: Math.max(0, num(raw.playhead, 0)),
    tracks,
    settings: {
      width: num(settingsRaw.width, DEFAULT_PROJECT_WIDTH),
      height: num(settingsRaw.height, DEFAULT_PROJECT_HEIGHT),
    },
    ui: { dockHeight: num(uiRaw.dockHeight, DEFAULT_DOCK_HEIGHT) },
  };
}

function fromTrack(raw: unknown, index: number): Track {
  if (!isPlainObject(raw)) throw new ProjectDataError(`第 ${index + 1} 条轨道不是对象`);
  const clipsRaw = raw.clips;
  if (clipsRaw !== undefined && !Array.isArray(clipsRaw)) {
    throw new ProjectDataError(`轨道 ${str(raw.id, `#${index + 1}`)} 的 clips 不是数组`);
  }
  const clipList: unknown[] = Array.isArray(clipsRaw) ? clipsRaw : [];
  const kind: TrackKind = raw.kind === 'audio' ? 'audio' : 'video';
  return {
    id: requireId(raw.id, `轨道 #${index + 1}`),
    name: str(raw.name, kind === 'video' ? DEFAULT_VIDEO_TRACK_NAME : DEFAULT_AUDIO_TRACK_NAME),
    kind,
    // 显式 overlay 标记：缺失时按类别给默认（音频=自由轨，视频=主轨），但**绝不按"第几条"推断**。
    overlay: bool(raw.overlay, kind === 'audio'),
    locked: bool(raw.locked, false),
    hidden: bool(raw.hidden, false),
    muted: bool(raw.muted, false),
    clips: clipList.map((c, i) => fromClip(c, i)),
  };
}

function fromClip(raw: unknown, index: number): Clip {
  if (!isPlainObject(raw)) throw new ProjectDataError(`第 ${index + 1} 个片段不是对象`);
  const kind: ClipKind = raw.kind === 'audio' ? 'audio' : raw.kind === 'image' ? 'image' : 'video';

  const sourceStart = Math.max(0, num(raw.sourceStart, 0));
  // 出点缺失/倒挂 → 落到「零长片段」而不是丢弃：丢弃会静默改变时间轴长度（假成功）。
  // 图片片段（含定格帧）时长来自常量，与图片素材入轨同源（§一.9 Q4）。
  const defaultEnd = kind === 'image' ? sourceStart + DEFAULT_IMAGE_CLIP_DURATION : sourceStart;
  const sourceEnd = Math.max(sourceStart, num(raw.sourceEnd, defaultEnd));

  const sizeRaw = isPlainObject(raw.size) ? raw.size : null;

  return {
    id: requireId(raw.id, `片段 #${index + 1}`),
    kind,
    sourceUrl: typeof raw.sourceUrl === 'string' && raw.sourceUrl ? raw.sourceUrl : undefined,
    assetId: typeof raw.assetId === 'string' && raw.assetId ? raw.assetId : undefined,
    nodeId: typeof raw.nodeId === 'string' && raw.nodeId ? raw.nodeId : undefined,
    sourceStart,
    sourceEnd,
    timelineStart: Math.max(0, num(raw.timelineStart, 0)),
    name: typeof raw.name === 'string' && raw.name ? raw.name : undefined,
    size:
      sizeRaw && num(sizeRaw.width, 0) > 0 && num(sizeRaw.height, 0) > 0
        ? { width: num(sizeRaw.width, 0), height: num(sizeRaw.height, 0) }
        : undefined,
    // M2 预留字段：**原样搬运**——只判「有没有」，不判形状（M1 不解释 M2 的形状，见 types.ts 说明）。
    // 不做字段级过滤：过滤会在 M2 改形状时静默丢数据（假成功）。
    volumePoints: Array.isArray(raw.volumePoints) ? raw.volumePoints : undefined,
    transform: isPlainObject(raw.transform) ? raw.transform : undefined,
    transitionIn: isPlainObject(raw.transitionIn) ? raw.transitionIn : undefined,
    transitionOut: isPlainObject(raw.transitionOut) ? raw.transitionOut : undefined,
  };
}

/**
 * id 是**实体身份**，缺了就没有可用的实体 —— 补一个只会制造「幽灵片段」，
 * 故这里**拒载**（与「缺字段补默认」的区别：默认值是可有可无的修饰，id 不是）。
 */
function requireId(v: unknown, what: string): string {
  if (typeof v === 'string' && v.length > 0) return v;
  throw new ProjectDataError(`${what} 缺少 id`);
}
