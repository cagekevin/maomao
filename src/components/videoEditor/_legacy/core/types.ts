/**
 * 视频剪辑器 · 领域数据模型（SSOT 三实体：Project / Track / Clip）。
 *
 * 契约来源：`docs/120` C1（工程数据模型）· `docs/123` §一.1/§一.2（时间原语 / 数据模型）。
 * 本文件**零依赖**（不 import React / 存储 / 网络），符合 `docs/123` §二 铁律；
 * 机器守卫见 `scripts/check-arch.mjs` 规则 4（`videoEditor/core` 导入白名单）。
 *
 * ── 时间纪律（docs/123 §一.1）──
 *  - **T1 唯一单位 = 秒（float）**：帧不是存储单位，只是显示与导出采样；
 *  - **T2 派生不落盘**：`duration`（= sourceEnd - sourceStart）与 `clipEnd`（= timelineStart + duration）
 *    **不存**，一律经 `clipDuration()` / `clipEnd()` 现算 —— 存了就会与源字段漂移；
 *  - **T3 浮点纪律**：比较走 `EPS`（见 `constants.ts`）。
 *
 * ── 命名对齐（重要 · 非笔误）──
 * 入点/出点字段名是 `sourceStart` / `sourceEnd`，**不是** `sourceIn` / `sourceOut`。
 * 依据（三处一致，改名会立刻造成第二套命名 = SSOT 第二份）：
 *  1. 仓内既有持久化字段就是这两个名：`VideoProcessNode.tsx:204 TimelineClip{sourceStart,sourceEnd,timelineStart}`，
 *     而 `docs/123` §二.2 明确要求「片段持久化字段须与 `TimelineClip` 对齐」；
 *  2. 前置收口已把跨域映射原语下沉为 `base/utils/timeline/sourceTime.ts`，其入参类型
 *     `ClipTimeWindow{timelineStart?, sourceStart?}` 用的就是 `sourceStart`
 *     （`docs/123` §一.4 已由审核改判：A 组跨域部分 → `base/utils/timeline/`，**直接复用、严禁重写**）；
 *  3. 若此处改叫 `sourceIn`，则共用原语无法被 `Clip` 直接喂入，每个调用点都要写适配 → 正是要避免的「同一真相两份」。
 * （`docs/123` §一.1 原表写的是 `sourceIn/sourceOut`，与同文 §二.2 及仓内事实冲突；
 *   按「代码事实可自裁」（7 步法附录 A3）取仓内名，待回改 123 §一.1。）
 */

/** 时间原语别名：一切时间字段都是「秒」的 float（仅为可读性，非新单位）。 */
type Seconds = number;

/**
 * 片段媒体类别。
 *  - `image` 用于图片素材与定格帧产物（`docs/120` C15.3：定格不新增 clip 类型）；
 *  - `text` 是**唯一凭空创建的片段**（M2）：文字没有源素材，其内容/样式在 `textStyle`。
 *    ★新增(2026-09-14)：类型先行、UI 后到（用户裁定「现在加上，省得 M2 再来加一次」）。
 */
export type ClipKind = 'video' | 'audio' | 'image' | 'text';

/**
 * 轨道类别（`docs/120` C11.1 的分轨唯一判据据此分轨）。
 *
 * `text` = **文字轨**（M2）：专装文字片段，固定紧凑行高（不纳入 `ui.rowHeight`，见 `constants.ts`）。
 * ★新增(2026-09-14)：与 `ClipKind: 'text'` 同批加入 —— 只加片段类别而不加轨道类别
 * 会得到「文字片段只能混在视频轨上」的半成品（= 数据看不清），故两者必须同时到位。
 */
export type TrackKind = 'video' | 'audio' | 'text';

/* ────────────────────────────────────────────────────────────────
 * M2 预留字段（docs/123 §一.4 里程碑过滤）
 *
 * 原则：**数据模型留字段**（120 C1：免迁移），**但 M1 不实现其原语、不消费其值**。
 * 「留字段」说的是**序列化字段位置**保留，**不是 M1 替 M2 定型**。
 *
 * 故这里四个字段的类型刻意是 `unknown`：M1 **不知道也不该猜**它的形状。
 * 若 M1 写死一个猜测的形状（如 `{ t, gain }[]`），加载时就会拿这个猜测去"校验"，
 * M2 的真实形状一旦不同 → 字段被静默过滤掉 = 数据丢失且无提示（7 步法 Step 4 禁「假成功」）。
 * M2 定稿时把 `unknown` 收窄成真实类型即可 —— 只改类型、无数据迁移成本。
 * ──────────────────────────────────────────────────────────────── */

/**
 * 片段 —— 时间轴上的一个媒体区间。
 *
 * 不变量（docs/123 §一.2/一.3）：
 *  - `sourceEnd >= sourceStart`（`clipDuration` 再夹 `max(0, …)` 兜住脏数据）；
 *  - `timelineStart >= 0`；
 *  - 主视频轨上 `clips[i+1].timelineStart === clipEnd(clips[i])`（EPS 内，磁吸态）。
 */
export interface Clip {
  /** 全局唯一 id。一律 `generateId()` 生成（`base/core/idGen.ts`），**禁时间基后缀**（docs/123 §二.5）。 */
  id: string;
  /** 素材类别。 */
  kind: ClipKind;

  /* ── 素材来源三态（docs/123 §一.2 R1/R2）── */
  /**
   * 画布节点产物 URL / 本机落盘 `/files/...`。
   * 与 `assetId` 任一能解析出即可读；两者皆空 → 断链（判定与处置只走 docs/120 C13）。
   */
  sourceUrl?: string;
  /** 素材库资源 id（经素材库 resolve，与 `ResourceItem.id` 对齐）。 */
  assetId?: string;
  /**
   * 来源画布节点 id —— **只读溯源标记，不作寻址键**（docs/123 §一.2 R2）。
   * 用途仅限「回填产物 URL / 导出结果回写来源节点提示」，不得据此找素材。
   */
  nodeId?: string;

  /* ── 时间（秒；T1/T2）── */
  /** 从源素材取用的**入点**（秒）。字段名对齐仓内既有 `TimelineClip.sourceStart`，见文件头说明。 */
  sourceStart: Seconds;
  /** 从源素材取用的**出点**（秒）。注意：`sourceEnd - sourceStart` 才是片段时长，**不落盘**（T2）。 */
  sourceEnd: Seconds;
  /** 片段在工程时间轴上的**起点**（秒）。 */
  timelineStart: Seconds;

  /* ── 显示与判据辅助 ── */
  /** 源素材显示名（仅显示，不参与任何判据）。 */
  name?: string;
  /**
   * 素材尺寸（像素），由探测得到（`hooks/useEditorSources` 写入）。
   * `needsCompositing` 的判据之一：`存在片段尺寸 ≠ 工程尺寸 → 必须合成`（docs/120 C12.1 红线）。
   * 探测不到时可缺省 —— 缺省视为「与工程一致」（放行直通），这是保守但诚实的选择：
   * 真不一致时尺寸必然已探到。
   */
  size?: { width: number; height: number };

  /* ── M2 预留（M1 不解释形状、不消费；见上方说明）── */
  /** 音量包络控制点（M2）。M1 只知道「有没有设」，不知道里面是什么。 */
  volumePoints?: unknown;
  /** 画中画 / 位移缩放（M2）。 */
  transform?: unknown;
  /** 转场（M2）。 */
  transitionIn?: unknown;
  transitionOut?: unknown;
  /**
   * 文字片段的内容与样式（M2；仅 `kind: 'text'` 有意义）。
   *
   * ★新增(2026-09-14)：形状刻意留 `unknown` —— 与上面四个 M2 字段同一条纪律：
   * **「留字段」指序列化位置，不是 M1 替 M2 定型**。若此处写死猜测形状（如 `{content,size}`），
   * 加载时就会拿这个猜测去「校验」，M2 真实形状一旦不同 → 字段被**静默过滤** = 数据丢失（假成功）。
   * M2 定稿时把 `unknown` 收窄成真实类型即可 —— **只改类型、无数据迁移成本**。
   *
   * 它同时是 `needsCompositing` ⑤ 的触发字段（文字必须渲染进画面，无法无损直通）。
   */
  textStyle?: unknown;
}

/**
 * 轨道 —— 两类 × 三状态（docs/123 §一.2）。
 *
 * **两类的判据是显式 `overlay` 标记**，不是「第一条就是主轨」的位置推断：
 * 位置推断在「删除首轨 / 拖序 / 未来增删轨」时全都会说谎。
 *  - 主视频轨：`overlay === false`（磁吸：无空隙、首尾相接，任何增删后 `relayoutSequential` 压实）；
 *  - 自由轨：`overlay === true`（叠加 / 音频：可留空，保留自由时间位置）。
 *
 * **三状态只增字段、不增实体**（docs/120 C7.1）：`locked` / `hidden` / `muted`，
 * 三者只影响「能不能编辑 / 渲不渲染 / 出不出声」，**都不改 `clips` 数据**。
 */
export interface Track {
  id: string;
  /** 轨道显示名（仅显示）。 */
  name: string;
  kind: TrackKind;
  /** 磁吸判据的唯一来源：`true` = 自由轨（可留空），`false` = 主视频轨（压实）。 */
  overlay: boolean;
  /** 锁定：禁止一切编辑（docs/120 C7.3）。 */
  locked: boolean;
  /** 隐藏：只影响渲染与导出，不动数据。 */
  hidden: boolean;
  /** 静音：只影响出声与导出音轨，不动数据。 */
  muted: boolean;
  /** 片段（顺序 = 入轨先后，docs/123 §一.3 I2；**库内不存在任何排序函数**）。 */
  clips: Clip[];
}

/** 工程参数（docs/120 C12：导出的唯一基准）。 */
interface ProjectSettings {
  /** 工程画布宽度（px）。 */
  width: number;
  /** 工程画布高度（px）。 */
  height: number;
}

/** 基座 UI 记忆（随工程落盘，docs/120 C2 的 `ui.dockHeight`、C7.5 的 `ui.rowHeight`）。 */
interface ProjectUI {
  dockHeight: number;
  /** 轨道行高（px，C7.5）。可选 = 兼容旧工程无此字段 → 回落默认。 */
  rowHeight?: number;
  /**
   * **吸附开关**（工具带「吸附」按钮）：`true` / 缺省 = 主轨磁吸（无空隙、删除自动补齐）；
   * `false` = 主轨允许留空隙（拖拽可拖出缝、删除留洞）。
   *
   * 【为什么属于 UI 而非 Track/Clip】它是一条**编辑行为偏好**（用户怎么排片），
   * 不是轨道或片段自身的属性 —— 存进 Track 会让「同一轨在不同工程里语义不同」。
   * 【为什么落 ui 而非顶层】它与 `dockHeight` / `rowHeight` 同类：**随工程落盘、不进撤销栈**，
   * 故复用 `applyProjectPatch` 这一条写者（`docs/120` C2.2）。
   * 缺省视为 `true`（磁吸）：旧工程无此字段 → 回到历史行为，不会突然变得可留缝。
   */
  magnetic?: boolean;
}

/**
 * 工程记录 —— **`tracks` 的唯一真相源**（docs/120 C2.4）。
 *
 * 身份 = 存储键 `video-editor-project-{projectId}`（docs/120 C2），
 * 故记录体内**不再存 `projectId`**：键即身份，存一份副本只会长出「键与值不一致」的判据。
 * （`docs/120` C1 表里写「`projectId` 必须有」，与同文 C2 的键设计冲突；
 *   按 `docs/123` §一.4 的签名 `createEmptyProject()` / `normalizeProject(raw)` 均无 projectId 入参，
 *   取「身份在外」这一支。）
 *
 * 无锚点节点：形态定稿后入口是全局的，画布节点**只被读**（点选派生素材），不回写、也不被回写（docs/120 C2.4）。
 */
export interface Project {
  /** 结构版本。读到**高于**本版本 → 按「无工程」处理（docs/120 C1/C2），不按缺字段渲染。 */
  schemaVersion: number;
  /** 帧率：只影响渲染与导出采样，**改它不移动任何片段**（docs/123 §一.9 Q2）。 */
  fps: number;
  /** 播放头位置（秒）。 */
  playhead: Seconds;
  /** 轨道集合。M1 固定双轨（视频 ×1 + 音频 ×1，docs/123 §一.9 Q3）。 */
  tracks: Track[];
  /** 工程参数（导出唯一基准）。 */
  settings: ProjectSettings;
  /** 基座 UI 记忆。 */
  ui: ProjectUI;
}
