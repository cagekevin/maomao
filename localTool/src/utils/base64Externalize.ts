/**
 * base64 图片外置工具（方案2核心，docs/41 第2节）
 *
 * 背景：画布节点 data.assetUrl / img_orig_* / img_thumb_* 里存的 base64
 *      把 sql.js KV 库撑到 79MB+，且每次 saveDb 全量 export + 同步写盘导致卡死。
 * 思路：在 handleKvSet 入库前，把所有 data:* base64 解码落盘成 uploads/ 文件，
 *      用 /files/ URL 替换，库只剩 URL，体积骤降。前端读 URL 正常渲染（已验证）。
 *
 * 幂等：文件名 = contentHashName(sha1(bytes), ext)（canonical 内容寻址，与 writeUploadBuffer/
 *       writeUploadDedup 同口径，2026-09-13 TD-03-9 统一）。同字节 → 同物理名，重复外置不重复落盘。
 * 失败降级：单字段外置失败保留原 base64，不拖垮整条 value（docs/41 第2.7节）。
 *
 * 本模块同时暴露 extractFilesUrls，供孤儿文件 GC（docs/41 第2.7节）复用，
 * 保证提取引用的逻辑只有一份实现。
 */
import { getUploadDir, queryOne } from '../db/database.js';
import { writeUploadDedupSync } from './fileStore.js';
import { mimeToExt } from './mime.js';
import { toAbsoluteFileUrl } from './localToolBaseUrl.js';

/** data URI 正则：匹配 data:image/png;base64,xxxx 或 data:video/... */
const DATA_URI_RE = /^data:([a-zA-Z0-9+.-]+\/[a-zA-Z0-9+.-]+);base64,(.*)$/s;

/**
 * 严格校验 base64 字符串（仅含 [A-Za-z0-9+/]，可选 0-2 个结尾 '='）。
 * Node 的 Buffer.from(x,'base64') 会宽容忽略非法字符（如 '@'），把残缺串静默解码，
 * 导致非法 data URI 被当成合法内容落盘成损坏文件。入库前必须严格校验，
 * 非法字符 → 返回 false，由调用方走失败回退保留原 base64（docs/41 第2.7节③）。
 */
function isValidBase64(s: string): boolean {
  if (!s || s.length % 4 !== 0) return false;
  // 去掉 padding 后，主体只能含 base64 字母表字符
  const stripped = s.replace(/=+$/, '');
  if (stripped.length % 4 === 1) return false; // 余 1 说明长度非法
  return /^[A-Za-z0-9+/]+$/.test(stripped);
}

/**
 * `saveBase64ToFile` 的成功返回：**url 与 contentId 一起给全**。
 *
 * 【为什么必须回传 contentId（2026-09-17 · 用户裁定「生产者没给就是生产者漏给了，要补生产者」）】
 * 本函数**一直在算**这个值（跨入口去重就靠它），却因返回类型只写 `string` 而**算完即扔** ⇒ 上层
 * （`routes/files.ts` 的 dataUri 分支）只能回 `{ url }`，于是前端 `UploadOutcome.contentId` 在
 * base64 分支恒为 `undefined`，与 multipart / fileUrl 两分支**口径不一致**（要稳定身份的消费者
 * 要么拿不到、要么自己拿字节再算一遍 = 第二份算法，正是 TD-08-28 收掉的东西）。
 * 现经同一权威 `contentIdOf` 回传，**三条落盘分支口径一致**。
 */
export interface Base64PersistResult {
  /** 落盘后的绝对 `/files/` URL */
  url: string;
  /** Content 维度稳定身份 `sha1:<hex>(解码后字节)`（与 multipart/fileUrl 同源，folder/url 无关） */
  contentId: string;
}

/**
 * 把单个 data URI 解码并落盘为 uploads/ 文件，返回可访问 /files/ URL 与 contentId。
 * 去重：先按【解码后的原始字节】算 contentId（`<alg>:<hex>`），查 resources 表命中即复用既有 url
 * （不二次落盘、不新建第二份）—— 与 multipart 上传 / 远程 URL 走同一 contentId 权威，跨入口去重免费。
 * 仅当未命中（新内容）时落盘，文件名 = `sha1(解码后字节)[:16] + ext`（内容寻址，与 writeUploadDedup 同口径）。
 *
 * 【两种失败必须分开（2026-09-14 失败诚实化）】
 *   - **非法输入**（非 data URI / base64 不合法）→ 返回 `null`：这是"内容不可用"，调用方保留原 base64；
 *   - **写盘失败**（磁盘满 / 权限 / IO）→ **抛出**：这是系统级故障，不得被压成与"非法输入"同一个 `null`
 *     —— 此前两者同返 null，handler 一律回 `400 Invalid dataUri`，把"写不进去"报成"格式不对"（错误归因，
 *     与 TD-03-12 同族）。降级型调用方（KV 外置）自行 try/catch 保留原值（见下两处）。
 * @param subfolder 落盘子目录（默认 'canvas'）
 * @param db 可选已初始化的 DB 句柄：传入则做 contentId 查重复用；不传则跳过（仅本地幂等）
 * @returns `{ url, contentId }`（成功）｜`null`（输入非法）；**写盘故障仍抛**
 */
export function saveBase64ToFile(
  dataUri: string,
  subfolder: string = 'canvas',
  db: any = null,
): Base64PersistResult | null {
  const m = dataUri.match(DATA_URI_RE);
  if (!m) return null;
  const mime = m[1];
  const base64Data = m[2];
  if (!base64Data) return null;
  // 严格校验：含非法 base64 字符（Node 会宽容忽略）视为无效，回退保留原值
  if (!isValidBase64(base64Data)) return null;

  const buf = Buffer.from(base64Data, 'base64');
  const ext = extFromMime(mime);

  // 【2026-09-18 · TD-02-64 收口】落盘/去重/命名**整体委托唯一权威 `writeUploadDedup`**。
  //
  // 此前本函数自持一整套：自算 sha1 → 自查 resources → 自算 contentHashName → 自 resolveUploadTarget
  // → 自 `fs.existsSync` 幂等 → 自 `fs.writeFileSync`。那是**与 writeUploadDedup 逐项重复的第二套实现**
  // （同一形态 = 2026-09-17 刚从 `doSaveRemoteUrl` 收口掉的那份），两套迟早漂移：
  // 例如权威侧 2026-09-17 修的「去重命中必须校验磁盘还在」（TD-08-31：DB 行在、文件被 GC 带走时
  // 复用会回 404 死 url = 假成功）本函数**从未跟进** —— 它只查 DB 就 return，同样会回死 url。
  // 现统一：命中校验、内容寻址命名、扩展名处理全在权威侧一份。
  //
  // 【为什么用同步核心而非 `writeUploadDedup`】调用方 `externalizeBase64InValue` 长在
  // `kv.ts::handleKvSet` 的**禁止 await** 的 CAS 临界区内（那里明令"以下到 return 之间禁止任何 await"），
  // 本函数必须保持**同步**。`writeUploadDedupSync` 就是权威 `writeUploadDedup` 的实现体（同一份判据，
  // 非第二套），故此处委托它 = 收口到唯一权威，且不破 CAS 原子性。
  const dedup = writeUploadDedupSync({
    subfolder,
    ext,
    data: buf,
    existingUrlByContentId: (contentId) => {
      if (!db) return null; // 无 DB 句柄 → 跳过跨入口去重（仅本地幂等，与旧行为一致）
      const hit = queryOne(db, 'SELECT url FROM resources WHERE sha1 = ?', [contentId]) as
        | { url?: string }
        | undefined;
      return hit?.url ?? null;
    },
  });
  // 权威返回：命中为既有 url（可能绝对形式），未命中为 `/files/...` 相对形式 → 统一绝对化，
  // 保持本函数既有契约（调用方拿到的恒是可访问的绝对 URL）。
  return { url: toAbsoluteFileUrl(dedup.urlPath), contentId: dedup.contentId };
}

/** MIME → 扩展名（唯一实现 utils/mime.ts；表外兜底用 mime 子类型，对齐旧 extFromMime 行为） */
function extFromMime(mime: string): string {
  const dotted = mimeToExt(mime);
  if (dotted) return dotted;
  const m = mime.split('/')[1]?.toLowerCase() ?? '';
  return m ? `.${m}` : '.bin';
}

/**
 * 深度遍历对象，把所有 data:image/video/audio;base64 字符串字段外置为 /files/ URL。
 * 逐字段 try/catch：单字段失败保留原 base64，其余照常外置，不抛异常。
 * 数组元素同样处理。
 */
function externalizeObject(obj: unknown, warnKey: string, db: any = null): void {
  if (Array.isArray(obj)) {
    for (const item of obj) {
      externalizeObject(item, warnKey, db);
    }
    return;
  }
  if (!obj || typeof obj !== 'object') return;

  for (const key of Object.keys(obj as Record<string, unknown>)) {
    const val = (obj as Record<string, unknown>)[key];
    if (typeof val === 'string') {
      if (val.startsWith('data:')) {
        // 逐字段降级（本函数头契约：单字段失败保留原 base64，不拖垮整条 value）：
        // 非法输入 → null 保留；写盘系统故障 → 抛 → 这里 catch 住并留痕，仍保留原 base64
        try {
          const saved = saveBase64ToFile(val, 'canvas', db);
          if (saved) {
            (obj as Record<string, unknown>)[key] = saved.url;
          } else {
            console.warn(
              `[base64Externalize] 外置失败（非法输入），保留原 base64: ${warnKey}.${key} (len=${val.length})`,
            );
          }
        } catch (e) {
          console.error(
            `[base64Externalize] 落盘异常，保留原 base64: ${warnKey}.${key} — ${(e as Error).message}`,
          );
        }
      }
    } else if (Array.isArray(val) || (val && typeof val === 'object')) {
      externalizeObject(val, `${warnKey}.${key}`, db);
    }
  }
}

/**
 * 处理单条 KV value（字符串），返回外置替换后的字符串。
 * JSON 可解析：深度遍历对象，外置所有 data: base64 字段。
 * JSON 不可解析：若整串是 data: base64（img_orig_* / img_thumb_* 形态），直接外置为 URL。
 */
export function externalizeBase64InValue(value: string, db: any = null): string {
  // 裸 base64 形态（img_* 键）：整串就是 data URI
  if (value.startsWith('data:')) {
    try {
      const saved = saveBase64ToFile(value, 'canvas', db);
      if (saved) return saved.url;
    } catch (e) {
      // 落盘系统故障：留痕并保留原 base64（外置只是优化，不阻断 KV 写入）
      console.error(`[base64Externalize] 落盘异常，保留原 base64 — ${(e as Error).message}`);
    }
    return value; // 非法输入 / 落盘失败：均保留原值
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return value; // 非 JSON 且非 data: 开头，原样返回
  }

  // JSON 已是基本类型（数字/布尔/null）或非对象，无 base64 可外置
  if (parsed === null || typeof parsed !== 'object') return value;

  const before = JSON.stringify(parsed);
  externalizeObject(parsed, 'kv', db);
  const after = JSON.stringify(parsed);
  return after.length === before.length ? value : after;
}

/**
 * 提取 value 中所有 /files/ 相对路径（供孤儿文件 GC 构建被引用集合）。
 * 兼容两种形态：
 *   URL：http://127.0.0.1:18080/files/canvas/xxx.png
 *   相对：/files/canvas/xxx.png
 * 返回形如 "canvas/xxx.png" 的 uploads 相对路径列表。
 */
export function extractFilesUrls(value: string): string[] {
  const out = new Set<string>();
  const re = /(?:https?:\/\/[^/]+)?\/files\/([^"'\s)\]]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value)) !== null) {
    try {
      out.add(decodeURIComponent(m[1]));
    } catch {
      out.add(m[1]);
    }
  }
  return Array.from(out);
}

/** 返回 uploads 目录绝对路径（供 GC 递归扫描） */
export function getUploadsAbsPath(): string {
  return getUploadDir();
}
