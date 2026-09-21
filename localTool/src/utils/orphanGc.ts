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
 *
 * 更新(2026-09-12 · docs/122 增量④)：引用收集在「/files/ url」基础上，补充 **Content 维度 contentId 引用**
 * （画布 asset 持 `sha1:<hex>`），防 contentId-only 引用被误判孤儿。
 *
 * ⚠️ 更新(2026-09-21 · 判据形态依赖缺陷修复)：contentId 的解析**不得只有"反查登记行"一条路**。
 * 删素材/任务入口的顺序是「先删行 → 再 runReferenceGc」，而 `resources.sha1 → url` 那行正是反查的
 * 唯一来源 ⇒ 同一次调用里判据自我失明：节点持 `assetUrl + contentId` 的文件被 `/files/` 文本保住，
 * 而**只持 contentId** 的文件被当孤儿真删（同一用户动作、同一语义，结果取决于节点字段形态 = 缺陷）。
 * 现补第二条**顺序无关**的路：磁盘文件名本身携带内容身份（`contentHashName`，见 `isContentAddressedBy`）。
 * 两条路查的是**同一条语义**（这个身份在磁盘上有没有对应文件），不是两份真相：索引快、物理身份兜底。
 */
import fs from 'node:fs';
import path from 'node:path';
import { extractFilesUrls } from './base64Externalize.js';
import { getDb, getUploadDir, queryAll } from '../db/database.js';
import { relativePathFromFilesUrl } from './helpers.js';

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
 *
 * 【TD-02-6 收口】此前「URL → 相对路径」的转换在 `runOrphanGc`（extraRefs）与
 * `collectReferences`（resources/tasks）各写一份（连 decodeURIComponent 容错都重复），
 * 是同一知识的两处实现 → 抽此唯一实现，三处共用。
 *
 * 【TD-08-16 收口 2026-09-16】原实现用正则 `/\/files\/(.+)$/` **不剥 `?`/`#`** ——
 * `…/a.png?token=1` 会被当成磁盘相对路径 `a.png?token=1` → `existsSync` 恒 false
 * → **该引用不计入 referenced → 仍被使用的文件可能被误删**（孤儿 GC 复用本函数的引用集合）。
 * 现委托 `helpers.relativePathFromFilesUrl`（`URL.pathname` 自动剥 `?#` + decode），
 * 与 `resources.relativePathFromFileUrl` / `resolveLocalImages` 同一探测原语。
 *
 * ⚠️ 行为差异（有意）：旧实现在 decode 失败时**原样返回**（保守，宁可少删盘）；
 * 新原语 decode 失败返回 **null**（则该条引用不纳入）—— 对孤儿 GC 而言这是**更安全**的方向吗？
 * 不是：`null` 会**少一条引用 → 偏向误删**。故此处**保留旧容错**：decode 失败时退回未解码串。
 */
export function toUploadRelPath(url: unknown): string | null {
  if (typeof url !== 'string' || !url) return null;
  // 先走唯一原语（剥 ?# + decode 一次）。decode 失败时原语返 null，但那**不代表**该 URL 非 /files/ 形态，
  // 此时须保留旧容错（原样返回未解码串，宁可少删盘）—— 用 pathname 再判一次前缀即可区分两种 null。
  const rel = relativePathFromFilesUrl(url);
  if (rel !== null) return rel;
  let pathname: string;
  try {
    pathname = new URL(url, 'http://localhost').pathname;
  } catch {
    return null;
  }
  if (!pathname.startsWith('/files/')) return null; // 确实非 /files/ 形态
  return pathname.slice('/files/'.length) || null; // decode 失败 → 返回未解码串（保守，保留引用）
}

/**
 * 【全库引用来源 · SQL 唯一查询点（TD-02-6）】返回：
 *   - `refUrls`：resources 表 url + tasks 表 result_url/thumbnail_url（**画布外**引用的完整 URL）；
 *   - `kvValues`：kv 表全部 value 字符串（含 canvas-state-*，画布内引用藏于 JSON）。
 * 这三类必须全覆盖、缺一不可（漏一类 → 误删仍在用的文件）：
 *   resources 表 = 存进素材库但没放画布的图；tasks 表 = AI 任务结果；kv 表 = 画布节点引用。
 *
 * `collectReferences`（存储健康报表 / 重复文件安全删除）与 `runReferenceGc`
 * （孤儿回收）**必须**共用本函数——此前两处各写一份同构 SQL（注释自承"完全同口径"），
 * 口径一旦漂移就是误删或漏回收（TD-02-6）。
 *
 * `contentIds` 是**未解析的内容身份**（40 位 sha1，来自 KV 里的 `sha1:<hex>`）：单靠本函数内的
 * SQL 索引解析不了"行已被删"的情形（见文件头 2026-09-21 注），故一并交给调用方走内容身份判定。
 */
function queryReferenceSources(db: Db): {
  refUrls: Set<string>;
  kvValues: string[];
  contentIds: Set<string>;
} {
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
  // 【docs/122 增量④】Content 维度引用：画布 asset 存稳定 contentId（`sha1:<hex>`，非 /files/ url），
  // extractFilesUrls 取不到它 —— 不补该引用则这些文件会被误判孤儿真删。
  // 收集为**纯身份（40 位 sha1）**：解析有两条路（同一条语义 = "这个身份在磁盘上有没有文件"）：
  //   ① 索引（快）：resources.sha1 反查 url —— 覆盖"文件名不含 sha1"的存量命名；
  //   ② 内容身份（顺序无关）：文件名携带 sha1（isContentAddressedBy）—— **行已被删**时唯一还成立的路，
  //      而"删行 → 立刻 GC"正是本仓删除入口的固定顺序，故 ② 不是可选项。
  const contentIdRe = /sha1:([0-9a-f]{40})/gi;
  const contentIds = new Set<string>();
  for (const v of kvValues) {
    for (const m of v.matchAll(contentIdRe)) contentIds.add(m[1].toLowerCase());
  }
  if (contentIds.size > 0) {
    const ids = [...contentIds].map((hex) => `sha1:${hex}`);
    const sha1Rows = queryAll(
      db,
      `SELECT url FROM resources WHERE sha1 IN (${ids.map(() => '?').join(',')})`,
      ids,
    ) as Array<{ url?: string }>;
    for (const r of sha1Rows) if (r.url) refUrls.add(r.url);
  }
  return { refUrls, kvValues, contentIds };
}

/**
 * 把「完整 /files/ URL 集合」并入 referenced（相对路径形态）——`runOrphanGc` 的 extraRefs
 * 与 `collectReferences` 共用，转换走 `toUploadRelPath` 唯一实现。
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

/** 空身份集单例（`runOrphanGc` 的 contentIds 缺省值；避免每次调用新建集合）。 */
const NO_CONTENT_IDS: ReadonlySet<string> = new Set();

/**
 * 磁盘文件是否**就是**某个被引用的内容身份 —— 唯一判据（走文件名，不依赖任何登记行）。
 *
 * 【为什么必须有它（2026-09-21 缺陷修复）】`contentId → 物理文件` 原先只有一条路：
 * `SELECT url FROM resources WHERE sha1 IN (...)`。而删素材/任务入口的顺序是「**先删行 → 再 GC**」，
 * 那行正是这条反查的唯一来源 ⇒ 同一次调用里判据自己失明：
 *   · 节点持 `assetUrl + contentId`（多数）→ `/files/` 文本引用保住文件 ✅
 *   · 节点**只持 contentId**（存量形态）→ 反查落空 → 文件被当孤儿**真删**，且不可逆 ❌
 * 同一个用户动作、同一个语义，结果取决于节点字段形态 = **判据形态依赖**，是缺陷不是因果。
 *
 * 【为什么按文件名扫是对的】内容身份的真源是**磁盘字节**（后端 `sha1(字节)`），落盘名由
 * `contentHashName(hash, ext)` 产出 ⇒ **文件名自己就携带身份**（实测两种形态并存：
 * `<sha1>.png` 与 `<时间戳>-<sha1>.png`）。故 `resources.sha1 → url` 只是**加速索引**
 * （它另外覆盖"文件名不含 sha1"的存量命名）；物理身份才是**顺序无关**的那条路。
 *
 * 【与 TD-02-31 的边界】TD-02-31 裁定的是「引用藏在**不可见**载体（浏览器 IndexedDB）⇒ 不该要求
 * 上报/副本/禁删约束」。本处引用**明确可见**（就在本服务的 KV 里），修的是"解析实现绕了一张会消失的行"
 * —— 不新增任何防御、不约束任何调用方。
 *
 * @param relPath uploads 相对路径（正斜杠），如 `migrated/1786...-<sha1>.png`
 * @param contentIds 被引用的内容身份集合（**40 位十六进制**，无 `sha1:` 前缀）
 */
export function isContentAddressedBy(relPath: string, contentIds: ReadonlySet<string>): boolean {
  if (contentIds.size === 0) return false;
  const base = relPath.slice(relPath.lastIndexOf('/') + 1);
  // 必须**完整 40 位**命中：不做前缀/子串近似，防"名字里带串十六进制就保住"的假判据（有过期孤儿回收不动）。
  const hits = base.match(/[0-9a-f]{40}/g);
  if (!hits) return false;
  return hits.some((hex) => contentIds.has(hex));
}

/**
 * 单个磁盘文件**是否被全库引用** —— 唯一判定入口（消费方只传参，不许自己拼两条判据）。
 *
 * 两条路查的是同一条语义（"这份内容还有没有人用"）：
 *   ① `referencedPaths.has(rel)`：`/files/` 文本引用（resources/tasks 的 url + KV 内嵌路径）；
 *   ② `isContentAddressedBy(rel, contentIds)`：文件名携带的内容身份（登记行已被删时唯一成立的路）。
 *
 * 【为什么必须收成一处】这个判定有三个消费点（孤儿回收 walk · 存储健康报表的孤儿/重复 ·
 * `admin/delete-file` 的删前守卫）。任一处只写 ① 就会在"删行 → 立刻 GC"的时序里得出"无引用"，
 * 从而**误删/误报**（2026-09-21 实证：删素材库一行 → 画布只持 contentId 的文件被真删）。
 */
export function isUploadReferenced(
  relPath: string,
  referencedPaths: ReadonlySet<string>,
  contentIds: ReadonlySet<string>,
): boolean {
  return referencedPaths.has(relPath) || isContentAddressedBy(relPath, contentIds);
}

/**
 * 执行孤儿文件 GC。
 * @param kvValues KV 表所有 value 字符串（调用方负责查库提取）
 * @param uploadDir uploads 绝对路径
 * @param extraRefs 额外被引用集合（如 resources/tasks 里的 URL），合并进引用集合
 * @param dryRun 为 true 时只统计不删除
 * @param contentIds 被引用的内容身份集合（40 位 sha1）—— 由文件名判定（`isContentAddressedBy`），
 *   覆盖"登记行已被删"的情形（删除入口是「先删行再 GC」，索引此刻已失明）
 */
export function runOrphanGc(
  kvValues: string[],
  uploadDir: string,
  extraRefs: ReadonlySet<string> = new Set(),
  dryRun = false,
  contentIds: ReadonlySet<string> = NO_CONTENT_IDS,
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
        // 单文件判定唯一入口（文本引用 or 内容身份两半，后者行删了也成立）
        if (!isUploadReferenced(rel, referenced, contentIds)) {
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
 * 全库引用集合（只读，不删）——「这个文件/这份内容还有没有人用」的**唯一查询入口**。
 *
 * 引用来源三类（resources 表 / tasks 表 / KV 表全部 value）由 `queryReferenceSources` 统一查询，
 * 与 `runReferenceGc` **同一实现**（TD-02-6 收口：此前是同构两份、口径靠注释保证一致）。
 *
 * ⚠️ 单路径判定**必须同时问两件事**（两者是同一条语义的两半，缺一即误删）：
 *   ① `paths.has(rel)` —— `/files/` 文本引用（resources/tasks 的 url + KV 内嵌路径）；
 *   ② `isContentAddressedBy(rel, contentIds)` —— 文件名携带的内容身份（登记行已删时唯一成立的路）。
 * 只判 ① 就是本文件头 2026-09-21 记录的那个缺陷（`admin/delete-file` 曾据此误判"无引用"）。
 */
export interface CollectedReferences {
  /** 被引用的 uploads 相对路径（形如 `canvas/xxx.png`） */
  paths: Set<string>;
  /** 被引用的内容身份（40 位 sha1，来自 KV 的 `sha1:<hex>`）；判定走 `isContentAddressedBy` */
  contentIds: Set<string>;
}

export async function collectReferences(): Promise<CollectedReferences> {
  const db = await getDb();
  const { refUrls, kvValues, contentIds } = queryReferenceSources(db);
  const paths = new Set<string>();
  addUrlRefs(paths, refUrls); // ① resources + tasks 的完整 /files/ URL（画布外引用）
  addKvRefs(paths, kvValues); // ② KV 全部 value 内嵌的 /files/ 相对路径（画布引用）
  return { paths, contentIds };
}

/**
 * 引用感知 GC 的统一入口：收集全库引用（resources 表 url + tasks 表 url + KV 全部 value）后执行孤儿回收。
 *
 * 设计背景（docs/13 §3.5）：删除接口「只删记录、绝不删盘」，删盘统一交给本函数裁决。
 * 引用来源的查询与转换全部复用 `queryReferenceSources` / `addUrlRefs` / `addKvRefs`
 * （**与 `collectReferences` 同一实现**，TD-02-6 收口；漏一类引用即误删仍在用的文件）。
 * 由删除入口（tasks/resources 删除/清空）尾部调用，让"引用消失 → 文件回收"窗口趋近于零；
 * 也供 /api/admin/cleanup 手动触发复用，保证引用收集口径只有一处。
 *
 * @param dryRun 为 true 时只统计不删除（人工核查用）
 */
export async function runReferenceGc(dryRun = false): Promise<GcResult> {
  const db = await getDb();
  const uploadDir = getUploadDir();
  const { refUrls, kvValues, contentIds } = queryReferenceSources(db);
  return runOrphanGc(kvValues, uploadDir, refUrls, dryRun, contentIds);
}
