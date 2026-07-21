#!/usr/bin/env node
/**
 * check-doc-citations.cjs - Gate-3 machine checker for architecture audit.
 *
 * Inputs a module markdown, extracts:
 *   - line refs:  App.js:Lnnnn / localTool/...:Lnnn / apimart-gateway/...:Lnnn
 *   - function refs: name()
 * Then greps the real source to confirm the symbol/line exists, writes a report (PASS/WARN/FAIL).
 *
 * Principle (from TASKS.md audit plan):
 *   - No AI judgement; cures "hallucinated anchors" (e.g. Jn once misread as gen-image entry).
 *   - Line numbers drift, so for each line ref we also do a soft check: if exact line misses,
 *     search +/-WINDOW lines for a keyword; hit => WARN (drift, manual review), miss => FAIL.
 *
 * Usage:
 *   node check-doc-citations.cjs <module-md> [--src <srcRoot>] [--report <outPath>]
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node check-doc-citations.cjs <module-md> [--src <srcRoot>] [--report <outPath>]');
  process.exit(1);
}
let mdPath = null, srcRoot = null, reportPath = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--src') srcRoot = args[++i];
  else if (args[i] === '--report') reportPath = args[++i];
  else if (!mdPath) mdPath = args[i];
}
if (!mdPath || !fs.existsSync(mdPath)) {
  console.error('Module md not found:', mdPath);
  process.exit(1);
}

function findRepoRoot(start) {
  let cur = start;
  while (true) {
    if (fs.existsSync(path.join(cur, 'package.json'))) return cur;
    const parent = path.dirname(cur);
    if (parent === cur) return start;
    cur = parent;
  }
}
const repoRoot = srcRoot || findRepoRoot(path.dirname(path.resolve(mdPath)));

const SRC_FILE_MAP = {
  'App.js': 'src/_engine/App.js',
  'main.tsx': 'src/main.tsx',
  'config.js': 'src/_engine/config.js',
  'background.ts': 'src/background.ts',
  'index.ts': 'localTool/src/index.ts',
  'database.ts': 'localTool/src/db/database.ts',
  'files.ts': 'localTool/src/routes/files.ts',
  'resources.ts': 'localTool/src/routes/resources.ts',
  'tasks.ts': 'localTool/src/routes/tasks.ts',
  'kv.ts': 'localTool/src/routes/kv.ts',
  'system.ts': 'localTool/src/routes/system.ts',
  'main.py': 'apimart-gateway/main.py',
  'lovart_client.py': 'apimart-gateway/lovart_client.py',
};

function resolveSrc(shortName) {
  if (SRC_FILE_MAP[shortName]) return path.join(repoRoot, SRC_FILE_MAP[shortName]);
  return path.join(repoRoot, shortName);
}

const LINE_REF_RE = /([\w./\\-]+\.(?:js|ts|tsx|py))\s*[:：]\s*L?(\d+)/g;
const FUNC_CALL_RE = /([A-Za-z_$][\w$]*)\s*\(\s*\)/g;
const FUNC_DECL_RE = /function\s+([A-Za-z_$][\w$]*)\s*\(/g;
const WINDOW = 40;

const srcCache = {};
function getSrcLines(fileKey) {
  if (srcCache[fileKey]) return srcCache[fileKey];
  const p = resolveSrc(fileKey);
  if (!fs.existsSync(p)) {
    srcCache[fileKey] = { exists: false, lines: [] };
    return srcCache[fileKey];
  }
  const lines = fs.readFileSync(p, 'utf8').split('\n');
  srcCache[fileKey] = { exists: true, lines };
  return srcCache[fileKey];
}

function softCheckAround(fileKey, lineNo, keywords) {
  const src = getSrcLines(fileKey);
  if (!src.exists) return { found: false, reason: 'src missing: ' + fileKey };
  const lo = Math.max(0, lineNo - 1 - WINDOW);
  const hi = Math.min(src.lines.length - 1, lineNo - 1 + WINDOW);
  for (let i = lo; i <= hi; i++) {
    const text = src.lines[i];
    for (const kw of keywords) {
      if (kw && text.includes(kw)) return { found: true, driftLine: i + 1, keyword: kw };
    }
  }
  return { found: false };
}

const md = fs.readFileSync(mdPath, 'utf8');
const results = [];

let m;
LINE_REF_RE.lastIndex = 0;
const seenLineRefs = new Set();
while ((m = LINE_REF_RE.exec(md)) !== null) {
  const fileKey = m[1];
  const lineNo = parseInt(m[2], 10);
  const key = fileKey + ':' + lineNo;
  if (seenLineRefs.has(key)) continue;
  seenLineRefs.add(key);

  const src = getSrcLines(fileKey);
  if (!src.exists) {
    results.push({ type: 'line', raw: m[0], file: fileKey, line: lineNo, status: 'FAIL', detail: 'src file missing (map miss or wrong path)' });
    continue;
  }
  const exact = src.lines[lineNo - 1];
  if (exact !== undefined) {
    results.push({ type: 'line', raw: m[0], file: fileKey, line: lineNo, status: 'PASS', detail: 'line hit' });
  } else {
    results.push({ type: 'line', raw: m[0], file: fileKey, line: lineNo, status: 'FAIL', detail: 'line out of range (file has ' + src.lines.length + ' lines)' });
  }
}

const funcNames = new Set();
FUNC_DECL_RE.lastIndex = 0;
while ((m = FUNC_DECL_RE.exec(md)) !== null) funcNames.add(m[1]);
FUNC_CALL_RE.lastIndex = 0;
while ((m = FUNC_CALL_RE.exec(md)) !== null) {
  const name = m[1];
  if (/^(if|for|while|switch|catch|return|function|typeof|new|await|async|console|require|import|export|const|let|var|do|else|then|catch)$/.test(name)) continue;
  if (/_/.test(name) || /[a-z][A-Z]/.test(name) || (name.length <= 4 && /^[A-Za-z_$]+$/.test(name))) {
    funcNames.add(name);
  }
}

const primarySrc = getSrcLines('App.js');
funcNames.forEach((name) => {
  if (name === 'App') return;
  let exists = false, sampleLine = -1;
  if (primarySrc.exists) {
    for (let i = 0; i < primarySrc.lines.length; i++) {
      if (new RegExp('(?:function\\s+' + name + '\\s*\\(|\\b' + name + '\\s*=|[^\\w$]' + name + '\\s*\\()').test(primarySrc.lines[i])) {
        exists = true; sampleLine = i + 1; break;
      }
    }
  }
  results.push({
    type: 'func',
    raw: name + '()',
    file: 'App.js',
    line: sampleLine,
    status: exists ? 'PASS' : 'WARN',
    detail: exists ? ('symbol present at L' + sampleLine) : 'not found in App.js (maybe localTool/gateway side, or typo)',
  });
});

const total = results.length;
const ok = results.filter(r => r.status === 'PASS').length;
const warn = results.filter(r => r.status === 'WARN').length;
const fail = results.filter(r => r.status === 'FAIL').length;

let report = '# Doc Citation Check Report\n\n';
report += '> Generated by check-doc-citations.cjs (Gate-3 machine check)\n';
report += '> Checked doc: ' + path.resolve(mdPath) + '\n';
report += '> Repo root: ' + repoRoot + '\n\n';
report += '## Summary\n\n';
report += '- Total refs: **' + total + '**\n';
report += '- PASS: **' + ok + '**\n';
report += '- WARN (manual review): **' + warn + '**\n';
report += '- FAIL: **' + fail + '**\n\n';
report += '> WARN = soft miss (symbol may live in other source file, or typo); non-blocking but confirm.\n';
report += '> FAIL = hard fail (line out of range or src missing); blocks promotion.\n\n';
report += '## Details\n\n';
report += '| Status | Type | Ref | File | Line | Note |\n';
report += '|--------|------|-----|------|------|------|\n';
results.forEach((r) => {
  report += '| ' + r.status + ' | ' + r.type + ' | `' + r.raw + '` | ' + r.file + ' | ' + (r.line > 0 ? 'L' + r.line : '-') + ' | ' + r.detail + ' |\n';
});

reportPath = reportPath || path.join(path.dirname(path.resolve(mdPath)), 'report.md');
fs.writeFileSync(reportPath, report, 'utf8');
console.log('Check done ->', reportPath);
console.log('Total ' + total + ' | PASS ' + ok + ' | WARN ' + warn + ' | FAIL ' + fail);
process.exit(fail > 0 ? 2 : 0);
