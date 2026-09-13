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
  DEFAULT_ROW_HEIGHT,
  DEFAULT_TEXT_TRACK_NAME,
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
 * 空工程：fps 30 / playhead 0 / **初始双轨**（视频 ×1 主轨磁吸 + 音频 ×1 自由）。
 *
 * 【M2 起轨道集合不再是固定的】`docs/123` §一.9 Q3 的「M1 轨道集合固定」已被 M2 取代：
 * 用户可经轨道头加/删轨（`core/timelineOps.ts::appendTrack` / `removeTrack`）。
 * `createEmptyProject` 只负责给出**开箱可用的最小集合**（一条主视频轨 + 一条音频轨），
 * 它不是「轨道数上限」的判据 —— 那个判据在 `MAX_TRACKS_PER_KIND`。
 *
 * 空工程是合法状态（`docs/120` C11.9：不设最少片段数），故 `clips` 为空数组。
 */
export function createEmptyProject(): Project {
  return {
    schemaVersion: VIDEO_EDITOR_SCHEMA_VERSION,
    fps: DEFAULT_FPS,
    playhead: 0,
    tracks: [createEmptyTrack('video'), createEmptyTrack('audio')],
    settings: { width: DEFAULT_PROJECT_WIDTH, height: DEFAULT_PROJECT_HEIGHT },
    ui: { dockHeight: DEFAULT_DOCK_HEIGHT, rowHeight: DEFAULT_ROW_HEIGHT },
  };
}

/**
 * 建一条空轨 —— **新建轨道的唯一出处**（`createEmptyProject` 与「加轨」动作共用它）。
 *
 * `overlay` 缺省由 `DEFAULT_OVERLAY_OF` 决定：音频/文字轨天然自由；**首个**视频轨是主轨（磁吸）。
 * 新增的**第二条及以后**视频轨必须是叠加轨（`overlay: true`）—— 主轨只能有一条，
 * 否则「主轨压实」与直通导出都会有两条轨同时声称自己是主轨（判据说谎）。
 * 故「加轨」的调用方**必须显式传 `overlay`**，见 `core/timelineOps.ts::appendTrack`。
 *
 * ★改（2026-09-14）：轨道的 id 前缀 / 默认名 / overlay 缺省三件事，
 * 从「一个个三元表达式」收成**三张 `Record<TrackKind, …>` 表**。
 * 理由与 `routeClipToTrack` 同源：三元表达式在新增 `TrackKind` 时**不报错、静默归位**，
 * 而 `Record` 缺键即编译错误 —— 加 `'text'` 那天编译器会点名这三张表（实测有效）。
 */
const TRACK_ID_PREFIX: Record<TrackKind, string> = {
  video: 'track-v',
  audio: 'track-a',
  text: 'track-t',
};

const TRACK_DEFAULT_NAME: Record<TrackKind, string> = {
  video: DEFAULT_VIDEO_TRACK_NAME,
  audio: DEFAULT_AUDIO_TRACK_NAME,
  text: DEFAULT_TEXT_TRACK_NAME,
};

/** 各类轨在**缺省**时是不是自由轨（`overlay: true`）。主视频轨的例外由「首条」规则另判。 */
const DEFAULT_OVERLAY_OF: Record<TrackKind, boolean> = {
  video: false,
  audio: true,
  text: true,
};

export function createEmptyTrack(kind: TrackKind, overlay = DEFAULT_OVERLAY_OF[kind]): Track {
  return {
    id: generateId(TRACK_ID_PREFIX[kind]),
    // 新轨名与既有轨重名是常态（都叫「视频」），此处**不做去重编号**：
    // 编号要读全量 tracks 才能算，而它是**显示名**（`name` 不参与任何判据，见 types.ts），
    // 为显示名引入「读全集合」的耦合不值得。UI 侧按位置显示 V1/V2/A1/A2，名字只作 fallback。
    name: TRACK_DEFAULT_NAME[kind],
    kind,
    // 音频/文字轨天然是自由轨（不压实）；**首个**视频轨是主轨（磁吸），新增视频轨是叠加轨（自由）。
    overlay,
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
  // 多轨不变量（加载期唯一入口负责）：**主轨（`overlay:false` 的视频轨）至多一条**。
  // 旧工程 / 手工编辑的 JSON 里可能出现两条 `overlay:false` 视频轨（M1 时代不可能、M2 可能被写坏），
  // 若放行，「主轨压实」与直通导出会各有两条轨声称是主轨（判据说谎）。故**加载期收敛**：
  // 保留第一条主轨，其余降级为叠加轨 —— 且这不改任何 `clips` 数据（只是压实行为不再作用其上）。
  const normalizedTracks = enforceLayerOrder(enforceSingleMainTrack(tracks));

  const settingsRaw = isPlainObject(raw.settings) ? raw.settings : {};
  const uiRaw = isPlainObject(raw.ui) ? raw.ui : {};

  return {
    schemaVersion: VIDEO_EDITOR_SCHEMA_VERSION,
    fps: num(raw.fps, DEFAULT_FPS),
    playhead: Math.max(0, num(raw.playhead, 0)),
    tracks: normalizedTracks,
    /** 工程参数（导出唯一基准）。 */
    settings: {
      width: num(settingsRaw.width, DEFAULT_PROJECT_WIDTH),
      height: num(settingsRaw.height, DEFAULT_PROJECT_HEIGHT),
    },
    // ── 持久化边界（docs/120 C2 · C7.5 · C12）──
    // `ui` 只承载**工程 UI 记忆**（dockHeight / rowHeight / magnetic）：它随工程落盘、跨刷新/切项目保留。
    // **视图快变量**（缩放 pps / 选中 / 面板开合 / 播放态）永不在模型里 —— 它们是"这次的屏幕此刻"，不该是工程真源。
    // 这里用**字段白名单**读取：即便调用方误把某个视图快变量写进了原始 `ui`，`fromRecord` 也不认它，
    // 读取端即把它丢弃 → 模型不会被有害字段污染（靠结构，不靠自觉）。
    // ⚠️ **新增 `ui` 字段必须在此登记**，否则落盘后会被静默丢弃（`magnetic` 首版就踩过这个坑）。
    ui: {
      dockHeight: num(uiRaw.dockHeight, DEFAULT_DOCK_HEIGHT),
      rowHeight: num(uiRaw.rowHeight, DEFAULT_ROW_HEIGHT),
      // 吸附开关：缺省 = `true`（磁吸）。非布尔一律回落缺省（不认 "false" 字符串这种脏值）。
      magnetic: typeof uiRaw.magnetic === 'boolean' ? uiRaw.magnetic : undefined,
    },
  };
}

/**
 * 主轨至多一条（加载期不变量，见 `fromRecord` 调用处说明）。
 * 视频轨里**第一条** `overlay:false` 保留为主轨，其余 `overlay:false` 的视频轨降为叠加轨。
 * 音频轨不受影响（它们恒为自由轨，`overlay` 语义不参与压实判断之外的任何东西）。
 * 已经合法（0 或 1 条主轨）→ 返回**原数组引用**（I4 同精神：无变化不动）。
 */
function enforceSingleMainTrack(tracks: Track[]): Track[] {
  let mainSeen = false;
  let changed = false;
  const next = tracks.map((track) => {
    if (track.kind !== 'video' || track.overlay) return track;
    if (!mainSeen) {
      mainSeen = true;
      return track;
    }
    changed = true;
    return { ...track, overlay: true };
  });
  return changed ? next : tracks;
}

/**
 * 层序不变量（**加载期收敛**）—— 文字轨必须**排在所有视频类轨之前**（用户口径 2026-09-14）。
 *
 * ── 数组序的确切语义（★2026-09-14 起，两处方向已对齐）──
 * ```
 * 数组 index 越小  ⇒  轨道区显示越靠上  ⇒  画面里越靠上（renderFrameAt 倒序绘制）
 * ```
 * 故「**文字在视频之上**（不管是轨道还是画面）」= 文字轨的 index 必须**小于**任何视频类轨。
 * 音频轨不参与画面层序（无画面），故**保持原位**、不强行搬迁。
 *
 * 【为什么必须在加载期收敛，而不是靠「加轨时插对位置」】
 * `appendTrack` 只在**新建轨**时决定位置；而 `tracks` 顺序还会从**别处**进来：
 * 加载旧工程 JSON、手工编辑的工程记录、将来可能的「拖拽重排轨道」——
 * 那些路径都**不经过** `appendTrack`。若只靠新建时插对，就会出现「旧工程里文字被视频盖住」，
 * 且**没有任何提示**（用户只看到文字不见了）。改在**加载期唯一入口**收敛，
 * 与 `enforceSingleMainTrack` 同一手法：**不管顺序从哪来，进来就合规**。
 *
 * 【为什么是「重排」而不是「拒载」】它是**顺序偏好**，不是数据损坏 ——
 * 重排不丢任何片段、不改任何 clips，故按结构性收敛处理（拒载会让用户打不开自己的工程，代价过大）。
 *
 * 【已合规 → 返回原数组引用】（I4 同精神：无变化不动）
 */
function enforceLayerOrder(tracks: Track[]): Track[] {
  // 稳定分区：文字类轨在前，其余（视频类 + 音频类）**保持原有相对顺序**。
  // 用「分区」而非「排序」：排序会改变同类轨之间的既有次序（那是有意义的用户编排），
  // 而分区只把文字轨整体前移，**不触碰其它任何轨的相对顺序**。
  const texts = tracks.filter((t) => t.kind === 'text');
  if (texts.length === 0) return tracks; // 无文字轨 → 无需收敛（I4）
  const others = tracks.filter((t) => t.kind !== 'text');
  const next = [...texts, ...others];
  // 逐元素引用比较：全等 = 本来就在前 → 返回原引用（不制造新数组，避免误触发落盘）
  const same = next.length === tracks.length && next.every((t, i) => t === tracks[i]);
  return same ? tracks : next;
}

function fromTrack(raw: unknown, index: number): Track {
  if (!isPlainObject(raw)) throw new ProjectDataError(`第 ${index + 1} 条轨道不是对象`);
  const clipsRaw = raw.clips;
  if (clipsRaw !== undefined && !Array.isArray(clipsRaw)) {
    throw new ProjectDataError(`轨道 ${str(raw.id, `#${index + 1}`)} 的 clips 不是数组`);
  }
  const clipList: unknown[] = Array.isArray(clipsRaw) ? clipsRaw : [];
  const kind = requireTrackKind(raw.kind, `轨道 #${index + 1}`);
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
  const kind = requireClipKind(raw.kind, `片段 #${index + 1}`);

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

/* ────────────────────────────────────────────────────────────
 * 类别的**唯一取值域**（★新增 2026-09-14 · 用户裁定「不要兜底，直接报错」）
 *
 * 【为什么是「拒载」而不是「回落默认」】
 * 原实现把未知 kind **静默归位**：`raw.kind === 'audio' ? 'audio' : 'video'`。
 * 失效模式是**最坏的一种** —— 数据被**改写**且**无人知晓**：
 *   · 一个损坏/未来的 `kind: 'text'` 轨道，会被**当作视频轨**加载 → 用户看到它进了错误的层；
 *   · 一个 `kind: 'gif'` 片段会被**当作视频片段** → 时间轴长度/渲染/导出全按错的语义走；
 *   · 而且**永远不会报错**（因为「归位」看起来总是成功的）。
 * 用户口径：**「我不喜欢有错误他不报，走了兜底，导致后面数据不清楚」** —— 说的正是这条。
 *
 * 故改为**白名单校验 + 拒载**（`ProjectDataError` → 上层 `normalizeProject` 转 `reject`，
 * 由 `projectRepository` 按「无工程」处理并向用户明示，`docs/120` C1/C2）。
 * 拒载的代价是「这个工程读不出来」，但**数据不会被悄悄改坏** ——
 * 宁可让用户看见「读不出来」，也不让他带着被篡改的数据继续编辑（正确性优先）。
 *
 * ⚠️ **新增类别时这里必须同步**：`CLIP_KINDS` / `TRACK_KINDS` 是**唯一取值域**，
 * 加进 `ClipKind` / `TrackKind` 类型却漏加进集合 → 该类别的新数据**读不出来**（响亮失败，非静默）。
 * ──────────────────────────────────────────────────────────── */

/* ── `ClipKind` / `TrackKind` 的运行时取值域 ──
 *
 * ⚠️⚠️ **必须用 `as const` 数组保留字面量**（三种 `Set` 写法实测**全部宽化**、对账因此失效）：
 *   · `new Set<ClipKind>([...])` → 推出 `Set<ClipKind>` = **全集** ⇒ 差集恒空
 *   · `new Set([...])`           → 推出 `Set<string>` ⇒ 同样宽化
 *   · `: ReadonlySet<string>`    → 显式标注直接擦掉字面量
 * 故取值域的**真源**是下面两个 `as const` 数组（窄字面量联合），
 * 运行时 `Set` 由 `kindSetOf()` 派生（只为 `.has()` 校验）。
 * 与 `ClipKind` / `TrackKind` 的**相等性**由 `KindSetsInSync` 在使用点断言（编译期强制）。
 */
const CLIP_KIND_LIST = ['video', 'audio', 'image', 'text'] as const;
const TRACK_KIND_LIST = ['video', 'audio', 'text'] as const;

/** `as const` 数组 → 运行时 `Set`（唯一消费点是 `.has()` 校验）。 */
const kindSetOf = <T extends string>(list: readonly T[]): ReadonlySet<T> => new Set<T>(list);

const CLIP_KINDS = kindSetOf(CLIP_KIND_LIST);
const TRACK_KINDS = kindSetOf(TRACK_KIND_LIST);

/**
 * **类型守卫**版的白名单校验：命中即把 `unknown` 收窄成该集合的成员类型。
 *
 * 【为什么必须是类型谓词，不能靠 `has()` + `as`】
 * `Set.has()` **不是**类型守卫，TS 不会因它收窄 —— 所以 `return v as ClipKind` 里的
 * `as` 是**假收窄**（断言掉的是编译器本该帮我们证的东西）。
 * 写成 `v is T` 后，收窄由**一次真实判断**（`typeof` + `has`）支撑，调用方拿到的是真类型。
 * （本仓 `strict:false`，但这与 strict 无关 —— 收窄逻辑本身要成立。）
 */
function isMemberOf<T extends string>(v: unknown, allowed: ReadonlySet<T>): v is T {
  return typeof v === 'string' && allowed.has(v as T);
}

/* ── ★运行时集合必须与类型声明**恰好相等**（编译期强制，零运行时成本）──
 *
 * 【为什么需要它】`Set` 是**运行时**取值域，而 `ClipKind` 是**编译期**类型 ——
 * 两者若不同步，编译器**不会报错**（`Set` 的 `.has()` 看不到少了一个成员）。
 * 后果：新类别的新数据被**拒载**（读不出来），而开发者以为「类型加完了就完事了」。
 *
 * 【⚠️ 断言形态踩坑：三次试错，前两次都是「看起来有守卫、实测不报」】
 *  ① `type X<T,S> = [MissingFrom<T,S>[], ExtraIn<T,S>[]]` + `const x: X<…> = [[], []]`
 *     → **漏报**：空数组字面量 `[]` 对任何 `Y[]` 都合法，"差集非空"也照样通过。
 *  ② 对象字面量 `{ missing: [], extra: [] }` → **同样漏报**（同一原因）。
 *  ③ **反向断言**（本版）：把「差集」赋给 `never` 的位置 —— 差集非空即不可赋值 ⇒ **报错**。
 * 且错误信息里**带着差集本身**（探针实测：`Type '"text"' is not assignable to 'never'`），
 * 直接告诉开发者缺哪个成员。
 * ⚠️ **另一个前提**：断言有效的前提是集合**不被宽化** —— 故上面必须用 `as const` 数组
 * （见 `CLIP_KIND_LIST` 处的说明）。
 */
type MissingFrom<T extends string, S extends ReadonlySet<string>> = Exclude<T, SetMember<S>>;
type ExtraIn<T extends string, S extends ReadonlySet<string>> = Exclude<SetMember<S>, T>;
type SetMember<S> = S extends ReadonlySet<infer U> ? U : never;

/**
 * 编译期对账：断言「类型联合 `T`」与「运行时集合 `S`」**恰好相等**。
 * 求值成 `true` = 相等；否则求值成**元组**（`'漏成员' | '多余成员'`, 差集）⇒ 赋给 `true` 即报错。
 *
 * 【为什么用反向断言而不是「差集数组 = 空数组」】见上方「⚠️ 断言形态踩坑」。
 * 【为什么 `T extends string`】让它只接受字符串联合（`ClipKind` / `TrackKind` 都满足）。
 */
type AssertKindSetExact<T extends string, S extends ReadonlySet<string>> =
  MissingFrom<T, S> extends never
    ? ExtraIn<T, S> extends never
      ? true
      : ['多余成员（类型里没有、集合里有）', ExtraIn<T, S>]
    : ['漏成员（类型里有、集合里没有）', MissingFrom<T, S>];

/**
 * 片段的 `kind` 必须是已知类别 —— 未知即**拒载**（不静默归位，见上方说明）。
 *
 * 【★编译期对账】`CLIP_KINDS` 必须与 `ClipKind` **恰好相等**（不等则下面那行报错）。
 * 这是「类型声明」与「运行时取值域」之间唯一的同步机制 —— 缺了它，
 * 新增 `ClipKind` 时集合会静默漏成员（实测过：编译器与测试都不报）。
 */
function requireClipKind(v: unknown, what: string): ClipKind {
  // ★编译期对账（反向断言）：`CLIP_KINDS` 必须与 `ClipKind` **恰好相等**；
  //   不等则**本行**报错，且错误信息里直接列出差集（漏/多了哪个类别）。
  const sync: true = null as unknown as AssertKindSetExact<ClipKind, typeof CLIP_KINDS>;
  void sync; // 纯类型层（运行时被消除）
  // 类型谓词收窄（真判断支撑，非 `as` 假收窄 —— 见 `isMemberOf` 说明）
  if (!isMemberOf(v, CLIP_KINDS)) {
    throw new ProjectDataError(
      `${what} 的 kind 无法识别（读到 ${JSON.stringify(v)}，已知取值：${[...CLIP_KINDS].join(' / ')}）`,
    );
  }
  return v;
}

/**
 * 轨道的 `kind` 必须是已知类别 —— 未知即**拒载**（不静默归位，见上方说明）。
 * 【★编译期对账】同 `requireClipKind`：`TRACK_KINDS` 必须与 `TrackKind` 恰好相等。
 */
function requireTrackKind(v: unknown, what: string): TrackKind {
  // ★编译期对账（反向断言）：同 `requireClipKind`
  const sync: true = null as unknown as AssertKindSetExact<TrackKind, typeof TRACK_KINDS>;
  void sync; // 纯类型层（运行时被消除）
  if (!isMemberOf(v, TRACK_KINDS)) {
    throw new ProjectDataError(
      `${what} 的 kind 无法识别（读到 ${JSON.stringify(v)}，已知取值：${[...TRACK_KINDS].join(' / ')}）`,
    );
  }
  return v;
}
