import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as babel from '@babel/parser';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = __dirname;
const SRC = join(root, 'src');
const TESTS = join(root, 'tests');

const SOURCE_EXTS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];

function toPosix(p) { return p.replace(/\\/g, '/'); }
// 显示用：相对仓库根（保留 src/ 前缀，便于人读）
function relOf(abs) { return toPosix(abs.slice(root.length).replace(/^[/\\]/, '')); }

// 域归属：基于绝对路径匹配，避免 relOf 基准错位
function domainOf(fileAbs) {
  const r = toPosix(fileAbs);
  if (r.includes('/tests/') || r.endsWith('/tests')) return 'tests';
  const mc = r.match(/\/src\/components\/([^/]+)\//);
  if (mc) return mc[1];                 // 叶子域：panels / editor / agent / base / ...
  const mh = r.match(/\/src\/(hooks)\//);
  if (mh) return 'hooks';
  if (r.includes('/src/base/')) return 'base';
  if (r.includes('/src/')) return 'app';
  return 'app';
}

function resolveSourceFile(abs) {
  if (!abs) return null;
  try { if (statSync(abs).isFile()) return abs; } catch {}
  const ext = extname(abs);
  const stem = SOURCE_EXTS.includes(ext) ? abs.slice(0, abs.length - ext.length) : abs;
  for (const e of SOURCE_EXTS) { const c = stem + e; if (existsSync(c) && statSync(c).isFile()) return c; }
  for (const e of SOURCE_EXTS) { const c = join(abs, 'index' + e); if (existsSync(c)) return c; }
  return null;
}

function resolveSpec(spec, fromFile) {
  const fromDir = dirname(fromFile);
  if (spec.startsWith('.')) return resolve(fromDir, spec);
  if (spec.startsWith('@/')) return resolve(root, 'src', spec.slice(2)); // A10 修正口径：相对仓库根
  if (spec.startsWith('/')) return resolve(SRC, spec.slice(1));
  return null;
}

function collectFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    let st; try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) collectFiles(full, acc);
    else if (SOURCE_EXTS.includes(extname(name))) acc.push(full);
  }
  return acc;
}

function extractSpecs(code) {
  const specs = new Set();
  try {
    const ast = babel.parse(code, { sourceType: 'unambiguous', plugins: ['jsx', 'typescript', 'decorators-legacy'], errorRecovery: true });
    const walk = (n) => {
      if (!n) return;
      if (Array.isArray(n)) { n.forEach(walk); return; }
      if (n.type === 'ImportDeclaration' && n.source) specs.add(n.source.value);
      else if ((n.type === 'ExportNamedDeclaration' || n.type === 'ExportAllDeclaration') && n.source) specs.add(n.source.value);
      else if (n.type === 'CallExpression') {
        const isReq = n.callee.type === 'Identifier' && n.callee.name === 'require';
        const isDI = n.callee.type === 'Import';
        if ((isReq || isDI) && n.arguments.length && n.arguments[0].type === 'StringLiteral') specs.add(n.arguments[0].value);
      }
      for (const k in n) if (typeof n[k] === 'object' && n[k] !== null && k !== 'loc' && k !== 'range') walk(n[k]);
    };
    walk(ast.program);
  } catch {}
  return [...specs];
}

// Build full import graph: file -> set of resolved targets
const allFiles = [...collectFiles(SRC), ...collectFiles(TESTS)];
const reverse = new Map(); // target -> Set(file)
function addEdge(from, to) {
  if (!reverse.has(to)) reverse.set(to, new Set());
  reverse.get(to).add(from);
}

for (const f of allFiles) {
  let code; try { code = readFileSync(f, 'utf8'); } catch { continue; }
  for (const spec of extractSpecs(code)) {
    const abs = resolveSpec(spec, f);
    if (!abs) continue;
    const t = resolveSourceFile(abs);
    if (!t || t === f) continue;
    addEdge(f, t);
  }
}

// Transitive reverse-reachability: all upstream importers of F (including via barrels)
function transitiveConsumers(F) {
  const seen = new Set([F]);
  const stack = [F];
  while (stack.length) {
    const cur = stack.pop();
    const ups = reverse.get(cur);
    if (!ups) continue;
    for (const u of ups) {
      if (!seen.has(u)) { seen.add(u); stack.push(u); }
    }
  }
  seen.delete(F);
  return [...seen];
}

const basename = (p) => { const s = p.split(/[\\/]/); return s[s.length - 1]; };
const candidateDirs = ['components/base/core', 'components/base/utils', 'components/base/ui', 'components/base/api', 'components/base/storage'];
const results = [];
for (const cd of candidateDirs) {
  const dir = join(SRC, cd);
  if (!existsSync(dir)) { console.log(`(跳过不存在目录: ${cd})`); continue; }
  for (const f of collectFiles(dir)) {
    if (basename(f) === 'index.ts' || basename(f) === 'index.tsx') continue; // skip barrels
    const consumers = transitiveConsumers(f);
    const domains = new Map();
    for (const c of consumers) {
      const d = domainOf(c);
      if (d === 'base' || d === 'app' || d === 'tests') continue; // 仅看叶子域
      if (!domains.has(d)) domains.set(d, []);
      domains.get(d).push(relOf(c));
    }
    if (domains.size === 1) {
      const [dom, list] = [...domains.entries()][0];
      results.push({ file: relOf(f), singleDomain: dom, count: list.length, examples: list.slice(0, 8) });
    }
  }
}

results.sort((a, b) => a.file.localeCompare(b.file));
console.log(`=== ADR-0040 L4 全量扫：base/{core,utils,ui,api,storage} 中被【恰好一个叶子域】传递消费的跨切件 ===`);
console.log(`TOTAL: ${results.length}\n`);
for (const r of results) {
  console.log(`• ${r.file}`);
  console.log(`    singleDomain=${r.singleDomain}  consumerFiles=${r.count}`);
  console.log(`    e.g. ${r.examples.join(', ')}`);
}
