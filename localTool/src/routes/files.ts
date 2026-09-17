/**
 * 子模块 0.3 — 文件操作路由
 * upload / read / thumbnail / mkdir / move / open / open-dir / list
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getUploadDir, getDb, queryOne } from '../db/database.js';
import {
  ensureDir,
  writeUploadDedup,
  ensureThumbnailTarget,
  resizeImage,
  normalizeSubfolder,
  resolveUploadFile,
  isJimpEncodableExt,
  jimpExtForFile,
} from '../utils/fileStore.js';
import {
  json,
  parseMultipart,
  parseJsonBody,
  sendError,
  HttpStatusError,
  fileNameFromUrl,
} from '../utils/helpers.js';
import { fetchWithProxy } from '../utils/netProxy.js';
import { stableRequest, RETRYABLE_HTTP_STATUSES } from '../ai-relay/httpTransport.js';
import { logTs } from '../utils/relayHeaders.js';
import { localToolBaseUrl } from '../utils/localToolBaseUrl.js';
import { saveBase64ToFile, type Base64PersistResult } from '../utils/base64Externalize.js';
import {
  applyResourceContextMove,
  recordUploadedFileRow,
  relativePathFromFileUrl,
} from './resources.js';
import { extToMime, mimeToExt } from '../utils/mime.js';

const BASE_URL = localToolBaseUrl();

/**
 * 入口校验并规范化 subfolder；非法 → 返回 null（调用方回 400）。
 *
 * 【TD-08-31】为什么必须在**入口**拦：底层 `resolveUploadTarget` 已改为非法即 throw（不再静默回退 `canvas`）。
 * 若不在入口拦，非法目录会在"落盘/下载"深处炸 → 被外层 catch 归因成「下载失败/500」，把排查引偏。
 * 且**落盘与登记行必须用同一个规范化值**，否则盘在 A、行记 B（素材库按 folder 分组时看不见文件）。
 */
function resolveRequestSubfolder(raw: unknown): string | null {
  return normalizeSubfolder(raw === undefined || raw === null || raw === '' ? 'canvas' : raw);
}

// 注：「thumbnail format 是否可编码」判据**不再在本文件自持**（原为 `SUPPORTED_THUMB_FORMATS` Set）。
// 2026-09-16（TD-02-41）收口到 `utils/fileStore.isJimpEncodableExt` —— 该事实（Jimp 0.22 能编码哪些格式）
// 此前被写了 3 份（本文件 / 前端 assetUrl.ts / resolveLocalImages.mimeFromExt），已漂移过。
// 放行 webp 的后果（@jimp/types 无编码器 → resize 失败后 copyFileSync 产出「.webp 名 + 原格式字节」的
// 假 webp）现由该唯一真源的注释统一说明，不再各处复述。

/**
 * saveRemoteUrl 的落盘结果信封。
 *
 * 更新(2026-09-17 · 格式真相 + 身份归位收口)：
 *  - `contentId` = Content 维度稳定身份（`sha1:<hex>(字节)`），由落盘权威 `writeUploadDedup` 产出、
 *    经此回传 —— 调用方（含前端）**直接使用，禁止再自行算哈希**（同一真相只允许一份计算）。
 *  - `url` 的物理名 = `contentHashName(sha1(字节)) + 真实格式扩展名`（内容寻址），
 *    不再是「URL 哈希 + URL basename」—— 后者让物理名承载 URL 信息（会漂移、会把 .jpg 名安到 webp 字节上）。
 */
interface SaveRemoteResult {
  url: string;
  path: string;
  thumbnailUrl?: string;
  /** Content 维度身份（`<alg>:<hex>`），与 resources.sha1 同源 */
  contentId: string;
}

/**
 * 进程内 in-flight 下载去重表：dedupeKey -> 正在下载的 Promise。
 *
 * 【为什么需要它】saveRemoteUrl 靠 fs.existsSync 做文件级幂等，只能挡"顺序重复到达"
 * （第一份已写完，第二份判 existsSync 命中即跳过），挡不住"并发重叠窗口"：
 * 前端双落盘(useNodeGeneration + PromptNode.onSuccess)会对同一远程 URL 发两个并发
 * POST /api/files/upload，两个请求到达时都还没下载完、existsSync 都判 false → 都真下载。
 *
 * 【锁语义】只挡"重叠并发窗口"：Promise settle 后 finally 必删该键，不缓存结果。
 *  - 并发窗口内：第二个请求 await 第一个的同一 Promise，复用其成功结果或同样的失败。
 *  - 窗口之后(顺序重复)：键已删，走既有 existsSync 文件幂等(带后缀 URL)或重新下载拿
 *    Content-Type(无后缀 URL)——与现状行为逐字一致，不因加锁改变顺序调用次数。
 *  - set 时机必须在"真正开始下载/fetch yield"之前，否则两并发仍可能都 miss。
 */
const inflightDownloads = new Map<string, Promise<SaveRemoteResult>>();

// ── upload ──
export async function handleUpload(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const contentType = req.headers['content-type'] || '';

  // 判断是 FormData 还是 JSON
  if (contentType.includes('multipart/form-data')) {
    return handleUploadFormData(req, res);
  } else {
    return handleUploadJson(req, res);
  }
}

// upload 响应留痕：此前日志只记 [POST] /api/files/upload 请求、不记响应，失败（400）无法从日志看出。
const uploadLog = (status: number, msg: string) =>
  console.log(`[upload] ${logTs()} | ${status} | ${msg}`);

async function handleUploadFormData(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const { fields, files } = await parseMultipart(req);

  const subfolder = resolveRequestSubfolder(fields['subfolder']);
  if (!subfolder) {
    uploadLog(400, `非法 subfolder: ${fields['subfolder']}`);
    return sendError(res, `Invalid subfolder: ${fields['subfolder']}`, 400);
  }
  const filename = fields['filename'] || undefined;
  // 【TD-12-5】当前项目 id（发起方唯一知晓）→ 落盘后写入 resource 行，闭合项目隔离写入链
  const projectId = fields['projectId'] || undefined;

  // file 优先于 fileUrl
  const fileData = files['file'];
  const fileUrl = fields['fileUrl'];

  if (fileData) {
    const saveName = filename || fileData.filename;
    // 【TD-03-8 修复】扩展名回退链：filename 后缀 → multipart mimeType → 空。
    // 此前**只用** filename 推 ext，于是 `canvas.toBlob` 等无 `.name` 的 Blob（前端传 'upload'）
    // 落盘成无后缀文件 → handleRead 回 octet-stream（浏览器不按图渲染）+ tryGenerateThumbnail 跳过。
    // 手边的 fileData.mimeType 是权威回退源，必须用上。
    const ext = path.extname(saveName) || mimeToExt(fileData.mimeType) || '';
    // 【docs/122 Content 维度 #6】按 contentId(`<alg>:<hex>`) 全局查重（folder 无关，入口不可能自带 hash 上行）：
    // 命中既有 Content/url → 复用不写盘；未命中 → 以 sha1(hex) 命名落盘（#1 仅初始命名）。
    const db = await getDb();
    const dedup = await writeUploadDedup({
      subfolder,
      ext,
      data: fileData.data,
      existingUrlByContentId: (contentId) => {
        const row = queryOne(db, 'SELECT url FROM resources WHERE sha1 = ?', [contentId]);
        return row ? (row.url as string) : null;
      },
    });
    // DB 既有 url 为绝对形式（http://.../files/...），转相对供 `BASE_URL + urlPath` 统一拼接
    const fileUrlPath = dedup.urlPath.replace(/^https?:\/\/[^/]+/, '');
    // 【TD-12-11 / TD-12-12 裁决 · 2026-09-14】**去重命中也要登记**：
    // 命中去重时这一步的作用是**刷新既有行的 context**（folder = 本次请求的 subfolder、
    // name = 本次声明名、project_id = 本次项目）→ 让「上传成功」诚实等价于
    // 「这份内容现在可在请求的 subfolder 下被看到」。
    // 改前 `if (!dedup.deduped)` 命中即跳过 → 行留旧目录，而调用方（发送到素材库 / 面板上传）
    // 已被回以成功 = **假成功**（用户：点了却库里没有）；且行 name 恒为磁盘哈希名。
    // 物理 url / contentId / id 均不动（docs/122 context-only：id 跟磁盘、folder/name 跟声明）。
    if (!fileUrlPath.startsWith('/files/')) {
      // 【TD-08-31】此前无守卫：`replace` 不命中就把整条 url 当相对路径传下去 ⇒ 行 id/url 全是脏值。
      uploadLog(500, `落盘 url 非 /files/ 形态，未登记行: ${fileUrlPath}`);
      return sendError(res, 'Persisted but returned url is not a /files/ path', 500);
    }
    const relPath = fileUrlPath.replace(/^\/files\//, '');
    await recordUploadedFileRow(relPath, { projectId, folder: subfolder, name: saveName });
    const thumbnailUrl = dedup.savedPath
      ? await tryGenerateThumbnail(dedup.savedPath, fileUrlPath)
      : undefined;
    uploadLog(
      200,
      `formdata ${saveName} -> ${fileUrlPath}${dedup.deduped ? ' (contentId dedup)' : ''}`,
    );
    return json(res, {
      code: 0,
      data: {
        url: `${BASE_URL}${fileUrlPath}`,
        path: dedup.savedPath || fileUrlPath,
        thumbnailUrl: thumbnailUrl ? `${BASE_URL}${thumbnailUrl}` : undefined,
        // Content 维度去重身份（docs/122 #4 桥）：前端可持 contentId（稳定），渲染经 url 派生
        contentId: dedup.contentId,
      },
    });
  }

  if (fileUrl) {
    // fileUrl 模式：下载远程文件保存（幂等由 contentId 去重承担，见 doSaveRemoteUrl）
    return respondRemoteUrlUpload(res, {
      subfolder,
      fileUrl,
      name: filename,
      projectId,
    });
  }

  uploadLog(400, 'missing file/fileUrl');
  return sendError(res, 'Missing file or fileUrl field', 400);
}

async function handleUploadJson(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as {
    fileUrl?: string;
    dataUri?: string;
    subfolder?: string;
    filename?: string;
    /** 行显示名（context 维度：发起方声明的用户命名；不参与磁盘命名 —— 磁盘名是内容寻址） */
    displayName?: string;
    projectId?: string;
  } | null;
  if (!body) {
    uploadLog(400, 'missing body in JSON');
    return sendError(res, 'Missing body', 400);
  }

  const subfolder = resolveRequestSubfolder(body.subfolder);
  if (!subfolder) {
    uploadLog(400, `非法 subfolder: ${body.subfolder}`);
    return sendError(res, `Invalid subfolder: ${body.subfolder}`, 400);
  }
  // 【TD-12-5】当前项目 id（发起方唯一知晓）→ 落盘后写入 resource 行，闭合项目隔离写入链
  const projectId = body.projectId || undefined;

  // dataUri 分支：前端 saveInlineToLocal 已收口为纯透传 base64 原文 + 子目录（deepening-files-upload-seam 候选 B）。
  // 落盘统一委托 base64Externalize.saveBase64ToFile（内容寻址 `sha1(解码后字节)` 全 40 位 + ext 幂等
  // —— 2026-09-13 TD-03-9 起；此前是 sha1(base64 原文) 前 16 位 + isValidBase64 严格校验），
  // 单一实现杜绝前端另造一套 hash/校验导致的不一致。非法 dataUri 返回 400，由前端 catch → null 降级保留原 base64。
  if (body.dataUri) {
    const db = await getDb();
    let saved: Base64PersistResult | null;
    try {
      saved = saveBase64ToFile(body.dataUri, subfolder, db);
    } catch (e) {
      // 【2026-09-14 失败诚实化】写盘系统故障（磁盘满/权限）≠ 输入非法 —— 不得回 400 Invalid dataUri
      // （那是错误归因，会把排查引偏）；系统故障就该是 5xx。
      uploadLog(500, `dataUri 落盘失败: ${(e as Error).message}`);
      return sendError(res, 'Failed to persist dataUri', 500);
    }
    if (!saved) {
      uploadLog(400, 'dataUri 非法/不可解码');
      return sendError(res, 'Invalid dataUri', 400);
    }
    const url = saved.url;
    // 【TD-12-5】登记行并写 projectId（否则行由 rescan 建、project_id 恒 NULL）
    // 【TD-12-12】行显示名取发起方声明的 `displayName`（base64 落盘名是内容寻址，不能当显示名）
    const rel = relativePathFromFileUrl(url);
    if (!rel) {
      // 【TD-08-31】原为静默跳过登记并照回 `{code:0}` ⇒ 盘上有文件、库里没行（素材库看不见）= 假成功。
      // 刚落盘就解析不出相对路径属**内部契约违约**（url 由本进程生成），必须 fail-loud。
      uploadLog(500, `落盘 url 无法解析为相对路径，未登记行: ${url}`);
      return sendError(res, 'Persisted but url is not a resolvable /files/ path', 500);
    }
    await recordUploadedFileRow(rel, { projectId, folder: subfolder, name: body.displayName });
    uploadLog(200, `dataUri -> ${url}`);
    // 【2026-09-17 补生产者 · 用户裁定「生产者没给就是漏给」】contentId 与 multipart（:175）/ fileUrl（:410）
    // 两分支**同一口径**回传：落盘权威已算出它（`saveBase64ToFile` 一直在用），此前只是没往外给。
    return json(res, { code: 0, data: { url, contentId: saved.contentId } });
  }

  if (!body.fileUrl) {
    uploadLog(400, 'missing fileUrl/dataUri in JSON');
    return sendError(res, 'Missing fileUrl or dataUri in JSON body', 400);
  }

  // fileUrl 分支：落盘 + 登记行 + 响应，唯一实现见 respondRemoteUrlUpload。
  // `name` 取本次声明的 filename（显示名属 context 维度）；物理名由内容寻址决定。
  return respondRemoteUrlUpload(res, {
    subfolder,
    fileUrl: body.fileUrl,
    name: body.filename || undefined,
    projectId,
  });
}

/**
 * 【fileUrl 落盘分支唯一实现】远程 URL → 落盘 + 登记 resource 行 + 响应信封。
 *
 * multipart 分支（handleUploadFormData）与 JSON 分支（handleUploadJson）此前各抄一份同语义代码，
 * 收口为唯一实现（同一能力只允许一条路径）。
 *  - `name` 是 resource 行的**显示名**（context 维度，本次声明）；磁盘物理名由内容寻址决定，不接受调用方命名。
 *  - 落盘结果里的 contentId 随 `{code,data}` 信封回传，前端直接使用（禁止再自行算哈希）。
 */
async function respondRemoteUrlUpload(
  res: ServerResponse,
  opts: { subfolder: string; fileUrl: string; name?: string; projectId?: string },
): Promise<void> {
  let result: { url: string };
  try {
    result = await saveRemoteUrl(opts.subfolder, opts.fileUrl);
  } catch (e) {
    uploadLog(400, `fileUrl ${opts.fileUrl} | ${(e as Error).message}`);
    return sendError(res, `Failed to download fileUrl: ${(e as Error).message}`, 400);
  }
  // 【TD-08-31】登记行是"上传成功"的**另一半**（盘上有文件 + 库里有行）；取不到 rel / 登记抛错
  // 都在原实现里混进了上面那个 catch ⇒ 一律被归因成「下载失败 400」（归因错，把排查引偏），
  // 或 `if (rel)` 静默跳过后照回 `{code:0}`（盘有行无 = 假成功）。现按真实原因分开报，且都留痕。
  const rel = relativePathFromFileUrl(result.url);
  if (!rel) {
    uploadLog(500, `落盘 url 无法解析为相对路径，未登记行: ${result.url}`);
    return sendError(res, 'Downloaded but url is not a resolvable /files/ path', 500);
  }
  try {
    await recordUploadedFileRow(rel, {
      projectId: opts.projectId,
      folder: opts.subfolder,
      name: opts.name,
    });
  } catch (e) {
    uploadLog(500, `登记 resource 行失败: ${rel} | ${(e as Error).message}`);
    return sendError(res, 'Downloaded but failed to register resource row', 500);
  }
  uploadLog(200, `fileUrl ${opts.fileUrl}`);
  return json(res, { code: 0, data: result });
}

/**
 * 远程 URL → 本地文件（【唯一下载归属点】+ 幂等，任何调用方都走这里保证去重）。
 *
 * 本函数是并发协调层：对"同一远程 URL 的并发请求"只真下载一次（见 inflightDownloads 注释），
 * 内部实现委托 doSaveRemoteUrl（stableRequest 下载 + 内容寻址落盘）。
 * 调用方(handleUploadFormData / handleUploadJson / relay-poll)签名不变、不感知锁。
 *
 * 去重键 = subfolder + fileUrl（URL 维度，挡同一 URL 的并发重复下载）；
 * 落盘侧的"同字节只存一份"由 contentId 去重负责（见 doSaveRemoteUrl）。
 *
 * 更新(2026-09-17)：删除 `filename` 形参 —— 物理名已由内容寻址决定（sha1(字节) + 真实格式扩展名），
 * 调用方指定文件名不再参与磁盘命名；显示名属 context 维度，由调用方写 resource 行 `name` 列。
 */
export async function saveRemoteUrl(subfolder: string, fileUrl: string): Promise<SaveRemoteResult> {
  const dedupeKey = `${subfolder}\u0000${fileUrl}`;
  const inFlight = inflightDownloads.get(dedupeKey);
  if (inFlight) {
    // 【并发窗口命中】已有同一 URL 在下载中 → 复用其结果(含失败)，不重复下载。
    // 打可查留痕(非静默)，供"下载去重是否生效"排障。不打断主流程，await 抛错由调用方统一处理。
    console.log(`[download] ${logTs()} | INFLIGHT(并发复用) | ${fileUrl}`);
    return inFlight;
  }
  // set 必须在真正开始下载(fetch yield)之前：doSaveRemoteUrl 内部首个 await 前已入表，
  // 保证并发请求 B 到达时查 Map 必命中 A 的 promise，消灭"两并发都 miss"窗口。
  const p = doSaveRemoteUrl(subfolder, fileUrl);
  inflightDownloads.set(dedupeKey, p);
  try {
    return await p;
  } finally {
    // Promise settle(成功或失败) 必删键：不缓存结果、不泄漏。后续顺序重复走既有 existsSync 幂等。
    inflightDownloads.delete(dedupeKey);
  }
}

/**
 * 远程 URL → 磁盘（下载 + 内容寻址落盘）。
 *
 * 更新(2026-09-17 · 格式真相 + 身份归位收口)：本函数原先自造了**第二套落盘命名与去重**
 * （文件名 = `sha1(fileUrl)前16位_basename`、`fs.existsSync` 免下载快路径、自行 sha1(字节) 查 resources），
 * 而 multipart / base64 走的是内容寻址权威 `writeUploadDedup`（`sha1(字节)` 命名 + contentId 去重）——
 * 同一语义两份实现，必然漂移。旧命名还把 URL 名后缀当成格式真相：CDN 用 `.jpg` 后缀发 webp 字节时，
 * 磁盘上出现「名 .jpg / 字节 webp」的假图，下游（缩略图 / 内联 base64）按名解码即失败。
 * 现收口为：① 格式 = 响应 Content-Type（字节的权威声明），URL 名后缀仅作回退；
 *          ② 落盘与去重委托 `writeUploadDedup`（唯一权威）；③ contentId 随结果回传，调用方不再自算哈希。
 *
 * 幂等语义变更（刻意，按项目约定不为存量兼容）：原先「同一 URL → 同一文件名 → existsSync 跳过下载」的
 * 免下载快路径已删 —— 物理名改由字节内容决定，下载前不可预知；幂等改由 contentId 去重承担
 * （同字节 → 命中既有 url，不写盘）。代价 = 同 URL 重复请求多一次下载，换来「名实相符 + 跨入口同一权威」。
 *
 * 失败契约：下载失败抛错（调用方转 400），不静默返回旧值。
 */
async function doSaveRemoteUrl(subfolder: string, fileUrl: string): Promise<SaveRemoteResult> {
  const ts = logTs;

  // 【TD-08-25 · 2026-09-17】下载走**中央 stableRequest**（不自写重试循环 —— ADAPTER_SPEC R3 红线）：
  //   原先单次 `fetchWithProxy` 无重试 ⇒ CDN「已发布但尚未可读」窗口的瞬时 403/超时**直接判失败**。
  //   本动作是纯下载 GET（天然幂等，重试无副作用）⇒ 交给中央的指数退避 + Retry-After。
  //   `retryStatuses` 补 403：该码在此场景是「刚发布未就绪」的瞬态，非权限问题；
  //   中央默认集**不动**（避免把其他场景真正的权限 403 也重试）。
  //   fetchImpl 注入 fetchWithProxy 保留「直连 → 代理隧道」兜底（CDN 可能需代理）。
  let response: Response;
  try {
    ({ response } = await stableRequest({
      method: 'GET',
      candidates: [fileUrl], // 精确地址，不做 baseUrl 发散探测
      retryStatuses: [403, ...RETRYABLE_HTTP_STATUSES],
      fetchImpl: fetchWithProxy as typeof fetch,
    }));
  } catch (e) {
    console.error(`[download] ${ts()} | FAIL | ${fileUrl} | ${(e as Error).message}`);
    throw new Error(`Failed to download fileUrl: ${(e as Error).message}`);
  }
  const data = Buffer.from(await response.arrayBuffer());

  // 格式真相 = 响应 Content-Type（字节的权威声明）；URL 名后缀仅作回退、不当真相。
  // 【TD-03-8 修复·远程分支】mime 未登记且 URL 无后缀时 ext 留空（不静默猜格式）。
  // 【TD-08-20 2026-09-16】URL 名取后缀统一经 fileNameFromUrl（剥 ?# + decode）—— `a.mp4?token=1` 不再带进扩展名。
  const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const ext = mimeToExt(mime) || path.extname(fileNameFromUrl(fileUrl)) || '';

  // 落盘与去重委托唯一权威（sha1(字节) 内容寻址 + contentId 查重），与 multipart / base64 同一实现。
  const db = await getDb();
  const dedup = await writeUploadDedup({
    subfolder,
    ext,
    data,
    existingUrlByContentId: (contentId) => {
      const row = queryOne(db, 'SELECT url FROM resources WHERE sha1 = ?', [contentId]);
      return row ? (row.url as string) : null;
    },
  });
  // DB 既有 url 为绝对形式，转相对供 `BASE_URL + urlPath` 统一拼接（与 multipart 分支同口径）
  const urlPath = dedup.urlPath.replace(/^https?:\/\/[^/]+/, '');
  const rel = urlPath.replace(/^\/files\//, '');
  // 命中去重时 savedPath=null（未写盘）→ 用既有文件定位原语还原绝对路径（**不 sanitize**，避免改写既有路径）
  const savedPath = dedup.savedPath ?? resolveUploadFile(rel) ?? '';
  console.log(
    `[download] ${ts()} | OK | ${fileUrl} -> ${urlPath}${dedup.deduped ? ' (contentId dedup)' : ''} | ${(data.length / 1024).toFixed(0)}KB`,
  );

  const thumbnailUrl = savedPath ? await tryGenerateThumbnail(savedPath, urlPath) : undefined;
  return {
    url: `${BASE_URL}${urlPath}`,
    path: savedPath || urlPath,
    thumbnailUrl: thumbnailUrl ? `${BASE_URL}${thumbnailUrl}` : undefined,
    contentId: dedup.contentId,
  };
}

async function tryGenerateThumbnail(filePath: string, _urlPath: string): Promise<string | null> {
  // 【TD-08-21 修复 2026-09-16】原 `const imageExts = ['.png','.jpg',…,'.svg']` 是本文件内联的
  // 第二份「哪些格式能缩图」白名单，且**多含 webp/svg**（Jimp 不可编码）→ resize 必失败、
  // 白走一轮 I/O 后静默返回 null。改为委托同文件已引入的 SSOT `isJimpEncodableExt`（无点扩展名）。
  const ext = path.extname(filePath).slice(1).toLowerCase();
  if (!isJimpEncodableExt(ext)) return null;

  const { thumbPath, thumbUrl } = ensureThumbnailTarget(filePath);
  try {
    if (!fs.existsSync(thumbPath)) {
      // 【TD-03-7 修复】缩放失败**不再 copyFileSync 伪造缩略图**：那会把全尺寸原图当缩略图返回，
      // 与「缩略图」语义相反（且 MIME/尺寸全错、无日志）。改为诚实降级 —— 不生成缩略图，
      // 返回 null，由调用方交给前端用原图 URL（这正是「缩略图是优化非前提」的正确表达）。
      const ok = await resizeImage(filePath, thumbPath, { maxDim: 256, quality: 80 });
      if (!ok) {
        // 与 handleThumbnail **同款语义分离**：只有「字节能解码却仍写不出」才是真失败（warn）；
        // 「字节不可编码」（存量名实不符文件：`.jpg` 名装 webp 字节）是预期内**不适用** → info。
        // 本函数上方已按扩展名快筛过一道（`isJimpEncodableExt`），但扩展名会说谎，故失败后仍需判字节。
        const realExt = await jimpExtForFile(filePath);
        if (realExt) {
          console.warn(`[thumbnail] resize 真失败（字节可编码为 ${realExt}）: ${filePath}`);
        } else {
          console.log(`[thumbnail] 源不可缩，跳过预热（前端将回原图）: ${filePath}`);
        }
        return null;
      }
    }
    return thumbUrl;
  } catch {
    return null;
  }
}

// ── read ──
export async function handleRead(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  const filePath = url.searchParams.get('path');
  if (!filePath) {
    return sendError(res, 'Missing path parameter', 400);
  }

  // 更新(2026-09-11)：旧 x-proxy-* 代理读分支已删除——该机制已随 2026-09-03 收口退役
  // （CLAUDE §5.7 明令禁止恢复），前端 0 调用，属退役残留死代码。
  if (!fs.existsSync(filePath)) {
    return sendError(res, 'File not found', 404);
  }

  // MIME 唯一实现 extToMime（utils/mime.ts），未登记回 octet-stream
  const contentType = extToMime(path.extname(filePath));
  const stat = fs.statSync(filePath);

  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': stat.size,
  });
  fs.createReadStream(filePath).pipe(res);
}

// ── thumbnail ──
export async function handleThumbnail(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  const sourceUrl = url.searchParams.get('url');
  if (!sourceUrl) {
    return sendError(res, 'Missing url parameter', 400);
  }

  const maxDim = parseInt(url.searchParams.get('maxDim') || '200', 10);
  const quality = parseInt(url.searchParams.get('quality') || '80', 10);
  // format：目标扩展名（如 webp）。缺省沿用源文件扩展名（保持既有行为，无回归）。
  const formatParam = url.searchParams.get('format') || '';

  // url 是 /files/subfolder/filename 格式，映射到磁盘路径
  const uploadDir = getUploadDir();
  // 对齐静态 /files/ 服务：query 参数经 searchParams.get 只解一层，中文/空格会被前端再编码成
  // %E4%BA…（最终 url=%25E4%25BA… 双态），此处必须再 decodeURIComponent 才能真正命中磁盘中文/空格目录。
  let relativePath = sourceUrl.replace(/^\/files\//, '');
  try {
    relativePath = decodeURIComponent(relativePath);
  } catch {
    // 非法编码保留原样，交给下方 existsSync 判 404（与 handleStaticFile 一致）
  }
  const filePath = path.join(uploadDir, relativePath);

  if (!fs.existsSync(filePath)) {
    return sendError(res, 'File not found', 404);
  }

  // 目标扩展名：仅接受 Jimp 可编码的 format（否则沿用源扩展名），杜绝假 webp/未知编码。
  // 【TD-08-23 修复 2026-09-16】源扩展名不再 `|| 'png'` 猜 —— 无扩展名文件（上传链 ext 回退到空所致，
  // 见 handleUpload 的 `filename → mimeType → ''`）若磁盘是真 JPEG，旧写法会把输出错定成 png
  // （Jimp 按 png 重编码 = 体积膨胀 + 格式丢失，且无日志）。**仅在扩展名缺失时才读盘定真格式**
  // （正常请求走 isJimpEncodableExt 短路，零额外 I/O）；读不出（非图/不可编码）才沿用空 → 显式失败。
  const srcExtRaw = path.extname(filePath).toLowerCase().replace(/^\./, '');
  const srcExt = isJimpEncodableExt(srcExtRaw)
    ? srcExtRaw
    : ((await jimpExtForFile(filePath)) ?? '');
  const outExt = isJimpEncodableExt(formatParam) ? formatParam.toLowerCase() : srcExt;

  if (!outExt) {
    // 【2026-09-17 语义修正】源格式**不可缩**（webp/avif/svg 等：Jimp 能读不能写；或字节非图）
    // ≠ 本端点出错，而是**预期内的「本优化不适用」** —— 浏览器多能直接渲染这些源格式，原图就是正确答案。
    // 故 302 到原图：语义清晰（要的东西在原地址），且**所有消费方（含未来新增）自动正确**，
    // 不必每个前端组件各自处理 415 再各自回退（那正是「同一能力 N 份实现」的复发土壤）。
    // 与下方「resize 真失败 → 500」严格区分：那是文件损坏 / 磁盘故障，属真错误，必须显式暴露（TD-03-7 契约）。
    // 日志级别 = info（console.log）：这是**预期内的优化跳过**，不是异常 —— 用 warn 会把它当问题反复刷屏。
    console.log(`[thumbnail] 源格式不可缩，302 → 原图: ${filePath}`);
    // Cache-Control 改为可缓存（与原图/缩略图口径一致）：「该源不可缩」是**文件的不变属性**，
    // 缓存后同一张图不再每次都重走 302（原 `no-store` 导致每次渲染都重复请求 + 重复刷日志）。
    res.writeHead(302, { Location: sourceUrl, 'Cache-Control': 'public, max-age=86400' });
    res.end();
    return;
  }

  // 缩略图缓存路径：复用 ensureThumbnailTarget 解析的缩略图目录，文件名显式含后缀与扩展名，
  // 使同源同 maxDim/quality/format 只渲染一次（幂等缓存，与 tryGenerateThumbnail 共用缓存目录）。
  const { thumbDir } = ensureThumbnailTarget(filePath, `${maxDim}x${quality}_`);
  const stemName = path.basename(filePath).replace(/\.[a-z0-9]+$/i, '') || `thumb_${Date.now()}`;
  const thumbName = `thumb_${maxDim}x${quality}_${outExt}_${stemName}.${outExt}`;
  const thumbPath = path.join(thumbDir, thumbName);

  // maxDim/quality 真正参与缩放与压缩（此前仅拼进文件名后缀，见 docs/35 §2.3）。
  // 【TD-03-7 修复】缩放失败**不再 copyFileSync 伪造缩略图**（全尺寸原图冒充缩略图 + 扩展名/字节不符）：
  // 本端点是显式「要缩略图」的请求，失败就该**显式失败**，让前端 <img onError> 回退原图 ——
  // 而非静默返回一张语义相反的假图（会把前端缩略图逻辑与体积优化一起骗过）。
  if (!fs.existsSync(thumbPath)) {
    const ok = await resizeImage(filePath, thumbPath, { maxDim, quality });
    if (!ok) {
      // 「resize 失败」有两种语义，必须分开 —— 否则「本优化不适用」会被报成「端点故障」（500）：
      //  ① **字节真相是 Jimp 不可编码格式**（webp/avif：能读不能写）→ 本优化不适用 → 302 回原图，
      //     与上方 `!outExt` 分支同一语义。
      //     **典型来源**：存量旧命名文件（`sha1(url)_basename.jpg` 装 webp 字节）—— 上方
      //     `isJimpEncodableExt(srcExtRaw)` 的「扩展名可编码就短路」判据没识破它，于是先按 jpg 解码才失败。
      //  ② **字节能解码但仍失败**（写盘失败 / 磁盘故障）→ 真失败 → 500（TD-03-7 诚实失败契约不变）。
      const realExt = await jimpExtForFile(filePath);
      if (!realExt) {
        // 同 `!outExt` 分支：预期内的「不适用」→ info 级 + 可缓存（缓存后不再重复请求 / 刷日志）
        console.log(`[thumbnail] resize 失败且字节不可缩，302 → 原图: ${filePath}`);
        res.writeHead(302, { Location: sourceUrl, 'Cache-Control': 'public, max-age=86400' });
        res.end();
        return;
      }
      console.error(
        `[thumbnail] resize 真失败（字节可编码为 ${realExt}）: ${filePath} (maxDim=${maxDim} quality=${quality})`,
      );
      return sendError(res, 'Thumbnail generation failed', 500);
    }
  }

  // 直接返回缩略图二进制，供 <img src> 使用（前端把该端点 URL 直接作为 img src）
  if (!fs.existsSync(thumbPath)) {
    return sendError(res, 'Thumbnail not found', 404);
  }
  // MIME 唯一实现 extToMime（utils/mime.ts），未登记回 octet-stream
  const stat = fs.statSync(thumbPath);
  res.writeHead(200, {
    'Content-Type': extToMime(`.${outExt}`),
    'Content-Length': stat.size,
    'Cache-Control': 'public, max-age=86400',
  });
  fs.createReadStream(thumbPath).pipe(res);
}

// ── mkdir ──
export async function handleMkdir(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as { folder?: string } | null;
  if (!body || !body.folder) {
    return sendError(res, 'Missing folder field', 400);
  }

  // 【2026-09-14 越根守卫】建目录必须过「相对路径 + 越根」校验 —— 此前直接 `path.join(uploadDir, body.folder)`，
  // 不拒 `..`：`{"folder":"../../x"}` 可写到 uploads 之外（唯一缺守卫的目录写入口）。
  // 复用既有原语 `resolveUploadFile`（拒空 / `.` / `..`，且 resolve 后必须仍在 uploadDir 内），
  // **不额外收紧**为顶层根白名单：mkdir 只建空目录（后续落盘仍受 normalizeSubfolder 白名单约束，
  // 那份判据只该住在落盘处），以免改动既有 mkdir 契约。
  const dirPath = resolveUploadFile(body.folder);
  if (!dirPath) {
    return sendError(res, 'Invalid folder path', 400);
  }
  ensureDir(dirPath);

  return json(res, { code: 0, data: { ok: true } });
}

// ── move ──
// 收相对 uploadDir 的 src/dst 路径（与 mkdir 收相对 folder、open-dir 收相对 filepath 口径一致）。
// 前端从资源 url 拿不到磁盘绝对路径，统一由后端拼 getUploadDir()，避免把绝对路径透传到前端。
//
// 【增量② · context-only（docs/122 Content/Ref：#4「移动只动 context」）】
// 把资源拖入文件夹 = 只更新 resource 行的 folder（UI 分类），**磁盘文件 / url / contentId 均不动**。
// 故此移动不再真做 renameSync 物理移动、不再改写 url/引用 → asset 永不破图、无需 rewriteUrlReferences。
// 历史「真移动磁盘 + 改写 url」曾由 applyResourceIdentityChange（真·身份变更）承担；该函数已随 context-only 上线退役。
export async function handleMove(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as { src?: string; dst?: string } | null;
  if (!body || !body.src || !body.dst) {
    return sendError(res, 'Missing src or dst field', 400);
  }

  try {
    const r = await applyResourceContextMove({ oldRel: body.src, newRel: body.dst });
    return json(res, { code: 0, data: { ok: true, id: r.id, url: r.url, name: r.name } });
  } catch (e) {
    const status = e instanceof HttpStatusError ? e.status : 500;
    return sendError(res, (e as Error).message, status);
  }
}

// ── open ──
export async function handleOpen(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  const subfolder = normalizeSubfolder(url.searchParams.get('subfolder')) ?? 'canvas';
  const uploadDir = getUploadDir();
  const dirPath = path.join(uploadDir, subfolder);

  ensureDir(dirPath);

  const cmd = process.platform === 'win32' ? 'explorer' : 'open';
  try {
    execSync(`${cmd} "${dirPath}"`, { timeout: 5000 });
  } catch {
    // 忽略打开失败
  }

  return json(res, { code: 0, data: { path: dirPath } });
}

// ── open-dir ──
export async function handleOpenDir(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  const filepath = url.searchParams.get('filepath');
  if (!filepath) {
    return sendError(res, 'Missing filepath parameter', 400);
  }

  // filepath 是 URL pathname 去 /files/ 前缀
  const uploadDir = getUploadDir();
  const relativePath = filepath.replace(/^\/files\//, '');
  const fullPath = path.join(uploadDir, relativePath);

  if (!fs.existsSync(fullPath)) {
    return sendError(res, 'File/directory not found', 404);
  }

  const dirToOpen = fs.statSync(fullPath).isDirectory() ? fullPath : path.dirname(fullPath);
  const cmd = process.platform === 'win32' ? 'explorer' : 'open';

  try {
    execSync(`${cmd} "${dirToOpen}"`, { timeout: 5000 });
  } catch {
    // 忽略打开失败
  }

  return json(res, { code: 0, data: { path: dirToOpen } });
}

// ── list ──
export async function handleList(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  const subfolder = url.searchParams.get('subfolder') || '';
  const uploadDir = getUploadDir();
  const targetDir = subfolder
    ? path.join(uploadDir, normalizeSubfolder(subfolder) ?? '')
    : uploadDir;

  if (!fs.existsSync(targetDir)) {
    return json(res, { code: 0, data: { files: [], folders: [] } });
  }

  const entries = fs.readdirSync(targetDir, { withFileTypes: true });
  const files: string[] = [];
  const folders: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue; // 隐藏文件跳过
    if (entry.isDirectory()) {
      folders.push(entry.name);
    } else {
      files.push(entry.name);
    }
  }

  return json(res, { code: 0, data: { files, folders } });
}
