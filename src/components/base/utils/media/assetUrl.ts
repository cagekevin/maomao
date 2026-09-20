/**
 * 统一图片 URL 归一化模块 —— 「前端图片形式统一」的唯一出口。
 * 参考图 URL 归一化唯一入口，refImage.js 已折叠至此。
 *
 * 背景：前端图片 URL 有 4 种形式——绝对 http(s) / data: base64 / blob: / 相对 /files/。
 * 若不统一：
 *  - 渲染端：相对 /files/ 在画布环境（localhost:5180）解析成错误源 → 破图；
 *  - 发送端：blob:（浏览器临时地址）/ 相对路径，后端网关访问不到 → 丢图。
 *
 * 因此所有「图片 URL 出口」（渲染、发送、存储）应统一经过本模块，保证：
 *  - 渲染用 normalizeAssetUrl → 相对补全成绝对，前端不破图；
 *  - 发送用 normalizeAssetUrlForSend → /files/ 保持相对（出站由 localTool resolveLocalImages 回读转 base64）、blob 转 data、公网补全绝对，后端不丢图；
 *
 * 【E 方案 · docs/72 · 会话落盘体积治理的抉择（2026-08-29）】
 * 契约：/files/ 是 AI 会话内唯一真值（可落盘、可累积、KB 级）；base64 只是「出站编码」，
 *       只在出站由 localTool（唯一出站口）现场生成，永不落盘、永不进 conversation。
 * 压缩边界（刻意如此，勿改）：前端只压【blob:/data:】（它们必须以内联 base64 形态落盘/出站）与
 *       【preferBase64 的 base64-only provider】；/files/ 的压缩统一在 localTool（resolveLocalImages）。
 * 否决的备选「全量压缩下移 localTool（连 data: 也压）」——data: 可能是 video 型（视频生成参考图，
 *       Jimp 解不了需按图像/视频分流，复杂度上升）、会打破「data: 幂等透传」（存量会话 base64 被
 *       意外重编码）、横跨前后端改动大且回归风险高 → 否决。现状已足够干净，勿再为此重构。
 *
 * 收敛原则：任何新增节点/面板要显示或发送图片，一律用这里，不各写各的 URL 处理。
 */
import { useCallback } from 'react';
import { logger } from '@/components/base/core/log/logger';
import { httpRequest } from '@/components/base/api/httpClient';
import { API_BASE } from '@/components/base/core/config';
import { IMAGE_FETCH_TIMEOUT } from '@/components/base/core/config';
import { API_ENDPOINTS } from '@/components/base/core/contracts';
import { useAppSettingsSelector } from '@/components/base/store/appSettings';
import { compressImage } from '../imageCompress.ts';
// TD-06-7：URL 归一化原语已下沉 core/utils（消除与 imageCompress 的循环依赖复制）；本模块自用 + 同名导出
import { toAbsoluteFileUrl } from '@/components/base/core/utils';

/**
 * 图片 URL 解析统一选项（resolveAssetUrl / useRenderAssetResolver 共用）。
 * - scope='render' 显示用小图 / 'send' 原图；
 * - thumbnail=false（渲染端关掉「显示缩略图」）时 render 也回原图绝对地址；
 * - maxDim 仅 render 按需出图透传。
 *
 * 更新(2026-09-16 · TD-02-41)：原 `format` 选项已删（连同它的前端白名单）。两条理由：
 *  ① **零消费者**（幽灵参数）：全库无任何业务调用点传它；
 *  ② 它透传前要先过一份**前端白名单**才放行 —— 那是「Jimp 能编码哪些格式」这个事实的**第二份抄写**，
 *     而真源在后端（`localTool/src/utils/fileStore.ts` 的 `JIMP_MIME_BY_EXT` / `isJimpEncodableExt`），
 *     后端对非法 format 已有权威处理（回退源扩展名）且有用例锁住（`Files·thumbnail format 校验`）。
 *  ⇒ 前端不做预判。将来真需要指定输出格式，由后端承接，**不要在前端重新引入白名单**。
 */
export interface AssetResolveOptions {
  scope?: 'render' | 'send';
  maxDim?: number;
  /** 显示缩略图（仅 render 生效；false 时回原图绝对地址） */
  thumbnail?: boolean;
}

/** 发送归一化选项（normalizeAssetUrlForSend / normalizeAssetUrlsForSend 共用） */
export interface AssetSendOptions {
  preferBase64?: boolean;
}

/**
 * 发送给 AI 的图片最长边上限（超过则前端压缩到该尺寸内，避免接口尺寸/体积限制）。
 * 契约双写：localTool 出站回读 resolveLocalImages 也用 1920（localTool/src/utils/resolveLocalImages.ts），
 * 改此处必须同步改 localTool，否则两端压缩口径漂移（前端压 blob/data + preferBase64，localTool 压 /files/）。
 */
export const MAX_SEND_DIM = 1920;

/**
 * 相对 /files/ 路径 → 完整可访问 URL。
 *
 * 【TD-06-7 收口 2026-09-13】实现在此**已下沉** `core/utils.ts::toAbsoluteFileUrl`
 * （纯 URL 原语只依赖 `API_BASE`，不应住在业务层 assetUrl；下沉后 imageCompress 可直取，
 * 消除 `assetUrl → imageCompress → assetUrl` 循环依赖的复制动机）。
 * 本模块**import + 同名 export**（非纯 re-export：内部 5 处仍自用）——
 * 40+ 既有消费方（`api/index` / `api/filesApi` / 本文件）零改动。
 */
export { toAbsoluteFileUrl };

/**
 * 是否是 localTool 本地文件 URL（相对 /files/ 或 API_BASE 绝对地址）。
 *
 * 用于「网页图本地化」的前置拦截：这类 URL 背后本就是 uploads/ 里的磁盘文件，
 * 再走一次「远程下载落盘」只会产出重复文件（历史上曾把素材库素材重复下载进 uploads/web）。
 * 注意与 toRelativeFileUrl 区分：后者对任意主机的 /files/ 路径都成立，这里只认本机的。
 * @param {string} u
 * @returns {boolean}
 */
export function isLocalFileUrl(u: string): boolean {
  if (!u || typeof u !== 'string') return false;
  return u.startsWith('/files/') || u.startsWith(`${API_BASE}/files/`);
}

/**
 * 绝对本地文件 URL（含 API_BASE 前缀）→ 相对 /files/ 路径；非本地返回 null。
 * DB 里存的是绝对路径（http://127.0.0.1:18080/files/...），按需出图端点要的是相对 /files/ 形式，
 * 这里收口「绝对→相对」的还原，避免各组件手写正则。
 * @param {string} u
 * @returns {string|null}
 */
export function toRelativeFileUrl(u: string | null | undefined): string | null {
  if (!u || typeof u !== 'string') return null;
  if (u.startsWith('/files/')) return u;
  const m = /^https?:\/\/[^/]+(\/files\/.*)$/.exec(u);
  return m ? m[1] : null;
}

/**
 * 发送侧防御：把「缩略图端点 URL」还原成其背后对应的原图片地址。
 *
 * 背景：显示侧（scope='render'）会把本地图转换成 `/api/files/thumbnail?url=...&maxDim=640` 端点，
 * 该 URL 是**小图**且仅供前端 `<img>` 显示。若历史上某处误把 render 结果当参考图塞进发送，网关会
 * 收到缩略图端点（可能 404 或拿到小图/糊图）→ 参考图丢失。这是「发送带缩略图」的系统性隐患。
 *
 * 契约：发送侧禁止携带任何缩略图端点 URL。本函数遇到此类 URL：
 *  1. 解析其 `query.url`（相对 /files/ 原图路径）；
 *  2. 还原并补全为**原图绝对地址**（真实原始图片），保证发送的一律是原图；
 *  3. 无法还原（无 url 参数 / 非法）→ 返回空串，由调用方丢弃该图（不静默发坏图）。
 *
 * 状态归属：这是图片 URL 归一化领域内的「发送统一出口守卫」，与 render 出口（buildThumbnailUrl）
 * 对称、互斥。新增节点要发图片一律经此，禁止绕过。
 * @param {string} u 可能是缩略图端点的 URL
 * @returns {string} 原图绝对地址；无法还原返回 ''
 */
function thumbnailToOriginal(u: string): string {
  if (typeof u !== 'string' || !u) return '';
  const qIndex = u.indexOf('?');
  if (qIndex === -1) return '';
  // 仅当确实命中缩略图端点路径才处理（避免误拆普通带 query 的原图 URL）。
  const path = u.slice(0, qIndex);
  if (!path.endsWith('/files/thumbnail')) return '';
  const rel = new URLSearchParams(u.slice(qIndex + 1)).get('url');
  if (!rel) return '';
  return toAbsoluteFileUrl(rel);
}

/**
 * 构造本地文件按需出图端点 URL（END P0：render 显示链路取小图）。
 *  - url 形如 /files/subfolder/name 或对应绝对地址（内部转为相对）；
 *  - maxDim 缺省 640：足显常见节点框且解码位图远小于原图（治拖拽卡）可另传覆盖。
 * 幂等：同 url/maxDim 命中同一缩略图缓存文件，重复取图不重复渲染。
 * 输出格式恒由后端按源扩展名决定（TD-02-41 删掉了前端的 format 白名单与透传，见 AssetResolveOptions）。
 * @param {string} url
 * @param {{ maxDim?: number }} [opts]
 * @returns {string}
 */
export function buildThumbnailUrl(url: string, opts: { maxDim?: number } = {}): string {
  const rel = toRelativeFileUrl(url);
  if (!rel) return toAbsoluteFileUrl(url); // 非本地文件，出图端点无法服务，回原图绝对地址
  const q = new URLSearchParams();
  q.set('url', rel);
  q.set('maxDim', String(opts.maxDim || 640));
  return `${API_BASE}${API_ENDPOINTS.fileThumbnail}?${q.toString()}`;
}

/**
 * 前端图片「唯一出口」：显示与发送共用一个契约，scope 区分策略。
 *
 *  - scope='render'（显示）：本地文件 → 按需小图（前端只解码小位图，治全分辨率拖拽卡）；
 *    非本地（外部 http / data: / blob: / 裸 base64）→ 原样地址（出图端点无法服务，回退原图，绝不破图）。
 *  - scope='send'（发送/AI 生图）：一律原图绝对地址（发送需原尺寸保真，不缩图）。
 *
 * 输出格式由后端按源扩展名决定（TD-02-41：前端不再持有格式白名单）。发送保真不引入压缩开关（见 docs/18 P2 决策）。
 *
 * 统一解析收口：/files/ 补全与「绝对→相对」均复用既有 toAbsoluteFileUrl / toRelativeFileUrl，
 * 组件不得再散写 URL 处理；新增显示/发送一律经本函数。
 * @param {string} url
 * @param {{ scope?: 'render'|'send', maxDim?: number }} [opts]
 * @returns {string}
 */
/** 空选项**单例**：避免「参数默认值写成对象字面量 `= {}`」—— 那会让每次调用新建一个对象
 *  （引用不稳定，`useCallback`/`useMemo` 依赖它时会隐形漂移），也掩盖"调用方没传"这一事实。
 *  口径：TS+React 异常容错禁止项 规则 8。 */
const NO_RESOLVE_OPTS: AssetResolveOptions = {};

export function resolveAssetUrl(url: string, opts: AssetResolveOptions = NO_RESOLVE_OPTS): string {
  // 【2026-09-17 TD-16-29③】原为 `if (!url || typeof url !== 'string') return url;`，三处错：
  //  ① **类型说谎**：声明返回 `string`，却会把 `null/undefined` **原样**丢给调用方（下游 `.startsWith` 炸在三公里外）；
  //  ② **静默放行**：`''` 是**合法 string**（不属 contract 违约，故不是"守卫该 fail-fast"的场景），
  //     而是"拿到无意义输入" ⇒ 必须**留痕**。否则渲染出口拿到空串，而 `<img src="">` / CSS `url()`
  //     都**不触发 onError** ⇒ "没有地址"此后无人知晓；
  //  ③ 仍返回 `''` 而**不抛**：调用方多为渲染路径，抛错会把"一张图没地址"升级成整块 UI 崩
  //     （与"不阻断"冲突）。但留痕后它**可查**，且上游 `mediaDisplayUrl` 的冗余 `?? ''` 已删
  //     ⇒ 空串只剩"调用方自己传了空"这一个明确来源。
  // 两类必须**分开**（否则又是"两个真相压成一个"）：
  //  · **类型违约**（非 string：null / undefined / 数字…）＝ 真异常 → **必须可见**（`logger.warn`）；
  //  · **空串** ＝ 合法 `string`，且"还没有地址"是调用方的**正常中间态**（高频）→ **静默**返回 `''`
  //    （对这一类告警只会刷屏，最终被绕 —— 闸的成本守恒律）。
  if (typeof url !== 'string') {
    logger.warn('assetUrl', 'resolveAssetUrl 收到非字符串地址（类型违约）', {
      got: url === null ? 'null' : typeof url,
    });
    return '';
  }
  if (!url) return '';
  const scope = opts.scope || 'render';
  // thumbnail:false（设置里关掉「显示缩略图」）→ render 也回原图绝对地址，不按需出图
  if (scope === 'render' && opts.thumbnail !== false && toRelativeFileUrl(url)) {
    return buildThumbnailUrl(url, { maxDim: opts.maxDim });
  }
  return toAbsoluteFileUrl(url);
}

/**
 * React hook：返回一个「显示地址解析器」`resolve(u)`，
 * 自动读取 app_settings.thumbnailOn（实时生效），关掉缩略图即回原图。
 * 在渲染内/循环内（如网格格元）直接调用 resolve(u) 即可，避免 hook 进循环。
 */
export function useRenderAssetResolver(): (u: string, extra?: AssetResolveOptions) => string {
  // 【TD-04-38】只订阅 `thumbnailOn` 一个字段。本 hook 被 20+ 组件消费，
  // 整包订阅会让「改任一设置」（调试模式 / 小地图 / 性能模式…）连坐它们**全部重渲**。
  const thumbnail = useAppSettingsSelector((s) => s.thumbnailOn !== false);
  return useCallback(
    (u: string, extra?: AssetResolveOptions) =>
      resolveAssetUrl(u, { scope: 'render', thumbnail, ...extra }),
    [thumbnail],
  );
}

/** 【已删 · 2026-09-20】原 `normalizeAssetUrl(url)` = `toAbsoluteFileUrl(url)` 的**纯转发别名**。
 *
 * 删因（ADR-0030 幽灵预留 / ADR-0046「让 AI 不猜」）：
 *  · 它对生产代码**零消费者**（全仓仅测试自己在断言"它等价于 toAbsoluteFileUrl"）；
 *  · 它给同一个操作造了**第二个名字** —— AI 看到 `normalizeAssetUrl` 与 `toAbsoluteFileUrl`
 *    并存，必须猜"该用哪个"（而两者逐字节等价，"选错"没有反馈）。
 *  · 相对 `/files/` → 绝对 URL 的唯一名字 = **`toAbsoluteFileUrl`**（`base/core/utils.ts`，58 处消费）。
 *  需要渲染地址时经 `resolveAssetUrl(url, {scope:'render'})`（它还负责按需出缩略图）。 */

/**
 * 【TD-08-28 收口 · 2026-09-17】`contentIdOfBytes`（前端由字节算 `sha1:<hex>`）**已删除**。
 *
 * 它曾有 3 个生产消费者（`nodes/AssetNode.tsx`、`hooks/useAssetDropPaste.ts` ×2），现已全部改为
 * **消费后端落盘权威回传的 contentId**：`filesApi` 的 `UploadOutcome.contentId` /
 * `PersistOutcome.contentId`（来源 `localTool/src/routes/files.ts:175`（multipart）/`:410`（fileUrl），
 * 由唯一权威 `writeUploadDedup` 产出）。网页图本地化那条还顺带省掉一次 `fetch(整图)`。
 *
 * 【为什么删而不是留】留一份零生产消费者的"第二份身份计算"＝ 幽灵 API，第一个后来者会本能地用它；
 * 而后端 `sha1(字节)` 与前端 WebCrypto 是**两套实现**，一旦编码/算法差一点就漂移成"同一文件两个身份"
 * （contentId 去重静默失效）。需要 contentId 时**从落盘结果拿**；确无生产者时（内联 dataURL/blob）
 * 本就**不该**有 contentId（docs/122：contentId 与 url 互斥双形态）。
 */

/**
 * 素材节点 data 的「渲染解析结果」。
 * - ok       → 可显示 url（文件型经 resource 解析，或内联 url）
 * - missing  → 资源查无（resourceId 指向的资源已删）→ 显式缺失态（fail-loud，UI 呈现不吞错破图）
 */
export type AssetRefState = { kind: 'ok'; url: string } | { kind: 'missing' };

/**
 * 素材节点渲染 url 解析（docs/122 #4/#5）——「渲染解析」唯一入口，禁止 asset/脚本盒各自 map 拼 url。
 *
 * data 互斥双形态：
 *  - 文件型持稳定 `contentId`(`sha1:<hex>`，与后端 resources.sha1 同源) → 经 resolveContentUrl 解析
 *    resource → url；若 resource 暂未登记（如纯画布拖入尚未入素材库）则回落到下方内联/存量兜底。
 *  - 内联 dataURL/blob/http 持 `url` → 直接用（不查 resource）。
 *  - 存量兼容层：仅当既无 contentId 也无 url 时，退回历史 `assetUrl` 字段（docs/118 §7.3 ⑤ 读兼容写唯一）。
 *
 * 纯函数，不 import store（避免循环依赖）；contentId 解析由调用方注入 resolveContentUrl
 * （如用 buildContentUrlResolver 由 resource 列表构建）。contentId 是 stable identity：
 * resource 行改名/移动只改 context（folder/name），url 经 contentId 派生自动跟随 → 永不破图。
 * @param {Record<string, unknown>|undefined} data 素材节点 data
 * @param {(contentId:string)=>string|null} resolveContentUrl 由调用方注入（查询 resource 得到 url）
 */
export function resolveAssetDisplayUrl(
  data: object | undefined,
  resolveContentUrl: (contentId: string) => string | null,
): AssetRefState {
  if (!data) return { kind: 'missing' };
  // 结构可读：data 是任意对象（含各节点 data 接口），只按需读 contentId/url/assetUrl，不假设索引签名
  const d = data as Record<string, unknown>;
  // 文件型：稳定 contentId → 经 resource 解析（资源行是 url 真源；改名/移动只改 context，contentId→url 自动跟随，永不破图）
  const contentId = typeof d.contentId === 'string' ? d.contentId : undefined;
  if (contentId) {
    const resolved = resolveContentUrl(contentId);
    if (resolved) return { kind: 'ok', url: resolved };
  }
  // 内联 dataURL/blob/http（网页图未本地化、粘贴图、生成结果）：直用 url
  const url = typeof d.url === 'string' ? d.url : undefined;
  if (url) return { kind: 'ok', url };
  // 存量兼容：老节点只有 assetUrl（读兼容、写唯一；不破存量快照）
  const assetUrl = typeof d.assetUrl === 'string' ? d.assetUrl : undefined;
  return assetUrl ? { kind: 'ok', url: assetUrl } : { kind: 'missing' };
}

/**
 * 由 resource 列表构建 contentId → url 解析器（docs/122 #4：文件型 asset 持稳定 contentId，
 * 渲染时经此解析出 url；resource 行改名/移动只改 context，url 自动跟随）。
 * 仅收录同时带 contentId 与 url 的 resource；缺失其一则不入表（解析时回落到 asset 自身 url/assetUrl 兜底）。
 * @param {Array<{contentId?:string|null; url?:string|null}>} resources
 * @returns {(contentId:string)=>string|null}
 */
export function buildContentUrlResolver(
  resources: Array<{ contentId?: string | null; url?: string | null }>,
): (contentId: string) => string | null {
  const map = new Map<string, string>();
  for (const r of resources || []) {
    if (typeof r?.contentId === 'string' && r.contentId && typeof r.url === 'string' && r.url) {
      map.set(r.contentId, r.url);
    }
  }
  // contentId 是 stable identity：resource 行改名/移动只改 context，url 经它派生自动跟随
  return (contentId: string) => map.get(contentId) ?? null;
}

/**
 * 互斥双形态校验（docs/122 #4）：返回「同时存在的字段」列表。
 * 文件型持 `contentId`、内联 type 持 `url`，二者互斥；`contentId+url` 双字段同指一文件即为
 * 冗余副本（明令杜绝），本函数返回违反字段供 UI guard / 测试兜底。
 * @param {Record<string, unknown>} data
 * @returns {Array<'contentId'|'url'>} 违规字段；normal 为 []
 */
export function assertMutuallyExclusiveAssetForm(data: object): Array<'contentId' | 'url'> {
  const d = data as Record<string, unknown>;
  const hasContentId = typeof d?.contentId === 'string';
  const hasUrl = typeof d?.url === 'string';
  return hasContentId && hasUrl ? ['contentId', 'url'] : [];
}

/**
 * 本地 File/Blob → data: base64（发送附件用）。
 * 收口：FileReader 的 dataURL 转换统一在此，各面板不得散写 FileReader。
 * 与 blobToDataUrl（网络 blob→data）语义互补：一个收本地 File、一个收 URL。
 * @param {Blob|File} file
 * @returns {Promise<string>} data:...;base64,xxx
 */
export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ''));
    fr.onerror = () => reject(new Error('FileReader failed'));
    fr.readAsDataURL(file);
  });
}

/**
 * 把单个 blob: URL 转成 data: base64（发送给后端用）。
 *  http/data/裸base64 原样返回；失败返回空字符串（调用方丢弃该图）。
 * @param {string} u
 * @returns {Promise<string>}
 */
async function blobToDataUrl(u: string): Promise<string> {
  try {
    const res = await httpRequest(u, {
      timeoutMs: IMAGE_FETCH_TIMEOUT,
      retries: 0,
      parseJson: false,
    });
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(new Error('FileReader failed'));
      fr.readAsDataURL(blob);
    });
  } catch (e) {
    logger.warn('assetUrl', 'blob 转 dataURL 失败', (e as { message?: string })?.message);
    return '';
  }
}

/**
 * 把任意 URL（http(s) / blob / /files/ 相对）拉取并转成 data: base64。
 * 用于「只认 base64 的后端」（refFormat: 'base64' 场景）。失败返回空字符串。
 * 注：http(s) 外网 URL 受 CORS 限制可能拉取失败；同源 localTool 没问题。
 * @param {string} u 需要转 base64 的图片地址
 * @returns {Promise<string>} data:image/...;base64,xxx 或空字符串
 */
async function urlToDataUrl(u: string): Promise<string> {
  if (typeof u !== 'string' || !u) return '';
  if (u.startsWith('data:')) return u; // 已是 base64，直接返回
  const absolute = toAbsoluteFileUrl(u); // 相对 /files/ 先补全
  try {
    const res = await httpRequest(absolute, {
      timeoutMs: IMAGE_FETCH_TIMEOUT,
      retries: 0,
      parseJson: false,
    });
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(new Error('FileReader failed'));
      fr.readAsDataURL(blob);
    });
  } catch (e) {
    logger.warn('assetUrl', 'URL 转 base64 失败', (e as { message?: string })?.message);
    return '';
  }
}

/**
 * 发送端归一化（单个图）：统一成「后端网关可访问」的地址。
 *
 * 规则（2026-08-29 定契约 · E 方案 docs/72 会话落盘体积治理）：
 *  - /files/ 本地图（相对或绝对本地）→ URL 模式（preferBase64=false，默认）下【保持相对 /files/】，
 *    不压缩不转码——会话内存/落盘只存 KB 级路径，避免 base64 撑爆会话快照误触发 volumePolicy 降级；
 *    出站时由 localTool resolveLocalImages 读 uploads/ → 压缩≤1920 → base64（localTool 是唯一出站口）。
 *  - blob: / data: → 压缩到最长边 ≤ MAX_SEND_DIM(1920)、保持原格式，转 data: base64 内嵌。
 *  - 公网图（http/https）→ 不压缩（AI 可直接访问，且受 CORS 限制压缩不可靠），原样透传。
 *  - preferBase64=true（只认 base64 的后端）→ 本地图压缩转 base64；公网图保持原尺寸转 base64（不压缩）。
 *  - 压缩失败（跨域/格式异常）→ 回退原逻辑，失败可见（logger 记录）但不阻断发送，避免丢图。
 *
 * 边界说明（为何前端仍压 blob:/data:，不随 /files/ 一起下移 localTool）：
 *  blob:/data: 最终必须以内联 base64 形态落盘/出站（blob 不可持久、服务端不可读；data 本身即 base64），
 *  前端 ≤1920 压缩是它们出站前唯一的体积护栏（localTool 对 data: 幂等透传、不压缩）；/files/ 才是主导
 *  路径，已完全下移 localTool。两端各司其职，勿把 blob/data 的压缩再挪到 localTool（见文件头「否决的备选」）。
 *
 * @param {string} u
 * @param {{ preferBase64?: boolean }} [opts]
 * @returns {Promise<string>}
 */
export async function normalizeAssetUrlForSend(
  u: string,
  opts: AssetSendOptions = {},
): Promise<string> {
  if (typeof u !== 'string') return '';
  // 发送侧硬契约：禁止发送缩略图端点 URL。若误入 render 结果，先还原回原图再走后续归一。
  const original = thumbnailToOriginal(u);
  if (original) u = original;

  // 判定「本地可压缩图」：/files/ 相对、blob:、data:、以及绝对 http 但指向本地文件（可还原为 /files/，如缩略图还原结果）。
  // 其余绝对 http(s) = 公网图（AI 可直接访问，且受 CORS 限制压缩不可靠 → 不压缩）。
  const isLocal =
    u.startsWith('/files/') ||
    u.startsWith('blob:') ||
    u.startsWith('data:') ||
    !!toRelativeFileUrl(u);
  if (!isLocal) {
    // 公网图：不压缩。按 preferBase64 决定是否转 base64（保持原尺寸）。
    if (opts.preferBase64) return urlToDataUrl(u);
    return u;
  }

  // 【E 方案 · docs/72】URL 模式（preferBase64=false）下 /files/ 保持相对路径（绝对本地归一为相对）。
  // 由 localTool 出站统一读 uploads/ → 压缩≤1920 → base64；前端不再压缩/转码 → 会话只存 KB 级 /files/。
  if (!opts.preferBase64) {
    const rel = toRelativeFileUrl(u);
    if (rel) return rel;
  }

  // 本地图：压缩到 ≤1920 保持原格式 → base64（仅 preferBase64 的 provider / blob: / data: 走到这）。
  // 压缩结果即 dataUrl，无论 preferBase64 与否都返回 base64。
  const compressable = u.startsWith('/files/') ? toAbsoluteFileUrl(u) : u;
  try {
    const { dataUrl } = await compressImage(compressable, {
      maxSize: MAX_SEND_DIM,
      keepOriginalFormat: true,
    });
    // compressImage 要么返回经唯一出口校验过的真图像、要么抛错 → 直接 return，
    // 不再写 `if (dataUrl)` 假判据（它挡不住 "data:,"，会把空图送给模型）。
    return dataUrl;
  } catch (e) {
    logger.warn('assetUrl', '发送前压缩失败，回退原样发送', {
      url: String(u).slice(0, 80),
      error: (e as { message?: string })?.message,
    });
  }

  // 压缩失败 / 无结果 → 回退原逻辑（/files/ 补全绝对、blob 转 base64、data 原样）。
  if (u.startsWith('/files/')) return toAbsoluteFileUrl(u);
  if (u.startsWith('blob:')) return blobToDataUrl(u);
  if (u.startsWith('data:') || opts.preferBase64) return urlToDataUrl(u);
  return u;
}

/**
 * 发送端归一化（图片数组）：逐个过 normalizeAssetUrlForSend，过滤空值。
 * @param {Array<string>} images
 * @param {{ preferBase64?: boolean }} [opts]
 * @returns {Promise<string[]>}
 */
export async function normalizeAssetUrlsForSend(
  images: string[] | null | undefined,
  opts: AssetSendOptions = {},
): Promise<string[]> {
  const urls = (images || []).filter((u) => typeof u === 'string' && u);
  // 多图并行压缩/归一化（Promise.all），避免多张图串行累积等待（本地图压缩耗时集中在 canvas 解码）。
  const results = await Promise.all(urls.map((u) => normalizeAssetUrlForSend(u, opts)));
  const sent = results.filter((r): r is string => typeof r === 'string' && r.length > 0);
  // 【带图可观测】发送前记录本次带了几张图、每张是 URL 还是 Base64（不含图片内容）。
  // 统一收口在发送归一化出口：覆盖生图/文本/视频/AI 聊天全部带图发送路径，一处埋点全链路可 grep。
  //
  // 【2026-09-17 TD-16-24】原实现日志记的是 **`urls.length`（输入张数）**，而返回
  // `results.filter(Boolean)` —— 归一化失败的图被**静默丢弃**后实发数可能更少，
  // 日志却报原始张数 ⇒ **实发 ≠ 日志**：排查时按日志以为"带了 3 张"，模型其实只收到 1 张。
  // 现按**结果事实**记账（`sent` 是出参本身），并单独把丢弃数留痕 —— 失败可见，不静默丢图。
  if (urls.length > 0) {
    // 注：`total` 即**实发数**（= 出参本身）。无丢弃时它自然等于输入数，故不再另加 `requested`
    // 字段（冗余：有丢弃时下面的 warn 已带全量口径）—— 契约保持最小。
    logger.info('assetUrl', '发送图片', {
      ...summarizeAssetUrls(sent),
      total: sent.length,
    });
  }
  const dropped = urls.length - sent.length;
  if (dropped > 0) {
    logger.warn('assetUrl', '发送归一化丢弃图片（实发少于请求）', {
      requested: urls.length,
      sent: sent.length,
      dropped,
    });
  }
  return sent;
}

/**
 * 把参考图 URL 数组转成网关 chat 契约的 messages 内容块：
 * [{ type: 'image_url', image_url: { url } }, ...]
 * 用于聊天消息让 AI 看图反推提示词。
 * @param {string[]} urls 已 normalize 的网关可用 URL
 */
export function toImageContentBlocks(
  urls: string[] | null | undefined,
): Array<{ type: 'image_url'; image_url: { url: string } }> {
  return (urls || []).map((url) => ({ type: 'image_url', image_url: { url } }));
}

/**
 * 图片形态分类（可观测用）：发送的图片是 URL 还是 Base64。
 *  - 'data:' 前缀 → 'base64'（内联 base64）
 *  - 其余（http/https/blob://files/ 等）→ 'url'
 * 用于发送出口日志，让「带图不可观测」变得可观测——不记图片内容，只记形态。
 * @param {string} url
 * @returns {'url'|'base64'}
 */
export function classifyImageType(url: string): 'url' | 'base64' {
  return typeof url === 'string' && url.startsWith('data:') ? 'base64' : 'url';
}

/**
 * 图片形态摘要（发送出口日志用）：把一组原始图片 URL 归成「几张 URL / 几张 Base64」。
 * 返回 { count, urls, base64s }，不携带图片内容，仅用于排障可观测。
 * @param {Array<string>} images 原始图片 URL 数组
 * @returns {{ count:number, urls:number, base64s:number }}
 */
export function summarizeAssetUrls(images: string[] | null | undefined): {
  count: number;
  urls: number;
  base64s: number;
} {
  const list = (images || []).filter((u) => typeof u === 'string' && u);
  let urls = 0;
  let base64s = 0;
  for (const u of list) {
    if (classifyImageType(u) === 'base64') base64s++;
    else urls++;
  }
  return { count: list.length, urls, base64s };
}

/* ════════════════════════════════════════════════════════════════
 * (以下工具对已随 context-only 改名废弃，相关函数已移除)
 * ════════════════════════════════════════════════════════════════ */
