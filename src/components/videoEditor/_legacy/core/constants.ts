/**
 * 视频剪辑器 · 领域常量**单一出处**（docs/123 §一.4 末）。
 *
 * 纪律：
 *  - 一律从本文件引用，**禁止在调用处就地写魔法数**（否则「同一容差两处不同值」必漂）；
 *  - 本文件零依赖（纯常量），落 `core/` 符合「零 React / 零 IO」。
 *
 * ── 视图层常量为什么不在这里（**依赖方向 + 机器守卫强制**）──
 * `docs/123` §一.4 原把视图换算常量（`MIN/MAX_PIXELS_PER_SECOND` · `SNAP_TOLERANCE_PX`）
 * 也列进本文件。但那批常量属于 **D 组（视图换算）**，而 D 组已由审核裁定落 `base/utils/timeline/`
 * （跨 3 域共用，见 `docs/124`）：
 *  - `base/` **不许**反向依赖业务域（`check-arch` G-1 反向判据）→ base 不能 import 本文件；
 *  - `videoEditor/core/**` 只准 import `core/**` 与 `base/core/idGen.ts`（G-2 白名单）→ core 不能 import base。
 * 两条合起来 ⇒ 视图层常量与领域常量**必须分居两层**，各自在自己的唯一出处。
 *
 * 另一条通用纪律：**常量在「首次被消费处」落地，不预置**（7 步法附录 A8 + `check:dead-code`）。
 * 声明一个零消费方的常量 = 死代码，且它会以「将来可能要用」为名长期滞留。
 * 故此文件只收录**此刻真有消费者**的领域常量；`SNAP_TOLERANCE_PX` 等将在其调用点（G3/G5）到来时补入。
 */

/**
 * 浮点比较容差（docs/123 §一.1 T3）。
 *
 * 时间单位是秒（float），`a + b - c` 这类运算必然带舍入误差，故：
 *  - **比较走 `|a - b| <= EPS`**，不用 `===`；
 *  - 吸附（`snapTime`）归到**离散候选值**，禁止就地 `±=` 累积误差。
 */
export const EPS = 1e-3;

/**
 * 图片片段 / 定格帧的默认时长（秒）——与「图片素材入轨」共用同一常量，
 * 避免长出第二个「图片默认几秒」的常量（docs/123 §一.9 Q4）。
 */
export const DEFAULT_IMAGE_CLIP_DURATION = 3;

/** 工程默认帧率（帧率只影响渲染与导出采样，**不进任何时间戳存储**：docs/123 §一.1 T1 / §一.9 Q2）。 */
export const DEFAULT_FPS = 30;

/** 新工程默认画布尺寸（16:9 · 720p）。首个入轨视频/图片片段的尺寸会覆盖它（docs/120 C12）。 */
export const DEFAULT_PROJECT_WIDTH = 1280;
export const DEFAULT_PROJECT_HEIGHT = 720;

/** 基座默认高度（px）。属 UI 记忆，随工程落盘（docs/120 C2 的 `ui.dockHeight`）。 */
export const DEFAULT_DOCK_HEIGHT = 280;

/** **视频轨**行高默认（px）。属 UI 记忆，随工程落盘（`docs/120` C7.5 轨道高度可调，`ui.rowHeight`）。 */
export const DEFAULT_ROW_HEIGHT = 38;

/** 视频轨行高可调范围（px，C7.5）。 */
export const ROW_HEIGHT_MIN = 24;
export const ROW_HEIGHT_MAX = 96;

/**
 * **音频轨 / 文字轨的固定行高**（px）—— **不随「轨道高度」滑块缩放**（用户裁定 2026-09-14）。
 *
 * 【★规则变更（用户口径）】「我们放大缩小轨道，**只针对视频轨道**」。
 * 原实现把 `ui.rowHeight` 一个值发给**所有轨**（`TrackHead` / `Lane` 同收一个 `rowHeight`），
 * 于是调大视频轨时**音频轨也跟着变高** —— 与用户意图相反。
 *
 * 【为什么音频轨不该跟着变】
 *  - 音频轨没有**胶片条**（C11.10 的「胶片条随行高缩放」这条理由对它不成立）——
 *    它的波形是「占剩余高度」派生的，行高变大只是把波形拉得更扁长，**不增加任何信息**；
 *  - 它高度变大只会挤占视频轨（用户的注意力所在）的可视面积。
 *
 * 【为什么文字轨更该固定】文字片段是**展示型**（内容即文字），行高一味放大只是浪费纵向空间，
 * 且 mockup 明确要求紧凑（24px）。
 */
export const AUDIO_TRACK_ROW_HEIGHT = 30;
export const TEXT_TRACK_ROW_HEIGHT = 24;

/** 轨道默认显示名（按 `TrackKind` 一一对应，新增类别时必须在此表态）。 */
export const DEFAULT_VIDEO_TRACK_NAME = '视频';
export const DEFAULT_AUDIO_TRACK_NAME = '音频';
/** 文字轨默认名（★新增 2026-09-14：与 `TrackKind: 'text'` 同批）。 */
export const DEFAULT_TEXT_TRACK_NAME = '文字';

/* 注：文字轨的**固定紧凑行高**（24px，不纳入 `ui.rowHeight`，用户裁定 2026-09-14）
 * 尚未落地为常量 —— 它的**首次消费方**是 M2 的轨道渲染（`Lane`/`TrackHead` 按类别取行高）。
 * 按纪律「常量在首次被消费处落地，不预置」（7 步法 A8 + `check:dead-code`）：
 * 现在加会是一个**零消费的死常量**（已被死代码闸当场抓过一次），故留到 M2 接 UI 时再加。 */

/**
 * 轨道数量上限（视频 / 音频**各自**计算）。
 *
 * 为什么设上限：`tracks` 每次编辑都是整份快照入撤销栈（`useEditorProject`），
 * 轨道数不封顶时，一次误操作点几十下「加轨」会把撤销栈撑成几十份大数组。
 * 40 条远超真实剪辑需求（专业 NLE 的时间轴可容纳轨道数亦在几十量级），
 * 且不设上限的「无限」在 UI 上没有意义（轨道区滚不了那么多还看得清）。
 */
export const MAX_TRACKS_PER_KIND = 40;

/**
 * 吸附容差（**像素**，不是秒）。
 *
 * 首次被消费处（2026-09-13 · G5）：播放头落点吸附（`docs/123` §二.9 第 4 行的「地基解」——
 * 「落在片段边界」由此变成**明确状态**，`splitAt` 才得以不设魔法容差）与自由轨拖拽落位。
 * 容差必须以像素给：用户感知的是「鼠标离那条线多近」，同一秒数在不同缩放下像素距离不同
 * （详见 `base/utils/timeline/timeScale.ts::snapTime` 的说明）。
 */
export const SNAP_TOLERANCE_PX = 8;

/** 缩放步进：每次 ⊖ / ⊕ 按此倍率乘除（再经 `clampZoom` 夹取）。 */
export const ZOOM_STEP = 1.4;

/**
 * 顶部拖柄「点按 vs 拖动」的判定容差（px，C7.5 收起出口）。
 *
 * 拖柄一物两用：位移 ≤ 本值 = 用户只是**点了一下** → 收起基座；超过则视为在**调高度**。
 * 取 6px 与 tab 拖拽的 `MOVE_THRESHOLD`（`assistantTable/useTabDragSort.ts`，同为 4-6px 档）
 * 同一量级：小于此值多是手抖 / 触控板轻触，不该被当成拖动。
 */
export const DOCK_CLICK_TOLERANCE_PX = 6;

/**
 * 工程记录结构版本（`docs/120` C1/C2 的 schemaVersion 守卫基准）。
 *
 * 只在**改变 `tracks` / `settings` 结构**（新增/重命名影响旧数据可读性的字段）时抬升，并补迁移分支。
 * 读取端语义（`normalizeProject`）：低于本值 → 迁移；**等于** → 直用；
 * **缺失 / 高于本值 / 结构损坏 → 拒载并明示**（绝不按缺字段渲染出半截工程）。
 */
export const VIDEO_EDITOR_SCHEMA_VERSION = 1;
