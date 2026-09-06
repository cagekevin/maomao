#!/usr/bin/env node
/**
 * dep-audit.cjs — 《Mac 依赖适配 5 步法》的对账脚本
 *
 * 作用：把「磁盘实况」与「Mac依赖适配5步法.md §4 依赖台账」对账，找出四类问题：
 *   ① 漏记  —— 磁盘装了依赖，台账里没有
 *   ② 幽灵  —— 台账记了，磁盘上已经没了
 *   ③ 混用  —— 同一项目同时存在 npm 与 pnpm 锁文件
 *   ④ 该归档 —— 超过 N 天没动过的依赖目录
 *
 * 只读保证：本脚本不写任何文件、不删任何目录、不修改台账。所有结论交给用户决定。
 *
 * 用法：node .codebuddy/commands/dep-audit.cjs
 *      DEP_STALE_DAYS=60 node .codebuddy/commands/dep-audit.cjs   # 自定义归档阈值
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const HOME = os.homedir();
const SCRIPT_DIR = __dirname;
const LEDGER_FILE = path.join(SCRIPT_DIR, 'Mac依赖适配5步法.md');
const STALE_DAYS = Number(process.env.DEP_STALE_DAYS || 90);
const MAX_DEPTH = Number(process.env.DEP_MAX_DEPTH || 4);
const ROOTS = (process.env.DEP_ROOTS || `${HOME}/Documents,${HOME}/Downloads`)
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean);

// node_modules / .venv / venv 都算依赖目录；命中后不再深入（剪枝）
const MARKERS = ['node_modules', '.venv', 'venv'];
const PRUNE = new Set(['.git', 'Library', 'Applications', '.Trash', '.cache']);
const DAY = 86400000;

const expand = (p) => (p.startsWith('~') ? path.join(HOME, p.slice(1)) : p);
const isDepDir = (name) => MARKERS.includes(name);

function dirSizeMB(dir) {
  try {
    const out = execFileSync('du', ['-sm', dir], { encoding: 'utf8' });
    return Number(out.trim().split(/\s+/)[0]) || 0;
  } catch {
    return 0;
  }
}

function safeStat(p) {
  try {
    return fs.statSync(p);
  } catch {
    return null;
  }
}

/** 扫描磁盘上的依赖目录（命中即剪枝，不进 node_modules 内部） */
function scanDisk() {
  const found = [];
  const walk = (dir, depth) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (PRUNE.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (isDepDir(e.name)) {
        const st = safeStat(full);
        found.push({
          path: full,
          marker: e.name,
          sizeMB: dirSizeMB(full),
          mtime: st ? st.mtime.getTime() : 0,
        });
        continue; // 剪枝
      }
      if (depth < MAX_DEPTH) walk(full, depth + 1);
    }
  };
  for (const root of ROOTS) walk(root, 1);
  return found;
}

/** 从 MD 台账解析出「项目名 -> 绝对路径」 */
function parseLedger() {
  if (!fs.existsSync(LEDGER_FILE)) {
    console.error(`[错误] 找不到台账文件：${LEDGER_FILE}`);
    process.exit(1);
  }
  const md = fs.readFileSync(LEDGER_FILE, 'utf8');
  // 只取「第 4 层」到下一个标题之间的表格，避免把第 5 层磁盘守护表误当台账
  const section = (md.split(/###\s*##\s*第\s*4\s*层/)[1] || '').split(/\n###\s*##|\n---/)[0];
  const rows = section
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|'))
    .map((l) => l.split('|').map((c) => c.trim()))
    .filter((cols) => cols.length > 4)
    .slice(2) // 去掉表头 + 分隔行
    .filter((cols) => !/^-+$/.test(cols[2]));

  const out = [];
  for (const cols of rows) {
    const name = cols[1];
    const rawPath = (cols[2] || '').replace(/`/g, '').trim();
    // 路径列必须以 ~ 或 / 或字母/开头，且含分隔符——用来滤掉误匹配的非台账表格
    if (!rawPath || rawPath === '—' || !/^[~/.]|\w+\//.test(rawPath)) continue;
    out.push({
      name,
      path: path.resolve(expand(rawPath)),
      size: (cols[7] || '').trim(), // 「磁盘」列
      status: (cols[9] || '').trim(), // 「状态」列
    });
  }
  return out;
}

/** 返回归属：exact / 子包 owner / null */
function findOwner(depPath, ledger) {
  let exact = null;
  let sub = null;
  for (const e of ledger) {
    if (depPath === path.join(e.path, path.basename(depPath)) && dirnameMatches(depPath, e.path)) {
      exact = e;
    } else if (depPath.startsWith(e.path + path.sep)) {
      if (!sub || e.path.length > sub.path.length) sub = e;
    }
  }
  return { exact, sub };
}

function dirnameMatches(depPath, projectPath) {
  return path.dirname(depPath) === projectPath;
}

function detectLockConflict(depPath) {
  const root = path.dirname(depPath);
  const has = (f) => fs.existsSync(path.join(root, f));
  const locks = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'].filter(has);
  return locks.length > 1 ? { root, locks } : null;
}

function fmtDate(ts) {
  if (!ts) return '未知';
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function age_days(ts) {
  return Math.floor((Date.now() - ts) / DAY);
}

// ---------------- 主流程 ----------------
const ledger = parseLedger();
const found = scanDisk();
const now = Date.now();

const missing = []; // 漏记
const stale = []; // 该归档
const conflicts = [];
const matched = new Set();
const subs = [];

for (const dep of found) {
  const { exact, sub } = findOwner(dep.path, ledger);
  const c = detectLockConflict(dep.path);
  if (c) conflicts.push(c);

  if (exact) {
    matched.add(exact.path);
  } else if (sub) {
    matched.add(sub.path);
    subs.push({ dep, owner: sub });
  } else {
    missing.push(dep);
  }

  if (dep.mtime && age_days(dep.mtime) >= STALE_DAYS) {
    stale.push({ dep, owner: exact || sub });
  }
}

// 「未装 / 待施工」本就无依赖目录；「已归档 / 已销毁」是主动删的——都不是幽灵
const ghosts = ledger.filter(
  (e) =>
    !matched.has(e.path) && !/未装|待施工|^-+$/.test(e.size) && !/已归档|已销毁/.test(e.status),
);

// ---------------- 输出 ----------------
const line = (s = '') => console.log(s);
line();
line('══════════ 依赖台账对账报告 ══════════');
line(`扫描范围：${ROOTS.join(', ')}（深度 ≤ ${MAX_DEPTH}）`);
line(`台账条目：${ledger.length}   磁盘依赖目录：${found.length}`);
line(`归档阈值：${STALE_DAYS} 天未改动`);
line();

line(`【① 漏记 —— 磁盘已装，台账没有】 ${missing.length} 项`);
if (!missing.length) line('  ✅ 无');
for (const d of missing) {
  line(`  ⚠️  ${d.path}`);
  line(
    `      ${d.marker} · ${d.sizeMB} MB · 最后改动 ${fmtDate(d.mtime)}（${age_days(d.mtime)} 天前）`,
  );
}
line();

line(`【② 幽灵 —— 台账记了，磁盘已无】 ${ghosts.length} 项`);
if (!ghosts.length) line('  ✅ 无');
for (const g of ghosts) line(`  👻 ${g.name}  ${g.path}  → 建议改状态为「已归档」`);
line();

line(`【③ 混用 —— 同一项目多份锁文件】 ${conflicts.length} 项`);
if (!conflicts.length) line('  ✅ 无');
for (const c of conflicts) line(`  ❌ ${c.root}\n      ${c.locks.join('  +  ')}`);
line();

line(`【④ 该归档 —— ≥ ${STALE_DAYS} 天未动】 ${stale.length} 项`);
if (!stale.length) line('  ✅ 无');
for (const s of stale) {
  line(`  📦 ${s.dep.path}`);
  line(
    `      ${s.dep.sizeMB} MB · 最后改动 ${fmtDate(s.dep.mtime)}（${age_days(s.dep.mtime)} 天前）· 归属 ${s.owner ? s.owner.name : '未登记'}`,
  );
}
line();

if (subs.length) {
  line(`【附属子包 —— 归属已登记项目的子目录】 ${subs.length} 项`);
  for (const s of subs) line(`  └─ ${s.dep.path}  (${s.dep.sizeMB} MB) → ${s.owner.name}`);
  line();
}

line('【全局共享仓库】（唯一，所有项目共用，勿删）');
for (const [label, dir] of [
  ['uv cache', `${HOME}/.cache/uv`],
  ['pnpm store', `${HOME}/Library/pnpm/store`],
]) {
  line(`  ${label.padEnd(12)} ${fs.existsSync(dir) ? dirSizeMB(dir) + ' MB' : '不存在'}  ${dir}`);
}
line();
line('⚠️  口径说明：体积为 du 读数，APFS 克隆/硬链接会重复计逻辑大小，只能用于排序，');
line('    不能当作真实磁盘占用。判断是否重复请用 df 剩余空间差值。');
line('══════════════════════════════════════');
line();
