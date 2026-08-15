/**
 * base64 图片外置工具（方案2核心，docs/41 第2节）
 *
 * 背景：画布节点 data.imageUrl / img_orig_* / img_thumb_* 里存的 base64
 *      把 sql.js KV 库撑到 79MB+，且每次 saveDb 全量 export + 同步写盘导致卡死。
 * 思路：在 handleKvSet 入库前，把所有 data:* base64 解码落盘成 uploads/ 文件，
 *      用 /files/ URL 替换，库只剩 URL，体积骤降。前端读 URL 正常渲染（已验证）。
 *
 * 幂等：文件名 = sha1(base64内容) 前 16 位，同一 base64 永远映射同一文件，
 *       重复外置不重复落盘（对齐 saveRemoteUrl 的 sha1 去重惯例，files.ts:97）。
 * 失败降级：单字段外置失败保留原 base64，不拖垮整条 value（docs/41 第2.7节）。
 *
 * 本模块同时暴露 extractFilesUrls，供孤儿文件 GC（docs/41 第2.7节）复用，
 * 保证提取引用的逻辑只有一份实现。
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getUploadDir } from '../db/database.js';
import { ensureDir, resolveUploadTarget, sanitizeFilename } from './fileStore.js';

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

/** 从 data URI 推断子目录（image/video/audio 统一放 canvas，可扩展） */
function subfolderFor(_mime: string): string {
  return 'canvas';
}

/**
 * 把单个 data URI 解码并落盘为 uploads/ 文件，返回可访问 /files/ URL。
 * 文件名 = sha1(base64 原文) 前 16 位 + 扩展名，幂等去重。
 * 落盘失败返回 null（调用方保留原 base64）。
 */
export function saveBase64ToFile(dataUri: string): string | null {
  const m = dataUri.match(DATA_URI_RE);
  if (!m) return null;
  const mime = m[1];
  const base64Data = m[2];
  if (!base64Data) return null;
  // 严格校验：含非法 base64 字符（Node 会宽容忽略）视为无效，回退保留原值
  if (!isValidBase64(base64Data)) return null;

  const ext = extFromMime(mime);
  const hash = crypto.createHash('sha1').update(base64Data).digest('hex').slice(0, 16);
  const stableName = sanitizeFilename(`${hash}${ext}`);

  const subfolder = subfolderFor(mime);
  const { savedPath, urlPath } = resolveUploadTarget(subfolder, stableName);
  ensureDir(path.dirname(savedPath));

  // 已存在则直接返回 URL（幂等，不重复落盘）
  if (fs.existsSync(savedPath)) {
    return urlPath;
  }

  try {
    const buf = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(savedPath, buf);
    return urlPath;
  } catch {
    return null;
  }
}

/** MIME 到扩展名的映射（小写，带点） */
function extFromMime(mime: string): string {
  const m = mime.split('/')[1]?.toLowerCase() ?? '';
  switch (m) {
    case 'jpeg': return '.jpg';
    case 'png': return '.png';
    case 'webp': return '.webp';
    case 'gif': return '.gif';
    case 'svg+xml': return '.svg';
    case 'bmp': return '.bmp';
    case 'mp4': return '.mp4';
    case 'webm': return '.webm';
    case 'mp3': return '.mp3';
    case 'wav': return '.wav';
    case 'json': return '.json';
    default: return m ? `.${m}` : '.bin';
  }
}

/**
 * 深度遍历对象，把所有 data:image/video/audio;base64 字符串字段外置为 /files/ URL。
 * 逐字段 try/catch：单字段失败保留原 base64，其余照常外置，不抛异常。
 * 数组元素同样处理。
 */
function externalizeObject(obj: unknown, warnKey: string): void {
  if (Array.isArray(obj)) {
    for (const item of obj) {
      externalizeObject(item, warnKey);
    }
    return;
  }
  if (!obj || typeof obj !== 'object') return;

  for (const key of Object.keys(obj as Record<string, unknown>)) {
    const val = (obj as Record<string, unknown>)[key];
    if (typeof val === 'string') {
      if (val.startsWith('data:')) {
        const url = saveBase64ToFile(val);
        if (url) {
          (obj as Record<string, unknown>)[key] = url;
        } else {
          console.warn(`[base64Externalize] 外置失败，保留原 base64: ${warnKey}.${key} (len=${val.length})`);
        }
      }
    } else if (Array.isArray(val) || (val && typeof val === 'object')) {
      externalizeObject(val, `${warnKey}.${key}`);
    }
  }
}

/**
 * 处理单条 KV value（字符串），返回外置替换后的字符串。
 * JSON 可解析：深度遍历对象，外置所有 data: base64 字段。
 * JSON 不可解析：若整串是 data: base64（img_orig_* / img_thumb_* 形态），直接外置为 URL。
 */
export function externalizeBase64InValue(value: string): string {
  // 裸 base64 形态（img_* 键）：整串就是 data URI
  if (value.startsWith('data:')) {
    const url = saveBase64ToFile(value);
    if (url) return url;
    return value; // 失败保留
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
  externalizeObject(parsed, 'kv');
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
