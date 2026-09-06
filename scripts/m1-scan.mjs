/**
 * m1-scan.mjs — M1 错误全貌只读扫描（治本方案 A，零工作区污染）
 *
 * 目的：可靠地统计「去掉全部 @ts-nocheck 后」每个测试文件 × 错误数 × 错误码，
 *       并区分「测试自身错」vs「src 连带错」。
 *
 * 为什么不用 status：
 *   - status 会「临时去掉工作区文件的 @ts-nocheck → tsc → 恢复」，恢复不可靠（曾丢 172 文件）。
 *   - 本脚本把 tests/unit **复制**到 gitignored 的 tmp/ 下，在副本上剥离 @ts-nocheck，
 *     工作区文件 0 写入，进程被杀也零污染。符合踩坑记录 2/5。
 *
 * 深度说明：
 *   - tmp/unit/foo.test.ts 与 tests/unit/foo.test.ts 同为「根下第二层目录」，故相对导入
 *     ../../src/... 解析结果一致；@/* 由临时 tsconfig 的 baseUrl/paths 解析到根 src。
 *
 * 用法：
 *   node scripts/m1-scan.mjs                 # 打印分布（含 src 连带错）
 *   node scripts/m1-scan.mjs --export        # 额外写 docs/75-M1-error-distribution.md
 */
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  rmSync,
  readdirSync,
  statSync,
  cpSync,
} from 'node:fs';
import { resolve, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: { export: { type: 'boolean' } } });

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');
const SRC_UNIT = resolve(root, 'tests', 'unit');
const TMP_UNIT = resolve(root, 'tmp', 'unit'); // 深度与 tests/unit 一致
const TMP_TSCONFIG = resolve(root, 'tmp', 'tsconfig.json');

/** 递归收集 .ts/.tsx */
function walkDir(dir, fileList = []) {
  if (!existsSync(dir)) return fileList;
  for (const file of readdirSync(dir)) {
    const abs = join(dir, file);
    if (statSync(abs).isDirectory()) walkDir(abs, fileList);
    else if (abs.endsWith('.ts') || abs.endsWith('.tsx')) fileList.push(abs);
  }
  return fileList;
}

/** 剥离顶部的 @ts-nocheck（保留 vitest 环境注解），返回处理后的源码 */
function stripTsNoCheck(src) {
  const lines = src.split('\n');
  for (let i = 0; i < Math.min(lines.length, 3); i++) {
    if (/^\s*\/\/\s*@ts-nocheck\s*$/.test(lines[i])) {
      lines.splice(i, 1);
      break;
    }
  }
  return lines.join('\n');
}

// ── 1. 清空并重建 tmp/unit 副本 ──
rmSync(TMP_UNIT, { recursive: true, force: true });
mkdirSync(TMP_UNIT, { recursive: true });
cpSync(SRC_UNIT, TMP_UNIT, { recursive: true });

// 在副本上剥离 @ts-nocheck
const copies = walkDir(TMP_UNIT);
for (const f of copies) {
  const src = readFileSync(f, 'utf8');
  writeFileSync(f, stripTsNoCheck(src), 'utf8');
}

// ── 2. 写临时 tsconfig（baseUrl=根，@/* → ./src/*）──
const tsconfig = {
  compilerOptions: {
    target: 'ES2022',
    lib: ['ES2022', 'DOM', 'DOM.Iterable'],
    module: 'ESNext',
    moduleResolution: 'bundler',
    jsx: 'react-jsx',
    resolveJsonModule: true,
    esModuleInterop: true,
    forceConsistentCasingInFileNames: true,
    skipLibCheck: true,
    noEmit: true,
    allowImportingTsExtensions: true,
    allowJs: true,
    checkJs: false,
    strict: false,
    noImplicitAny: false,
    strictNullChecks: false,
    types: ['node', 'vite/client', 'vitest/globals'],
    baseUrl: root,
    paths: { '@/*': ['./src/*'] },
  },
  include: [join(root, 'tmp', 'unit', '**', '*.ts'), join(root, 'tmp', 'unit', '**', '*.tsx')],
};
writeFileSync(TMP_TSCONFIG, JSON.stringify(tsconfig, null, 2), 'utf8');

// ── 3. 跑 tsc（只读，扫副本）──
const res = spawnSync('npx', ['tsc', '--noEmit', '-p', 'tmp/tsconfig.json'], {
  cwd: root,
  encoding: 'utf8',
  shell: true,
});
const allOut = res.stdout + '\n' + res.stderr;

// ── 4. 解析（路径规范化为从根出发的相对路径）──
const fileStats = {}; // key: 规范化 rel path（正斜杠、小写）
const rawToNorm = {}; // 记录每个 src/test 文件原始展示路径
const order = []; // 首次出现顺序

function normPath(p) {
  const clean = p.trim().replace(/\\/g, '/');
  // tmp/unit/... 映射回 tests/unit/...，便于对照工作区真实路径
  const mapped = clean.startsWith('tmp/unit/')
    ? 'tests/unit/' + clean.slice('tmp/unit/'.length)
    : clean.startsWith('./tmp/unit/')
      ? 'tests/unit/' + clean.slice('./tmp/unit/'.length)
      : clean.startsWith('./src/')
        ? clean.slice(2)
        : clean;
  return mapped;
}

const errorLines = allOut.split('\n').filter((l) => l.includes('error TS'));
for (const line of errorLines) {
  const m = line.match(/^([^(]+)\(\d+,\d+\): error TS(\d+)/);
  if (!m) continue;
  const norm = normPath(m[1]).toLowerCase();
  const code = m[2];
  if (!fileStats[norm]) {
    fileStats[norm] = { count: 0, codes: {} };
    rawToNorm[norm] = normPath(m[1]);
    order.push(norm);
  }
  fileStats[norm].count++;
  fileStats[norm].codes[code] = (fileStats[norm].codes[code] || 0) + 1;
}

// ── 5. 汇总 ──
const testFiles = Object.entries(fileStats).filter(([k]) => k.startsWith('tests/unit/'));
const srcFiles = Object.entries(fileStats).filter(([k]) => k.startsWith('src/'));
const totalErr = errorLines.length;
const testErr = testFiles.reduce((s, [, v]) => s + v.count, 0);
const srcErr = srcFiles.reduce((s, [, v]) => s + v.count, 0);

const byCode = {};
errorLines.forEach((l) => {
  const c = l.match(/error TS(\d+)/);
  if (c) byCode[c[1]] = (byCode[c[1]] || 0) + 1;
});

console.log('══════ M1 错误全貌（只读扫描）══════');
console.log(`总计错误行: ${totalErr}`);
console.log(`  tests/unit 错误: ${testErr}（测试自身错）`);
console.log(`  src 连带错: ${srcErr}`);
console.log(`涉及文件数: tests ${testFiles.length} 个, src ${srcFiles.length} 个`);
console.log(
  '错误码分布: ' +
    Object.entries(byCode)
      .sort((a, b) => b[1] - a[1])
      .map(([c, n]) => `TS${c}×${n}`)
      .join('  '),
);

// 按错误数降序排 tests 文件
const sorted = testFiles
  .map(([k, v]) => ({ file: rawToNorm[k], ...v }))
  .sort((a, b) => b.count - a.count);
console.log('\n── tests/unit 各文件错误数（降序，前 40）──');
sorted.slice(0, 40).forEach((f, i) => {
  const top = Object.entries(f.codes)
    .sort((a, b) => b[1] - a[1])
    .map(([c, n]) => `TS${c}×${n}`)
    .join(', ');
  console.log(`${String(i + 1).padStart(2)}. [${String(f.count).padStart(4)}] ${f.file}  (${top})`);
});
if (sorted.length > 40) console.log(`  ... 余下 ${sorted.length - 40} 个文件`);

if (srcFiles.length) {
  console.log('\n── src 连带错（需在 M3 前量化，避免把已绿的 src 弄红）──');
  srcFiles
    .map(([k, v]) => ({ file: rawToNorm[k], ...v }))
    .sort((a, b) => b.count - a.count)
    .forEach((f) => console.log(`  [${f.count}] ${f.file}`));
} else {
  console.log('\n── src 连带错：0 个 ✓（当前扫描下 src 未被连带报错）');
}

// ── 6. 可选导出 ──
if (values.export) {
  const lines = [
    '# 75 · M1 错误全貌（只读扫描，零工作区污染）',
    '',
    `- 生成时间：${new Date().toISOString()}`,
    `- 方法：复制 tests/unit → gitignored tmp/unit，副本剥离 @ts-nocheck，临时 tsconfig 跑 tsc`,
    `- 总计错误：**${totalErr}**（tests/unit ${testErr} / src ${srcErr}）`,
    `- 涉及文件：tests ${testFiles.length} 个 / src ${srcFiles.length} 个`,
    '',
    '## 错误码分布',
    '',
    '| 错误码 | 数量 |',
    '|---|---|',
    ...Object.entries(byCode)
      .sort((a, b) => b[1] - a[1])
      .map(([c, n]) => `| TS${c} | ${n} |`),
    '',
    '## tests/unit 各文件（错误数降序）',
    '',
    '| 文件 | 错误数 | 错误码分布 |',
    '|---|---|---|',
    ...sorted.map(
      (f) =>
        `| \`${f.file}\` | ${f.count} | ${Object.entries(f.codes)
          .sort((a, b) => b[1] - a[1])
          .map(([c, n]) => `TS${c}×${n}`)
          .join(', ')} |`,
    ),
    '',
    srcFiles.length
      ? '## src 连带错（M3 前必须量化）\n\n' +
        srcFiles.map(([k, v]) => `| \`${rawToNorm[k]}\` | ${v.count} |`).join('\n')
      : '## src 连带错：0 个 ✓',
  ];
  const outPath = resolve(root, 'docs', '75-M1-error-distribution.md');
  writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log(`\n✔ 已导出 ${relative(root, outPath)}`);
}

// ── 7. 清理临时副本（保工作区纯净）──
rmSync(TMP_UNIT, { recursive: true, force: true });
rmSync(TMP_TSCONFIG, { recursive: true, force: true });
console.log('✔ 临时副本已清理，工作区无残留。');
