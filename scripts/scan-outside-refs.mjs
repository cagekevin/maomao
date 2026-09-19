#!/usr/bin/env node
/**
 * scan-outside-refs.mjs —— **扫描根之外**的引用侦察（只读工具，**不是闸**）。
 *
 * 【为什么存在】（2026-09-19 · 域模块化前置 P2）
 *   `mv-sync-refs.mjs` 的扫描根只有 `src` + `tests`（其 `SCAN_ROOTS`）⇒ 改名/移位时**它不会同步**根外的活引用，
 *   而漏改的症状**静默**：漏 `tailwind.config.ts` ⇒ **构建破**（push 闸不跑 build，`tsc` 也查不出）；
 *   漏 `scripts/check-arch.mjs` 的扫描根常量 ⇒ 扫描根变空 ⇒ **闸假绿**。
 *   本脚本把「根外还有谁引用它」变成**一条命令**，供 SOP §5.2 前置检查使用。
 *
 * ★ 用法与判据（**先记清单 → 改后复跑必须 0**）
 *   # 改名前（以"即将改名/移位的旧路径片段"为输入）
 *   node scripts/scan-outside-refs.mjs videoEditor/ve-tailwind-colors
 *   # 改名/移位后，用**同一个旧片段**再跑一次 —— 命中数必须为 0（非 0 = 你漏同步了）
 *
 *   node scripts/scan-outside-refs.mjs <片段> [<片段2> …] [--all] [--json]
 *     · 不传片段 + `--all`：列出全部活引用（做基线清点用，会有噪声，仅用于周期性盘点）
 *
 * 【刻意不扫（历史不可改写）】`daily/**`（架构日志）· `Temp/**` · `docs/adr/**`（判据记录）·
 *   `docs/plan/**`+`docs/AI-Canvas-tauri-prompts/**`（历史/外来方案）· `scripts/1mao-scripts/**`（外部移植脚本）·
 *   `spec/TECH-DEBT.md`（已废弃只读）· `node_modules` · `dist`。
 *
 * 【不是闸】未登记 `gates.manifest.json`、不进 CI —— 它是**施工期侦察助手**，目标清单可随仓库演进调整；
 *   要把它变成闸，须先过「建闸前置评审」（见 `架构师改码7步法`：默认不建）。
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/[/\\]$/, '');

/** 根外的「活」目标 */
const TARGET_FILES = [
  'tailwind.config.ts',
  'vitest.config.ts',
  'vite.config.ts',
  'playwright.config.ts',
  'postcss.config.js',
  'knip.json',
  'package.json',
  'index.html',
  'CLAUDE.md',
];
/** 目录：只扫**根级**文件（递归会引入历史/外来文档噪声，见文件头） */
const TARGET_DIRS_SHALLOW = ['spec', 'docs'];
/** 目录：递归扫 */
const TARGET_DIRS_DEEP = ['scripts', '.codebuddy/commands', 'localTool/src'];

const SKIP_NAMES = new Set([
  'node_modules',
  '.git',
  'dist',
  'archived',
  'Temp',
  'daily',
  '1mao-scripts',
  'adr',
  'plan',
  'AI-Canvas-tauri-prompts',
  'teams',
  'TECH-DEBT.md',
]);
const TEXT_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.html', '.css']);

function walk(dir, out, deep) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (SKIP_NAMES.has(e.name)) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (deep) walk(full, out, deep);
    } else if (e.isFile() && TEXT_EXTS.has(extname(e.name))) {
      out.push(full);
    }
  }
}

function collectTargets() {
  const files = [];
  for (const f of TARGET_FILES) {
    const abs = join(ROOT, f);
    if (existsSync(abs)) files.push(abs);
  }
  for (const d of TARGET_DIRS_SHALLOW) {
    const abs = join(ROOT, d);
    if (existsSync(abs)) walk(abs, files, false);
  }
  for (const d of TARGET_DIRS_DEEP) {
    const abs = join(ROOT, d);
    if (existsSync(abs)) walk(abs, files, true);
  }
  return [...new Set(files)];
}

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const all = args.includes('--all');
const needles = args.filter((a) => !a.startsWith('--'));

if (!needles.length && !all) {
  console.log(
    '用法：node scripts/scan-outside-refs.mjs <路径片段> [<片段2> …] [--all] [--json]\n' +
      '判据：改名前跑旧片段记清单 → 改名/移位后**用同一旧片段再跑** → 命中必须为 0。',
  );
  process.exit(0);
}

const targets = collectTargets();

/** 路径片段模式：命中的行原样列出（供"改前记清单 / 改后复跑必须 0"） */
function scanNeedles() {
  const hits = [];
  for (const file of targets) {
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const rel = file.slice(ROOT.length + 1).replace(/\\/g, '/');
    text.split(/\r?\n/).forEach((line, i) => {
      if (line.includes('scan-outside-refs-ok')) return; // 行级豁免（例：工具自带用法示例）
      if (!needles.some((n) => line.includes(n))) return;
      hits.push({ file: rel, line: i + 1, text: line.trim().slice(0, 160) });
    });
  }
  return hits;
}

/** --all 模式：抽取根外的**源码路径引用**并逐条验证可达性（周期性盘点用） */
const PATH_RE = /(?:src\/)?components\/[A-Za-z0-9_][A-Za-z0-9_./-]*/g;
const PROBE_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css'];
function resolveCandidate(candidate) {
  const abs = join(ROOT, candidate);
  if (existsSync(abs)) {
    try {
      if (statSync(abs).isFile()) return { via: null };
    } catch {
      /* ignore */
    }
    return { via: null };
  }
  const ext = extname(candidate);
  const stem = ext ? candidate.slice(0, candidate.length - ext.length) : candidate;
  for (const e of PROBE_EXTS) {
    if (existsSync(join(ROOT, stem + e))) return { via: stem + e };
  }
  for (const e of PROBE_EXTS) {
    if (existsSync(join(ROOT, candidate, 'index' + e))) return { via: `${candidate}/index${e}` };
  }
  return null;
}
function scanAllPaths() {
  const seen = new Set();
  const hits = [];
  for (const file of targets) {
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const rel = file.slice(ROOT.length + 1).replace(/\\/g, '/');
    text.split(/\r?\n/).forEach((line, i) => {
      if (line.includes('scan-outside-refs-ok')) return;
      for (const raw of line.match(PATH_RE) || []) {
        if (/[*?{}<>…$]/.test(raw)) continue; // glob / 占位符 → 非确定路径
        const cleaned = raw.replace(/[.,'"`)\]}，。；：、]+$/, '');
        if (!cleaned || cleaned.endsWith('/components')) continue;
        const candidate = cleaned.startsWith('src/') ? cleaned : 'src/' + cleaned;
        const key = `${rel}\u0000${candidate}`;
        if (seen.has(key)) continue;
        seen.add(key);
        hits.push({ file: rel, line: i + 1, path: candidate, ok: !!resolveCandidate(candidate) });
      }
    });
  }
  return hits;
}

if (asJson) {
  const payload = all
    ? { mode: 'all', hits: scanAllPaths() }
    : { mode: 'needles', needles, hits: scanNeedles() };
  console.log(JSON.stringify(payload, null, 2));
} else if (all) {
  const hits = scanAllPaths();
  const broken = hits.filter((h) => !h.ok);
  console.log(
    `🔎 扫描根之外的**源码路径引用**盘点｜共 ${hits.length} 处（去重后）· 断链 ${broken.length} 处`,
  );
  if (broken.length) {
    console.log('\n❌ 断链（该路径解析不到真实文件/目录）：');
    for (const h of broken) console.log(`   ${h.file}:${h.line} → ${h.path}`);
  } else {
    console.log('\n  ✅ 无断链');
  }
  console.log('\n用途：改名/移位**前后各跑一次**，断链集合**只许减少、不许新增**。');
} else {
  const hits = scanNeedles();
  console.log(`🔎 扫描根之外的活引用｜片段：${needles.join(' / ')}｜命中 ${hits.length} 处`);
  const byFile = new Map();
  for (const h of hits) {
    if (!byFile.has(h.file)) byFile.set(h.file, []);
    byFile.get(h.file).push(h);
  }
  for (const [f, hs] of byFile) {
    console.log(`\n  ${f}（${hs.length} 处）`);
    for (const h of hs) console.log(`    :${h.line}  ${h.text}`);
  }
  if (!hits.length) {
    console.log('\n  ✅ 0 命中 —— 若这是"改名后复跑旧片段"，即表示**外部引用已同步干净**。');
  }
  console.log('\n判据：改前跑旧片段记清单 → 改后用**同一旧片段**复跑 → 命中必须为 0（非 0 = 漏同步）。');
}
process.exit(0);
