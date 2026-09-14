/**
 * 视频抽帧原语（唯一实现）——从 `<video>` / 视频 URL 取一帧。
 *
 * 【两层结构（`126` 卡 1 硬边界③ 的"最小共同签名"提案）】
 *  - **底层探测原语** `drawVideoFrame(video, { atTime, maxSize?, willReadFrequently?, errors? }) → Promise<HTMLCanvasElement>`
 *    = 「seek + drawImage → canvas」这唯一一件"怎么读一帧"的事。
 *  - **宿主薄包装**：各域只决定「怎么拿 video 元素 / 输出什么格式 / 是否降采样 / 什么质量 / 失败文案」。
 *    本文件内已有 `captureFrame`（URL → JPEG Blob）；`scriptBoxEngine.captureVideoFrame`（URL+比例 → dataURL/max480）
 *    与 `nodes/VideoExtractNode.seekTo`（已有元素 → dataURL/max800）已改为调它；其余见下方"待迁"。
 *
 * 【为什么不是一个签名通吃（Step 3：先分清重复的种类）】5 处的**输入**（URL vs 已有元素）、**输出**
 * （Blob / dataURL / canvas）、**尺寸策略**（原尺寸 / 480 / 800）、**质量**（0.55 / 0.7 / 0.8）都不同 —— 属
 * **判据层差异**，硬合并会削掉某一域的必要能力。可收口的只有底层探测原语。**禁止**再把 5 处并成一个函数。
 *
 * ════════════════════════════════════════════════════════════════
 * 【同机制清单（2026-09-13 取证·份数按「输入/输出形态」判定，不按名称）】
 * 本轮结论（2026-09-13 **结项**）：**同机制 4 处（①②③⑤）→ 已全部收口到本模块（1 实现 + 0 重复）**；
 * **④ 经步 2 取证改判为异类**（理由见文末异类段）；**异类共 5 处**（`thumbnails.ts` / `VideoThumbnail.tsx` /
 * `videoEngine.ts:568` / `smartCapture` / ④）已在文末登记。
 *
 * | # | 位置 | 输入 | 输出 | 尺寸 | 质量 | 状态 |
 * |---|------|------|------|------|------|------|
 * | ① | `nodes/VideoProcessNode.tsx`（原本地 `captureFrame`） | URL | Blob | 原尺寸 | jpeg 0.55 | ✅ 已下沉（本文件 `captureFrame`） |
 * | ② | `hooks/useVideoPoster.ts` | URL | dataURL | 原尺寸 | jpeg 0.7 | ✅ 已迁（宿主持有判据：`seek 0.05` + 失败静默回退 `''`） |
 * | ③ | `scriptbox/scriptBoxEngine.ts` `captureVideoFrame` | URL + 比例 | dataURL | max 480 | jpeg 0.8 | ✅ 已迁（本文件 `drawVideoFrame`） |
 * | ④ | `base/utils/clipboard.ts` `drawVideoFrameToCanvas` | **已有 `<video>`** | **canvas** | 原尺寸 | 由调用方定（png） | ❌ **异类（2026-09-13 步 2 取证改判，理由见下）** |
 * | ⑤ | `nodes/VideoExtractNode.tsx` `seekTo` | **已有 `<video>`** | dataURL | max 800 | jpeg 0.8 | ✅ 已迁（本文件 `drawVideoFrame`） |
 *
 * 【异类登记 —— 看着像抽帧、其实不是，禁止并入本模块（防下一个人再统一一次）】
 *  - `director3d/thumbnails.ts:12 thumbnailFromCanvas(source: HTMLCanvasElement)`：
 *    输入是 **已画好的 canvas**（3D 监视器截图，`director3d/App.tsx:1218` 传 `monitorCanvasRef.current`），
 *    是「canvas → 缩略图」的图像缩放，**不涉及视频 seek / decode**。并入会削掉其无视频源的能力。
 *  - `base/ui/VideoThumbnail.tsx:49`：**显示侧组件**（`<video preload="metadata">` + 悬浮播放按钮），
 *    **根本不抽帧**，靠浏览器渲染首帧。它没有可提取的帧数据。
 *  - `base/utils/videoEngine.ts:568`：GIF 逐帧编码循环内的 `ctx.drawImage(video, …)`
 *    （`videoToGif` 的一部分），逐帧 `getImageData → quantize → writeFrame`，**不是"取一帧"API**，
 *    帧数据直接进编码器、不产出单帧图。抽出来会打断编码循环。
 *  - `nodes/VideoExtractNode.tsx` 的 `smartCapture`（16×16 像素差）：只取 16×16 像素做画面变化检测，
 *    **不产出帧图**（`getImageData` 而非 `toDataURL`），与"抽一帧"不同类。
 *  - `base/utils/clipboard.ts:103 drawVideoFrameToCanvas`（**2026-09-13 步 2 改判：从"待迁"改为异类**）：
 *    它**不是"从视频取某一时刻的帧"，而是"把预览框当前已显示的画拿走"**（截屏 → 剪贴板）。两类能力共用一个名字是历史巧合。
 *    **支持"不迁"的真判据（3 条，语义层不可通约）**：
 *    ① **尾帧时间策略不同**：`max(0, min(dur-0.1, dur*0.5))`（极短视频兜底到**中段**）≠ ③ 的 `max(dur-0.05, 0.001)`；
 *    ② **`video.pause()` 前置**：防 seek 后被播放推进（只有预览框场景需要）；
 *    ③ **同步模型相反**：`last=false` 时**完全同步、根本不 seek** —— 与本原语「seek→draw 原子」模型冲突（**单这一条已足够**）。
 *    → 硬塞会削掉真判据或把原语撑宽（宽接口 + 薄实现 = 泄漏）；唯一重叠只有 `drawImage` 两行，不值得为它变宽。
 *    另：它自带 `withTimeout(5000)`，**正因本原语无 seek 超时**（见下「已知边界」②），故它**不走本原语**。
 *
 * ════════════════════════════════════════════════════════════════
 * 【本原语的已知边界（明确不覆盖 —— 防止有人以为"原语已覆盖一切抽帧"）】
 *
 * > 背景：④ 的另外 3 处差异（就绪度预检 / seek 超时 / 等两帧 rAF）**不是"④ 的特有判据"，而是本原语缺的能力**。
 * > 它们**真实存在**，只是 ③⑤ 当前没暴露 —— 登记在此，供将来排查与扩展时按需补，**不要就此认为原语完备**。
 *
 * ① **无"已就绪但尺寸为 0"的中间态防御**：本原语在 `videoWidth/Height` 为 0 时报 `dimensions` 错误。
 *    "就绪却是 0×0"（解码器已 ready 但尚未拿到尺寸）是**真实存在的中间态**；④ 显式预检并抛「视频尚未加载，无法截屏」。
 *    当前 ③⑤ 未暴露该态；若将来命中，应在本原语加"就绪但尺寸为 0 → 等待/重试"的判据，而不是各宿主各写一遍。
 *
 * ② **无 seek 超时**：对"**已就绪但 seek 不触发 `seeked`**"的媒体会**永久悬挂**。
 *    本原语的 `<1ms 直接绘制` 守卫只覆盖 `currentTime === target` 这一种；"seek 事件永不触发"这一类**仍然无解**。
 *    当前 ③⑤ 依赖 `<video>` 的 `error` 事件覆盖**加载**失败，覆盖不了"加载成功但 seek 静默失败"。
 *    → ④ 正因如此保留了自己的 `withTimeout(5000, '尾帧定位超时')`。
 *    → **将来出现悬挂实例时的正确做法：先在本原语加超时**（一处修、全宿主受益），
 *      **不要就地 `try/catch` 兜底**（那样是把复杂度埋进调用方，且失败不可见）。
 *
 * ③ **无"等渲染面更新"**：`seeked` → `drawImage` 在**两帧未上屏**时可能取到**陈旧帧**。
 *    ④ 为此特意 `await 两帧 rAF`（它的场景是"预览框正在实时显示"，seeked 后渲染面未必已更新到解码帧）。
 *    ③⑤ 当前没暴露 ≠ 没这风险；若出现"抽到的帧比目标早一帧"，先在本原语加该等待，不要在宿主各自补一遍。
 *
 * ④ **本原语不提供**：seek 超时 / 尺寸 0 重试 / rAF 等待 / `pause()` / 播放恢复 —— 这些属"何时取帧、取哪一帧、
 *    取的是不是当前显示的那一帧"的**判据层**，由宿主决定（7 步法 Step 3：收口探测、保留判据）。
 */

/**
 * 一个媒体 URL 是否**跨源**（需要 `crossOrigin='anonymous'` / 让 canvas 可读）？
 *
 * 【为什么抽帧必须按同源/跨源分情况（2026-09-13 取证修正）】
 * 本模块的素材 = 本地 `/files/`（经 `toAbsoluteFileUrl` → `API_BASE + /files/…`）。
 * 生产发布时页面**部署在 localTool 18080 端口可与 /files/ 同源**（`config.ts:17`）。
 * 若对**同源** URL 设了 `crossOrigin='anonymous'`：元素会走 CORS 模式请求，而网关对
 * `/files/*` 未必回 `Access-Control-Allow-Origin` ⇒ 该媒体成为"不透明（opaque）"、
 * canvas **被污染**、`toBlob` 拿到的回调是 `null` ⇒ 抽帧静默失败 ⇒ 时间轴视频无缩略图。
 * 故：**同源不设**（读像素无需 CORS），**真跨源才设 anonymous**。这同时是旧实现（恒设）
 * 在"页面内嵌到 localTool 同源"部署形态下的错误修正 —— 不是兜底，是让抽帧一次到位。
 */
import { releaseQuietly } from './asyncGuard.ts';

export function setCrossOriginForReadable(video: HTMLVideoElement, url: string) {
  if (sameOriginUrl(url)) return; // 同源：不强制 CORS，canvas 可读
  video.crossOrigin = 'anonymous';
}

/** URL 与当前页面是否同源（相对路径 / blob: / 同 origin 绝对地址 → 同源）。 */
function sameOriginUrl(url: string): boolean {
  if (!url) return true;
  if (url.startsWith('/') || url.startsWith('blob:') || url.startsWith('data:')) return true;
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return new URL(url, origin || undefined).origin === origin;
  } catch {
    return false;
  }
}
interface DrawVideoFrameErrors {
  /** 视频加载失败（`error` 事件） */
  load?: string;
  /** 视频尺寸不可用（`videoWidth/videoHeight` 为 0） */
  dimensions?: string;
  /** 2d context 不可用 */
  context?: string;
}

/** `drawVideoFrame` 入参。 */
export interface DrawVideoFrameOptions {
  /**
   * 目标时间（秒），或「按已加载时长算目标」的函数（按比例取帧的宿主需要，如 ③）。
   * 与当前 `currentTime` 差值 < 1ms 时**不 seek，直接绘制** —— 否则"目标=0 且本就停在 0"会等不到
   * `seeked` 事件而永久挂起（③ 原先就存在这个悬挂面）。
   */
  atTime: number | ((duration: number) => number);
  /** 最长边像素上限；不传 / <=0 → 原尺寸。只在超限时按比例缩小（不放大）。 */
  maxSize?: number;
  /**
   * 是否等 `loadeddata` 再开始（默认 true = 新建元素的情形，①③ 用）。
   * **宿主已自备、且已等过元数据的元素**（⑤ 的 `<video>`）传 `false`：
   * ⑤ 原实现根本不等 `loadeddata`（它只挂 `seeked/error` 后直接 seek），
   * 收口时若强行加这道门槛，宿主在 `loadeddata` 不再触发时会**永久挂起**
   * —— 这是收口越界（`126` §八：既有测试变红 = 既有语义被破坏），故保留为显式开关。
   * **理由（谁需要它、为什么）**：①③ 新建元素 → 需要等；⑤ 的元素由宿主在 `loadedmetadata` 后自备 → 不能等。
   */
  waitForLoad?: boolean;
  // 更新(2026-09-13)：曾带的 `willReadFrequently` 已**删除**——③⑤ 的 canvas 只「画一次 + 导出一次」，
  // 从不 `getImageData`（⑤ 唯一读像素的 `smartCapture` 用的是它自己那块 16×16 canvas），
  // 该 hint 找不到需要它的宿主 → 按「给不出理由就删」（宽接口 + 薄实现 = 泄漏）摘掉。
  // 将来真有宿主需要读像素，再由**该宿主**按需传入（不预置在唯一原语上）。
  /** 覆盖默认错误文案；未覆盖的走默认值。 */
  errors?: DrawVideoFrameErrors;
}

/** 默认错误文案（= ① 下沉前的原文案，逐字保留）。 */
const DEFAULT_FRAME_ERRORS: Required<DrawVideoFrameErrors> = {
  load: 'captureFrame: load error',
  dimensions: 'captureFrame: zero dimensions',
  context: 'captureFrame: no 2d context',
};

/**
 * 底层探测原语：把 `<video>` 定位到 `atTime` 并画进 canvas。
 *
 * - `waitForLoad !== false` → 等 `loadeddata` 再开始（新建元素的情形，①③）；
 *   宿主已自备元素（⑤）→ `waitForLoad: false`，直接 seek，**不空等事件**（保原语义）。
 * - 事件一律用 `addEventListener` + 结算时 `removeEventListener`，**不占用 `onxxx` 属性**——
 *   ⑤ 的元素由调用方持有，改属性会踩到宿主的处理器。
 * - 只做「seek + drawImage」；**夹取（clamp）与"取哪一帧"是宿主的判据**，不并入本函数。
 */
export function drawVideoFrame(
  video: HTMLVideoElement,
  { atTime, maxSize, waitForLoad, errors }: DrawVideoFrameOptions,
): Promise<HTMLCanvasElement> {
  const errFor = (kind: keyof DrawVideoFrameErrors) =>
    new Error(errors?.[kind] ?? DEFAULT_FRAME_ERRORS[kind]);
  return new Promise<HTMLCanvasElement>((resolve, reject) => {
    let done = false;
    const cleanup = () => {
      video.removeEventListener('loadeddata', begin);
      video.removeEventListener('seeked', draw);
      video.removeEventListener('error', onError);
    };
    const fail = (e: Error) => {
      if (done) return;
      done = true;
      cleanup();
      reject(e);
    };
    const draw = () => {
      if (done) return;
      try {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (!vw || !vh) return fail(errFor('dimensions'));
        let w = vw;
        let h = vh;
        if (maxSize && maxSize > 0 && (w > maxSize || h > maxSize)) {
          if (w > h) {
            h = Math.round((h * maxSize) / w);
            w = maxSize;
          } else {
            w = Math.round((w * maxSize) / h);
            h = maxSize;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return fail(errFor('context'));
        ctx.drawImage(video, 0, 0, w, h);
        done = true;
        cleanup();
        resolve(canvas);
      } catch (e) {
        fail(e instanceof Error ? e : new Error(String(e)));
      }
    };
    const begin = () => {
      const duration = video.duration || 0;
      const target = typeof atTime === 'function' ? atTime(duration) : atTime;
      if (Math.abs(video.currentTime - target) < 0.001) draw();
      else {
        video.addEventListener('seeked', draw, { once: true });
        try {
          video.currentTime = target;
        } catch {
          draw();
        }
      }
    };
    const onError = () => fail(errFor('load'));

    video.addEventListener('error', onError, { once: true });
    if (waitForLoad === false) begin();
    else video.addEventListener('loadeddata', begin, { once: true });
  });
}

/** `buildFilmstrip` 入参。 */
export interface FilmstripOptions {
  /**
   * 源素材时长（秒）。
   *
   * **必传**（不从元素现读）：调用方（剪辑器）本来就知道它 —— 它正是「这个片段有多长」的同一件事实。
   * 让本函数再读一次 = 同一事实第二个来源，且两者不一致时无法判断谁对。
   */
  duration: number;
  /** 每张缩略图的**显示高度**（px）。胶片条的真高 = 它（C11.10c：由行高派生，禁写死）。 */
  frameHeight: number;
  /** 抽几帧（≥1）。**固定值**而不是"按片段宽度算"—— 见文件头「为什么一条一起抽」。 */
  frames?: number;
  /** 每帧最长边上限（默认 160）—— 胶片条是**缩略**，不是原图。 */
  maxFrameSize?: number;
  /** JPEG 质量（默认 0.6）。 */
  quality?: number;
  /** 取消信号：宿主卸载 / 换素材时别继续抽。 */
  signal?: AbortSignal;
}

/** 一条横向胶片（`docs/120` C11.10 的「一次抽帧拼成一条横向胶片 jpg」）。 */
export interface Filmstrip {
  blob: Blob;
  /** 实际帧数（可能少于请求数：源太短 / 个别帧抽失败）。 */
  frameCount: number;
  /** 整条的画布尺寸（px）。 */
  width: number;
  height: number;
}

/**
 * 宿主薄包装 ⑥：把一条素材**一次抽 N 帧拼成一条横向胶片**（`docs/120` C11.10 规定的形态）。
 *
 * ── 为什么是「一条」而不是「N 张图」 ──
 * C11.10 是性能红线：时间轴上每个片段各挂一个真 `<video>`（或各挂 N 张 `<img>`）会让
 * 解码线程争用、滚动卡顿、内存上涨。正确形态 = **一条图**，片段用 CSS `background` 按
 * 「源区间 → 图内区间」映射显示（**裁剪即所见**，映射的数学在调用方，见 `filmstripBackground`）。
 *
 * ── 为什么一个 `<video>` 抽 N 帧（而不是 N 次 `captureFrame`）──
 * `captureFrame` 每次调用都新建元素 + 重新加载整条素材；N 帧就是 N 次加载。
 * 本函数复用**同一个**元素、只反复 seek ⇒ 一次加载 N 帧。这正是 ⑤ 的模式
 * （`drawVideoFrame(video, { waitForLoad: false })`）：首帧等 `loadeddata`，其后直接 seek。
 *
 * ── 它的落点为什么还是这里（而不是某个域的宿主）──
 * 它不是「某个域怎么显示缩略图」，而是**抽帧能力的第二种输出形态**（拼成一条）。
 * 放在这里，`drawVideoFrame` 依旧是「seek + drawImage」的**唯一**实现，本函数只是它的组合用法。
 */

/**
 * 宿主薄包装 ①：URL → seek → drawImage → JPEG `Blob`（原 `nodes/VideoProcessNode.tsx` 本地 `captureFrame` 下沉）。
 * 消费方：时间线胶片条抽缩略图；视频剪辑器可直接复用。
 */
export function captureFrame(url: string, atTime: number, quality = 0.55): Promise<Blob> {
  const video = document.createElement('video');
  setCrossOriginForReadable(video, url);
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  video.src = url;
  const release = () => {
    video.removeAttribute('src');
    releaseQuietly(() => video.load());
  };
  return drawVideoFrame(video, {
    // 原实现：target = min(atTime, max(0, (duration || atTime) - 0.01))（夹取是 ① 的判据，留在宿主）
    atTime: (duration) => Math.min(atTime, Math.max(0, (duration || atTime) - 0.01)),
  })
    .then(
      (canvas) =>
        new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error('captureFrame: toBlob null'))),
            'image/jpeg',
            quality,
          );
        }),
    )
    .finally(release);
}
