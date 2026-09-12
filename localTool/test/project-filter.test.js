/**
 * resources 表 project 隔离契约单测（node --test / ESM）
 * ------------------------------------------------------------
 * 运行：cd localTool && npm test
 * 覆盖（docs/122 #2 语义，物理去重全局 / 引用 per-project 解耦）：
 *   - resourceVisibleForProject：filter 缺省全量；row NULL(legacy) 全项目可见；不同项目隐藏
 *   - buildPaginatedQuery nullOrEqCols：产出 `IS NULL OR =` 且不叠加 generic 等值（防「NULL 反而不可见」）
 * 纯函数，无 I/O。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'src');
const { resourceVisibleForProject } = await import(
  pathToFileURL(path.join(SRC, 'routes', 'resources.ts')).href
);
const { buildPaginatedQuery } = await import(
  pathToFileURL(path.join(SRC, 'utils', 'helpers.ts')).href
);

const SEARCH_COLS = ['id', 'url', 'folder', 'name', 'project_id'];

// ── T-B1 · resourceVisibleForProject 谓词 ──
test('resourceVisibleForProject：filter 缺省 → 全量（向后兼容）', () => {
  assert.equal(resourceVisibleForProject('p1', undefined), true);
  assert.equal(resourceVisibleForProject('p1', null), true);
  assert.equal(resourceVisibleForProject('p1', ''), true);
});

test('resourceVisibleForProject：本项目可见', () => {
  assert.equal(resourceVisibleForProject('p1', 'p1'), true);
});

test('resourceVisibleForProject：他项目隐藏', () => {
  assert.equal(resourceVisibleForProject('p1', 'p2'), false);
});

test('resourceVisibleForProject：legacy NULL 全项目可见（含未知项目）', () => {
  assert.equal(resourceVisibleForProject(null, 'pX'), true);
  assert.equal(resourceVisibleForProject(undefined, 'pX'), true);
});

// ── buildPaginatedQuery nullOrEqCols：产出 IS NULL OR =，且不重复叠加等值 ──
test('buildPaginatedQuery nullOrEqCols：project_id 过滤为 IS NULL OR =（legacy 可见）', () => {
  const q = buildPaginatedQuery(
    'resources',
    { page: 1, pageSize: 20, sortBy: 'timestamp', sortDir: 'DESC', filters: { project_id: 'p1' } },
    SEARCH_COLS,
    ['project_id'],
  );
  assert.ok(
    q.sql.includes('(project_id IS NULL OR project_id = ?)'),
    '应含 IS NULL OR = 语义，实际: ' + q.sql,
  );
  assert.ok(q.values.includes('p1'));
  // 不叠加 generic 等值：整个 WHERE 只出现一次 project_id = ?
  const eqCount = (q.sql.match(/project_id = \?/g) || []).length;
  assert.equal(eqCount, 1, '不应出现第二处 project_id = ?，实际 ' + q.sql);
  assert.ok(q.countSql.includes('(project_id IS NULL OR project_id = ?)'));
});

test('buildPaginatedQuery nullOrEqCols：未提供判定值不注入条件', () => {
  const q = buildPaginatedQuery(
    'resources',
    { page: 1, pageSize: 20, sortBy: 'timestamp', sortDir: 'DESC', filters: {} },
    SEARCH_COLS,
    ['project_id'],
  );
  assert.ok(!q.sql.includes('project_id'), '无 projectId 过滤时 SQL 不应含 project_id 条件');
});
