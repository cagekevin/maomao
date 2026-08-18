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
  dryRun = false
): GcResult {
  const result: GcResult = { scanned: 0, deleted: 0, skipped: 0, referenced: 0, dryRun, deletedFiles: [] };

  // 1. 收集所有被引用的 /files/ 相对路径（KV value + 额外来源）
  const referenced = new Set<string>();
  for (const v of kvValues) {
    if (typeof v === 'string' && v) {
      for (const rel of extractFilesUrls(v)) {
        referenced.add(rel);
      }
    }
  }
  // 额外引用（形如 http://127.0.0.1:18080/files/canvas/x.png 的完整 URL）转相对路径
  for (const url of extraRefs) {
    const m = url.match(/\/files\/(.+)$/);
    if (m) {
      try {
        referenced.add(decodeURIComponent(m[1]));
      } catch {
        referenced.add(m[1]);
      }
    }
  }
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
 * 引用感知 GC 的统一入口：收集全库引用（resources 表 url + tasks 表 url + KV 全部 value）后执行孤儿回收。
 *
 * 设计背景（docs/13 §3.5）：删除接口「只删记录、绝不删盘」，删盘统一交给本函数裁决。
 * 引用来源必须覆盖三类，缺一不可：
 *   - resources 表 url：用户"存进素材库但没放画布"的图只在此表，漏了会被误删 → 素材丢失；
 *   - tasks 表 result_url / thumbnail_url：AI 任务结果；
 *   - KV 表全部 value（含 canvas-state-*）：画布节点引用。
 *
 * 由删除入口（tasks/resources 删除/清空）尾部调用，让"引用消失 → 文件回收"窗口趋近于零；
 * 也供 /api/admin/cleanup 手动触发复用，保证引用收集口径只有一处。
 *
 * @param dryRun 为 true 时只统计不删除（人工核查用）
 */
export async function runReferenceGc(dryRun = false): Promise<GcResult> {
  const db = await getDb();
  const uploadDir = getUploadDir();

  const refUrls = new Set<string>();
  const resUrls = queryAll(db, 'SELECT url FROM resources') as Array<{ url: string }>;
  for (const r of resUrls) if (r.url) refUrls.add(r.url);
  const taskUrls = queryAll(db, 'SELECT result_url, thumbnail_url FROM tasks') as Array<{ result_url?: string; thumbnail_url?: string }>;
  for (const t of taskUrls) {
    if (t.result_url) refUrls.add(t.result_url);
    if (t.thumbnail_url) refUrls.add(t.thumbnail_url);
  }

  const kvValues = queryAll(db, 'SELECT value FROM kv') as Array<{ value: string }>;
  const kvValueStrings = kvValues.map((r) => r.value).filter((v): v is string => typeof v === 'string');

  return runOrphanGc(kvValueStrings, uploadDir, refUrls, dryRun);
}
