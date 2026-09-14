#!/usr/bin/env node
/**
 * 债务账本读写**唯一入口** —— 主表 `债务.md`（只留待办）+ 归档 `债务-归档.md`（已完成）。
 *
 * 【为什么存在】`债务.md` 原有 2 个手写点（`债务登记5步法` Step 4.2 追加 + `架构师改码7步法` Step 7.4 改状态），
 *   且两处都只规定"不删"、**没规定"改状态怎么改"** → 实测漂移：同 ID 两行（改状态被写成再追一行）、
 *   归类 **40+ 种写法**、`\|` 转义被误判 + 裸 `|` 撑破列致 14 行错位。收口判据（CLAUDE §5.4.9）：可写点 ≥2 且已漂移过 → 该收。
 *
 * 【机制：写入口，不是闸】`add`/`resolve` 在**落盘前**拒非法枚举 / 含 `|` 的摘要 / 不存在的锚点 —— 表单校验，
 *   **不挂 `gates.manifest.json`、不进 CI**（用户 2026-09-14 定调：写文档要的是**规范**，不是门禁）。
 *
 * 【活账 / 死账分离】`archive` 把已完成项移入 `债务-归档.md` → 主表只剩待办（实测 146KB/182 条 → 4.9KB/8 条）。
 *   读命令**默认跨两者**：查历史债用 `--all` / `--area` / `search`，不必手读归档文件。
 *
 * 【取号口径 = 主表 ∪ 归档】（2026-09-14 修复）`add` 的"区内 max 序号"与"区域名"都取自 `loadAll()`，
 *   与读命令**同一口径**；并在落盘前加**取号自检**（新 ID 已存在 → 拒写）。
 *   ⚠️ 旧实现只查主表 → 某区历史债**全部归档后** `maxN` 归零 → 下次登记必得 `TD-<NN>-1` 撞已归档 ID；
 *   又因 `loadAll()` 按 ID 去重（主表优先），撞号会**静默遮蔽**归档同名债 = 账本静默腐坏。
 *   实证：2026-09-14 02 区登记被误分配 `TD-02-1`/`TD-02-2`（均已于首轮存在并归档），区域名同时退化成裸 `02`。
 *   → 见 TD-17-2（已解决）。
 *
 * 【列错位为什么能无损解析】`line.split('|')` 与 `join('|')` 互逆：只要重新定出正确列边界，描述里的裸 `|`
 *   会被逐字还原。靠**四级校验**（标准 / A 尾部多余段 / B 右锚定 / C 左锚定状态起点），任一级不过就报 `manual`，**绝不猜**。
 *
 * 用法（读）：
 *   node scripts/debt.mjs list [--area 22] [--status 待还] [--class 增债] [--all] [--json]
 *     · 默认 = 主表待办；给了 `--area`/`--status`/`--class`/`--all` 之一 = **跨主表 + 归档**筛
 *   node scripts/debt.mjs area <NN>            # 某区**全部**历史债（含归档）—— 开审前查"这区以前查出过什么"
 *   node scripts/debt.mjs search <关键词> [--area 22]   # 跨区找同类问题（多词 AND）
 *   node scripts/debt.mjs show <TD-ID>         # 单条最新真相 + **解法入口**（锚点区域日志）
 *   node scripts/debt.mjs audit                # 只读体检（**不是闸**）
 * 用法（写 / 维护）：
 *   node scripts/debt.mjs add --area 22 --summary "…" [--class 增债] [--rate 中] [--owner 结构债]
 *                              [--anchor 22-视频-横切全量-2026-09-13.md] [--refs "@见 TD-xx"]
 *   node scripts/debt.mjs resolve <TD-ID> [--status 已解决] [--note "…"] [--date YYYY-MM-DD]
 *   node scripts/debt.mjs archive [--dry]
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LOG_DIR = join(ROOT, 'daily', '架构日志');
const LEDGER = join(LOG_DIR, '债务.md');
const ARCHIVE = join(LOG_DIR, '债务-归档.md');

// ─────────────────────────────────────────────────────────────────────────────
// 规范真源（唯一）：改枚举 = 改这里 + 两处流程文档，不得只改一处
// ─────────────────────────────────────────────────────────────────────────────
const CLASSES = ['还债', '持平', '增债'];
const RATES = ['高', '中', '低'];
const OWNERS = ['结构债', '业务债'];
const STATUS_WORDS = ['待还', '待用户拍板', '已解决', '已裁定非债', '已裁定', '待翻新', '已退役', '不做'];
const TODO_WORDS = ['待还', '待用户拍板', '待翻新'];
const DONE_WORDS = ['已解决', '已裁定', '已裁定非债', '已退役', '不做'];
const STATUS_RANK = { 待还: 1, 不做: 1, 待翻新: 2, 待用户拍板: 2, 已裁定: 3, 已裁定非债: 3, 已解决: 4 };
/** 历史写法 → 规范词（存量归一用；新登记不接受别名） */
const STATUS_ALIAS = { 已自纠: '已解决', 已办: '已解决', 已闭: '已解决', 已修: '已解决',
  '待 G5 接线': '待还', 待人工跑: '待还', 待回改: '待还', 待做: '待还', 部分完成: '待还', 迁入中: '待还' };
/** 归类别名（`→` 后是状态流转，取箭头前；"非债"是裁定不是归类 → 归持平） */
const CLASS_ALIASES = { '还债+持平': '还债', '还债（源头收敛·设计+重构）': '还债', '还基（规则修正）': '还债',
  '增债→还': '增债', '持平→已还': '持平', '持平→待翻新': '持平', '持平→待还': '持平', '持平→**保留分层**': '持平',
  '持平（**半成品**）': '持平', '持平（**M1 必需项缺位**）': '持平', '持平（**裁：推迟 M2**）': '持平',
  '增债→**不做**': '增债', '增债→**删**': '增债', '增债→**不建/复用**': '增债', '增债→**并入**': '增债',
  '增债→**建**': '增债', '增债→**已修**': '增债', '增债→**已办**': '增债', '增债→**升级**': '增债',
  '增债→**非债**': '持平', 非债: '持平', 设计观察: '持平', 待还: '持平', 累计: '增债' };
const RATE_ALIASES = { 中高: '高', '低-中': '中', '—': '低', '-': '低' };
/**
 * 本仓高频**母体词**同义表 —— 只用于 `search`：**精确匹配 0 命中时**才降级扩展（不牺牲精度）。
 * 目的：AI 想找"同类问题"时用的词与账本里写的词往往不同（搜"重复实现"而账本写"SSOT 第二份"）。
 */
const SYNONYMS = {
  SSOT: ['双真相', '第二份', '两份真相', '同语义两处', '两处维护', '重复实现', '两处实现', '同语义两实现', '抄成多份'],
  双真相: ['SSOT', '第二份', '两份'],
  静默: ['吞错', 'catch', '零日志', '不报错', '静默失败', '无信号', '吞掉', '无声'],
  吞错: ['静默', 'catch', '零日志'],
  假收窄: ['as any', 'as never', 'as unknown', '断言', '绕过类型'],
  死代码: ['0 引用', '零消费', '死导出', '死参数', '无人调用', '没用', '残留'],
  唯一入口: ['绕过', '旁路', '直调', '入口', '绕过入口'],
  兜底: ['回退', '降级', 'fallback', '退化', '兜底式'],
  假成功: ['伪装', '假绿', '谎报', '不报错'],
  注释漂移: ['描述漂移', '失实注释', '过时注释', 'stale'],
  漏网: ['未覆盖', '盲区', '回潮', '复发'],
};
/** 反向索引：值 → 所属键（让"搜表外的同义说法"也能扩展，如 `重复实现` → SSOT 全组） */
const SYN_REV = (() => { const m = {}; for (const [k, vs] of Object.entries(SYNONYMS)) for (const v of vs) (m[v.toLowerCase()] ??= []).push(k); return m; })();
/** 把一个搜索词扩展成同义组（键 + 双向） */
function expandWord(w) {
  const out = new Set([w]);
  for (const v of SYNONYMS[w] ?? []) out.add(v);
  for (const k of SYN_REV[w.toLowerCase()] ?? []) { out.add(k); for (const v of SYNONYMS[k]) out.add(v); }
  return [...out];
}

const MAP = {
  TD: { id: 0, area: 1, summary: 2, class: 3, rate: 4, status: 5, anchor: 6, cols: 7 },
  MD: { id: 0, summary: 1, class: 2, status: 3, anchor: 4, cols: 5 },
};
const TABLE_ROW = /^\|\s*\*{0,2}(TD|MD)-\d+-\d+/;
const ESC = '\u0001';

const today = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const stripBold = (s) => String(s ?? '').trim().replace(/^\*+|\*+$/g, '').trim();
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

// ─────────────────────────────────────────────────────────────────────────────
// 解析（含列错位四级校验）
// ─────────────────────────────────────────────────────────────────────────────
const isClassish = (s) => { const t = stripBold(s); return CLASSES.includes(t) || has(CLASS_ALIASES, t) || /^(还债|持平|增债)/.test(t); };
const isRateish = (s) => { const t = stripBold(s); return RATES.includes(t) || has(RATE_ALIASES, t) || /^[高中低]-?[高中低]/.test(t) || /^(高|中|低|—|-)/.test(t); };
const isStatusShape = (s) => /^\*{0,2}\[(已裁定非债|已解决|已裁定|待用户拍板|待翻新|已退役|待还|不做)/.test(String(s ?? '').trim());
const isAnchorish = (s) => /^\*{0,2}\[[^\]]*\]\([^)]*\)/.test(String(s ?? '').trim()) || stripBold(s) === '—';

/** 解析一行表格 → null | {broken} | {kind, parts, inner, fields, mode}；mode: ok/A/B/C/manual */
function readRow(line) {
  if (!TABLE_ROW.test(line)) return null;
  const kind = line.match(TABLE_ROW)[1];
  const parts = line.replace(/\\\|/g, ESC).split('|').map((x) => x.replaceAll(ESC, '\\|'));
  if (parts[0] !== '' || parts[parts.length - 1].trim() !== '') return { broken: true, kind, parts };
  const inner = parts.slice(1, -1);
  const C = MAP[kind];
  const fields = (arr) => ({ kind, id: stripBold(arr[C.id]), area: (arr[C.area] ?? '').trim(), summary: (arr[C.summary] ?? '').trim(),
    class: (arr[C.class] ?? '').trim(), rate: (arr[C.rate] ?? '').trim(), status: (arr[C.status] ?? '').trim(), anchor: (arr[C.anchor] ?? '').trim() });
  if (inner.length === C.cols) return { kind, parts, inner, fields: fields(inner), mode: 'ok' };
  const n = inner.length;
  if (kind !== 'TD' || n < C.cols) return { kind, parts, inner, fields: fields(inner), mode: 'manual' };
  // A：左端标准位置正确 + 尾部多段（同锚点被贴两次）
  if (isClassish(inner[3]) && isRateish(inner[4]) && isStatusShape(inner[5]) && inner.slice(6).every(isAnchorish)) {
    const fixed = [...inner.slice(0, 6), inner.slice(6).map((x) => x.trim()).filter(Boolean).join(' · ')];
    return { kind, parts, inner, fields: fields(fixed), mode: 'A', fixedInner: fixed };
  }
  // B：右锚定（末 4 段 = 归类 / 利率 / 状态 / 锚点）
  if (isClassish(inner[n - 4]) && isRateish(inner[n - 3]) && isStatusShape(inner[n - 2]) && isAnchorish(inner[n - 1])) {
    const fixed = [inner[0], inner[1], inner.slice(2, n - 4).join('|').trim(), inner[n - 4].trim(), inner[n - 3].trim(), inner[n - 2].trim(), inner[n - 1].trim()];
    return { kind, parts, inner, fields: fields(fixed), mode: 'B', fixedInner: fixed };
  }
  // C：左找"状态起点"（首个状态形状段）+ 右锚定锚点
  if (isAnchorish(inner[n - 1])) {
    for (let i = 4; i <= n - 2; i++) {
      if (!isStatusShape(inner[i]) || !isClassish(inner[i - 2]) || !isRateish(inner[i - 1])) continue;
      const status = inner.slice(i, n - 1).join('｜');
      if (!statusWord(status)) continue;
      const fixed = [inner[0], inner[1], inner.slice(2, i - 2).join('|').trim(), inner[i - 2].trim(), inner[i - 1].trim(), status.trim(), inner[n - 1].trim()];
      return { kind, parts, inner, fields: fields(fixed), mode: 'C', fixedInner: fixed };
    }
  }
  return { kind, parts, inner, fields: fields(inner), mode: 'manual' };
}

// ─────────────────────────────────────────────────────────────────────────────
// 枚举归一
// ─────────────────────────────────────────────────────────────────────────────
function normClass(v) {
  const s = stripBold(v);
  if (CLASSES.includes(s)) return { value: s };
  if (has(CLASS_ALIASES, s)) return { value: CLASS_ALIASES[s], from: String(v).trim() };
  const m = s.match(/^(还债|持平|增债)/);
  return m ? { value: m[1], from: String(v).trim() } : { unknown: true, value: s };
}
function normRate(v) {
  const raw = String(v ?? '').trim();
  if (!raw) return { value: '' };
  const s = stripBold(raw);
  if (RATES.includes(s)) return { value: s };
  if (has(RATE_ALIASES, s)) return { value: RATE_ALIASES[s], from: raw };
  if (/^[中高]-?[中高]|^中高/.test(s)) return { value: '高', from: raw };
  if (/^低-中|^中-低/.test(s)) return { value: '中', from: raw };
  const m = s.match(/^(高|中|低)/);
  return m ? { value: m[1], from: raw } : { unknown: true, value: s };
}
function normStatus(v) {
  const raw = String(v ?? '').trim();
  if (!raw) return { value: raw };
  const tail = raw.replace(/^\*{0,2}\[\*{0,2}/, '');
  for (const k of Object.keys(STATUS_ALIAS)) if (tail.startsWith(k)) return { value: `[${STATUS_ALIAS[k]}${tail.slice(k.length)}`, from: raw };
  if (isStatusShape(raw)) return { value: raw };
  const bare = stripBold(raw);
  const m = bare.match(/^(已裁定非债|已解决|已裁定|待用户拍板|待翻新|已退役|待还|不做)(.*)$/);
  if (m) return { value: `[${m[1]}${m[2]}]`, from: raw };
  if (STATUS_WORDS.includes(bare)) return { value: `[${bare}]`, from: raw };
  return { unknown: true, value: raw };
}
/** 状态词（先同义归一） */
function statusWord(status) {
  const m = normStatus(status).value.match(/^\*{0,2}\[(已裁定非债|已解决|已裁定|待用户拍板|待翻新|已退役|待还|不做)/);
  return m ? m[1] : '';
}
/** 状态列里的"一句注"（= 解法 / 裁定摘要），截断显示 */
function statusNote(status, max = 76) {
  const t = normStatus(status).value.replace(/\*\*/g, '');
  const m = t.match(/^\*{0,2}\[([^\]]+)\]/);
  const body = m ? m[1] : t;
  const note = body.replace(/^(已裁定非债|已解决|已裁定|待用户拍板|待翻新|已退役|待还|不做)\s*/, '').replace(/^\d{4}-\d{2}-\d{2}\s*/, '').replace(/^[·：:]\s*/, '');
  if (!note) return '';
  return note.length > max ? note.slice(0, max) + '…' : note;
}

// ─────────────────────────────────────────────────────────────────────────────
// 读取（主表 + 归档）
// ─────────────────────────────────────────────────────────────────────────────
function parseText(text, src) {
  const rows = [];
  text.split(/\r?\n/).forEach((line, li) => {
    const r = readRow(line);
    if (r && !r.broken) rows.push({ li, line, src, ...r });
  });
  return rows;
}
/** 主表（可写） */
function loadLedger() {
  const text = readFileSync(LEDGER, 'utf8');
  return { text, lines: text.split(/\r?\n/), rows: parseText(text, 'main') };
}
/** 主表 ∪ 归档（同 ID 主表优先 —— 主表是"活的"）。读命令一律用它。 */
function loadAll() {
  const main = readFileSync(LEDGER, 'utf8');
  const arch = existsSync(ARCHIVE) ? readFileSync(ARCHIVE, 'utf8') : '';
  const byId = new Map();
  for (const r of [...parseText(main, 'main'), ...parseText(arch, 'archive')]) if (!byId.has(r.fields.id)) byId.set(r.fields.id, r);
  return [...byId.values()];
}
const idNum = (id) => Number((id.match(/^TD-(\d+)-/) ?? [])[1] ?? -1);
const idSeq = (id) => Number((id.match(/^TD-\d+-(\d+)/) ?? [])[1] ?? 0);
const idKey = (id) => idNum(id) * 1000 + idSeq(id);
const SRC_TAG = (r) => (r.src === 'archive' ? '（归档）' : '');

// ─────────────────────────────────────────────────────────────────────────────
// 读命令
// ─────────────────────────────────────────────────────────────────────────────
function cmdList(argv) {
  const area = argVal(argv, '--area'), status = argVal(argv, '--status'), cls = argVal(argv, '--class'), rate = argVal(argv, '--rate');
  const json = argv.includes('--json'), all = argv.includes('--all'), archived = argv.includes('--archived');
  const rows = loadAll().filter((r) => r.fields.kind === 'TD');
  const filtered = !!(area || status || cls || rate || all || archived);
  let sel = rows;
  if (archived) sel = sel.filter((r) => r.src === 'archive');
  else if (!filtered) sel = sel.filter((r) => r.src === 'main' && TODO_WORDS.includes(statusWord(r.fields.status)));
  if (area) sel = sel.filter((r) => idNum(r.fields.id) === Number(area));
  if (status) sel = sel.filter((r) => statusWord(r.fields.status) === status);
  if (cls) sel = sel.filter((r) => normClass(r.fields.class).value === cls);
  if (rate) sel = sel.filter((r) => normRate(r.fields.rate).value === rate);
  sel.sort((a, b) => idKey(a.fields.id) - idKey(b.fields.id));

  if (json) { console.log(JSON.stringify(sel.map((r) => ({ ...r.fields, src: r.src, line: r.li + 1 })), null, 2)); return; }
  const scope = !filtered ? '主表待办' : archived ? '仅归档' : '主表 + 归档';
  console.log(`🔎 debt list ｜ ${scope} ｜ 命中 ${sel.length} 条（全档 ${loadAll().filter((r) => r.fields.kind === 'TD').length} · 主表 ${loadMainCount()}）`);
  if (!sel.length) { console.log('   （无匹配记录）'); return; }
  for (const r of sel) printRow(r);
  if (!filtered) console.log('   ↳ 查历史债加 `--all` / `--area <NN>` / `search <关键词>`（历史在 `债务-归档.md`，本命令已打通）');
}
const loadMainCount = () => loadLedger().rows.filter((r) => r.fields.kind === 'TD').length;

function cmdArea(argv) {
  const nn = argv.find((a) => !a.startsWith('--'));
  if (!nn) fail('用法：node scripts/debt.mjs area <NN>（如 area 22）');
  cmdList(['--area', nn, '--all']);
}

function cmdSearch(argv) {
  const kw = argv[0] && !argv[0].startsWith('--') ? argv[0] : argVal(argv, '--q');
  if (!kw) fail('用法：node scripts/debt.mjs search <关键词> [--area 22]（多词 = AND；精确无命中时自动同义词扩展）');
  const area = argVal(argv, '--area');
  const words = kw.split(/\s+/).filter(Boolean);
  let pool = loadAll().filter((r) => r.fields.kind === 'TD');
  if (area) pool = pool.filter((r) => idNum(r.fields.id) === Number(area));
  const hay = (r) => `${r.fields.id} ${r.fields.area} ${r.fields.summary} ${r.fields.status}`;
  let syn = false;
  let sel = pool.filter((r) => words.every((w) => hay(r).includes(w)));
  if (!sel.length) {
    syn = true;
    sel = pool.filter((r) => words.every((w) => expandWord(w).some((v) => hay(r).toLowerCase().includes(v.toLowerCase()))));
  }
  sel.sort((a, b) => idKey(a.fields.id) - idKey(b.fields.id));
  const inMain = sel.filter((r) => r.src === 'main').length;
  const ext = syn ? words.map((w) => { const e = expandWord(w).filter((x) => x !== w); return e.length ? `${w}〔≈ ${e.join(' / ')}〕` : w; }).join(' + ') : words.join(' + ');
  console.log(`🔎 debt search「${ext}」${area ? ` in 区 ${area}` : ''}${syn ? '［同义词扩展］' : ''} ｜ 命中 ${sel.length} 条（主表 ${inMain} · 归档 ${sel.length - inMain}）`);
  if (!sel.length) {
    console.log('   （无匹配）换个词试试：母体名（SSOT / 静默 / 假收窄 / 死代码 / 唯一入口 / 兜底 / 假成功 / 注释漂移）、');
    console.log('   症状（刷新 / 破图 / 丢输入 / 残留 / 回弹）、或文件名片段。');
    console.log('   兜底办法：`node scripts/debt.mjs area <NN>` 直接列该区全部历史债。');
    return;
  }
  for (const r of sel) printRow(r);
  console.log('   ↳ 某条的**完整解法（含被压缩掉的长决策）+ 证据入口**：`node scripts/debt.mjs show <TD-ID>`');
}

function printRow(r) {
  const f = r.fields;
  const note = statusNote(f.status);
  const sum = f.summary.length > 84 ? f.summary.slice(0, 84) + '…' : f.summary;
  console.log(`${f.id} ｜ ${f.area} ｜ [${statusWord(f.status) || '?'}]${SRC_TAG(r)} ${note ? '· ' + note : ''}`);
  console.log(`        ${normClass(f.class).value} / ${normRate(f.rate).value} ｜ ${sum}`);
}

function cmdShow(argv) {
  const id = argv.find((a) => /^TD-\d+-\d+|^MD-\d+-\d+/.test(a));
  if (!id) fail('用法：node scripts/debt.mjs show <TD-ID>');
  const hit = loadAll().filter((r) => r.fields.id === id);
  if (!hit.length) fail(`主表与归档中均无 ${id}`);
  for (const r of hit) {
    const f = r.fields;
    const warn = ['A', 'B', 'C'].includes(r.mode) ? ` · 列错位已自动解析（${r.mode}）` : r.mode === 'manual' ? ' · ⚠️ 列错位需人工' : '';
    console.log(`── ${f.id}${SRC_TAG(r)}${warn}`);
    console.log(`  状态   : [${statusWord(f.status)}]${f.status.replace(/^\*{0,2}\[[^\]]*\]/, '')}`);
    console.log(`  归类   : ${normClass(f.class).value}   利息率 : ${normRate(f.rate).value}   区域 : ${f.area ?? ''}`);
    console.log(`  现象   : ${f.summary}`);
    // 完整解法：从"全文归档"取该 ID 的原始行（账本压缩时丢掉的长决策都在那儿）
    const full = readFullArchive(id);
    const note = full?.fields.status ?? f.status;
    if (note) console.log(`  解法   : ${note}`);
    if (full?.fields.summary && full.fields.summary !== f.summary) console.log(`  现象·详: ${full.fields.summary}`);
    console.log(`  入口   : daily/架构日志/${f.anchor.replace(/^\**\[([^\]]+)\]\([^)]*\).*$/, '$1')}${isAnchorish(f.anchor) ? '' : '（锚点非标准形状，见原文）'}`);
    if (f.anchor && isAnchorish(f.anchor)) console.log(`           ↳ **下一跳**：该区域日志的「探债」段有最完整的决策、探针与证据（搜 \`${id}\`）`);
    if (full) console.log(`           ↳ 长叙述原文：daily/架构日志/债务-全文归档-2026-09-14.md（搜 \`${id}\`）`);
  }
}
/** 从"债务-全文归档-*.md"取某 ID 的原始行（完整长叙述/解法） */
function readFullArchive(id) {
  const f = readdirSync(LOG_DIR).find((n) => /^债务-全文归档-.*\.md$/.test(n));
  if (!f) return null;
  const raw = readFileSync(join(LOG_DIR, f), 'utf8').split(/\r?\n/).find((l) => l.includes(`| ${id} |`) || l.includes(`**${id}**`));
  if (!raw) return null;
  const r = readRow(raw);
  return r && !r.broken ? r : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 写命令（唯一写入者）
// ─────────────────────────────────────────────────────────────────────────────
function validate({ cls, rate, owner, summary, anchor }) {
  const errs = [];
  if (!CLASSES.includes(cls)) errs.push(`归类 \`${cls}\` 不在白名单 [${CLASSES.join(' / ')}]`);
  if (rate && !RATES.includes(rate)) errs.push(`利息率 \`${rate}\` 不在白名单 [${RATES.join(' / ')}]`);
  if (owner && !OWNERS.includes(owner)) errs.push(`归属 \`${owner}\` 不在白名单 [${OWNERS.join(' / ')}]`);
  if (!summary) errs.push('摘要为空');
  if (/[|｜]/.test(summary || '')) errs.push('摘要含竖线 → 用「／」代替（裸 `|` 会撑破表格列，本仓已有 14 行因此错位）');
  if (summary && summary.length > 120) errs.push(`摘要 ${summary.length} 字 > 120（一行一债，长叙述写区域文件）`);
  if (anchor && !existsSync(join(LOG_DIR, anchor))) errs.push(`锚点文件不存在：daily/架构日志/${anchor}`);
  if (errs.length) {
    console.error('❌ 登记被拒（写入口校验，**不是闸**）：');
    for (const e of errs) console.error('   · ' + e);
    process.exit(1);
  }
}

function cmdAdd(argv) {
  const area = argVal(argv, '--area'), summary = argVal(argv, '--summary');
  const cls = argVal(argv, '--class') || '增债', rate = argVal(argv, '--rate') || '中', owner = argVal(argv, '--owner') || '结构债';
  const anchor = argVal(argv, '--anchor') || '', refs = argVal(argv, '--refs') || '', status = argVal(argv, '--status') || '待还';
  if (!area || !summary) fail('用法：add --area 22 --summary "…" [--class 增债] [--rate 中] [--anchor <区域文件>]');
  validate({ cls, rate, owner, summary, anchor });
  const { text } = loadLedger(); // 只为拿"可写主表"原文；**取号 / 区域名不吃它**
  const nn = String(area);
  // 取号 + 区域名口径 = 主表 ∪ 归档（与 list/area/search/show 同源）。旧实现只查主表，
  // 某区历史债全部 archive 后 maxN 归零 → 必撞已归档 ID（详见文件头【取号口径】）。
  const allTd = loadAll().filter((r) => r.fields.kind === 'TD');
  const same = allTd.filter((r) => r.fields.id.match(/^TD-(\d+)-/)?.[1] === nn);
  if (same.some((r) => r.src === 'main' && r.mode === 'manual')) fail('本区主表存在"列错位需人工"的行 → 先修，否则新 ID 可能撞号');
  const maxN = same.reduce((mx, r) => Math.max(mx, idSeq(r.fields.id)), 0);
  const id = `TD-${nn}-${maxN + 1}`;
  // 取号自检（fail-loud）：撞号即拒写，防"归档新增行 / 手工残留"再破口径
  const dup = allTd.find((r) => r.fields.id === id);
  if (dup) fail(`取号自检失败：${id} 已存在于${dup.src === 'archive' ? '归档' : '主表'} → 拒写（撞号会被 loadAll 静默遮蔽）`);
  // 区域名：优先主表既有写法（"活的"），退化取归档写法，并剥"（@见 …）"跨区后缀（新债跨区引用各自标）
  const areaRaw = (same.find((r) => r.src === 'main') ?? same[0])?.fields.area ?? '';
  const areaText = areaRaw.replace(/（@见[^）]*）/g, '').trim() || `${nn}`;
  const anchorText = anchor ? `[${anchor}](./${anchor})` : '—';
  const row = `| ${id} | ${areaText}${refs ? `（${refs}）` : ''} | ${summary} | ${cls} | ${rate} | [${status}] | ${anchorText} |`;
  writeFileSync(LEDGER, text.replace(/\s*$/, '') + '\n' + row + '\n');
  console.log(`✅ 已登记 ${id}（${cls} · ${rate} · ${status}）`);
  console.log('   ' + row);
}

function cmdResolve(argv) {
  const id = argv.find((a) => /^TD-\d+-\d+|^MD-\d+-\d+/.test(a));
  if (!id) fail('用法：resolve <TD-ID> [--status 已解决] [--note "…"] [--date YYYY-MM-DD]');
  const status = argVal(argv, '--status') || '已解决';
  if (!STATUS_WORDS.includes(status)) fail(`状态 \`${status}\` 不在白名单 [${STATUS_WORDS.join(' / ')}]`);
  const note = argVal(argv, '--note') || '', date = argVal(argv, '--date') || today();
  const { lines, rows } = loadLedger();
  const hit = rows.filter((r) => r.fields.id === id);
  if (!hit.length) fail(`主表中无 ${id}${existsSync(ARCHIVE) && parseText(readFileSync(ARCHIVE, 'utf8'), 'a').some((r) => r.fields.id === id) ? '（它在归档里 = 已处理完）' : ''}`);
  if (hit.length > 1) fail(`${id} 在主表出现 ${hit.length} 次（重复 ID）→ 先手工合并`);
  const r = hit[0], C = MAP[r.kind];
  const parts = r.line.split('|');
  const newStatus = `[${status} ${date}${note ? ' · ' + note : ''}]`;
  parts[1 + C.status] = ` ${newStatus} `;
  lines[r.li] = parts.join('|');
  writeFileSync(LEDGER, lines.join('\n'));
  console.log(`✅ ${id} → ${newStatus}`);
  console.log(`   旧状态：${r.fields.status}`);
  console.log('   ↳ 收尾别忘了 `node scripts/debt.mjs archive`（把已完成项移入归档，主表只留待办）');
}

/**
 * archive —— 把已完成项从主表移入 `债务-归档.md`，主表只留待办。
 * 幂等：归档按 ID 去重，已存在的用最新行替换。惯例：`resolve` 后顺手跑一次。
 */
function cmdArchive(argv) {
  const dry = argv.includes('--dry');
  const date = today();
  const { lines, rows } = loadLedger();
  const doneRows = rows.filter((r) => DONE_WORDS.includes(statusWord(r.fields.status)));
  const keepRows = rows.filter((r) => !DONE_WORDS.includes(statusWord(r.fields.status)));
  if (!doneRows.length) { console.log(`✅ 无需归档：主表已无「已完成」项（现有 ${keepRows.length} 条待办）`); return; }
  const archText = existsSync(ARCHIVE) ? readFileSync(ARCHIVE, 'utf8') : '';
  const byId = new Map();
  for (const l of [...archText.split(/\r?\n/).filter((x) => TABLE_ROW.test(x)), ...doneRows.map((r) => r.line)]) {
    const id = l.match(/\|\s*\*{0,2}((?:TD|MD)-\d+-\d+)/)?.[1];
    if (id) byId.set(id, l);
  }
  const ent = [...byId.entries()];
  const tdA = ent.filter(([id]) => id.startsWith('TD')).sort((a, b) => idKey(a[0]) - idKey(b[0])).map(([, l]) => l);
  const mdA = ent.filter(([id]) => id.startsWith('MD')).map(([, l]) => l);
  const outArch = [
    '# 债务账本 · 归档（已解决 / 已裁定 / 已退役 / 不做）', '',
    '> **由 `node scripts/debt.mjs archive` 自动维护**：把 `债务.md` 里的已完成项移入本文件，主表只留待办。',
    '> 读法：`list --all` / `area <NN>` / `search <关键词>` / `show <TD-ID>`（**均已打通归档，不必手读本文件**）。',
    '> 格式与读写规范见 [债务.md](./债务.md)；明细真源 = 各区域日志的「探债」段；',
    '> 2026-09-14 重写前的长叙述全文见 [债务-全文归档-2026-09-14.md](./债务-全文归档-2026-09-14.md)。',
    `> 最近更新：${date} ｜ 归档 ${byId.size} 条`, '',
    '## 元结构债（机制层，非代码；ID 前缀 `MD-<NN>`）', '',
    '| MD-ID | 现象 | 归类 | 状态 | 锚点 |', '| --- | --- | --- | --- | --- |', ...mdA, '',
    '## 已登记债', '',
    '| TD-ID | 区域 | 现象摘要 | 归类 | 利息率 | 状态 | 锚点 |', '| --- | --- | --- | --- | --- | --- | --- |', ...tdA, '',
  ].join('\n');
  if (dry) { console.log(`（dry-run）将归档 ${doneRows.length} 条 → 主表留 ${keepRows.length} 条`); return; }
  const doneLineSet = new Set(doneRows.map((r) => r.li));
  writeFileSync(ARCHIVE, outArch);
  writeFileSync(LEDGER, lines.filter((_, i) => !doneLineSet.has(i)).join('\n'));
  const by = {};
  for (const r of keepRows) { const w = statusWord(r.fields.status) || '?'; by[w] = (by[w] || 0) + 1; }
  console.log(`✅ 归档 ${doneRows.length} 条 → daily/架构日志/债务-归档.md（累计 ${byId.size} 条）`);
  console.log(`   主表保留 ${keepRows.length} 条待办：${Object.entries(by).map(([k, v]) => `${k}=${v}`).join(' · ') || '（无）'}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// audit（只读报告 · 不是闸）
// ─────────────────────────────────────────────────────────────────────────────
const AUTO_KINDS = ['列错位·可自动修', '归类非规范', '利息率非规范', '状态非规范', '多余表头'];
function cmdAudit() {
  const issues = [];
  for (const [file, src] of [[LEDGER, '主表'], [ARCHIVE, '归档']]) {
    if (!existsSync(file)) continue;
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    const seen = new Map();
    const headerLines = [];
    lines.forEach((line, li) => {
      if (/^\|\s*TD-ID\s*\|/.test(line)) headerLines.push(li);
      const r = readRow(line);
      if (!r) return;
      const at = `${src}第 ${li + 1} 行`;
      if (r.broken) { issues.push({ at, kind: '断行', detail: '缺少首/尾竖线' }); return; }
      const f = r.fields;
      if (seen.has(f.id)) issues.push({ at, kind: '重复 ID', detail: `${f.id}（首次在第 ${seen.get(f.id) + 1} 行）` }); else seen.set(f.id, li);
      if (r.mode === 'A') issues.push({ at, kind: '列错位·可自动修', detail: `${f.id}：尾部多余段（同锚点贴两次）` });
      if (r.mode === 'B') issues.push({ at, kind: '列错位·可自动修', detail: `${f.id}：描述含裸 \`|\`（段数 ${r.inner.length}）` });
      if (r.mode === 'C') issues.push({ at, kind: '列错位·可自动修', detail: `${f.id}：状态含裸 \`|\`（段数 ${r.inner.length}）` });
      if (r.mode === 'manual') issues.push({ at, kind: '列错位·需人工', detail: `${f.id}：段数 ${r.inner.length}，四级校验均不通过 → 不猜` });
      if (r.mode !== 'manual' && !isAnchorish(f.anchor)) issues.push({ at, kind: '锚点异常', detail: `${f.id}：\`${String(f.anchor).slice(0, 48)}\`` });
      const c = normClass(f.class);
      if (c.unknown) issues.push({ at, kind: '归类未知', detail: `${f.id}：\`${f.class}\`` });
      else if (c.from) issues.push({ at, kind: '归类非规范', detail: `${f.id}：\`${c.from}\` → \`${c.value}\`` });
      if (r.fields.kind === 'TD') {
        const rt = normRate(f.rate);
        if (rt.unknown) issues.push({ at, kind: '利息率未知', detail: `${f.id}：\`${f.rate}\`` });
        else if (rt.from) issues.push({ at, kind: '利息率非规范', detail: `${f.id}：\`${rt.from}\` → \`${rt.value}\`` });
      }
      const s = normStatus(f.status);
      if (s.unknown) issues.push({ at, kind: '状态未知', detail: `${f.id}：\`${f.status}\`` });
      else if (s.from) issues.push({ at, kind: '状态非规范', detail: `${f.id}：\`${s.from}\` → \`${s.value}\`` });
    });
    if (headerLines.length > 1) for (const li of headerLines.slice(1)) issues.push({ at: `${src}第 ${li + 1} 行`, kind: '多余表头', detail: '追加时误贴的表头行' });
  }
  const main = loadLedger().rows.filter((r) => r.fields.kind === 'TD').length;
  const arch = existsSync(ARCHIVE) ? parseText(readFileSync(ARCHIVE, 'utf8'), 'a').filter((r) => r.fields.kind === 'TD').length : 0;
  console.log(`🔍 debt audit（只读 · **不是闸**）｜ 主表 ${main} 条 · 归档 ${arch} 条 ｜ 违规 ${issues.length} 项`);
  const byKind = {};
  for (const i of issues) (byKind[i.kind] ||= []).push(i);
  for (const [kind, list] of Object.entries(byKind)) {
    console.log(`\n── ${kind}（${list.length}）`);
    for (const i of list.slice(0, 30)) console.log(`   ${i.at}：${i.detail}`);
    if (list.length > 30) console.log(`   … 另 ${list.length - 30} 项`);
  }
  const auto = issues.filter((i) => AUTO_KINDS.includes(i.kind)).length;
  console.log(`\n小结：可归一/修复 ${auto} 项 · 需人工 ${issues.length - auto} 项`);
}

// ─────────────────────────────────────────────────────────────────────────────
function argVal(argv, flag) { const i = argv.indexOf(flag); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : ''; }
function fail(msg) { console.error('❌ ' + msg); process.exit(1); }

const [, , cmd, ...rest] = process.argv;
switch (cmd) {
  case 'list': cmdList(rest); break;
  case 'area': cmdArea(rest); break;
  case 'search': cmdSearch(rest); break;
  case 'show': cmdShow(rest); break;
  case 'add': cmdAdd(rest); break;
  case 'resolve': cmdResolve(rest); break;
  case 'archive': cmdArchive(rest); break;
  case 'audit': cmdAudit(); break;
  default:
    console.log('债务账本读写唯一入口（详见文件头注释）');
    console.log('  读：list [--area NN] [--status X] [--all] | area <NN> | search <关键词> | show <TD-ID>');
    console.log('  写：add --area NN --summary "…" | resolve <TD-ID> --note "…"');
    console.log('  维护：archive [--dry] | audit');
    process.exit(cmd ? 1 : 0);
}
