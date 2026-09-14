/**
 * C 组 · 判据（谓词）—— `docs/123` §一.4 C 组。
 *
 * 纪律：**每个判据只准有一个真值源**。UI 里不许内联 `kind === 'audio' ? … : …`、
 * 不许内联 `sizes.every(s => s === project.size)` 这类判断 —— 判据一旦被抄成两份，必漂
 * （7 步法 Step 3：**探测重复可收口，判据重复不可合并且必须单点**）。
 *
 * 本文件零外部依赖（只 import 本目录的类型），符合 `docs/123` §二 铁律。
 */
import { AUDIO_TRACK_ROW_HEIGHT, TEXT_TRACK_ROW_HEIGHT } from './constants.ts';
import { findTrackOfClip, hasOverlap } from './timelineOps.ts';
import type { Clip, ClipKind, Project, Track, TrackKind } from './types.ts';

/* `findTrackOfClip` 的**唯一实现**已按「查询归 A 组」下移到 `timelineOps.ts::findTrackOfClip`
 * （原因：编辑层也要用它，留在本文件会与 `timelineOps → routeClip` 成环）。
 * 此处 re-export 只为**保持既有消费方零改动**（`import { findTrackOfClip } from './routeClip'`），
 * 不是第二份实现。 */
export { findTrackOfClip };

/* ────────────────────────────────────────────────────────────────
 * 分轨唯一判据（docs/120 C11.1）
 * ──────────────────────────────────────────────────────────────── */

/**
 * 片段类别 → 落轨类别（**分轨唯一判据** · `docs/120` C11.1）。
 *
 * ── ★改：二选一 → 显式穷举表（2026-09-14 · 用户裁定「我喜欢直接报错…一次性做正确」）──
 *
 * 【为什么必须是穷举表，不能是三选一表达式】
 * 原写法 `kind === 'audio' ? 'audio' : 'video'` 的失效模式是**静默的**：
 * 新增一个 `ClipKind`（如 M2 的 `'text'`）时，它**不会报错**，只会**默默归到 `'video'`** ——
 * 于是文字片段被放进视频轨（或将来某种新片段被放进错误的轨），
 * 而**没有任何一处会红**。用户看到的只是「它进错轨了」，数据却已经写下了。
 *
 * `Record<ClipKind, TrackKind>` 把这条判据从「表达式」变成「**表**」：
 *  - 每个 `ClipKind` 都必须**显式给一行**；
 *  - 新增 `ClipKind` 的那天，**编译器直接报 TS2741/RECORD 缺键**，点名这一处要处理 ——
 *    **从「靠人记得」变成「靠类型兜」**（与 §八 P-1 的按层白名单同款手法）。
 *
 * 【为什么用 `Record` 而不是 `switch`】`switch` 靠 `default` 兜底，而兜底正是要消灭的东西：
 * 写 `default: return 'video'` 等于把静默归位换个地方写。`Record` **没有 default 可写** ——
 * 缺键就是编译错误，没有「兜底」这条退路可走。这是刻意的选择。
 *
 * 语义：`image`（图片素材 / 定格帧产物）是**画面** → 进视频轨；
 * （结构参考 N `getTrackTypeForClipType`，但**不搬**它的「三轨一一对应」。）
 */
const TRACK_OF_CLIP: Record<ClipKind, TrackKind> = {
  video: 'video',
  audio: 'audio',
  image: 'video',
  // 文字片段进**专属文字轨**（★新增 2026-09-14：与 `TrackKind: 'text'` 同批加入）。
  // 不复用视频轨：文字是独立层（固定紧凑行高、无胶片条/波形），混进视频轨会毁掉轨道头语义。
  text: 'text',
};

export function routeClipToTrack(kind: ClipKind): TrackKind {
  return TRACK_OF_CLIP[kind];
}

/**
 * **有画面、须参与渲染合成**的轨道类别 —— 肯定式穷举（★新增 2026-09-14）。
 *
 * 【为什么是集合而不是 `!== 'audio'` 或 `!== 'video'`】
 * 否定式判据（`kind !== 'video'` → 跳过）在新类别出现时**不会报错**：
 * 新轨会被**静默跳过**（不渲染）或**静默渲染**（若恰好通过否定式），
 * 两种都是「数据看不清」的失败。肯定式集合要求**显式表态**：
 * 加 `TrackKind` 的那天，这里必须回答「它有没有画面」。
 *
 * 【★已表态 2026-09-14】文字轨**有画面**（文字要渲染进成片）→ 已加入本集合。
 * 漏加它的后果正是本判据存在的理由：文字**不入成片**且导出**仍报成功**（静默错片）。
 *
 * 【⚠️ 为什么是 `as const` 数组而不是 `new Set<TrackKind>(…)`】
 * `new Set<TrackKind>([...])` 会让成员类型**宽化成 `TrackKind` 全集** ⇒
 * 下方对账断言**恒为真**（= 假守卫）。实测过：用 `new Set<TrackKind>(['video'])` 删掉 `'text'`
 * 后编译器**一声不吭**（正是本守卫要拦的场景）。故取值域真源是 `as const` 数组，
 * 运行时 `Set` 由 `kindSetOf()` 派生（只为 `.has()`）。**同一坑在 `normalize.ts` 已踩过一次**。
 */
const RENDERABLE_TRACK_LIST = ['video', 'text'] as const;

/** **无画面**（纯声音）的轨道类别 —— 与 `RENDERABLE_TRACK_LIST` 互补。 */
const AUDIOLESS_TRACK_LIST = ['audio'] as const;

/** `as const` 数组 → 运行时 `Set`（只保留成员窄类型，见上方说明）。 */
const kindSetOf = <T extends string>(list: readonly T[]): ReadonlySet<T> => new Set<T>(list);

export const RENDERABLE_TRACK_KINDS = kindSetOf(RENDERABLE_TRACK_LIST);
export const AUDIOLESS_TRACK_KINDS = kindSetOf(AUDIOLESS_TRACK_LIST);

/* ── ★编译期对账：两集合的并集必须**恰好覆盖**全部 `TrackKind` ──
 *
 * 【为什么必须对账】这两个集合把 `TrackKind` 二分成「有画面 / 无画面」。
 * 新类别若**没有被放进任何一侧**，它会落进「无人区」——
 * 对渲染而言等同于「被静默跳过」（画面层不入成片，而导出仍报成功）。
 *
 * 【手法与踩坑】用**反向断言**：把「漏掉的类别」赋给 `never`。
 * ⚠️ 前一版写成 `type Cover<T,A,B> = T extends A|B ? true : never` +
 * `const x: Cover<…> = true` —— 那是**假守卫**：
 * 因为集合已经被 `new Set<TrackKind>()` 宽化成全集，`A|B` 恒等于 `TrackKind`，断言永远成立。
 * 两个错叠加时「看起来有守卫」，实测删掉成员后**零报错**。修正后（`as const` + 反向断言）
 * 删掉任一成员即编译错误并**打印缺的是哪个类别**（探针验证见 `docs/132` §九 P-6.6）。
 */
type SetMember<S> = S extends ReadonlySet<infer U> ? U : never;
type KindNotCovered<
  T extends string,
  A extends ReadonlySet<string>,
  B extends ReadonlySet<string>,
> = Exclude<T, SetMember<A> | SetMember<B>>;
type CoveredOr<T extends string, A extends ReadonlySet<string>, B extends ReadonlySet<string>> = [
  KindNotCovered<T, A, B>,
] extends [never]
  ? true
  : ['有 TrackKind 没被放进任何一侧（会静默不渲染）', KindNotCovered<T, A, B>];

const trackKindsCovered: CoveredOr<
  TrackKind,
  typeof RENDERABLE_TRACK_KINDS,
  typeof AUDIOLESS_TRACK_KINDS
> = true;
void trackKindsCovered;

/**
 * 该轨道类别**是否有画面**（须参与渲染合成）。
 *
 * 【为什么要一个类型谓词，不直接 `RENDERABLE_TRACK_KINDS.has(kind)`】
 * 集合的成员类型是**窄联合**（`'video' | 'text'`，这是对账能生效的前提），
 * 而 `kind: TrackKind` 是**宽联合** —— 直接 `.has()` 会 TS2345。
 * 用类型谓词 `kind is …` 把「查表」与「收窄」合成一步：
 * 调用方拿到的是**编译器证明过**的窄类型，而不是 `as` 猜出来的。
 * 【收益】这也让「集合里有没有这个类别」这件事**在调用处可见**：
 * 漏加成员时不是「悄悄返回 false」，而是**编译期就要求你处理**。
 */
export function isRenderableTrack(
  kind: TrackKind,
): kind is SetMember<typeof RENDERABLE_TRACK_KINDS> {
  return RENDERABLE_TRACK_KINDS.has(kind as SetMember<typeof RENDERABLE_TRACK_KINDS>);
}

/** 该轨道类别**无画面**（纯声音，不参与画面渲染）。与 `isRenderableTrack` 互补。 */
export function isAudiolessTrack(kind: TrackKind): kind is SetMember<typeof AUDIOLESS_TRACK_KINDS> {
  return AUDIOLESS_TRACK_KINDS.has(kind as SetMember<typeof AUDIOLESS_TRACK_KINDS>);
}

/**
 * 工程的主视频轨 = **第一条视频类轨**（`kind === 'video'`）—— 唯一判据。
 *
 * 【为什么不是 `!overlay`】`overlay` 回答的是「压不压实 / 是不是叠加层」，**不回答「是不是主视频流」**：
 * M2 允许加轨后，一条工程完全可能**没有** `overlay:false` 的视频轨（用户把主轨删了、只剩叠加轨），
 * 也可能有两条（理论上，已被 `normalize.ts::enforceSingleMainTrack` 在加载期收敛）。
 * 「无损直通要拼哪一条流」「编辑动作无选中时回落哪条轨」问的都是**主视频流**，
 * 故判据必须是 `kind === 'video'` 的**第一条**。
 * （⚠️ 2026-09-14 起 `renderFrameAt` 改为**倒序**绘制 —— 数组第一项现在位于**最上层**；
 *   本判据**与绘制层序无关**，它只回答「哪条承载主视频流」。）
 *
 * 空工程（无视频轨）→ `undefined`，调用方各自处置（直通报「主视频轨上没有片段」）。
 *
 * ★修正（2026-09-14）：**不能**用 `RENDERABLE_TRACK_KINDS`（曾误改，被测试当场抓住）。
 * 「有画面」与「能承载直通搬运的主视频流」是**两件事**：
 * 文字轨有画面（要渲染），但它是叠加层、**没有可搬运的编码流** ——
 * 若把文字轨排到视频轨之前，用 `RENDERABLE` 判会把文字轨选成「主视频轨」，
 * 于是 `runDirect` 去文字轨上找视频分组 → 找不到 / 搬错。
 * 故本判据必须精确到 `kind === 'video'`（字面量是有意的，不是漏表态）。
 */
export function mainVideoTrackOf(project: Project): Track | undefined {
  return project.tracks.find((t) => t.kind === 'video');
}

/* ────────────────────────────────────────────────────────────────
 * 导出路径唯一判据（docs/120 C5.1 / C12.1 红线）
 * ──────────────────────────────────────────────────────────────── */

/**
 * 是否需要**合成重编码**（`false` = 可走无损直通）—— 导出路径的**唯一判据**。
 *
 * 【入参为什么是 `Project` 而不是 `(tracks, projectSize)`】（`docs/123` §二.7 P6）
 * 判据的真源是「**工程基准**」这一个东西。拆成两个参数后，调用方一旦传了与工程不一致的 size，
 * 判据就开始说谎（且没有任何测试会红）。收成一个参数，让"说谎"在类型层就不可能。
 *
 * 【为什么必须包含「片段尺寸 ≠ 工程尺寸」】（`docs/120` C12.1 红线）
 * 参考实现漏了这一条 → 会出现「尺寸不一致却走了直通」，导出结果被按源尺寸原样拼接，
 * 用户在播放器里才发现画面尺寸乱跳。补上它，就是「一次性做对」。
 *
 * 【保守方向说明】判据只依据 **Project 的结构事实**，不假装能判断参数级问题
 * （如「音频轨与视频轨恰为同源同参 → 可无损 copy」需要探测，属导出层 G4）。
 * 结构上不能证明可直通 → 判合成。宁可多编码一次，不可悄悄掉画质（`docs/120` C5.1 的立意）。
 */
export function needsCompositing(project: Project): boolean {
  const { tracks, settings } = project;

  // ⓪ **直通只搬运一条视频流**（`pipeline.ts::runDirect` 取 `mainVideoTrackOf` = 第一条视频轨），
  //    故除它之外的**任何画面轨上有内容都必须合成** —— 否则那些层的画面会被直通静默丢掉。
  //
  // 【为什么不能只靠 ① 的 `overlay`】M2 加轨后「叠加轨」是 `overlay: true` 的**视频轨**，
  //    ① 能拦住它们；但 ① 拦不住「主视频轨之后还排着别的视频轨」这类顺序变化 ——
  //    这里用「画面轨中**非第一条**的那些是否有内容」把话说完整，与轨道顺序无关地成立。
  //
  // ★改（2026-09-14）：判据从 `kind === 'video'` 改为**「画面类轨」的肯定式集合**
  //    （`RENDERABLE_TRACK_KINDS`）。理由同 ⑤：否定式/单一字面量在新 `TrackKind` 出现时
  //    不会报错，只会静默漏判。这里问的是「**除底层画面轨之外，还有没有别的画面层有内容**」——
  //    M2 的文字轨正是这种「另一层画面」，漏加进集合 ⇒ 文字层被直通静默丢掉（见该常量的说明）。
  const firstVisual = tracks.find((t) => isRenderableTrack(t.kind));
  if (tracks.some((t) => isRenderableTrack(t.kind) && t !== firstVisual && t.clips.length > 0)) {
    return true;
  }

  for (const track of tracks) {
    // ① 自由轨（叠加 / 音频）上有内容 → 需要叠加或混音 → 合成。
    //    主轨单个/多个视频片段的「关键帧对齐无损拼接」不需要合成，故主轨不参与本判据。
    if (track.overlay && track.clips.length > 0) return true;

    // ② 时间轴重叠（同轨两片段同时可见/可闻）→ 必须合成（直通无法表达重叠）。
    if (hasOverlap(track.clips)) return true;

    for (const clip of track.clips) {
      // ③ 图片 / 定格帧片段：没有可搬运的编码流 → 必须渲染进画面 → 合成。
      if (clip.kind === 'image') return true;

      // ④ 片段尺寸 ≠ 工程尺寸 → 需要 contain 归一 → 合成（C12.1 红线）。
      //    尺寸探测不到（undefined）时不判 —— 不猜（诚实免责，见 Clip.size 注释）。
      if (
        clip.size &&
        (clip.size.width !== settings.width || clip.size.height !== settings.height)
      ) {
        return true;
      }

      // ⑤ 画面/声音加工（画中画 / 转场 / 音量包络 / ★M2 的任何新加工字段）→ 必须合成。
      //
      // 【★改：枚举「触发字段」→ 枚举「放行字段」（2026-09-14）】
      // 原写法逐个列举 `transform`/`transitionIn`/`transitionOut`/`volumePoints`。
      // 失效模式是**静默的**：M2 加 `speed`（变速）时若没人回来补这一行，
      // 变速片段会被判「可直通」→ `runDirect` 原样搬运已编码分组 → **变速被静默忽略**，
      // 用户拿到的成片速度没变且毫无提示（7 步法 Step 4 禁「假成功」）。
      // ✅ 改为**放行白名单**：只有「确定不影响编码流」的字段被放行，
      //    其余**任何**被设过的字段一律判合成 —— 于是 M2 加字段时**默认走保守分支**，
      //    忘了登记只会「多编码一次」（性能代价，可接受），**不会产错片**。
      //    失效方向从「静默错片」翻转为「保守多编码」，这是正确性优先的取舍。
      if (hasProcessingField(clip)) return true;
    }
  }
  return false;
}

/**
 * 「与编码流无关」的**放行白名单** —— 除这些之外的任何字段被设过 → 判合成（见 ⑤ 说明）。
 *
 * 分组依据（每条都对应一个「直通搬运不关心它」的事实）：
 *  - 身份 / 溯源：`id` `kind` `sourceUrl` `assetId` `nodeId` —— 直通只搬字节，不读这些；
 *  - 时间窗：`sourceStart` `sourceEnd` `timelineStart` —— 由 `runDirect` 按它切分组，是**它的输入**不是加工；
 *  - 显示与派生：`name` `size` —— 仅显示 / 仅用于 ④ 的尺寸判据（已在上面单独判过）。
 *
 * ⚠️ **新增字段时必须想清楚它属于哪一类**：
 *  - 若它改变画面/声音**怎么呈现**（倍速、滤镜、文字样式、音量…）→ **不要**加进本表；
 *  - 若它只是身份/时间/显示（如 M2 的 `textStyle` 之外的元数据）→ 才加进来。
 *  忘了判断的后果 = 保守多编码一次（安全方向），见 ⑤ 说明。
 */
const NON_PROCESSING_CLIP_FIELDS: ReadonlySet<string> = new Set([
  'id',
  'kind',
  'sourceUrl',
  'assetId',
  'nodeId',
  'sourceStart',
  'sourceEnd',
  'timelineStart',
  'name',
  'size',
]);

/**
 * 该片段是否设过**任何**「画面/声音加工」字段 → 必须合成。
 *
 * 判据是「字段有没有被设过」，**不解释形状**（`transform` 等在 M1 是 `unknown`，
 * 判形状 = 替 M2 定型，见 types.ts 顶部说明）。
 * `undefined` / 空数组视为「没设」（空数组 = 没设任何控制点，与 `volumePoints: []` 的语义一致）。
 */
function hasProcessingField(clip: Clip): boolean {
  // 经 `unknown` 中转再断言：`Clip` 没有字符串索引签名，直接 `as Record<string, unknown>`
  // 会被 TS 判为「两个类型不够重叠」（本仓 `strict:false` 下依然报 TS2352）。
  // 这里读的是**运行时真实存在的键**（`Object.keys`），故断言是诚实的。
  const bag = clip as unknown as Record<string, unknown>;
  for (const key of Object.keys(bag)) {
    if (NON_PROCESSING_CLIP_FIELDS.has(key)) continue;
    const value = bag[key];
    if (value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    return true;
  }
  return false;
}

/* ────────────────────────────────────────────────────────────────
 * 异构素材判据（直通 concat 的参数一致性前置）
 * ──────────────────────────────────────────────────────────────── */

/**
 * 素材的**探测画像**（只收「判定异构所需」的那几维，不是素材元数据大对象）。
 * 探测不到的维度留空 —— 留空**不参与**异构判定（不猜，诚实免责）。
 */
export interface MediaProfile {
  width?: number;
  height?: number;
  /** 容器/编码的 MIME，如 `video/mp4`。 */
  mimeType?: string;
}

/**
 * 是否存在**异构素材**（分辨率 / 容器编码不一致）。
 *
 * 用途：无损直通的「多片段 concat」要求各段解码参数一致，否则必须**报错**而不是产出坏文件
 * （`docs/120` C5）。本判据只回答「是否一致」，**怎么处置（报错 / 改走合成）由导出层决定**。
 */
export function hasMixedSources(profiles: MediaProfile[]): boolean {
  const known = profiles.filter(
    (p) => p.width !== undefined || p.height !== undefined || p.mimeType,
  );
  if (known.length < 2) return false;
  const first = known[0];
  return known.some(
    (p) =>
      (p.width !== undefined && first.width !== undefined && p.width !== first.width) ||
      (p.height !== undefined && first.height !== undefined && p.height !== first.height) ||
      (p.mimeType !== undefined && first.mimeType !== undefined && p.mimeType !== first.mimeType),
  );
}

/* ────────────────────────────────────────────────────────────────
 * 可闻判据（docs/120 C11.7 · M1 走带必须真出声）
 * ──────────────────────────────────────────────────────────────── */

/**
 * 时间轴上**可闻**的片段（`docs/120` C11.7：M1 走带必须真出声）。
 *
 * **判据单点**：导出混音（`export/composite`）、导出探针（`export/pipeline`）、
 * 预览播放（`panels/dock/PlaybackSink`）都问这一个函数。各写一遍 `!hidden && !muted` 必漂 ——
 * 一处说「有声音」、另一处说「没有」，结果就是「明明有音频却没探音频编码器」/「预览有、导出没有」。
 *
 * 落点：判据属**领域真相（纯、零 IO）**，故收在 `core/`（判据层），不躺在导出域——
 * 否则播放域为了取一个纯函数会反向依赖导出域。
 *
 * ★改（2026-09-14）：原写法 `clip.kind !== 'image'` 是**否定式判据** —— 加 `'text'` 后
 * 它**不报错**，而是把文字片段**当成可闻片段**（文字没有音源）。实测后果是一条**假降级**：
 *   ① `pipeline::assertEncodersUsable` 因「有时间轴上真有可闻片段」而去探**音频编码器**（不必要）；
 *   ② `composite::mixClip` 对文字片段取不到音轨 → 计入 `missing` →
 *      导出被判定 `AudioOutcome.lost` → 用户被告知「音频丢失」（**明明什么都没丢**）。
 * 这是「否定式判据在新类别出现时静默失效」的又一实例（与 `RENDERABLE_TRACK_KINDS` 同型）。
 * 故改为**肯定式穷举**：显式列出「有音源的片段类别」，新增类别时**必须表态**。
 */
const AUDIBLE_CLIP_KINDS = kindSetOf(['video', 'audio'] as const);

/** 该片段类别**有音源**（须参与混音 / 走带出声）。类型谓词 —— 见 `isRenderableTrack` 的说明。 */
export function isAudibleClip(kind: ClipKind): kind is SetMember<typeof AUDIBLE_CLIP_KINDS> {
  return AUDIBLE_CLIP_KINDS.has(kind as SetMember<typeof AUDIBLE_CLIP_KINDS>);
}

/**
 * 该轨道类别**本身有无音源** —— 决定轨道头是否渲染「静音」按钮。
 *
 * 【为什么文字轨没有】文字轨上的片段全是 `kind: 'text'`，而它**不在** `AUDIBLE_CLIP_KINDS` 内
 * （没有音源）⇒ 给文字轨一个静音按钮是**误导**（点了什么都不会变）。
 * mockup 也如此画（文字轨的静音格是 `visibility:hidden`）。
 *
 * 【判据来源】与「该轨上可能有哪些片段」同源：`routeClipToTrack` 的反向查询 ——
 * 即「有音源的片段类别 → 它们的轨道类别」。**不另立一套 `TrackKind` 白名单**（那会与
 * `AUDIBLE_CLIP_KINDS` 两处维护，迟早漂成「片段说没声、轨道头却有静音钮」）。
 */
const AUDIBLE_TRACK_KINDS = kindSetOf(
  (Object.keys(TRACK_OF_CLIP) as ClipKind[])
    .filter((k) => AUDIBLE_CLIP_KINDS.has(k as SetMember<typeof AUDIBLE_CLIP_KINDS>))
    .map((k) => TRACK_OF_CLIP[k]),
);

/** 该轨道类别有无音源（决定是否渲染静音按钮）。 */
export function trackHasAudio(kind: TrackKind): boolean {
  return AUDIBLE_TRACK_KINDS.has(kind as SetMember<typeof AUDIBLE_TRACK_KINDS>);
}

export function audibleClipsOf(tracks: Track[]): Clip[] {
  return tracks
    .filter((track) => !track.hidden && !track.muted)
    .flatMap((track) => track.clips.filter((clip) => isAudibleClip(clip.kind)));
}

/* ────────────────────────────────────────────────────────────────
 * 轨道行高判据（★新增 2026-09-14 · 用户裁定「缩放只针对视频轨」）
 * ──────────────────────────────────────────────────────────────── */

/**
 * 该轨道在**编辑区**里应该占多高（px）—— 轨道行高的**唯一真源**。
 *
 * ── 规则（用户口径 2026-09-14）──
 * **「我们放大缩小轨道，只针对视频轨道。」** 即：
 *  - **视频轨** → 用工程 UI 记忆里的可调值（`project.ui.rowHeight`，工具带齿轮里的滑块）；
 *  - **音频轨 / 文字轨** → **固定值**，**不随那个滑块变化**。
 *
 * 【为什么必须收成函数而不是在 UI 里各判一次】
 * 「行高」有**两个渲染位**必须逐像素对齐：左列固定列（`TrackHead`）与右侧轨道行（`Lane`）。
 * 两处若各写一遍 `track.kind === 'video' ? rowHeight : …`，一旦漂移，左列第 N 行与右列第 N 行
 * **不再同一像素行**（本仓真出过这个 bug，见 `VideoEditorDock.tsx` 的滚动结构长注释）。
 * 故判据单点在此，两处都调它 —— 与 `routeClipToTrack` 同一条纪律（C 组判据单点）。
 *
 * 【为什么入参是 `(track, videoRowHeight)` 而不是只收 `track`】
 * 本函数属 `core/`（**零 IO、不认识工程**），而可调行高住在 `project.ui` ——
 * 让 core 去读工程会把「工程全貌」拉进判据层。故由宿主把 `videoRowHeight` 传进来，
 * 本函数只回答「哪一类用可调值、哪一类用固定值」。
 */
export function rowHeightOf(track: Track, videoRowHeight: number): number {
  switch (track.kind) {
    case 'video':
      return videoRowHeight;
    case 'audio':
      return AUDIO_TRACK_ROW_HEIGHT;
    case 'text':
      return TEXT_TRACK_ROW_HEIGHT;
  }
}

/* ────────────────────────────────────────────────────────────────
 * 三状态判据（docs/120 C7.3）—— 锁定收口一处
 * ──────────────────────────────────────────────────────────────── */

function findTrack(tracks: Track[], trackId: string): Track | undefined {
  return tracks.find((t) => t.id === trackId);
}

/**
 * 轨道是否锁定。**未知 id 一律按「未锁定」**（`docs/123` §一.4 C 组）——
 * 找不到的轨道不应让整个 UI 变灰；真要有问题，断链/数据校验会把它暴露在别处。
 */
export function isTrackLocked(tracks: Track[], trackId: string): boolean {
  return findTrack(tracks, trackId)?.locked ?? false;
}

/** 片段是否锁定（其所属轨锁定即视为锁定；找不到片段 → 未锁定）。 */
export function isClipLocked(tracks: Track[], clipId: string): boolean {
  return findTrackOfClip(tracks, clipId)?.locked ?? false;
}

/** 轨道是否隐藏（只影响渲染与导出，不动数据）。 */
export function isTrackHidden(tracks: Track[], trackId: string): boolean {
  return findTrack(tracks, trackId)?.hidden ?? false;
}

/** 轨道是否静音（只影响出声与导出音轨，不动数据）。 */
export function isTrackMuted(tracks: Track[], trackId: string): boolean {
  return findTrack(tracks, trackId)?.muted ?? false;
}
