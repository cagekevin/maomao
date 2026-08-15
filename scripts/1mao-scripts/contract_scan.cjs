'use strict';
// 契约扫描器：跨端字符串契约全量分布 + 漂移（漏改/多改）检测。
// 用法：
//   node scripts/contract_scan.cjs            # 校验模式：与基线快照比对，漂移即 FAIL
//   node scripts/contract_scan.cjs --resnap   # 重建基线快照（混淆重排后数量正常变化时用）
//   node scripts/contract_scan.cjs --md       # 额外输出 CONTRACTS.md 分布表（AI 改前查阅）
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..').replace(/\\/g, '/');
const DICT = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/contracts.json'), 'utf8'));
const SNAP_PATH = path.join(ROOT, 'scripts/contract_snapshot.json');
const CONTRACTS_MD = path.join(ROOT, 'CONTRACTS.md');

// 始终排除的目录/文件
const EXCLUDE = ['node_modules', 'dist', 'docs/逆向专用_ai 禁止读', 'symbol_map.json'];
function inExclude(p) {
  return EXCLUDE.some((e) => p.split('/').includes(e) || p.includes('/' + e + '/'));
}

// 在某 scope 内递归搜文件；scope 可为目录或单个文件
function listFiles(scope) {
  const dir = path.join(ROOT, scope);
  if (!fs.existsSync(dir)) return [];
  const out = [];
  let stat;
  try { stat = fs.statSync(dir); } catch { return []; }
  if (stat.isFile()) {
    if (/\.(js|jsx|ts|tsx|json|css|html)$/.test(scope)) out.push(dir.replace(/\\/g, '/'));
    return out;
  }
  const walk = (d) => {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = (d + '/' + e.name).replace(/\\/g, '/');
      if (inExclude(p)) continue;
      if (e.isDirectory()) walk(p);
      else if (/\.(js|jsx|ts|tsx|json|css|html)$/.test(e.name)) out.push(p);
    }
  };
  walk(dir);
  return out;
}

// 预读所有 scope 文件内容并缓存：scope -> {fileAbs: content}。
// 避免 buildSnapshot 逐条契约反复 readFileSync（src/bundle ~200 文件被读 N 次）。
const FILE_CACHE = {};
function loadScopeCache(scope) {
  if (FILE_CACHE[scope]) return FILE_CACHE[scope];
  const cache = {};
  for (const f of listFiles(scope)) {
    try { cache[f] = fs.readFileSync(f, 'utf8'); } catch { /* 忽略不可读文件 */ }
  }
  FILE_CACHE[scope] = cache;
  return cache;
}

// 统计一条契约在某 scope 内的命中（返回 {file: 次数}）；内容取自缓存，不做重复 IO
function scanContractInScope(contract, scope) {
  const cache = loadScopeCache(scope);
  const hit = {};
  for (const [f, content] of Object.entries(cache)) {
    let count = 0;
    for (const pat of contract.patterns) {
      if (pat.type === 'fixed') {
        let i = content.indexOf(pat.value);
        while (i !== -1) { count++; i = content.indexOf(pat.value, i + pat.value.length); }
      } else {
        const re = new RegExp(pat.value, 'g');
        const m = content.match(re);
        if (m) count += m.length;
      }
    }
    if (count > 0) hit[f.replace(ROOT + '/', '')] = count;
  }
  return hit;
}

// 跑全部契约，得到当前分布快照
function buildSnapshot() {
  const snap = {};
  for (const [id, c] of Object.entries(DICT.contracts)) {
    snap[id] = { desc: c.desc, severity: c.severity, scopes: c.scopes, hits: {}, total: 0 };
    for (const scope of c.scopes) {
      const h = scanContractInScope(c, scope);
      for (const [f, n] of Object.entries(h)) {
        snap[id].hits[f] = (snap[id].hits[f] || 0) + n;
      }
    }
    snap[id].total = Object.values(snap[id].hits).reduce((a, b) => a + b, 0);
  }
  return snap;
}

function loadSnapshot() {
  if (!fs.existsSync(SNAP_PATH)) return null;
  return JSON.parse(fs.readFileSync(SNAP_PATH, 'utf8'));
}

// ---- 模式分发 ----
const argv = process.argv.slice(2);
const resnap = argv.includes('--resnap');
const emitMd = argv.includes('--md') || resnap;
// isCli=false 时由 smoke 等 require 本模块后直接调用 run()，不触发 process.exit
const isCli = require.main === module;

// 可编程入口：返回 { pass, details }。pass=是否通过（校验模式漂移即 false）；
// details 为供上层展示的行数组。resnap/md 副作用仅在此执行。
function run() {
  const cur = buildSnapshot();

  if (resnap) {
    fs.writeFileSync(SNAP_PATH, JSON.stringify(cur, null, 2));
    console.log('✓ 基线快照已重建 → scripts/contract_snapshot.json');
    if (!emitMd) { if (isCli) process.exit(0); return { pass: true, details: ['基线已重建'] }; }
  }

  // 输出 CONTRACTS.md 分布表（AI 改契约前查阅）
  if (emitMd) {
    const lines = ['# CONTRACTS.md · 跨端字符串契约分布表', '',
      '> 自动生成（scripts/contract_scan.cjs --md）。改任一契约前先查此表，确认要动几个文件、哪个端；改完跑 `npm run contracts` 校验全端同步。',
      '> 当前快照基线时间见 scripts/contract_snapshot.json。', ''];
    lines.push('| 契约 | 严重度 | 总命中 | 文件分布（文件:次数） |');
    lines.push('|---|---|---|---|');
    for (const [id, s] of Object.entries(cur)) {
      const dist = Object.entries(s.hits).map(([f, n]) => `${f}(${n})`).join(' · ') || '—';
      lines.push(`| \`${id}\` | ${s.severity} | ${s.total} | ${dist} |`);
    }
    lines.push('');
    lines.push('## 各契约 scope 与含义');
    lines.push('');
    for (const [id, c] of Object.entries(DICT.contracts)) {
      lines.push(`- **${id}**：${c.desc}`);
      lines.push(`  - scope: ${c.scopes.join(', ')}`);
      lines.push(`  - 模式: ${c.patterns.map((p) => (p.type === 'fixed' ? `"${p.value}"` : `/${p.value}/`)).join(' | ')}`);
    }
    fs.writeFileSync(CONTRACTS_MD, lines.join('\n'));
    console.log('✓ 分布表已生成 → CONTRACTS.md');
  }

  if (resnap) { if (isCli) process.exit(0); return { pass: true, details: ['基线已重建'] }; }

  // ---- 校验模式：与基线比对 ----
  const base = loadSnapshot();
  const details = [];
  if (!base) {
    details.push('⚠ 无基线快照，先跑 `npm run contracts -- --resnap` 建基线。');
    if (isCli) { console.log(details[0]); process.exit(0); }
    return { pass: true, details };
  }

  let fail = false;
  const sevRank = { critical: 3, high: 2, medium: 1, low: 0 };
  details.push('=== 契约漂移检测（与基线 snapshot 比对）===');
  for (const [id, s] of Object.entries(cur)) {
    const b = base[id];
    if (!b) { details.push(`● ${id}  [新增契约, 基线无]`); continue; }
    const curTotal = s.total, baseTotal = b.total;
    const curFiles = s.hits, baseFiles = b.hits;
    const allFiles = new Set([...Object.keys(curFiles), ...Object.keys(baseFiles)]);
    const drift = [];
    for (const f of allFiles) {
      const c = curFiles[f] || 0, bf = baseFiles[f] || 0;
      if (c !== bf) drift.push(`${f}: 基线${bf} → 当前${c}`);
    }
    const changed = curTotal !== baseTotal || drift.length > 0;
    const mark = !changed ? 'PASS' : (sevRank[s.severity] >= 2 ? 'FAIL' : 'WARN');
    if (mark !== 'PASS') fail = fail || mark === 'FAIL';
    details.push(`● ${id}  [${s.severity}]  ${mark}`);
    details.push(`   命中: ${baseTotal} → ${curTotal}`);
    for (const d of drift) details.push('   漂移: ' + d);
    if (!changed) details.push('   无漂移 ✓');
  }
  details.push('=== 结果: ' + (fail ? 'DRIFT FAIL' : 'STABLE') + ' ===');
  if (isCli) {
    console.log(details.join('\n'));
    process.exit(fail ? 1 : 0);
  }
  return { pass: !fail, details };
}

if (isCli) run();

module.exports = { run, buildSnapshot };
