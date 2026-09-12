#!/usr/bin/env node
/**
 * uploads 顶层根白名单对账门禁（TD-12-4）—— 消灭「同集两处手维护」。
 *
 * 【为什么存在】前端 `src/components/base/utils/uploadDirs.ts::UPLOAD_DIRS` 与后端
 *   `localTool/src/utils/fileStore.ts::UPLOAD_ROOT_ALLOW` 各自手维护「uploads 顶层根集」，
 *   是同一真相的两份副本（违反 SSOT）。前端加根而后端未加 → 落盘被后端拒（静默失败）；
 *   后端加根而前端未加 → 前端永远传不出该根（功能死）。二者漂移即线上故障。
 *
 * 【收敛方式】后端 `UPLOAD_ROOT_ALLOW` 为**真源**（它是执行校验的一方）；前端 `UPLOAD_DIRS`
 *   的**顶层根集合**必须与之一致（前端可含嵌套子目录如 canvas/drop，其顶层根仍为 canvas）。
 *   本脚本静态读取两端常量做**集合对账**，不引入运行期跨端依赖（前端不 import 后端）。
 *
 * 用法：`node scripts/check-upload-dirs.mjs`（挂 `npm run check:upload-dirs`）
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const FRONTEND = join(ROOT, 'src/components/base/utils/uploadDirs.ts');
const BACKEND = join(ROOT, 'localTool/src/utils/fileStore.ts');

/** 从 UPLOAD_ROOT_ALLOW 行解析 Set 元素（后端真源） */
function parseBackendRoots() {
  const text = readFileSync(BACKEND, 'utf8');
  const m = text.match(/export\s+const\s+UPLOAD_ROOT_ALLOW\s*=\s*new\s+Set\(\s*\[([^\]]*)\]/);
  if (!m) return null;
  return new Set(
    [...m[1].matchAll(/['"`]([^'"`]+)['"`]/g)].map((x) => x[1]).filter(Boolean),
  );
}

/** 从 UPLOAD_DIRS 对象解析全部路径值，取顶层根（'canvas/drop' → 'canvas'） */
function parseFrontendRoots() {
  const text = readFileSync(FRONTEND, 'utf8');
  const m = text.match(/export\s+const\s+UPLOAD_DIRS\s*=\s*\{([\s\S]*?)\}/);
  if (!m) return null;
  const roots = new Set();
  for (const line of m[1].split(/\r?\n/)) {
    // 跳过注释行
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
    // 取 `key: 'value',` 的 value
    const vm = line.match(/:\s*'([^']+)'/);
    if (!vm) continue;
    roots.add(vm[1].split('/')[0]);
  }
  return roots;
}

const backend = parseBackendRoots();
const frontend = parseFrontendRoots();

// 自检 fail-loud：任一端解析失败 → 报错退出（防「解析为空 → 静默 0 违规」的假绿）
if (!backend || backend.size === 0) {
  console.error('❌ uploads 根对账自检失败：未能从后端 UPLOAD_ROOT_ALLOW 解析出任何根');
  process.exit(1);
}
if (!frontend || frontend.size === 0) {
  console.error('❌ uploads 根对账自检失败：未能从前端 UPLOAD_DIRS 解析出任何根');
  process.exit(1);
}

console.log('🔒 uploads 顶层根对账门禁（SSOT：后端 UPLOAD_ROOT_ALLOW）');
console.log(`   后端真源根 ${backend.size} 个：[${[...backend].join(', ')}]`);
console.log(`   前端 UPLOAD_DIRS 顶层根 ${frontend.size} 个：[${[...frontend].join(', ')}]`);

const onlyFrontend = [...frontend].filter((r) => !backend.has(r));
const onlyBackend = [...backend].filter((r) => !frontend.has(r));

let errors = 0;
if (onlyFrontend.length) {
  console.error(
    `\n❌ 前端有、后端无（落盘会被后端拒 → 静默失败）：${onlyFrontend.join(', ')}` +
      `\n   修法：在 localTool/src/utils/fileStore.ts 的 UPLOAD_ROOT_ALLOW 加上，或从前端删除。`,
  );
  errors++;
}
if (onlyBackend.length) {
  console.error(
    `\n❌ 后端有、前端无（前端永远用不到该根 → 功能死）：${onlyBackend.join(', ')}` +
      `\n   修法：在 src/components/base/utils/uploadDirs.ts 的 UPLOAD_DIRS 加上，或从后端删除（须确认无存量文件）。`,
  );
  errors++;
}

if (errors > 0) process.exit(1);
console.log('   ✅ 两端顶层根集合一致');
