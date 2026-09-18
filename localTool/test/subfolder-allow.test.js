/**
 * fileStore.ts::normalizeSubfolder 分域校验单测（node --test / ESM）
 * ------------------------------------------------------------
 * 运行：cd localTool && npm test
 *
 * 【TD-03-18】本次校验从"只查顶层根"升级为"顶层根 + 子目录分域"。本测试锁住三条判据：
 *   ① 用户数据根（migrated）子目录**必须放行**（用户可自建任意层级 —— 枚举即功能死）
 *   ② 系统产物根（canvas 等）的**未登记**子目录**必须拒绝**（孤儿目录的来源：canvas/cleaned 等）
 *   ③ 越根/未知根/逃逸**必须拒绝**（既有行为，防回归）
 *
 * 纯函数，无 I/O（fileStore.ts 顶层无 DB 副作用）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'src');

const { normalizeSubfolder, SUB_DIR_ALLOW, UPLOAD_ROOT_ALLOW } = await import(
  pathToFileURL(path.join(SRC, 'utils', 'fileStore.ts')).href
);

test('顶层根本身一律放行', () => {
  for (const root of UPLOAD_ROOT_ALLOW) {
    assert.equal(normalizeSubfolder(root), root, `顶层根 ${root} 应放行`);
  }
});

test('用户数据根 migrated 的子目录一律放行（不可枚举）', () => {
  const cases = [
    'migrated/人物',
    'migrated/场景',
    'migrated/道具',
    'migrated/脚本/尾帧变体', // 三级嵌套，scriptBoxEngine 代码生成
    'migrated/颜色', // 用户自建
    'migrated/HKH其他产品', // 用户自建
    'migrated/用户今天新建的目录', // 未来任意新建 —— 必须放行
  ];
  for (const c of cases) {
    assert.equal(normalizeSubfolder(c), c, `${c} 应放行（用户数据根子目录开放）`);
  }
});

test('系统产物根下已登记子目录放行', () => {
  for (const sub of SUB_DIR_ALLOW) {
    assert.equal(normalizeSubfolder(sub), sub, `${sub} 已登记，应放行`);
  }
});

test('系统产物根下未登记子目录必须拒绝（TD-03-18 孤儿目录入口）', () => {
  // 这三个正是盘上真实存在的孤儿目录（全仓零引用）—— 收紧后必须写不进来
  const orphans = ['canvas/cleaned', 'canvas/template', 'canvas/upload'];
  for (const o of orphans) {
    assert.equal(normalizeSubfolder(o), null, `${o} 未登记，必须拒绝`);
  }
  // 任意新造的未登记子目录同样拒绝（防再次自由生长）
  assert.equal(normalizeSubfolder('canvas/任意新目录'), null);
  assert.equal(normalizeSubfolder('tasks/sub'), null);
  assert.equal(normalizeSubfolder('web/sub'), null);
  assert.equal(normalizeSubfolder('director3d/sub'), null);
});

test('未知顶层根与越根逃逸必须拒绝', () => {
  assert.equal(normalizeSubfolder('bogusroot'), null);
  assert.equal(normalizeSubfolder('bogusroot/sub'), null);
  assert.equal(normalizeSubfolder('canvas/../etc'), null);
  assert.equal(normalizeSubfolder('../canvas'), null);
  assert.equal(normalizeSubfolder('C:/abs'), null);
  assert.equal(normalizeSubfolder(''), null);
  assert.equal(normalizeSubfolder('/'), null);
  assert.equal(normalizeSubfolder(null), null);
  assert.equal(normalizeSubfolder(undefined), null);
  assert.equal(normalizeSubfolder(123), null);
});

test('路径规范化：反斜杠/连续斜杠/首尾斜杠', () => {
  assert.equal(normalizeSubfolder('canvas\\drop'), 'canvas/drop');
  assert.equal(normalizeSubfolder('/canvas/drop/'), 'canvas/drop');
  assert.equal(normalizeSubfolder('canvas//drop'), 'canvas/drop');
  assert.equal(normalizeSubfolder('/migrated/人物/'), 'migrated/人物');
});

test('登记表覆盖：盘点中的每个代码落点都在册', () => {
  // 本次清点（2026-09-18）得到的系统产物根下真实落点 —— 少一个即闸/校验会误拒
  const inUse = ['canvas/drop', 'canvas/video-process', 'canvas/video-editor', 'canvas/face_mosaic'];
  for (const d of inUse) {
    assert.ok(SUB_DIR_ALLOW.has(d), `${d} 是真实落点，必须在 SUB_DIR_ALLOW 登记`);
  }
});
