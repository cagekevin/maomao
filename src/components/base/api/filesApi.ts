/**
 * ════════════════════════════════════════════════════════════════
 * 【前端 ↔ 后端的定位】本模块是「前端 → localTool 后端」的文件落盘唯一桥。
 * ════════════════════════════════════════════════════════════════
 * · 职责：把生成结果 / 素材 / 网页图从浏览器侧落盘到 localTool 后端的 uploads/ 目录，
 *   使「生成面板 / 素材库」能读到（后端 rescan 按目录收录）。
 * · 2026-09-04（候选 C 收口）：本模块是【全站文件域单点】——除落盘外，文件访问端点
 *   （move/mkdir/open/open-dir）+ 3 个纯函数（relativePathFromUrl/canMoveAsset/resolveMovePaths）
 *   也收口在此；localToolApi 回归纯 CRUD + kv + providers（不再割裂文件域）。
 * · 后端：localTool 服务，默认 http://127.0.0.1:18080（API_BASE）。
 * · 唯一端点：只打 `POST ${API_BASE}/api/files/upload` 一个接口，两种请求模式——
 *     multipart FormData（file + subfolder [+filename]）→ 直接存本地文件；
 *     JSON（{ fileUrl, subfolder, filename }）→ 后端 saveRemoteUrl 代下载（fetchWithProxy）
 *     并 sha1 幂等去重（downloadRemoteToLocal / saveResultToTasks 的 http 分支共用 uploadRemoteUrl）。
 * · 落盘目录：**默认值**取自 UPLOAD_DIRS 中央表（tasks/web/canvas/canvas/drop/
 *   canvas/video-process/migrated/director3d）。
 *   【TD-03-6③ 文档更正，2026-09-13】原写「subfolder **一律**取自 UPLOAD_DIRS…禁止散写字面量」，
 *   与实流不符：`subfolder` 参数接受**任意合法相对路径**，调用方会传表外动态目录——如素材库按分类
 *   `migrated/人物|场景|道具`（ResourceLibrary）、尾帧变体 `migrated/脚本/尾帧变体`（scriptBoxEngine），
 *   经 resourceStore.localizeAndStoreToResourceLibrary → saveInlineToLocal/uploadFileToLocal 落盘。
 *   后端以 `normalizeSubfolder` 的**顶层根白名单**（tasks/web/canvas/migrated/director3d）校验，而非枚举全路径。
 *   **本模块内**仍然成立的纪律：不散写目录字面量（用 UPLOAD_DIRS 作默认值）；目录名不改（防存量 URL 破链）。
 * · 返回契约：后端返回 { code, data: { url } } 信封，本模块取 data.data.url
 *   （http://127.0.0.1:18080/files/<subfolder>/<name>）；失败一律返回 null 不抛
 *   （调用方降级保持原 URL），并 logger.warn 留痕 —— 失败可见但不打断主流程。
 * · 出口纪律：所有落盘经 httpRequest（统一超时/重试/错误分类），UPLOAD_OPTS 用较长超时 +
 *   retries:0（大文件不自动重试，避免重复上传）；禁止绕过本模块另写 fetch/上传。
 * · 本模块不碰后端 SQLite/DB，只做文件落盘 + 供 rescan 收录。
 * ════════════════════════════════════════════════════════════════
 *
 * 落盘函数一览：
 *  - persistUrlToUploads(url, {folder,name,type,projectId})  ★「任意来源 URL → uploads」唯一原语：
 *      内部分流 data:/blob:/http(s)/已是本机 /files/，返回判别联合 PersistOutcome（不抛、不归一 null）。
 *      上层用例（发送到素材库 / 剧本盒本地化）一律走它，**禁止再抄一份分流判据**。
 *  - saveInlineToLocal(dataUrl, subfolder?)   dataURL → multipart，sha1 内容哈希幂等去重（返回 url|null）
 *  - uploadFileToLocal(file, subfolder?, name)  原始 File/Blob → multipart（避免大文件两段内存拷贝）
 *  - downloadRemoteToLocal(url, {folder,name})  网页远程图 → JSON fileUrl 后台代下载（先拦本地 URL）
 *  - saveResultToTasks(url, type)  生成结果 → tasks（data:→multipart；http→fileUrl 代下载）
 *  - saveTextToTasks(text, name)  纯文本结果 → tasks/*.txt（后端 rescan 识别 type='text'）
 * 注：`url|null` 系函数是「落盘失败即降级（保留内联）」语义的原语，null 是它们**诚实**的契约；
 *    需要「成败可判别 / 不得静默降级」的用例用 persistUrlToUploads 的判别联合。
 */
import { API_BASE } from '../core/config.ts';
import { httpRequest } from './httpClient.ts';
import { logger } from '../core/logger.ts';
import { reportDegrade } from '../core/degrade.ts';
import { UPLOAD_TIMEOUT } from '../core/config.ts';
import { formatTime, safeFileName, relativePathFromFileUrl } from '../core/utils.ts';
import { UPLOAD_DIRS } from '../utils/uploadDirs.ts';
import type { ApiEnvelope } from './localToolApi.ts';
export { toAbsoluteFileUrl } from '../utils/assetUrl.ts';
export { EXT_BY_TYPE };
import { isLocalFileUrl, fileToDataUrl } from '../utils/assetUrl.ts';
import { detectAssetType, detectFileType } from '../utils/assetType.ts';
import type { AssetType } from '@/types';

// ─────────────────────────── files 域（候选 C 收口：全站文件域单点可查）───────────────────────────
// 此前文件域被劈成两半：落盘在 filesApi，move/mkdir/open + 3 个纯函数却住在 localToolApi
// （其文件头还自述「filesApi 是深模块，不并入」——与事实不符）。候选 C（deepening 文档）
// 把分散在 localToolApi 的文件域成员一并收口到本模块，localToolApi 回归纯 CRUD + kv + providers。

/** GET /api/files/open|open-dir 响应内层。 */
export interface OpenPathData {
  path: string;
}
/** POST /api/files/move|mkdir 响应。 */
export interface FileOpResult {
  code: number;
}

// GET /api/files/open?subfolder=... → { path }
export async function openLocalFolder(subfolder?: string): Promise<ApiEnvelope<OpenPathData>> {
  return httpRequest(
    `${API_BASE}/api/files/open?subfolder=${encodeURIComponent(subfolder || 'tasks')}`,
    { label: 'openLocalFolder' },
  );
}

// GET /api/files/open-dir?filepath=... → { path }；空路径短路
export async function openFileDir(
  filepath: string,
): Promise<ApiEnvelope<OpenPathData> | undefined> {
  if (!filepath) return;
  return httpRequest(`${API_BASE}/api/files/open-dir?filepath=${encodeURIComponent(filepath)}`, {
    label: 'openFileDir',
  });
}

/**
 * 从资源的 18080 url 解析出「相对 uploadDir 的磁盘路径」（去 /files/ 前缀 + 解码）。
 * 纯函数，非转发。用于 open-dir 与移动归类的**磁盘定位真源**（TD-12-8）。
 *
 * 【必须命中 /files/ 前缀】非本地 url（远程图 https://…、data URL、其它路径）→ **返回 null**，
 * 不得返回一个看似合法的残串（旧实现直接 replace，会把 `https://x/y.png` 返回成 `/y.png`，
 * 使调用方误以为拿到了本地相对路径）。与后端 `relativePathFromFileUrl` 同口径（同一探测原语）。
 */
export function relativePathFromUrl(url: string): string | null {
  return relativePathFromFileUrl(url);
}

// POST /api/files/move { src, dst } → { code:0, data:{ ok:true, id, url, name } }
// src/dst 为「相对 uploadDir」路径（口径同 createFolder/mkdir）。
//
// 【TD-03-6① 文档更正，2026-09-13】原名「移动」是**物理移动时代的化石**。实测后端
// `handleMove` → `applyResourceContextMove` 是 **context-only**：只改 `resources` 表的 folder 列，
// **不移动磁盘文件**（后端注释明说「context-only 虽不碰磁盘」「物理文件未动」）。
// 故原注释「重试会撞『src 已不存在』404」的**理由已不成立**（context-only 更新本身幂等）。
// ⚠️ 本次**只更正文档，不改行为**：`retries:0` 原样保留（既有调用方行为不变；是否放宽留给后续按需评估）。
export async function moveFile(src: string, dst: string): Promise<FileOpResult> {
  return httpRequest(`${API_BASE}/api/files/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ src, dst }),
    retries: 0,
    label: 'moveFile',
  });
}

// 是否可移动到文件夹：仅本地文件型资源（local-tool）可移动；文件夹 / 远程 / 收藏类不提供移动入口。
// 纯函数，供拖拽移动到文件夹（useResourceMoveToFolder）+ 单测。禁止在组件里手写 source/type 判断。
export function canMoveAsset(item: { source?: string; type?: string } = {}): boolean {
  return item.source === 'local-tool' && item.type !== 'folder';
}

// 由资源项 + 目标目录（相对 uploadDir）推导移动的 src/dst，并判断是否同目录。
//
// 【TD-12-8 修复 · 磁盘定位真源 = 不可变 url】src/dst 的**磁盘相对路径**必须由 `item.url` 派生
// （`relativePathFromUrl`），**不得**用 `folder`/`name` 拼：
//   - `folder`/`name` 是 context-only 下的「UI 分类 / 显示名」，移动归类后 folder 与磁盘脱钩、
//     改名后 name 与磁盘文件名脱钩 → 用它们拼路径会得到**不存在的磁盘路径**（移动失败/假成功）。
//   - `url`（= `/files/<磁盘rel>`）rescan 写入后**永不改**，是唯一真源。
// 回退：item 无 url（历史/非本地）时退回旧 folder/name 口径（不静默改语义，避免本函数调用方炸）。
// - src  = 磁盘 rel（url 派生）
// - dst  = targetFolderRel/磁盘文件名（basename 取自 url，非 UI name）
// - sameDir = 磁盘源目录 === targetFolderRel
// 纯函数，供拖拽移动到文件夹（useResourceMoveToFolder）+ 单测；禁止各 tab 各自拼路径。
export function resolveMovePaths(
  item: { folder?: unknown; name?: unknown; url?: unknown } = {},
  targetFolderRel = '',
): { src: string; dst: string; sameDir: boolean } {
  const fromUrl = typeof item.url === 'string' ? relativePathFromUrl(item.url) : null;
  // 磁盘相对路径 + 磁盘文件名：优先 url 派生，缺失时回退 UI folder/name（历史兼容）
  const srcFolder = fromUrl
    ? fromUrl.includes('/')
      ? fromUrl.slice(0, fromUrl.lastIndexOf('/'))
      : ''
    : item.folder
      ? String(item.folder)
      : '';
  const diskName = fromUrl ? fromUrl.slice(fromUrl.lastIndexOf('/') + 1) : String(item.name || '');
  const src = srcFolder ? `${srcFolder}/${diskName}` : diskName;
  const dst = targetFolderRel ? `${targetFolderRel}/${diskName}` : diskName;
  return { src, dst, sameDir: srcFolder === (targetFolderRel || '') };
}

// POST /api/files/mkdir { folder } → { code:0, data:{ ok:true } }
// 收口 GeneratedView/ResourceLibrary 此前裸拼 `/api/files/mkdir` 的 createFolder 散落点。
export async function createFolder(folder: string): Promise<FileOpResult> {
  return httpRequest(`${API_BASE}/api/files/mkdir`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder }),
    retries: 0, // mkdir 是 UI 即时操作，不重试
    label: 'createFolder',
  });
}

const SUBFOLDER = UPLOAD_DIRS.tasks;
/** 网页拖图专用落盘目录（不与素材库/生成结果混放，见 docs/34 升级） */
export const WEB_DROP_SUBFOLDER = UPLOAD_DIRS.web;
// multipart/大文件上传统一参数：较长超时 + 不自动重试（避免重复上传）
const UPLOAD_OPTS = { timeoutMs: UPLOAD_TIMEOUT, retries: 0 };

// toAbsoluteFileUrl 已收敛到 assetUrl.js（统一图片 URL 归一化入口）。
// 此处 re-export 兼容既有引用，逻辑单一来源在 assetUrl.js。

// 类型 → 扩展名（生成面板按扩展名分类展示）
const EXT_BY_TYPE: Record<string, string> = {
  image: 'png',
  text: 'txt',
  video: 'mp4',
  audio: 'm4a',
};

/** 文件名去非法字符 + 可读时间戳唯一化（到秒，如 20250815_142305） */
function safeName(base: string, ext: string): string {
  const clean = safeFileName(base, { fallback: 'result' });
  return `${clean}_${formatTime(undefined, { mode: 'file' })}.${ext}`;
}

/**
 * 把内联 dataURL 落盘为本地文件 URL（「将内联资源转为URL / 清理缓存」核心）。
 * 候选 B（deepening-files-upload-seam）：已收口为**纯透传**——只把 base64 原文 + subfolder
 * 发给 localTool /api/files/upload 的 dataUri 分支；sha1 幂等、isValidBase64 严格校验、
 * 扩展名推导全部移交后端 base64Externalize.saveBase64ToFile 单一实现，前端不再另造一套。
 * 之前前端在此自算 sha1(blob) 40 位 + 无合法校验，与后端 sha1(base64) 16 位不一致 → 同一图
 * 两种文件名互不去重，且残缺 base64 会落盘成损坏文件；收口后两链路一致并堵住损坏文件缺陷。
 * @param {string} dataUrl 形如 data:image/png;base64,xxxx
 * @param {string} [subfolder] 落盘子目录，默认 canvas（与官方 base64Externalize 一致）
 * @param {string} [displayName] 行显示名（context 维度；不参与磁盘命名 —— 磁盘名是内容寻址 sha1）
 * @returns {Promise<string|null>} 落盘 URL（http://127.0.0.1:18080/files/<subfolder>/<name>）；失败返回 null（调用方保留原 base64）
 */
export async function saveInlineToLocal(
  dataUrl: string,
  subfolder: string = UPLOAD_DIRS.canvas,
  projectId?: string,
  displayName?: string,
): Promise<UploadOutcome> {
  // 【2026-09-17 判据 · 补齐】本层**不再**保留旧的 `string|null` 签名 —— 上一轮"为省改动半径而留口"
  // 的结果就是「原因仍被压平」（注释里自己记的 ⚠️ 已知缺口）。现与低层 `uploadInlineDataUrl` 同型：
  // **判别联合 + 生产者 message**，由消费方**只转发**。
  //
  // 并且**本层不再自己 `logger.warn`**（上一轮加的那句已删）：按判据"**消费者只转发，禁止自己加工**"，
  // 留痕属于**产生失败的那层**或**拥有 UI 的那层**；中转层多记一次既是重复留痕、制造噪声，
  // 也会让"非 data: 不该发任何请求"这类断言失真（logger 上报本身就是一个请求）。
  return uploadInlineDataUrl(dataUrl, subfolder, projectId ?? '', displayName);
}

/** 低层上传结果（**判别联合 + 生产者给可展示信息**）。
 *
 *  【2026-09-17 判据】错误必须由**产生它的那层**以判别联合透传（含可展示信息）；**消费者只转发**。
 *  本文件**已有正面范式**（`SaveTasksOutcome` / `persistUrlToUploads` 的 `{ok:false, reason, message}`，
 *  注释自述「不再用 null 兼表『无需落盘』与『落盘失败』」）—— 下面这 4 个低层上传函数是**仅存的例外**：
 *  它们把失败压成 `null`，**`e.message`（原因）当场丢失**，于是上层只能给用户一个笼统的
 *  `reason:'upload-failed'` ⇒ 用户与开发者都**不知道"为什么没落盘"**（这正是"假兜底"的典型：
 *  看起来处理了，实际把信息扔了）。
 */
export type UploadOutcome =
  | {
      ok: true;
      url: string;
      /**
       * Content 维度稳定身份（`sha1:<hex>(字节)`）—— **由后端落盘权威产出**（`writeUploadDedup`，
       * multipart `files.ts:175` / fileUrl `files.ts:410` 两分支随结果回传）。
       *
       * 【TD-08-28 收口】生产者给全 ⇒ 消费者（`AssetNode` / `useAssetDropPaste`）**直接用它**，
       * 不再自行 `contentIdOfBytes`（fetch 整图 + 重算 sha1：同一身份两份计算，既漂移又白下载）。
       * base64/dataUri 分支后端**暂不回传** ⇒ 此处 `undefined`（如实，不在前端补算 —— 补算正是本债要收的那份）。
       */
      contentId?: string;
    }
  /** `skipped:true` ＝**无需上传**（已是本地文件 / 非 http 地址）—— 与「上传失败」严格区分
   *  （对齐同文件 `SaveTasksOutcome.skipped` 的既有语义：编排层据此决定要不要报告）。 */
  | { ok: false; message: string; skipped?: boolean };

async function uploadInlineDataUrl(
  dataUrl: string,
  subfolder: string,
  projectId: string,
  displayName?: string,
): Promise<UploadOutcome> {
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    return { ok: false, message: '内联资源不是 data: 形式，无法落盘' };
  }
  try {
    const data = await httpRequest(`${API_BASE}/api/files/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // 【TD-12-5】携当前项目 id → 后端落盘时写 resource 行 project_id（项目隔离写入链闭环）
      // 【TD-12-12】携 displayName → 后端行的 name = 用户命名（改前恒为磁盘哈希名，素材库里认不出）
      body: JSON.stringify({ dataUri: dataUrl, subfolder, projectId, displayName }),
      ...UPLOAD_OPTS,
    });
    const url = data?.data?.url;
    // 【2026-09-17 补生产者后】后端 base64 分支现也回传 contentId（与 multipart / fileUrl 同口径）⇒ 如实上浮，
    // 消费者经 `UploadOutcome` / `PersistOutcome` 直接用，不必自行算 sha1（TD-08-28 收掉的那份算法）。
    const contentId = data?.data?.contentId;
    // 【生产者给事实】后端 200 但没回 url ＝ 落盘未完成（不能当成成功）
    return url
      ? { ok: true, url, contentId }
      : { ok: false, message: '落盘接口未返回 url（后端未完成落盘）' };
  } catch (e) {
    // 【生产者给可展示信息】把原因带出去，不让上层猜、也不让它自己编文案。
    return {
      ok: false,
      message: `内联资源落盘失败：${(e as { message?: string })?.message || String(e)}`,
    };
  }
}

/**
 * 从 `File | Blob` **诚实**取文件名（TD-03-6④，2026-09-13）。
 *
 * 参数类型是 `File | Blob`，而 **`Blob` 没有 `name`** —— 原写法 `(file as File).name` 是
 * **假收窄**（类型声称是 File，运行时可能是 Blob）→ 拿到 `undefined` 后静默落到 `'upload'` 兜底，
 * 类型层完全看不见这个可能性。改用 `instanceof` 运行时守卫，把"可能没有 name"这件事显式化。
 * 调用方仍可用显式 `filename` 参数覆盖（本条只修**默认取名**路径）。
 */
function fileNameOf(file: File | Blob): string {
  return file instanceof File ? file.name : '';
}

/**
 * 直接把 File/Blob 上传到 localTool（对齐官方 H_.jsx onDrop 的 hi(file,{subfolder})）。
 * 区别于 saveInlineToLocal（dataURL → 落盘）：这里直接 multipart 传原始文件，
 * 避免视频等大文件先转 dataURL 再转 Blob 的两段大内存拷贝。
 * 上传成功返回 http://127.0.0.1:18080/files/<subfolder>/<name>；失败返回 null。
 * @param {File|Blob} file 原始文件
 * @param {string} [subfolder] 落盘子目录，默认 canvas/drop（对齐官方）
 * @param {string} [filename] 可选自定义文件名。**Blob 无 name**，故默认名对 Blob 恒为空 → 落 `'upload'`
 * @returns {Promise<string|null>}
 */
export async function uploadFileToLocal(
  file: File | Blob | null,
  subfolder: string = UPLOAD_DIRS.canvasDrop,
  filename?: string,
  projectId?: string,
): Promise<UploadOutcome> {
  if (!file) return { ok: false, message: '未提供文件（file 为空）' };
  logger.debug(
    'filesApi',
    '[UPLOAD] 准备 multipart 上传',
    { subfolder, name: filename || fileNameOf(file), size: file.size, type: file.type },
    { module: 'asset' },
  );
  try {
    const fd = new FormData();
    fd.append('file', file, filename || fileNameOf(file) || 'upload');
    fd.append('subfolder', subfolder);
    // 【TD-12-5】携当前项目 id → 后端落盘时写 resource 行 project_id（项目隔离写入链闭环）
    if (projectId) fd.append('projectId', projectId);
    const data = await httpRequest(`${API_BASE}/api/files/upload`, {
      method: 'POST',
      body: fd,
      ...UPLOAD_OPTS,
    });
    const url = data?.data?.url;
    // 【TD-08-28】后端 multipart 分支已回传 contentId（files.ts:175）⇒ 生产者给全、随结果上浮。
    const contentId = data?.data?.contentId;
    logger.debug('filesApi', '[UPLOAD] 完成', { url, subfolder, contentId }, { module: 'asset' });
    if (!url) {
      // 【2026-09-17 判据】「200 但后端没回 url」＝ **落盘未完成**，不能混进成功路径。
      // 原 `return data?.data?.url || null` 把"成功拿到 url"与"接口没给 url"压成同一个 null。
      return { ok: false, message: '上传接口未返回 url（后端未完成落盘）' };
    }
    return { ok: true, url, contentId };
  } catch (e) {
    // 【生产者给可展示信息】原来 `logger.warn(..., e)` + `return null`：**原因当场丢失**，
    // 上层只能给用户笼统的"上传失败"。现在 `e.message` 随判别联合上浮（消费者**只转发**）。
    return {
      ok: false,
      message: `文件上传失败：${(e as { message?: string })?.message || String(e)}`,
    };
  }
}

/**
 * ════════════════════════════════════════════════════════════════
 * 【图像入节点·统一落盘策略】—— 唯一策略，调用方禁止再写第二套降级
 * ════════════════════════════════════════════════════════════════
 * 语义前提：**落盘只是"让图刷新不丢"的优化，不是图能否显示的前提。**
 *  ① File 源 → 先直接 multipart 上传（绝不为上传先把 File 转 dataURL：大视频会内存爆），
 *     只有上传失败才读内联 dataURL 兜底；
 *  ② dataURL 源（编辑器保存/裁剪/压缩/放大的产物）→ 先让图立即上屏，再落盘换持久 URL；
 *  ③ **落盘失败一律回退内联**：不阻断、不回滚、不标记失败；
 *  ④ 只有「连内联都拿不到」才算真失败 → 返回 null，由调用方提示一次错误。
 * 快照里的内联体积由后端 base64Externalize 统一兜底，**入口侧不再各写一套"以防万一"的兜底**。
 *
 * 消费方（勿再各写降级）：AssetNode 上传、useAssetDropPaste 拖入/粘贴、ImageGenerate 上传参考图、
 * useImageHoverActions 的四条编辑出口。
 */

/**
 * 【TD-03-13】本地服务（localTool :18080）不可用 → 落盘降级为「内联 base64」时的**一次性**提示。
 *
 * 语义前提：落盘只是"让图刷新不丢"的优化，不是"图能否显示"的前提（见上方统一落盘策略）——
 * 所以降级本身**不阻断、不回滚**，但**不能再静默**：此前用户完全不知道后台没存成，
 * 直到项目快照膨胀 / 换设备 / 清缓存后图全丢才察觉。
 * 本会话只提示一次（localTool 未启动是**持续性状态**，反复弹是打扰）；日志每次留痕（reportDegrade 内 logger.warn）。
 */
let localServiceDegradeNotified = false;
function notifyLocalServiceDegrade(): void {
  reportDegrade({
    layer: 'filesApi',
    key: 'local-service-down',
    toast: localServiceDegradeNotified
      ? undefined
      : '本地服务未启动，素材已临时保存（换设备或清缓存可能丢失）',
  });
  localServiceDegradeNotified = true;
}

/**
 * File/Blob → 可上屏的图片 URL（图像入节点·File 源）。
 * ① 先 uploadFileToLocal（原始 multipart）；② 上传失败 → 读内联 dataURL 兜底；③ 都拿不到 → null。
 * @returns 持久 /files/ URL（优先）或 dataURL；两者都失败返回 null（调用方提示一次错误）
 */
export async function resolveNodeAssetUrl(
  file: File | Blob | null,
  subfolder: string = UPLOAD_DIRS.canvasDrop,
  filename?: string,
): Promise<UploadOutcome> {
  if (!file) return { ok: false, message: '未提供文件（file 为空）' };
  const r = await uploadFileToLocal(file, subfolder, filename); // ① 直传，不先转 dataURL
  if (r.ok) return r;
  notifyLocalServiceDegrade(); // ② 落盘失败 → 降级内联：一次可见提示（TD-03-13）
  // ③ 降级读内联 dataURL —— 这是**真兜底**（dataURL 确实能上屏，不是拿默认值掩盖失败）。
  //    读不出才是真失败，此时把**两段原因合并**回报（消费者只转发，不自己编）。
  try {
    return { ok: true, url: await fileToDataUrl(file) };
  } catch {
    return { ok: false, message: `落盘失败（${r.message}），且读不出内联数据` };
  }
}

/**
 * dataURL → 落盘（图像入节点·dataURL 源，**需要拿到落盘结果的调用方**用）。
 * 与 showThenPersistInline 同族、共用同一条降级策略（落盘失败保留内联），只是返回形态不同：
 * 本函数返回最终 URL 供调用方自行决定何时写回（如「合成结果 → 先落盘再 patchData + spawn」）。
 * 禁止在调用方另写 `saveInlineToLocal(...) || dataUrl` 的第二套降级。
 * @returns 持久 /files/ URL（成功）或原 dataURL（失败保留内联）
 */
export async function persistInlineOrKeep(
  dataUrl: string,
  subfolder: string = UPLOAD_DIRS.canvas,
): Promise<string> {
  if (!dataUrl) return dataUrl;
  const saved = await saveInlineToLocal(dataUrl, subfolder);
  // 【2026-09-17 判据】签名保持 `Promise<string>` **是有意的**（不是省改动）：本函数的契约就是
  // 「**保证返回一个能上屏的 url**」，落盘失败则原样保留内联 —— 这是真兜底，已由
  // `notifyLocalServiceDegrade()` 给用户可见提示。故此处不需要 `UploadOutcome`。
  if (!saved.ok) notifyLocalServiceDegrade(); // 落盘失败 → 降级内联：一次可见提示（TD-03-13）
  return saved.ok ? saved.url : dataUrl;
}

/**
 * dataURL → 上屏 → 落盘换持久 URL（图像入节点·dataURL 源）。
 * ① 立即 show(dataUrl)（不等网络）；② persistInlineOrKeep 换 /files/ 持久 URL；③ 成功才二次 show。
 * 落盘失败 → 静默保持内联（不回滚、不报错；抛错只可能是 show 自身，本函数不吞操作级错误）。
 */
export async function showThenPersistInline(
  dataUrl: string,
  show: (url: string) => void,
  subfolder: string = UPLOAD_DIRS.canvas,
): Promise<void> {
  if (!dataUrl) return;
  show(dataUrl); // ① 立即上屏
  const persisted = await persistInlineOrKeep(dataUrl, subfolder);
  if (persisted !== dataUrl) show(persisted); // ③ 成功才换持久；失败保留内联
}

/**
 * 远程 http(s) URL → 本地 /files/ URL（网页拖图后台本地化专用，先显示后替换）。
 * 复用 localTool 后端【唯一下载归属点】saveRemoteUrl：POST /api/files/upload 传 fileUrl，
 * 服务端 fetchWithProxy 下载（直连优先、失败走 7897 代理）+ sha1 幂等去重 + [download] 留痕日志。
 * 跨域/防盗链图在浏览器 fetch 会失败，后端代下载天然绕过 CORS。网页图统一落 web 目录，
 * 不与素材库/生成结果混放。
 * @param {string} url http(s) 远程图片 URL
 * @param {object} [opts] { folder='canvas' 落盘子目录, filename 可选文件名（默认取 URL basename） }
 * @returns {Promise<string|null>} 本地化 URL（http://127.0.0.1:18080/files/<folder>/<name>）；失败返回 null（调用方降级保持原 URL）
 */
export async function downloadRemoteToLocal(
  url: string,
  { folder = UPLOAD_DIRS.canvas, filename }: { folder?: string; filename?: string } = {},
): Promise<UploadOutcome> {
  // 【本地图拦截】URL 已指向本机 uploads（/files/... 或 API_BASE/files/...）→ 本就落盘，无需再下载。
  // 背景：素材拖到画布时若没带 application/x-yimao-asset，画布会把它当「网页图」走本地化，
  // 后端便把 127.0.0.1 的文件重新下载一份存进 web 目录 → uploads/web 出现重复文件。
  // 这里作为最后一道防线：任何入口想「本地化」本机文件，一律返回 `skipped`（调用方保持原 URL）。
  if (isLocalFileUrl(url)) {
    logger.debug(
      'filesApi',
      '[DOWNLOAD] 已是本地文件，跳过重复下载',
      { url: String(url).slice(0, 100) },
      { module: 'asset' },
    );
    // 【2026-09-17】这**不是失败** —— 但它也不是 `ok:true`（没有新 url）。原实现 `return null` 把
    // 「无需下载」与「下载失败」压成同一个 `null`，上层只能猜（这正是"假兜底"）。现显式声明
    // `skipped:true`（对齐 `SaveTasksOutcome.skipped` 的既有语义），原因一并给出。
    return { ok: false, message: '已是本地文件，无需重复下载', skipped: true };
  }
  // saveRemoteUrl 用 new URL(fileUrl) 取 basename，data:/blob: 会抛错 → 仅 http(s) 可下载
  if (typeof url !== 'string' || !/^https?:/i.test(url)) {
    return { ok: false, message: '非 http(s) 地址，不适用远程下载', skipped: true };
  }
  return uploadRemoteUrl(url, folder, filename);
}

/**
 * 【内部】http(s) 远程 URL → 落盘本地 /files/ URL（fileUrl 模式，后端 saveRemoteUrl 幂等下载）。
 * downloadRemoteToLocal / saveResultToTasks / persistUrlToUploads 共用的唯一下载入口，禁止调用方另写 JSON 上传。
 * @param {string} fileUrl http(s) 远程 URL
 * @param {string} subfolder 落盘子目录
 * @param {string} [filename] 可选文件名
 * @returns {Promise<string|null>} 本地 /files/ URL；失败返回 null（不抛，调用方降级）
 */
async function uploadRemoteUrl(
  fileUrl: string,
  subfolder: string,
  filename?: string,
): Promise<UploadOutcome> {
  try {
    const data = await httpRequest(`${API_BASE}/api/files/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileUrl, subfolder, filename: filename || undefined }),
      ...UPLOAD_OPTS,
    });
    const url = data?.data?.url;
    // 【TD-08-28】后端 fileUrl 分支已回传 contentId（files.ts:410）⇒ 同 multipart，生产者给全。
    // 关键收益：网页图本地化路径（`downloadRemoteToLocal`）**不必再 fetch 整图算 sha1**（原
    // `useAssetDropPaste` 就是为此多下一次整图的消费者）。
    const contentId = data?.data?.contentId;
    return url
      ? { ok: true, url, contentId }
      : { ok: false, message: '远程 URL 落盘接口未返回 url（后端未完成落盘）' };
  } catch (e) {
    // 【2026-09-17】原因带出去（原来是 `return null` 把它扔掉 ⇒ 上层只剩笼统的 upload-failed）
    return {
      ok: false,
      message: `远程 URL 落盘失败：${(e as { message?: string })?.message || String(e)}`,
    };
  }
}

// ─────────────────────── 「URL → uploads」落盘唯一原语 ───────────────────────
// 【为什么收口（TD-12-10 收口轮）】「按来源协议分流（data: / blob: / http(s) / 已是本机 /files/）」
// 这一**判据**此前被抄成 ≥4 份，且短路口径各不相同：
//   · resourceStore.persistUrlToBackend        —— 无「已是本机」短路 → 把 uploads 里的文件再 fetch + 重传
//   · resourceStore.localizeAndStoreToResourceLibrary —— 有短路，但整体与上式重复（同一能力两份）
//   · filesApi.saveResultToTasks / downloadRemoteToLocal —— 各有短路，各自维护
// 判据属**文件域**（本模块 = 全站文件域单点），不属于任何上层用例 → 收口到此处唯一一份。
// 其中「无短路」不是风格问题而是正确性问题：本机文件重传会撞后端 contentId 去重
// （files.ts:124-130 命中即不登记/不刷新 resource 行）→ 行留在旧目录 → 素材库目录下拉不到
// → 用户看到「发送了，库里没有」的假成功。

/** 落盘来源（成功侧）：inline=data URL；uploaded=经上传落盘；already-local=本就在 uploads（未上传）。 */
export type PersistSource = 'inline' | 'uploaded' | 'already-local';

/**
 * 落盘失败原因（唯一词表）。
 * - empty：无 url 可落
 * - unsupported：既非 data:/blob:/http(s)、也非本机 /files/（不猜、不兜底）
 * - upload-failed：上传/落盘接口明确失败（后端 4xx/5xx 或返回空）
 * - exception：fetch/编码等抛错（message 带原始信息，不上报为笼统失败）
 * - relocate-failed：**由用例层（发送到素材库）产生**——文件已落盘，但资源行未能归位到目标目录
 */
export type PersistFailReason =
  'empty' | 'unsupported' | 'upload-failed' | 'exception' | 'relocate-failed';

/**
 * 「URL → uploads 落盘」结果 —— **判别联合**（禁把「失败」压成 `null`，也禁把
 * 「本就在 uploads，无需落盘」与「落盘失败」混为一谈 —— 两者对调用方是**相反**的动作）。
 *
 * 注：两侧各带对方的键（可选 `undefined`）是本仓 tsconfig 的历史约束（`strictNullChecks: false`
 * 下 TS 不对 boolean 判别属性做收窄）——`ok` 仍是判别位，语义不变。
 */
export type PersistOutcome =
  | {
      ok: true;
      url: string;
      source: PersistSource;
      /**
       * Content 维度稳定身份（`sha1:<hex>(字节)`），随 `PersistSource` 分支而异：
       *  · `uploaded` → 后端回传（multipart / fileUrl 分支，见 `UploadOutcome.contentId`）；
       *  · `inline` → 后端 base64 分支**暂不回传** ⇒ undefined（如实；前端不补算，TD-08-28）；
       *  · `already-local` → 未发生上传，本层无从得知 ⇒ undefined（需稳定身份的调用方按 url 查资源行）。
       */
      contentId?: string;
      reason?: undefined;
      message?: undefined;
    }
  | {
      ok: false;
      url?: undefined;
      source?: undefined;
      contentId?: undefined;
      reason: PersistFailReason;
      message?: string;
    };

/**
 * 「生成结果 → tasks 落盘」结果 —— **判别联合**（TD-01-17，2026-09-16）。
 *
 * 【为什么从 `string|null` 改为判别联合】原契约用 `null` 同时表达「**无需落盘**（blob:/已是本机 /files/）」
 * 与「**落盘失败**」—— 这对调用方是**相反**的动作（前者无需报告、后者必须可见），却拿到同一个信号
 * → 编排层只能把两者都并入「生成成功」报告 = **假成功**（M1 结果契约缺位 / M5 失败不可见）。
 * 与同文件 `PersistOutcome` 同族（`ok` 为判别位）。
 *
 * - `ok: true` + `skipped: true`  —— 无需落盘（blob: 本地临时地址 / url 已是本机 `/files/`），url = 原样返回
 * - `ok: true` + `skipped: false` —— 落盘成功，url = 新持久 `/files/` URL
 * - `ok: false`                    —— 落盘失败，**调用方应保留原始 URL 降级并让失败可见**
 */
export type SaveTasksOutcome =
  | { ok: true; url: string; skipped: boolean; reason?: undefined; message?: undefined }
  | {
      ok: false;
      url?: undefined;
      skipped?: undefined;
      reason: PersistFailReason;
      message?: string;
    };

/** 落盘文件名的扩展名（按调用方声明类型优先，其次由 mime / URL 推断；未知按 png）。 */
function extOf(kind: AssetType | 'other', fallback = 'png'): string {
  return EXT_BY_TYPE[kind] || fallback;
}

/**
 * 把任意来源 URL 落盘到 uploads 指定子目录，返回**持久 /files/ URL 或明确失败**。
 *
 * 【分流判据（唯一实现，禁止上层再抄）】
 *  1. `data:`            → saveInlineToLocal（后端 base64Externalize 校验 + 内容寻址）
 *  2. 已是本机 /files/   → **不落盘**（`already-local`）——它本就在 uploads，重传只会撞 contentId 去重
 *  3. `blob:`            → 浏览器 fetch 取 Blob（后端拿不到 blob:）→ multipart 上传
 *  4. `http(s):`         → 交后端唯一「下载归属点」uploadRemoteUrl（免浏览器 CORS/防盗链、大文件不进前端内存）
 *  5. 其它                → `unsupported`（明确失败，不猜协议）
 *
 * @param {string} url 来源 URL（data: / blob: / http(s) / 本机 /files/）
 * @param {object} [opts]
 *   - folder    落盘子目录（相对 uploads，如 'migrated'）
 *   - name      期望的落盘文件名（安全化后使用；不含扩展名，扩展名由类型推断）
 *   - type      调用方声明的素材类型（优先于推断）
 *   - projectId 当前项目 id（后端据此写 resource 行的 project_id）
 * @returns {Promise<PersistOutcome>} 判别联合；**不抛**（异常也归为 `exception` 并留痕）
 */
export async function persistUrlToUploads(
  url: string,
  {
    folder = UPLOAD_DIRS.canvas,
    name,
    type,
    projectId,
  }: { folder?: string; name?: string; type?: AssetType; projectId?: string } = {},
): Promise<PersistOutcome> {
  const src = String(url || '');
  if (!src) return { ok: false, reason: 'empty' };
  const base = safeFileName(name, { stripExt: true, fallback: 'asset' });
  try {
    if (src.startsWith('data:')) {
      const saved = await saveInlineToLocal(src, folder, projectId, name);
      // 【2026-09-17 消费者只转发】生产者的 `message`（**为什么**没落盘）随 `PersistOutcome` 上浮，
      // 不再笼统压成 `reason:'upload-failed'` —— 那是让用户与开发者都得不到原因。
      return saved.ok
        ? { ok: true, url: saved.url, source: 'inline', contentId: saved.contentId }
        : { ok: false, reason: 'upload-failed', message: saved.message };
    }
    if (isLocalFileUrl(src)) {
      // 原样返回：保持调用方既有 URL 形态（相对仍相对），不做归一（归一属渲染/发送出口的职责）
      // 【TD-08-28】本分支不产生 contentId（未上传）：如需稳定身份，调用方按 url 查资源行，
      // 而非在这里补算 sha1（补算＝同一身份两份计算，正是本债要收的形态）。
      return { ok: true, url: src, source: 'already-local' };
    }
    if (src.startsWith('blob:')) {
      const resp = await httpRequest(src, {
        parseJson: false,
        retries: 0,
        label: 'persistUrlToUploads.blob',
      });
      const blob = await resp.blob();
      const mime = blob.type || 'image/png';
      const ext = extOf(
        type || detectFileType({ name: '', type: mime }),
        mime.split('/')[1] || 'png',
      );
      const file = new File([blob], `${base}.${ext}`, { type: mime });
      const saved = await uploadFileToLocal(file, folder, file.name, projectId);
      // 【2026-09-17 同上】message 上浮，不压平。
      return saved.ok
        ? { ok: true, url: saved.url, source: 'uploaded', contentId: saved.contentId }
        : { ok: false, reason: 'upload-failed', message: saved.message };
    }
    if (/^https?:/i.test(src)) {
      const ext = extOf(type || detectAssetType(src));
      const saved = await uploadRemoteUrl(src, folder, `${base}.${ext}`);
      // 【2026-09-17 消费者只转发】失败时**转发生产者给的 `message`** —— 原来这里只能给笼统的
      // `reason:'upload-failed'`，因为真正的原因（`e.message`）已在低层被 `return null` 扔掉。
      return saved.ok
        ? { ok: true, url: saved.url, source: 'uploaded', contentId: saved.contentId }
        : { ok: false, reason: 'upload-failed', message: saved.message };
    }
    return { ok: false, reason: 'unsupported' };
  } catch (e) {
    const message = (e as { message?: string })?.message || String(e);
    logger.warn('filesApi', '[PERSIST] URL 落盘失败', `${src.slice(0, 80)} | ${message}`);
    return { ok: false, reason: 'exception', message };
  }
}

/**
 * 把生成结果落盘到 localTool 的 tasks 目录。
 *
 * 【TD-01-17】返回**判别联合** `SaveTasksOutcome`（不再用 `null` 兼表「无需落盘」与「落盘失败」）——
 * 编排层须能区分二者：前者无需报告，后者必须**保留原 URL 降级 + 用户可见**（否则=假成功）。
 * @param {string} url 结果 url：data: / blob: / http(s) 上游 url
 * @param {'image'|'text'|'video'|'audio'|string} type 结果类型，决定扩展名
 * @returns {Promise<SaveTasksOutcome>} 落盘成功 → 新 url；无需落盘 → 原 url + skipped:true；失败 → ok:false（不抛）
 */
export async function saveResultToTasks(url: string, type: string): Promise<SaveTasksOutcome> {
  // 空 url：没有东西可落盘（非失败）→ 早返回，保留原口径（不把"无内容"降级成失败）。
  if (!url) return { ok: true, url, skipped: true };
  const ext = EXT_BY_TYPE[type] || 'bin';
  // 【TD-02-58 收口 · 2026-09-17】分流判据（data: / blob: / http(s) / 已是本机 /files/）与失败判词
  // **只有一份**：本函数不再自抄一份，而是**委托唯一原语** `persistUrlToUploads`（见上方「落盘唯一原语」段），
  // 自己只做两件事：① 给 tasks 场景的命名与子目录；② 把 `PersistOutcome` **如实映射**成 `SaveTasksOutcome`
  // （`skipped` 由 `source === 'already-local'` 决定 = "无需落盘"，与"落盘失败"严格分开）。
  //
  // 【行为变化（合同变更，见 01 区 §二十三）】：
  //  ① `blob:` 从「skipped 保留原地址」改为**真上传** —— 落盘函数就该落盘：`blob:` 是页面级临时地址，
  //     刷新即失效，原来的"skipped"等于让生成结果在刷新后消失；委托后失败会给出 ok:false + 生产者 message，
  //     调用方（`generationContract`）本就有"保留原 URL + 可见提示"的兜底，比静默保留死链更诚实。
  //  ② 失败 `reason` **不再由本层改写**：原实现在此把 `upload-failed` 重贴成 `exception`、又自编 catch ——
  //     那是**消费者替生产者重新归类失败**（越权，见 CLAUDE.md §5.1「只有生产者才有权呈现错误」）。
  //     现原样转发原语给的 `reason` + `message`。
  const r = await persistUrlToUploads(url, {
    folder: SUBFOLDER,
    name: safeName('generated', ext),
    type: type as AssetType,
  });
  if (!r.ok) return { ok: false, reason: r.reason, message: r.message };
  return { ok: true, url: r.url, skipped: r.source === 'already-local' };
}

/**
 * 把纯文本结果落盘成 txt 到 tasks 目录（文本节点的生成结果不是 url，而是文本内容）。
 * 后端 rescan 会把 upload/tasks/*.txt 识别为 type='text'，生成面板「文本」tab 即可收录。
 * @param {string} text 文本内容
 * @param {string} [name] 文件名前缀（默认 generated）
 * @returns {Promise<string|null>} 落盘后的 18080 url；失败返回 null（不抛，不影响主流程）
 */
export async function saveTextToTasks(text: string, name?: string): Promise<UploadOutcome> {
  if (typeof text !== 'string' || !text.trim()) {
    return { ok: false, message: '文本为空，无需落盘' };
  }
  // 文件名清洗统一走 safeFileName（收口，勿再手写 replace 样板）：与旧手写逻辑逐字节等价（sep='_' + fallback）
  const safeBase = safeFileName(name, { fallback: 'generated' });
  const filename = `${safeBase}_${formatTime(undefined, { mode: 'file' })}.txt`;
  try {
    const blob = new Blob([text], { type: 'text/plain' });
    const fd = new FormData();
    fd.append('file', blob, filename);
    fd.append('subfolder', SUBFOLDER);
    fd.append('filename', filename);
    const data = await httpRequest(`${API_BASE}/api/files/upload`, {
      method: 'POST',
      body: fd,
      ...UPLOAD_OPTS,
    });
    const url = data?.data?.url;
    return url ? { ok: true, url } : { ok: false, message: '文本落盘接口未返回 url' };
  } catch (e) {
    // 【2026-09-17】原因带出去（原来是 `return null` 把它扔掉 ⇒ 上层只剩笼统 upload-failed）
    return {
      ok: false,
      message: `文本落盘 tasks 失败：${(e as { message?: string })?.message || String(e)}`,
    };
  }
}
