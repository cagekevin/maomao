/**
 * ext→kind 真值源单测（node --test / ESM）
 * ------------------------------------------------------------
 * 运行：cd localTool && npm test
 *
 * 覆盖（TD-08-17 / TD-08-18 / TD-16-13 收口 · 2026-09-16）：
 *   「扩展名 → 媒体类别」全库唯一真源 = utils/mime.ts `extToKind`（由 EXT_TO_MIME 派生）。
 *   此前后端有两张手抄表（resources.ts `RESCAN_FILE_TYPE` / admin.ts `CATEGORY_BY_EXT`），
 *   互不委托且已漂移 —— 本测试钉死「漂移不再回来」：
 *     · `.wmv` 曾是 image（rescan 判 image 静默误判为图片 → 破图），现必须 video；
 *     · `.json`/`.csv`/`.log` 等曾是 null（rescan 直接 continue 丢弃），现必须 text；
 *     · 未知扩展 → null（诚实「不猜」，禁 `|| 'image'` 静默兜底）。
 *
 * 纯函数，无 I/O。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'src');
const { extToKind, extToCategoryLabel, kindLabel } = await import(
  pathToFileURL(path.join(SRC, 'utils', 'mime.ts')).href
);
const { contextOfUpload } = await import(
  pathToFileURL(path.join(SRC, 'routes', 'resources.ts')).href
);

test('extToKind：漂移过的扩展名现在归位（.wmv 视频 / .json·.csv·.log 文本 / .avif 图片）', () => {
  // TD-08-18 症状：RESCAN_FILE_TYPE 漏这些 → rescan 判 null → `|| 'image'` 静默误判为图片
  assert.equal(extToKind('.wmv'), 'video');
  assert.equal(extToKind('.aac'), 'audio');
  assert.equal(extToKind('.opus'), 'audio');
  assert.equal(extToKind('.json'), 'text');
  assert.equal(extToKind('.csv'), 'text');
  assert.equal(extToKind('.log'), 'text');
  assert.equal(extToKind('.xml'), 'text');
  // TD-16-13 症状：RESCAN_FILE_TYPE 缺 avif/ogv/oga，多 flv（与前端 EXT_KIND 漂移）
  assert.equal(extToKind('.avif'), 'image');
  assert.equal(extToKind('.ogv'), 'video');
  assert.equal(extToKind('.oga'), 'audio');
  assert.equal(extToKind('.flv'), 'video');
  assert.equal(extToKind('.aiff'), 'audio');
  assert.equal(extToKind('.ico'), 'image');
});

test('extToKind：四类基准扩展名与大小写/裸扩展名兼容', () => {
  assert.equal(extToKind('.png'), 'image');
  assert.equal(extToKind('.mp4'), 'video');
  assert.equal(extToKind('.mp3'), 'audio');
  assert.equal(extToKind('.md'), 'text');
  // 大写 + 无点
  assert.equal(extToKind('.PNG'), 'image');
  assert.equal(extToKind('mp4'), 'video');
});

test('extToKind：未知扩展返回 null（不猜）—— 禁回退成 image', () => {
  assert.equal(extToKind('.xyz'), null);
  assert.equal(extToKind(''), null);
  assert.equal(extToKind('.no-such-ext'), null);
});

test('kindLabel：kind → 中文显示名（admin 存储健康口径），未知回「其他」', () => {
  assert.equal(kindLabel('image'), '图片');
  assert.equal(kindLabel('video'), '视频');
  assert.equal(kindLabel('audio'), '音频');
  assert.equal(kindLabel('text'), '文本');
  assert.equal(kindLabel(null), '其他');
  // 组合 helper：与旧 CATEGORY_BY_EXT 口径一致（用于 admin 报表）
  assert.equal(extToCategoryLabel('.wmv'), '视频');
  assert.equal(extToCategoryLabel('.json'), '文本');
  assert.equal(extToCategoryLabel('.xyz'), '其他');
});

test('contextOfUpload：未知扩展 → other（不再静默误判 image）', () => {
  // TD-08-18 核心：未知扩展不得被标成 image（前端按图片渲染 → 破图 + 掩盖"表该补"信号）
  const ctx = contextOfUpload('tasks/a.xyz');
  assert.equal(ctx.type, 'other');
});

test('contextOfUpload：收口后原本漏判的扩展名拿到正确类别', () => {
  assert.equal(contextOfUpload('tasks/a.wmv').type, 'video');
  assert.equal(contextOfUpload('tasks/a.json').type, 'text');
  assert.equal(contextOfUpload('tasks/a.avif').type, 'image');
});
