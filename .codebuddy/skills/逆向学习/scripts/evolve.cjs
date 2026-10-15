/**
 * evolve.cjs — 「逆向学习」技能经验库的写入工具（自我进化里的机械活）
 *
 * 只做机械动作：唯一键去重、ID 编号、命中次数累加、晋升标记、归档、统计。
 * **判断（是不是坑、值不值得晋升）必须由人 / Agent 做，脚本不替你思考。**
 *
 * 只写 references/evolution/lessons.md（archive 会另写 archive/lessons-<yyyy>.md）。
 * 机制说明见 references/evolution/overview.md。
 *
 * 用法：
 *   node evolve.cjs list [--status 新增] [--branch B]
 *   node evolve.cjs add --key <唯一键> --branch <A|B|C|D|G> --type <坑|工具|判据|分支缺口|反模式> \
 *        --symptom "现象" --cause "根因" --fix "修法" [--confidence <确证|推断|待验证>] [--date YYYY-MM-DD]
 *   node evolve.cjs hit     --key <唯一键>
 *   node evolve.cjs promote --key <唯一键> --target references/bundle/xxx.md
 *   node evolve.cjs archive
 *   node evolve.cjs stats
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LESSONS = path.join(ROOT, 'references', 'evolution', 'lessons.md');
const ARCHIVE_DIR = path.join(ROOT, 'references', 'evolution', 'archive');

const HEADER_ID = '| ID |';
const COLUMNS = 11; // ID 日期 分支 类型 唯一键 现象 根因 修法 置信度 命中次数 状态
const BRANCHES = ['A', 'B', 'C', 'D', 'G'];
const TYPES = ['坑', '工具', '判据', '分支缺口', '反模式'];
const CONFIDENCES = ['确证', '推断', '待验证'];

function die(msg) {
  console.error('❌ ' + msg);
  process.exit(1);
}
function ok(msg) {
  console.log('✅ ' + msg);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        out[k] = next;
        i++;
      } else {
        out[k] = true;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

/** 单元格净化：禁止换行和裸 `|`（会破坏表格列数） */
function sanitize(s) {
  return String(s == null ? '' : s)
    .replace(/\r?\n/g, ' ')
    .replace(/\|/g, '｜')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 唯一键归一化：比较时一律剥掉反引号，避免 `key` 与 key 被当成两个键 */
function normKey(s) {
  return sanitize(s).replace(/`/g, '');
}

/** 唯一键落表格式：统一带反引号，便于阅读 */
function fmtKey(s) {
  const k = normKey(s);
  return k ? '`' + k + '`' : '';
}

function normConfidence(c) {
  if (!c || c === true) return '[推断]';
  const v = String(c).replace(/[[\]]/g, '').trim();
  if (!CONFIDENCES.includes(v)) die(`--confidence 只能是 ${CONFIDENCES.join(' / ')}，收到：${c}`);
  return `[${v}]`;
}

function normBranch(b) {
  const v = String(b || 'G').toUpperCase();
  if (!BRANCHES.includes(v)) die(`--branch 只能是 ${BRANCHES.join(' / ')}，收到：${b}`);
  return v;
}

function normType(t) {
  const v = String(t || '坑').trim();
  if (!TYPES.includes(v)) die(`--type 只能是 ${TYPES.join(' / ')}，收到：${t}`);
  return v;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function readLessons() {
  if (!fs.existsSync(LESSONS)) die(`找不到经验库：${LESSONS}`);
  return fs.readFileSync(LESSONS, 'utf8').split(/\r?\n/);
}

function writeLessons(lines) {
  fs.writeFileSync(LESSONS, lines.join('\n'), 'utf8');
}

/** 定位活跃条目表：表头行 + 分隔行 + 连续数据行 */
function locateTable(lines) {
  const head = lines.findIndex((l) => l.trim().startsWith(HEADER_ID));
  if (head < 0) die('经验库缺少表头行「| ID | 日期 | ...」，无法解析');
  let end = head + 2;
  while (end < lines.length && lines[end].trim().startsWith('|')) end++;
  return { head, end };
}

function parseTable(lines) {
  const { head, end } = locateTable(lines);
  const rows = [];
  for (let i = head + 2; i < end; i++) {
    const cells = lines[i]
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length !== COLUMNS || !/^L-\d+$/.test(cells[0])) continue;
    rows.push({ index: i, cells });
  }
  return { head, end, rows };
}

function buildRow(cells) {
  return '| ' + cells.join(' | ') + ' |';
}

function nextId(rows) {
  let max = 0;
  for (const r of rows) max = Math.max(max, parseInt(r.cells[0].slice(2), 10));
  return 'L-' + String(max + 1).padStart(4, '0');
}

function findRow(rows, key) {
  const k = normKey(key);
  const hit = rows.filter((r) => normKey(r.cells[4]) === k);
  if (hit.length === 0) die(`唯一键不存在：${k}（先 add，或核对拼写）`);
  if (hit.length > 1)
    die(
      `唯一键重复 ${hit.length} 次：${key} → ${hit.map((r) => r.cells[0]).join(', ')}（手动合并后重试）`,
    );
  return hit[0];
}

function warnIfUnverifiable(cells) {
  if (cells[8] === '[待验证]' && !/验证|核对|复现|check|test/i.test(cells[7])) {
    console.log(
      '⚠️  置信度 [待验证] 但「修法·判据」里没写验证方法 —— 请补上（见 overview.md 第 4 节）',
    );
  }
}

// ---------------------------------------------------------------- commands

function cmdAdd(args) {
  if (!args.key || args.key === true)
    die('add 需要 --key <唯一键>，形如 bundle/webcrack-native-code');
  const key = normKey(args.key);
  if (!key) die('--key 不能为空');
  const branch = normBranch(args.branch);
  const type = normType(args.type);
  const date = args.date && args.date !== true ? sanitize(args.date) : today();
  // 只在显式传入时才改置信度，避免「不加 --confidence 就把 [确证] 悄悄降级成 [推断]」
  const conf = args.confidence && args.confidence !== true ? normConfidence(args.confidence) : null;

  const lines = readLessons();
  const { head, rows } = parseTable(lines);

  const existing = rows.find((r) => normKey(r.cells[4]) === key);
  if (existing) {
    existing.cells[1] = date;
    if (conf) existing.cells[8] = conf;
    existing.cells[9] = String(Number(existing.cells[9] || 0) + 1);
    if (args.symptom) existing.cells[5] = sanitize(args.symptom);
    if (args.cause) existing.cells[6] = sanitize(args.cause);
    if (args.fix) existing.cells[7] = sanitize(args.fix);
    lines[existing.index] = buildRow(existing.cells);
    writeLessons(lines);
    ok(
      `命中已有条目 ${existing.cells[0]}（${key}）→ 命中次数 ${existing.cells[9]}；日期 / 置信度已更新`,
    );
    warnIfUnverifiable(existing.cells);
    console.log('   提示：同键命中 ≥2 次且复现，即达晋升条件（overview.md 第 5 节）。');
    return;
  }

  const cells = [
    nextId(rows),
    date,
    branch,
    type,
    fmtKey(key),
    sanitize(args.symptom),
    sanitize(args.cause),
    sanitize(args.fix),
    conf || '[推断]',
    '1',
    '新增',
  ];
  const insertAt = rows.length ? rows[rows.length - 1].index + 1 : head + 2;
  lines.splice(insertAt, 0, buildRow(cells));
  writeLessons(lines);
  ok(`新增条目 ${cells[0]}（${key}）已写入经验库`);
  warnIfUnverifiable(cells);
}

function cmdHit(args) {
  if (!args.key) die('hit 需要 --key <唯一键>');
  const key = normKey(args.key);
  const lines = readLessons();
  const { rows } = parseTable(lines);
  const row = findRow(rows, key);
  row.cells[1] = args.date && args.date !== true ? sanitize(args.date) : today();
  row.cells[9] = String(Number(row.cells[9] || 0) + 1);
  lines[row.index] = buildRow(row.cells);
  writeLessons(lines);
  ok(`命中次数 +1：${row.cells[0]}（${key}）→ ${row.cells[9]}`);
  if (Number(row.cells[9]) >= 2) {
    console.log(`   已达晋升判据（命中 ${row.cells[9]} 次）：确认复现后执行`);
    console.log(`   node scripts/evolve.cjs promote --key ${key} --target <目标文件>`);
  }
}

function cmdPromote(args) {
  if (!args.key) die('promote 需要 --key <唯一键>');
  if (!args.target || args.target === true)
    die('promote 需要 --target <目标文件，如 references/bundle/toolchain.md>');
  const key = normKey(args.key);
  const target = sanitize(args.target).replace(/\\/g, '/');
  const lines = readLessons();
  const { rows } = parseTable(lines);
  const row = findRow(rows, key);
  if (row.cells[10].startsWith('已晋升')) die(`${row.cells[0]} 已经是「${row.cells[10]}」`);
  row.cells[10] = `已晋升 → \`${target}\``;
  lines[row.index] = buildRow(row.cells);
  writeLessons(lines);
  ok(`${row.cells[0]}（${key}）状态 → ${row.cells[10]}`);
  console.log('   还剩三步（overview.md 第 5 节）：');
  console.log(`   1. 按目标文件的既有体例把这条经验写进 ${target}`);
  console.log('   2. 工具 / 命令类经验，考虑同时补进 commands.md 或 scripts/');
  console.log(
    '   3. 在 references/evolution/changelog.md 记一笔（版本 + 依据 lesson ID + 回滚点）',
  );
}

function cmdList(args) {
  const lines = readLessons();
  const { rows } = parseTable(lines);
  const status = args.status && args.status !== true ? sanitize(args.status) : null;
  const branch = args.branch && args.branch !== true ? sanitize(args.branch).toUpperCase() : null;
  let list = rows;
  if (status) list = list.filter((r) => r.cells[10].includes(status));
  if (branch) list = list.filter((r) => r.cells[2] === branch);

  if (list.length === 0) {
    console.log('（无匹配条目）');
    return;
  }
  console.log(`共 ${list.length} 条：`);
  for (const r of list) {
    const c = r.cells;
    const symptom = c[5].length > 40 ? c[5].slice(0, 40) + '…' : c[5];
    console.log(`  ${c[0]} [${c[2]}/${c[3]}] ${c[4]}  ${c[8]} ×${c[9]}  ${c[10]}`);
    console.log(`      ${symptom}`);
  }
}

function cmdStats() {
  const lines = readLessons();
  const { rows } = parseTable(lines);
  if (rows.length === 0) {
    console.log('（经验库为空）');
    return;
  }
  const group = (idx) => {
    const m = {};
    for (const r of rows) m[r.cells[idx]] = (m[r.cells[idx]] || 0) + 1;
    return m;
  };
  const fmt = (m) =>
    Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}=${v}`)
      .join('  ');
  const promoted = rows.filter((r) => r.cells[10].startsWith('已晋升')).length;
  const hot = rows.filter((r) => Number(r.cells[9]) >= 2).length;
  const unverified = rows.filter((r) => r.cells[8] === '[待验证]').length;

  console.log(`总条目 ${rows.length}`);
  console.log(`  按分支：${fmt(group(2))}`);
  console.log(`  按类型：${fmt(group(3))}`);
  console.log(`  已晋升 ${promoted} · 命中≥2（待晋升候选）${hot} · [待验证] ${unverified}`);
  if (rows.length > 80)
    console.log('⚠️  活跃条目已超 80 行：执行 node scripts/evolve.cjs archive 归档');
}

function cmdArchive() {
  const lines = readLessons();
  const { rows } = parseTable(lines);
  const dead = rows.filter((r) => /^已(归档|废弃)/.test(r.cells[10]));
  if (dead.length === 0) {
    console.log('（没有可归档的条目：状态需为 已归档 / 已废弃）');
    return;
  }
  fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  const file = path.join(ARCHIVE_DIR, `lessons-${new Date().getFullYear()}.md`);
  const header = fs.existsSync(file)
    ? ''
    : `# 经验库归档 ${new Date().getFullYear()}\n\n| ID | 日期 | 分支 | 类型 | 唯一键 | 现象 | 根因 | 修法·判据 | 置信度 | 命中次数 | 状态 |\n|---|---|---|---|---|---|---|---|---|---|---|\n`;
  const body = dead.map((r) => buildRow(r.cells)).join('\n') + '\n';
  fs.appendFileSync(file, header + body, 'utf8');

  const drop = new Set(dead.map((r) => r.index));
  writeLessons(lines.filter((_, i) => !drop.has(i)));
  ok(`已归档 ${dead.length} 条 → ${path.relative(ROOT, file).replace(/\\/g, '/')}`);
}

// ---------------------------------------------------------------- main

const USAGE = `evolve.cjs — 经验库写入工具

  node evolve.cjs list [--status 新增] [--branch B]
  node evolve.cjs add --key <唯一键> --branch <A|B|C|D|G> --type <坑|工具|判据|分支缺口|反模式> \\
       --symptom "现象" --cause "根因" --fix "修法" [--confidence <确证|推断|待验证>] [--date YYYY-MM-DD]
  node evolve.cjs hit     --key <唯一键>
  node evolve.cjs promote --key <唯一键> --target <目标文件>
  node evolve.cjs archive
  node evolve.cjs stats`;

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];

switch (cmd) {
  case 'add':
    cmdAdd(args);
    break;
  case 'hit':
    cmdHit(args);
    break;
  case 'promote':
    cmdPromote(args);
    break;
  case 'list':
    cmdList(args);
    break;
  case 'stats':
    cmdStats();
    break;
  case 'archive':
    cmdArchive();
    break;
  default:
    console.log(USAGE);
    if (cmd) die(`未知子命令：${cmd}`);
}
