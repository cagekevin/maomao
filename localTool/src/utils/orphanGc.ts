/**
 * 孤儿文件 GC（docs/41 §2.7①，方案②必配）
 * ------------------------------------------------------------
 * 方案②把 base64 外置为 uploads/ 磁盘文件后，节点删除/画布重置时 KV 里
 * 的 /files/ URL 引用消失，但磁盘文件不会被自动清理 → 孤儿文件累积，
 * 膨胀会从「KV 库」转移到「uploads 目录」。本模块负责：
 *
 *   1. 遍历 KV 表所有 value，用 extractFilesUrls 提取「被引用的 uploads 相对路径」集合；
 *   2. 递归扫描 uploads/ 目录下的实际文件（跳过 .thumbnails/，缩略图随原图按名配对）；
 *   3. 删除「磁盘有、但不在引用集合」的孤儿文件。
 *
 * 安全约束：
 *   - 只删 getUploadDir() 目录内文件；
 *   - 跳过 .thumbnails/（缩略图可按需重新生成）；
 *   - dryRun 模式只统计不删除，先验证再执行。
 */
import fs from 'node:fs';
import path from 'node:path';
import { extractFilesUrls } from './base64Externalize.js';
import { getDb, getUploadDir, queryAll } from '../db/database.js';

export interface GcResult {
  scanned: number;
  deleted: number;
  skipped: number;
  referenced: number;
  dryRun: boolean;
  deletedFiles: string[];
}

/** 数据库句柄类型（getDb 的解析值），供下方引用查询辅助函数使用 */
type Db = Awaited<ReturnType<typeof getDb>>;

/**
 * 完整 `/files/` URL → uploads 相对路径（`canvas/x.png`）；非 /files/ 形态返回 null。
 * 【TD-02-6 收口】此前「URL → 相对路径」的转换在 `runOrphanGc`（extraRefs）与
 * `collectReferencedRelPaths`（resources/tasks）各写一份（连 decodeURIComponent 容错都重复），
 * 是同一知识的两处实现 → 抽此唯一实现，三处共用。
 */
export function toUploadRelPath(url: unknown): string | null {
  if (typeof url !== 'string' || !url) return null;
  const m = url.match(/\/files\/(.+)$/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1]; // 非法转义序列：原样返回（不去掉引用，宁可少删盘）
  }
}

/**
 * 【全库引用来源 · SQL 唯一查询点（TD-02-6）】返回：
 *   - `refUrls`：resources 表 url + tasks 表 result_url/thumbnail_url（**画布外**引用的完整 URL）；
 *   - `kvValues`：kv 表全部 value 字符串（含 canvas-state-*，画布内引用藏于 JSON）。
 * 这三类必须全覆盖、缺一不可（漏一类 → 误删仍在用的文件）：
 *   resources 表 = 存进素材库但没放画布的图；tasks 表 = AI 任务结果；kv 表 = 画布节点引用。
 *
 * `collectReferencedRelPaths`（存储健康报表 / 重复文件安全删除）与 `runReferenceGc`
 * （孤儿回收）**必须**共用本函数——此前两处各写一份同构 SQL（注释自承"完全同口径"），
 * 口径一旦漂移就是误删或漏回收（TD-02-6）。
 */
function queryReferenceSources(db: Db): { refUrls: Set<string>; kvValues: string[] } {
  const refUrls = new Set<string>();
  const resRows = queryAll(db, 'SELECT url FROM resources') as Array<{ url?: string }>;
  for (const r of resRows) if (r.url) refUrls.add(r.url);
  const taskRows = queryAll(db, 'SELECT result_url, thumbnail_url FROM tasks') as Array<{
    result_url?: string;
    thumbnail_url?: string;
  }>;
  for (const t of taskRows) {
    if (t.result_url) refUrls.add(t.result_url);
    if (t.thumbnail_url) refUrls.add(t.thumbnail_url);
  }
  const kvRows = queryAll(db, 'SELECT value FROM kv') as Array<{ value?: unknown }>;
  const kvValues = kvRows
    .map((r) => r.value)
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
  return { refUrls, kvValues };
}

/**
 * 把「完整 /files/ URL 集合」并入 referenced（相对路径形态）——`runOrphanGc` 的 extraRefs
 * 与 `collectReferencedRelPaths` 共用，转换走 `toUploadRelPath` 唯一实现。
 */
function addUrlRefs(referenced: Set<string>, urls: Iterable<string>): void {
  for (const url of urls) {
    const rel = toUploadRelPath(url);
    if (rel) referenced.add(rel);
  }
}

/** 把 KV 全部 value 内嵌的 /files/ 相对路径并入 referenced（提取走 extractFilesUrls 唯一实现）。 */
function addKvRefs(referenced: Set<string>, kvValues: readonly string[]): void {
  for (const v of kvValues) {
    for (const rel of extractFilesUrls(v)) referenced.add(rel);
  }
}

/**
 * 执行孤儿文件 GC。
 * @param kvValues KV 表所有 value 字符串（调用方负责查库提取）
 * @param uploadDir uploads 绝对路径
 * @param extraRefs 额外被引用集合（如 resources/tasks 里的 URL），合并进引用集合
 * @param dryRun 为 true 时只统计不删除
 */
export function runOrphanGc(
  kvValues: string[],
  uploadDir: string,
  extraRefs: ReadonlySet<string> = new Set(),
  dryRun = false,
): GcResult {
  const result: GcResult = {
    scanned: 0,
    deleted: 0,
    skipped: 0,
    referenced: 0,
    dryRun,
    deletedFiles: [],
  };

  // 1. 收集所有被引用的 /files/ 相对路径（KV value + 额外来源）；两处转换均走共用实现（TD-02-6）
  const referenced = new Set<string>();
  addKvRefs(referenced, kvValues);
  // 额外引用（形如 http://127.0.0.1:18080/files/canvas/x.png 的完整 URL）转相对路径
  addUrlRefs(referenced, extraRefs);
  result.referenced = referenced.size;

  if (!fs.existsSync(uploadDir)) {
    return result;
  }

  // 2. 递归扫描 uploads 目录（跳过 .thumbnails/ 与隐藏文件）
  const walk = (dir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || entry.name === '.thumbnails') {
          result.skipped++;
          continue;
        }
        walk(full);
      } else if (entry.isFile() && !entry.name.startsWith('.')) {
        result.scanned++;
        // 相对路径（正斜杠），与 extractFilesUrls 产出对齐
        const rel = path.relative(uploadDir, full).replace(/\\/g, '/');
        if (!referenced.has(rel)) {
          if (!dryRun) {
            try {
              fs.unlinkSync(full);
              result.deleted++;
              result.deletedFiles.push(rel);
            } catch {
              result.skipped++;
            }
          } else {
            result.deleted++; // dryRun 下"可删除数"
            result.deletedFiles.push(rel);
          }
        }
      }
    }
  };

  walk(uploadDir);
  return result;
}

/**
 * 收集全库「被引用的 uploads 相对路径」集合（只读，不删）。
 *
 * 引用来源三类（resources 表 / tasks 表 / KV 表全部 value）由 `queryReferenceSources` 统一查询，
 * 与 `runReferenceGc` **同一实现**（TD-02-6 收口：此前是同构两份、口径靠注释保证一致）。
 *
 * 返回形如 "canvas/xxx.png" 的 uploads 相对路径集合。未引用的文件 = 可安全删除。
 */
export async function collectReferencedRelPaths(): Promise<Set<string>> {
  const db = await getDb();
  const { refUrls, kvValues } = queryReferenceSources(db);
  const referenced = new Set<string>();
  addUrlRefs(referenced, refUrls); // ① resources + tasks 的完整 /files/ URL（画布外引用）
  addKvRefs(referenced, kvValues); // ② KV 全部 value 内嵌的 /files/ 相对路径（画布引用）
  return referenced;
}

/**
 * 引用感知 GC 的统一入口：收集全库引用（resources 表 url + tasks 表 url + KV 全部 value）后执行孤儿回收。
 *
 * 设计背景（docs/13 §3.5）：删除接口「只删记录、绝不删盘」，删盘统一交给本函数裁决。
 * 引用来源的查询与转换全部复用 `queryReferenceSources` / `addUrlRefs` / `addKvRefs`
 * （**与 `collectReferencedRelPaths` 同一实现**，TD-02-6 收口；漏一类引用即误删仍在用的文件）。
 *
 * 由删除入口（tasks/resources 删除/清空）尾部调用，让"引用消失 → 文件回收"窗口趋近于零；
 * 也供 /api/admin/cleanup 手动触发复用，保证引用收集口径只有一处。
 *
 * @param dryRun 为 true 时只统计不删除（人工核查用）
 */
export async function runReferenceGc(dryRun = false): Promise<GcResult> {
  const db = await getDb();
  const uploadDir = getUploadDir();
  const { refUrls, kvValues } = queryReferenceSources(db);
  return runOrphanGc(kvValues, uploadDir, refUrls, dryRun);
}
