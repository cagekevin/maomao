/**
 * 子模块 0.2 — KV 存储路由
 *
 * 【并发写入根治（docs/118 §三 S1）】
 *  - `handleKvSet` 支持 `ifVersion`（乐观并发 / CAS）：版本不符 → 409 且**一个字节都不写**；
 *    `ifVersion` 缺省 = 旧行为（无条件写 + 版本自增）→ 现有调用点零改动、可随时回滚。
 *  - `handleKvVersion`：轻量只读 `<key>_version`（跨源冲突轮询用，绝不拉整包）。
 *  - `handleKvDelete`：**键与版本一并删除**（TD-02-10，2026-09-12）——删除后重建不带旧版本基线。
 *  - `handleKvKeys`：枚举实际存在的键（备份列举用，TD-02-30）。
 *
 * ★★★ 原子性红线（勿删）★★★
 *   `await getDb()` 之后到 `return` 之间**禁止任何 await**：sql.js 是内存库、API 全同步，
 *   Node 单线程事件循环保证这段不被其它请求插入 → 天然 CAS。
 *   一旦中间插了 await（fetch / 文件 IO / contentSetAsync…），就退化成 TOCTOU，本方案失效。
 *   （例外：本文件 `handleKvKeys` 是**纯读**，不参与 CAS，不受此红线约束，但也无 await 需要。）
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { getDb, queryOne, queryAll, run, debouncedSaveDb } from '../db/database.js';
import { json, parseJsonBody, sendError } from '../utils/helpers.js';
import { externalizeBase64InValue } from '../utils/base64Externalize.js';

export async function handleKvGet(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  const key = url.searchParams.get('key');
  if (!key) return sendError(res, 'Missing key parameter', 400);

  const db = await getDb();
  const row = queryOne(db, 'SELECT value FROM kv WHERE key = ?', [key]);

  if (!row) return json(res, null);

  try {
    return json(res, JSON.parse(row.value));
  } catch {
    return json(res, row.value);
  }
}

/**
 * POST /api/kv/set { key, value, ifVersion? }
 *  - `ifVersion === undefined` → 无条件写（导入/迁移/强制），版本自增，返回 `{ code:0, data:{ ok, version } }`；
 *  - `ifVersion !== 当前 <key>_version` → 409 `{ error:{code:'conflict'}, current }`，value 与 version 都不动；
 *  - `ifVersion === 当前版本` → 写 value；`<key>_version = max(Date.now(), cur+1)`。
 */
export async function handleKvSet(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as {
    key?: string;
    value?: unknown;
    ifVersion?: number;
  } | null;
  if (!body || typeof body.key !== 'string') return sendError(res, 'Missing key field', 400);

  const db = await getDb();
  const versionKey = `${body.key}_version`;

  // ★★★ 以下到 return 之间禁止任何 await：原子 CAS 全部依赖这段同步执行 ★★★
  const curRow = queryOne(db, 'SELECT value FROM kv WHERE key = ?', [versionKey]) as
    { value?: string } | undefined;
  const cur = curRow?.value ? parseInt(String(curRow.value), 10) || 0 : 0;

  if (body.ifVersion !== undefined && body.ifVersion !== cur) {
    // 冲突：value 与 version 都不动（一个字节都不写）
    return json(res, { error: { code: 'conflict', message: '版本冲突' }, current: cur }, 409);
  }

  const value = typeof body.value === 'string' ? body.value : JSON.stringify(body.value);
  // 方案②：把 value 里的 base64 图片外置为 uploads/ 磁盘文件，用 /files/ URL 替换后入库，
  // 避免 sql.js KV 库被 base64 撑大 → 全量 export + 同步写盘导致的卡死（docs/41）。
  // 失败字段自动回退保留原 base64，不破坏契约。
  const finalValue = externalizeBase64InValue(value, db);
  const next = Math.max(Date.now(), cur + 1);

  // sql.js 不支持 ON CONFLICT，用 DELETE + INSERT 模拟
  run(db, 'DELETE FROM kv WHERE key = ?', [body.key]);
  run(db, 'INSERT INTO kv (key, value, updated_at) VALUES (?, ?, unixepoch())', [
    body.key,
    finalValue,
  ]);
  run(db, 'DELETE FROM kv WHERE key = ?', [versionKey]);
  run(db, 'INSERT INTO kv (key, value, updated_at) VALUES (?, ?, unixepoch())', [
    versionKey,
    String(next),
  ]);

  debouncedSaveDb();
  return json(res, { code: 0, data: { ok: true, version: next } });
}

/**
 * GET /api/kv/version?key=<key> → `{ code:0, data:{ version } }`
 * 轻量：只读 `<key>_version`，不拉整包（3s 冲突轮询专用）。key 不存在/不可解析 → 0。
 */
export async function handleKvVersion(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  const key = url.searchParams.get('key');
  if (!key) return sendError(res, 'Missing key parameter', 400);

  const db = await getDb();
  const row = queryOne(db, 'SELECT value FROM kv WHERE key = ?', [`${key}_version`]) as
    { value?: string } | undefined;
  const version = row?.value ? parseInt(String(row.value), 10) || 0 : 0;
  return json(res, { code: 0, data: { version } });
}

/**
 * GET /api/kv/keys[?includeInternal=1] → `{ code:0, data:{ keys: string[] } }`
 *
 * 【为什么存在（TD-02-30 · M7 方案 A 三期）】KV 是**工程数据的统一载体**，备份
 * （`backupStore.exportAll`）必须能「枚举**实际存在**的键」才能做到
 * 「新工程域只要在 `STORAGE_KEYS` 登记 → 自动进备份」，而不用给每个域手写收集逻辑
 * （那正是 M3「手写清单必漂移」母体）。前端只持有**键模板**
 * （`contracts.getKvKeyPatterns()`），不知道哪些实例存在 ⇒ 只能问后端。
 *
 * 【判据归位：默认不返回 `_version` 键】`<key>_version` 是 CAS 的**服务端内部元数据**
 * （唯一产出方 = 本文件 `handleKvSet`，客户端不产生、也不该进备份）。
 * 「它算不算用户数据」只有后端知道 ⇒ 过滤判据放这里，不放消费方（前端写这个后缀判断就是第二份协议知识）。
 * `includeInternal=1` 供运维取全表。
 *
 * 【双消费方（同语义单入口）】① `backupStore.exportAll`（业务 · 默认口径）；
 * ② `scripts/1mao-scripts/clear-cache.cjs`（运维 · `includeInternal=1`）。
 * 原为 `/api/admin/kv-list`（只有运维消费）——2026-09-16 归位到 kv 域：
 * admin 前缀会误导后续「这是运维端点、可随便改」，而用户备份已依赖它（TD-02-30）。
 *
 * 【返回形状】只给**键名**（窄接口）：两个消费方都只用键名，`len`/`updated_at` 无消费者即删（防幽灵预留）。
 */
export async function handleKvKeys(
  _req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  const includeInternal = url.searchParams.get('includeInternal') === '1';
  const db = await getDb();
  const rows = queryAll(db, 'SELECT key FROM kv ORDER BY key') as Array<{ key: string }>;
  const keys = rows.map((r) => r.key).filter((k) => includeInternal || !k.endsWith('_version'));
  return json(res, { code: 0, data: { keys } });
}

/**
 * DELETE /api/kv/delete?key=<key> → `{ code:0, data:{ ok:true } }`
 *
 * 【删除语义 = 键与版本一并删除（TD-02-10，2026-09-12）】原先只删 `<key>`、留下 `<key>_version`
 * 兄弟行 → 「删除后重建」会拿到**旧版本基线**（CAS 的 `ifVersion` 语义失真）；且删除完整性此前
 * 靠**各调用方手工补删**（`projectStore.deleteProject` 手动删过 `_version`），新调用方必漏。
 * 现由 handler 一次性保证：`<key>` 与 `<key>_version` 同删（调用方只删一次即可、无需补删）。
 */
export async function handleKvDelete(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  const key = url.searchParams.get('key');
  if (!key) return sendError(res, 'Missing key parameter', 400);

  const db = await getDb();
  run(db, 'DELETE FROM kv WHERE key = ?', [key]);
  run(db, 'DELETE FROM kv WHERE key = ?', [`${key}_version`]);
  debouncedSaveDb();
  return json(res, { code: 0, data: { ok: true } });
}
