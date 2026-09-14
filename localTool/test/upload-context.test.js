/**
 * 上传登记 context 计算单测（node --test / ESM）
 * ------------------------------------------------------------
 * 运行：cd localTool && npm test
 * 覆盖（TD-12-11 / TD-12-12 裁决 · 2026-09-14）：
 *   contextOfUpload —— 把「物理身份」与「本次声明」分开：
 *     · id 跟**磁盘 rel**（不可变物理身份）；folder/name 跟**本次声明**（请求 subfolder / 发起方命名）
 *     · 缺省回退磁盘值（旧调用方零行为变化）
 *     · type 由**磁盘名扩展名**推（显示名可能没有后缀）—— Content 维度的事实
 *     · folder 清洗（去首尾分隔符 / 去 `..` / 合并重复分隔符）；name 单行化
 * 纯函数，无 I/O（与 project-filter / file-store-dedup 同族）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'src');
const { contextOfUpload } = await import(
  pathToFileURL(path.join(SRC, 'routes', 'resources.ts')).href
);

test('contextOfUpload：folder/name 取本次声明，id 与类型仍跟磁盘 rel', () => {
  const ctx = contextOfUpload('tasks/abc123.png', { folder: 'migrated', name: '猫.png' });
  assert.equal(ctx.id, 'local-tasks-abc123.png'); // 物理身份跟磁盘（改名/归类都不改 id）
  assert.equal(ctx.folder, 'migrated'); // UI 分类跟声明 → 内容已存在时即「归位到请求目录」
  assert.equal(ctx.name, '猫.png'); // 显示名跟声明（改前恒为磁盘哈希名）
  assert.equal(ctx.type, 'image'); // 类型跟磁盘名扩展名
});

test('contextOfUpload：缺省回退磁盘值（旧调用方零行为变化）', () => {
  const ctx = contextOfUpload('migrated/人物/9f9f.png');
  assert.equal(ctx.diskFolder, 'migrated/人物');
  assert.equal(ctx.folder, 'migrated/人物');
  assert.equal(ctx.name, '9f9f.png');
});

test('contextOfUpload：type 由磁盘扩展名推，不受显示名（可无后缀）影响', () => {
  const ctx = contextOfUpload('tasks/v1.mp4', { folder: 'migrated', name: '没有后缀的命名' });
  assert.equal(ctx.type, 'video');
  assert.equal(ctx.name, '没有后缀的命名');
});

test('contextOfUpload：folder 清洗（去首尾分隔符 / 去 .. / 合并重复分隔符）+ name 单行化', () => {
  const ctx = contextOfUpload('tasks/a.png', { folder: '/migrated/../x/', name: '  猫\n狗  ' });
  assert.equal(ctx.folder, 'migrated/x');
  assert.equal(ctx.name, '猫 狗');
});

test('contextOfUpload：顶层文件（无目录）→ diskFolder/folder 均为空串', () => {
  const ctx = contextOfUpload('a.png');
  assert.equal(ctx.diskFolder, '');
  assert.equal(ctx.folder, '');
  assert.equal(ctx.id, 'local-a.png');
});

test('contextOfUpload：空显示名 → 回退磁盘 basename（不写空 name）', () => {
  const ctx = contextOfUpload('migrated/b.png', { folder: 'migrated', name: '   ' });
  assert.equal(ctx.name, 'b.png');
});
