/**
 * 显示名合并单测（node --test / ESM）
 * ------------------------------------------------------------
 * 运行：cd localTool && npm test
 * 覆盖（2026-09-14 十一轮裁决）：`resolveDisplayName` —— **显式命名优先于隐式声明**：
 *   · 既有显示名非空且 ≠ 磁盘哈希名（已被命名过）→ 保留（用户手动改名不被再次上传冲掉）
 *   · 既有为空 / 仍是磁盘哈希名（未命名）→ 采用本次声明（修「上传后库里显示哈希名」）
 * 纯函数，无 I/O。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'src');
const { resolveDisplayName } = await import(
  pathToFileURL(path.join(SRC, 'routes', 'resources.ts')).href
);

const DISK = 'c12ae6144d471a4f20473cecca8c86a01d57c418.png';

test('未命名（既有为空）→ 采用本次声明名', () => {
  assert.equal(resolveDisplayName(null, '我的猫.png', DISK), '我的猫.png');
  assert.equal(resolveDisplayName(undefined, '我的猫.png', DISK), '我的猫.png');
  assert.equal(resolveDisplayName('   ', '我的猫.png', DISK), '我的猫.png');
});

test('既有名仍是磁盘哈希名（旧行未命名）→ 采用本次声明名（TD-12-12 收益保留）', () => {
  assert.equal(resolveDisplayName(DISK, '我的猫.png', DISK), '我的猫.png');
});

test('既有名已被命名（用户手动改名）→ 保留，不被再次上传覆盖（显式优先）', () => {
  assert.equal(resolveDisplayName('主角.png', '图像 1.png', DISK), '主角.png');
});

test('既有名恰好等于磁盘名但带空白 → 视为未命名', () => {
  assert.equal(resolveDisplayName(` ${DISK} `, '我的猫.png', DISK), '我的猫.png');
});
