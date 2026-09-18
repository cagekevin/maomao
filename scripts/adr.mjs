#!/usr/bin/env node
/**
 * ADR 读写**唯一入口** —— `docs/adr/ADR-NNNN-*.md`（各条决议）+ `docs/adr/README.md`（**索引是产物**）。
 *
 * 【为什么存在】ADR 的价值全在"**读债 / 普查时顺手看一眼**"（7 步法 铁律 6 · ADR-0001）。
 *   若索引靠人手维护，就会出现与 `债务.md` 同款的老问题：同一条约定两处维护 → **必然漂移** → 索引失真后
 *   没人再信它 → ADR 退化成"写了没人看"。故：**真源 = 各 ADR 文件的头部字段；README 的索引表 = 生成物**。
 *
 * 【机制：写入口，不是闸】`add`/`status` 在**落盘前**拒非法状态枚举 / 缺必填字段 / 标题重复 / 取号撞号。
 *   与 `debt.mjs` 同款定位（用户 2026-09-14 定调：写文档要的是**规范**，不是门禁）。
 *
 * 【申诉口三问（本脚本自己也要能答）】
 *   ① 守什么：ADR 头部字段的**形状**与索引的**一致性**（红线？否 —— 属**结构偏好**，可被证据推翻）。
 *   ② 什么时候该改它：新增了必要的头部字段 / 状态枚举需扩充 / 索引渲染要变 → 直接改本脚本，别改产物。
 *   ③ 怎么改：改本文件的 `FIELDS` / `STATUS` / `renderIndex`；README 的手写段落在 `README_*` 常量里。
 *
 * 【规模维护（ADR 会越来越多 —— 这是本工具的第二个存在理由）】
 *   ① **默认只看现行**：`list` 只列非退出态；已退出要 `--all` 才见；`search` 则**含全部**。
 *   ② **索引分两张表**：现行 / 已退出 —— 读者不必在几十条里挑现行判据。**不搬家**（搬家会断链）。
 *   ③ **正文是一页**：超 `MAX_BODY_LINES` 行即 `audit` 报错（过程归区域日志，ADR 只留判据+证据+落点）。
 *   ④ **毕业机制（控制规模的根本手段）**：ADR 属**手段优先级 5（文档留痕）**；判据一旦能升为
 *      **fitness function**（可自动检查的载体：结构上不可能 > 类型层 > 唯一入口 > 对账测试 > 红线），
 *      就 `status --to 已毕业 --note "<载体:文件:行>"` —— **能被自动检查的才算毕业**（只写进文档的不算）。
 *      ⇒ 现行集大小 = **尚未被自动检查承担的判据数**（有上界）。
 *   ⑤ **Find 升级触发器**：行业实测「80 条链接的 README 可导航 / 300 条不可导航 / 200 文件扁平目录查找性近零」
 *      ⇒ 到 `FIND_WARN` / `FIND_CRITICAL` 由 `audit` 报警，届时换载体（按 tag 拆索引 / 发布站点）。
 *   ⑥ **不可变性（行业共识）**：**accepted 之后正文冻结** —— 改主意就**写新 ADR 取代它**，不要就地改写历史。
 *      唯一允许的就地变更是**头部状态行**（`状态` / `取代` / `被取代于` / `毕业去向`）。
 *   ⑦ **写入门槛**：`add` 拒标题重复 + 拒结论重复；只写「推翻/确立约定 · 用户裁定 · **被否决的方案**」。
 *
 * 【AI 友好】`--json`（list/show/audit/stats）· `--dry`（不落盘）· 错误一律带"怎么修"·
 *   参数值里**别用 ASCII 双引号 `"`**（PowerShell 会当引号边界截断，用中文引号「」）。
 *
 * 用法（读）：
 *   node scripts/adr.mjs list [--all] [--json]      # 默认只列现行；--all 含已退出
 *   node scripts/adr.mjs show <NNNN|文件名片段>      # 单条全文
 *   node scripts/adr.mjs search <关键词> [--json]    # 标题 / 结论 / 触发 / 正文 全文匹配（多词 AND，含已退出）
 *   node scripts/adr.mjs index [--json]             # 【幂等】索引过期则自动重生成（不阻断）
 *   node scripts/adr.mjs audit [--json]             # 只读体检（**不是闸**）
 *   node scripts/adr.mjs stats                      # 状态分布
 * 用法（写 / 维护）：
 *   node scripts/adr.mjs add --title "…" --conclusion "…" [--status 生效] [--decider 用户|架构师]
 *                           [--trigger "…"] [--date YYYY-MM-DD] [--supersedes NNNN] [--dry]
 *   node scripts/adr.mjs index --write              # 重生成 README 索引块（禁手改索引表）
 *   node scripts/adr.mjs status <NNNN> --to <状态> [--by <NNNN>] [--note "…"] [--dry]
 *                                                   # 状态：草案|生效|已取代|已弃用|已否决|已毕业
 *                                                   # --by：被哪条 ADR 取代（双向连线）
 *                                                   # --to 已毕业 必须给 --note「升到哪个可自动检查的载体」
 *   node scripts/adr.mjs rm <NNNN> --reason "…" [--force]
 *                                                   # **只用于误建/重复**（正常退役走 status，不删）
 *                                                   # 参与取代链的默认拒删；确认误建才 --force（会同时解开取代链）
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ADR_DIR = join(ROOT, 'docs', 'adr');
const README = join(ADR_DIR, 'README.md');

/**
 * 状态枚举 —— 对齐行业（Nygard / MADR 一脉的 Proposed/Accepted/Deprecated/Superseded/Rejected）
 * 并**加一个本仓特有态** `已毕业`（判据升级为 fitness function，见 ADR-0001 与 README §6.3）。
 *
 * 【为什么把「废止」拆成两态（2026-09-18）】行业区分 **Superseded**（被别的 ADR 取代）与
 *   **Deprecated**（只是不再相关，**没有**取代者）。本仓原先合成一个 `已废止` ⇒ 取代链校验判不准
 *   （分不清"该有取代者却没有"和"本来就不该有"）。
 * 【为什么加 `已否决`】行业明写「**Don't hide failures — Rejected decisions are valuable**」：
 *   考虑过但没采纳的方案也要留档，否则后人会把同一方案再提一遍。
 */
const STATUS = ['草案', '生效', '已取代', '已弃用', '已否决', '已毕业'];
const STATUS_ICON = {
  草案: '📝',
  生效: '✅',
  已取代: '🔄',
  已弃用: '🗑',
  已否决: '❌',
  已毕业: '🎓',
};
/** 「已退出」= 不再作为现行判据被引用（保留作记录，**不搬家** —— 搬家会断链）。 */
const RETIRED = ['已取代', '已弃用', '已否决', '已毕业'];
const FIELDS = ['状态', '结论', '日期', '裁定人', '触发', '取代', '被取代于', '毕业去向'];
const REQUIRED = ['状态', '日期', '裁定人', '结论'];
/** 正文行数上限 —— ADR 是**一页**：判据 + 证据 + 落点，不是过程记录（过程归区域日志）。 */
const MAX_BODY_LINES = 80;
/**
 * 【近义阈值（2026-09-18 补）】字符集 Dice 系数下限。
 *   **0.55** 的标定依据（对本仓 20 条现行 ADR 全量两两实测）：
 *     · 已确认的同义对（如合并前的 0010 vs 0020）⇒ **0.547**
 *     · 当前最相似的一组不同判据（ADR-0005 canvas 出口 vs ADR-0006 深拷贝）⇒ **0.436**
 *     · 无关判据 ⇒ ~0.23
 *   取 0.55 落在真实间隔里。**误报代价只是多看一眼；漏报代价是生效集虚胖**（本仓真实教训）。
 */
const SIMILAR_THRESHOLD = 0.55;
/**
 * 【Find 升级触发器（2026-09-18 · 用户裁定）】行业实测：**80 条链接的 README 可导航、300 条不可导航、
 *   200 个文件的扁平目录查找性近零**。故本索引表**必须在到上限之前换载体** —— 到点由 `audit` 报警。
 */
const FIND_WARN = 60;
const FIND_CRITICAL = 150;
const IDX_BEGIN = '<!-- ADR-INDEX:BEGIN（由 node scripts/adr.mjs index --write 生成 · 禁手改） -->';
const IDX_END = '<!-- ADR-INDEX:END -->';

const die = (msg, fix) => {
  console.error(`❌ ${msg}`);
  if (fix) console.error(`   ↳ 怎么修：${fix}`);
  process.exit(2);
};
const val = (name, dflt = undefined) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : dflt;
};
const flag = (name) => process.argv.includes(name);

const normStatus = (raw) => String(raw || '').replace(/[✅⛔📝\s]/g, '');

function adrFiles() {
  if (!existsSync(ADR_DIR)) die(`ADR 目录不存在：${ADR_DIR}`, 'mkdir docs/adr 或先跑 `add`');
  return readdirSync(ADR_DIR)
    .filter((f) => /^ADR-\d{4}-.*\.md$/.test(f))
    .sort();
}

/**
 * 【近义检测（2026-09-18 补）】`add` 原先只查**字符串全等** ⇒ 结论改一个字即绕过，
 * 于是同一天里连写出 3 条讲同一件事的 ADR（ADR-0017/0023/0024，后被合并为 ADR-0025）。
 * 这里做**归一化后的字符集 Dice 系数**比较，抓"换说法但同义"的条目。
 *
 * 归一化：去掉空白 / 常见标点 / 仓库前缀符号，只留实义字符。
 * 相似度：**字符集**（不是 bigram）Dice 系数 —— 中文同义改写会换掉大量相邻字对，
 *   bigram 实测把 0.55 的同义对压到 0.16（抓不到），字符集 Dice 则有 0.55 vs 无关 0.23 的分隔度。
 */
function normalizeForCompare(s) {
  return String(s)
    .replace(/[\s`*·、，。；：（）()「」【】\[\]{}<>\/\\|—\-_"'‘’“”]/g, '')
    .toLowerCase();
}

function diceCoefficient(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const c of A) if (B.has(c)) inter++;
  return (2 * inter) / (A.size + B.size);
}

/** 返回与 `text` 高度相似的既有 ADR（排除自身编号）。 */
function findSimilar(adrs, text, excludeNo) {
  const target = normalizeForCompare(text);
  let best = null;
  for (const a of adrs) {
    if (a.no === excludeNo) continue;
    const score = diceCoefficient(target, normalizeForCompare(a.conclusion));
    if (score >= SIMILAR_THRESHOLD && (!best || score > best.score)) best = { adr: a, score };
  }
  return best;
}

/**
 * 【模板占位符残留（2026-09-18 补）】`add` 一直**打印**「占位符留着 = 假账」，却从不**检查**它 ——
 * 实证：造一条正文全是 `<新约定是什么>` 的空壳 ADR，`audit` 报 **0 问题**（假绿灯）。
 * 这是"垃圾 ADR 能进仓"最直接的入口，故在此补上检出。
 *
 * 检出形态（必须**同时**满足）：① 整行就是一对尖括号包起来的占位说明；② 行内不含句读（。；，
 * 或 200 字以上的实质内容）。这样 `if (x < y)` 这类代码对比、`<div>` 这类 JSX 都不会误报。
 */
const PLACEHOLDER_LINE = /^\s*(?:[-*]\s*)?<[^<>\n]{2,80}>\s*$/;

function placeholderLines(text) {
  const out = [];
  text.split('\n').forEach((line, i) => {
    if (PLACEHOLDER_LINE.test(line)) out.push({ line: i + 1, text: line.trim() });
  });
  return out;
}

/** 必填段落名 —— 缺段 = 结构不完整（ADR 是**一页**且固定四段）。 */
const REQUIRED_SECTIONS = ['背景', '判据', '决议', '后果'];

function missingSections(text) {
  return REQUIRED_SECTIONS.filter((s) => !new RegExp(`^##\\s*${s}`, 'm').test(text));
}

function parseAdr(file) {
  const abs = join(ADR_DIR, file);
  const text = readFileSync(abs, 'utf8');
  const h = text.match(/^#\s+ADR-(\d{4})\s*·\s*(.+?)\s*$/m);
  if (!h) die(`${file}：缺标题行「# ADR-NNNN · <标题>」`, '补上标题行（编号四位，与文件名一致）');
  const meta = {};
  for (const m of text.matchAll(/^-\s+\*\*(状态|结论|日期|裁定人|触发|取代|被取代于|毕业去向)\*\*：\s*(.*?)\s*$/gm)) {
    meta[m[1]] = m[2];
  }
  return {
    no: h[1],
    id: `ADR-${h[1]}`,
    title: h[2],
    status: normStatus(meta['状态']),
    conclusion: meta['结论'] ?? '',
    date: meta['日期'] ?? '',
    decider: meta['裁定人'] ?? '',
    trigger: meta['触发'] ?? '',
    supersedes: meta['取代'] ?? '',
    supersededBy: meta['被取代于'] ?? '',
    graduatedTo: meta['毕业去向'] ?? '',
    bodyLines: text.split('\n').length,
    file,
    path: `docs/adr/${file}`,
    text,
  };
}

const loadAdrs = () => adrFiles().map(parseAdr);

/**
 * 索引分**两张表**：生效 / 已退出。
 * 【为什么分表（2026-09-18）】ADR 只增不减 ⇒ 生效集必须**默认可见**、退出集**默认折叠**，
 *   否则读者要在几十条里挑现行判据。**不搬家**（已废止/已毕业的仍留原路径）—— 搬家会断链。
 */
function renderIndex(adrs) {
  const row = (a) =>
    `| [${a.no}](${a.file}) | ${a.title} | ${STATUS_ICON[a.status] ?? '❔'} ${a.status} | ${a.conclusion} |`;
  const HEAD = '| # | 标题 | 状态 | 结论一句话 |\n| --- | --- | --- | --- |';
  const active = adrs.filter((a) => !RETIRED.includes(a.status));
  const retired = adrs.filter((a) => RETIRED.includes(a.status));
  const parts = [HEAD, ...active.map(row)];
  if (retired.length) {
    parts.push('', '**已退出**（保留作记录 · **勿再引用为现行判据**）', '', HEAD, ...retired.map(row));
  }
  return `${IDX_BEGIN}\n${parts.join('\n')}\n${IDX_END}`;
}

function readIndexBlock() {
  if (!existsSync(README)) die(`README 不存在：${README}`, '先建 docs/adr/README.md');
  const t = readFileSync(README, 'utf8');
  const s = t.indexOf(IDX_BEGIN);
  const e = t.indexOf(IDX_END);
  if (s < 0 || e < 0) die('README 里找不到索引块标记', `补上 ${IDX_BEGIN} … ${IDX_END}`);
  return { text: t, s, e, block: t.slice(s, e + IDX_END.length) };
}

function writeIndex(adrs) {
  const { text, s, e } = readIndexBlock();
  const next = text.slice(0, s) + renderIndex(adrs) + text.slice(e + IDX_END.length);
  writeFileSync(README, next, 'utf8');
}

/** 文件名 slug：去掉路径非法字符 + 会破坏 markdown 链接的字符（`()` `[]`），空格转 `-`。
 *  与仓内既有产物（`index.md` / `debt.mjs` 锚点）同款：索引里写**裸文件名**，不做 URL 编码。 */
const slug = (t) =>
  t
    .replace(/[\\/:*?"<>|()[\]{}]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 40);

/**
 * `index` —— README 索引块**生成器**（**不是闸**）。
 *
 * 【为什么不炸（2026-09-18 · 与 `arch-index.mjs` 同款定性）】README 索引块是**产物**
 * （整份派生自 `docs/adr/*.md`），"不一致" = 「**该重新生成**」，不是「违规」。
 * 曾用 `exit 1` 判红 → 净效果只是**让正确动作多付一次失败代价**（忘了重生成 → 被拦 →
 * 手跑 `--write` → 再来一次），对照「闸的成本守恒律」必被绕。⇒ 改为**幂等自愈**。
 * **幂等 ⇒ 无"何时该跑"这个问题**：`renderIndex` 是纯派生，跑不跑都对，故消费者
 * （`架构师改码7步法` Step 7.4 等）**照常直接读 README 即可**，无需任何前置动作。
 */
function cmdIndex() {
  const adrs = loadAdrs();
  const want = renderIndex(adrs);
  const { block } = readIndexBlock();
  const same = want === block;
  if (flag('--json')) {
    console.log(JSON.stringify({ consistent: same, count: adrs.length }, null, 2));
    return;
  }
  if (flag('--write')) {
    writeIndex(adrs);
    console.log(`✅ 已重生成 docs/adr/README.md 索引块（${adrs.length} 条）`);
    return;
  }
  if (same) {
    console.log(`✅ README 索引与 ADR 文件一致（${adrs.length} 条）`);
    return;
  }
  // ── 幂等：内容物变了就刷新（不阻断）──────────────────────────────────────
  // 索引是**产物**（整份派生自 ADR 文件），"不一致" = 「该重新生成」，不是「违规」。
  // 见 `index 子命令` 头部【为什么不炸】。
  writeIndex(adrs);
  console.log(`✅ 索引已过期 → 已自动刷新（${adrs.length} 条）`);
  console.log('   ↳ 请 `git add docs/adr/README.md` 一并提交（禁手改索引表）。');
}

function cmdList() {
  const all = loadAdrs();
  const showAll = flag('--all');
  const adrs = showAll ? all : all.filter((a) => !RETIRED.includes(a.status));
  const retired = all.length - adrs.length;
  if (flag('--json')) {
    console.log(
      JSON.stringify(
        adrs.map(({ text, ...r }) => r),
        null,
        2,
      ),
    );
    return;
  }
  console.log(
    `📚 ADR 现行判据 ｜ ${adrs.length} 条` +
      (showAll ? `（--all：含已退出 ${retired} 条）` : retired ? `（另有已退出 ${retired} 条，--all 可见）` : ''),
  );
  for (const a of adrs) {
    console.log(`${a.id} ｜ ${STATUS_ICON[a.status] ?? '❔'} ${a.status} ｜ ${a.title}`);
    if (a.conclusion) console.log(`        ${a.conclusion}`);
  }
  console.log(
    '   ↳ 全文：`show <NNNN>` · 检索（**含已退出**）：`search <关键词>` · 看全部：`list --all`',
  );
}

function cmdShow() {
  const q = process.argv[3];
  if (!q) die('用法：node scripts/adr.mjs show <NNNN|文件名片段>');
  const hit = loadAdrs().filter((a) => a.no === q || a.id === q || a.file.includes(q));
  if (!hit.length) die(`没有匹配的 ADR：${q}`, '先 `list` 看编号');
  console.log(hit[0].text);
}

function cmdSearch() {
  const words = process.argv.slice(3).filter((a) => !a.startsWith('--'));
  if (!words.length) die('用法：node scripts/adr.mjs search <关键词> [关键词2 …]（多词 AND）');
  const hit = loadAdrs().filter((a) => words.every((w) => a.text.includes(w)));
  if (flag('--json')) {
    console.log(JSON.stringify(hit.map(({ text, ...r }) => r), null, 2));
    return;
  }
  console.log(`🔎 adr search「${words.join(' + ')}」｜ 命中 ${hit.length} 条`);
  for (const a of hit) console.log(`${a.id} ｜ ${STATUS_ICON[a.status]} ${a.status} ｜ ${a.title}`);
}

function cmdAdd() {
  const title = val('--title');
  const conclusion = val('--conclusion');
  if (!title) die('缺 --title', 'node scripts/adr.mjs add --title "…" --conclusion "…"');
  if (!conclusion) die('缺 --conclusion（索引表要它）', '补一句话结论，≤120 字');
  if (conclusion.length > 120) die(`--conclusion 过长（${conclusion.length} 字 > 120）`, '压到一句话');
  if (conclusion.includes('|')) die('--conclusion 含裸竖线 `|`（会撑破索引表格）', '用「／」代替');

  const adrs = loadAdrs();
  if (adrs.some((a) => a.title === title)) die(`标题已存在：${title}`, '换个标题，或改既有那条');
  const dup = adrs.find((a) => a.conclusion === conclusion);
  if (dup)
    die(
      `结论与 ${dup.id} 重复`,
      `同义 ADR 应合并 —— 改 ${dup.id} 那条，或换一条**真正不同**的判据（重复结论会让生效集虚胖）`,
    );
  const near = findSimilar(adrs, conclusion);
  if (near && !flag('--force'))
    die(
      `结论与 ${near.adr.id} **近义**（相似度 ${(near.score * 100).toFixed(0)}%）`,
      `同义 ADR 应合并 —— 改 ${near.adr.id} 那条，或改写成**真正不同**的判据。` +
        ` 确属不同判据时：改措辞使两者判据分明，再 --force 跳过本检查。`,
    );
  const status = normStatus(val('--status', '生效'));
  if (!STATUS.includes(status)) die(`状态非法：${val('--status')}`, `白名单：${STATUS.join(' / ')}`);
  const supersedes = val('--supersedes');
  if (supersedes && !adrs.some((a) => a.no === supersedes))
    die(`--supersedes ${supersedes} 不存在`, '先确认被取代的编号（`list`）');

  const no = String(Math.max(0, ...adrs.map((a) => Number(a.no))) + 1).padStart(4, '0');
  const date = val('--date', new Date().toISOString().slice(0, 10));
  const decider = val('--decider', '架构师（取证后自定）');
  const trigger = val('--trigger', '—');
  const file = `ADR-${no}-${slug(title)}.md`;
  const body = [
    `# ADR-${no} · ${title}`,
    '',
    `- **状态**：${status}`,
    `- **结论**：${conclusion}`,
    `- **日期**：${date}`,
    `- **裁定人**：${decider}`,
    `- **触发**：${trigger}`,
    ...(supersedes ? [`- **取代**：ADR-${supersedes}`] : []),
    '',
    '## 背景',
    '',
    '<旧约定是什么、它当初为什么这么定>',
    '',
    '## 判据（它凭什么成立 / 为什么不成立）',
    '',
    '<取证：物理红线？类型层？唯一入口？对账测试？—— 答不出就是待消灭的对象>',
    '',
    '## 决议',
    '',
    '<新约定是什么；落点（文件:行）>',
    '',
    '## 后果',
    '',
    '- ✅ 收益',
    '- ⚠️ 代价 / 回潮风险',
    '- 📌 违反时的判据（怎么发现"又回去了"）',
    '',
  ].join('\n');

  // 【落笔前的 5 问（2026-09-18 · 治"ADR 滥用"）】本仓「默认不建闸」⇒ 该不该写只能靠**记录纪律**。
  //   故把自检**打在落笔那一刻**（最需要它的时刻），而不是写进某份没人读的文档。
  //   ⚠️ 这是**提醒不是闸**：不做机器校验（"该不该写"不可机器验证）。
  //   ⚠️ 顺序有讲究：**必须排在 `--dry` 分支之前** —— 预演正是最该看到这 5 问的时刻；
  //      若排在 `return` 之后，连"验证打印对不对"都只能靠真建一条（往库里塞垃圾）= 本末倒置。
  //   ⓿（2026-09-18）：**涉及多个面才有意义** —— 只影响一处的决定是**死日记**。
  console.log(`
   ── 落笔前先答这 5 问（答不出 ⇒ 它多半不该是 ADR）──
   ⓿ **它涉及几个面？** 换个地方还会不会遇到它？只影响**一处** ⇒ **不写**（死日记）→ 区域日志。
   ① **它推翻了什么既有约定？** 答不出 ⇒ 它更可能是"记录"而非"判据"（→ 区域日志）。
   ② **既有的 20 条里有同义的吗？** 已自动查过近义（上面没被拦 = 结论不相似）；
      但仍要人工扫一遍：\`node scripts/adr.mjs list\`（**当你在正文里想写「与 ADR-XXXX 是同一族的两个面」时，
      那就是"应该只有一条"的信号**）。
   ③ **能不能不用 ADR 守？** 结构上不可能 / 类型层 / 唯一入口 / 对账测试里有没有更根本的？
      有 ⇒ 用那个（ADR 属手段优先级 5，是**孵化器不是仓库**）。
   ④ **谁会发现它被违反？** 写得出「📌 违反时的判据」吗？写不出 ⇒ 它是**没有防线**的声明。
`);

  if (flag('--dry')) {
    console.log(`（dry-run）将创建 docs/adr/${file} 并重生成索引`);
    console.log(body);
    return;
  }
  writeFileSync(join(ADR_DIR, file), body, 'utf8');
  if (supersedes) {
    const target = adrs.find((a) => a.no === supersedes);
    writeFileSync(
      join(ADR_DIR, target.file),
      target.text.replace(/^- \*\*状态\*\*：.*$/m, '- **状态**：已取代').trimEnd() +
        `\n- **被取代于**：ADR-${no}\n`,
      'utf8',
    );
  }
  writeIndex(loadAdrs());
  console.log(`✅ 已创建 docs/adr/${file}（${status}）并重生成索引`);
  console.log('   ↳ ⚠️ 现在它是**空壳**（四段仍是占位符）。`audit` 会报「模板占位符残留」——');
  console.log('     把 §背景 / §判据 / §决议 / §后果 写成真内容才算落盘（占位符留着 = 假账）');
}

function cmdStatus() {
  const q = process.argv[3];
  const to = normStatus(val('--to'));
  if (!q || !to)
    die('用法：node scripts/adr.mjs status <NNNN> --to <生效|已废止|已毕业|草案> [--by NNNN] [--note "毕业去向"]');
  if (!STATUS.includes(to)) die(`状态非法：${val('--to')}`, `白名单：${STATUS.join(' / ')}`);
  const adrs = loadAdrs();
  const target = adrs.find((a) => a.no === q || a.id === q);
  if (!target) die(`没有匹配的 ADR：${q}`, '先 `list`');
  const by = val('--by');
  if (by && !adrs.some((a) => a.no === by)) die(`--by ${by} 不存在`, '先 `list`');
  const note = val('--note');
  // 「毕业」= 约束已升级到更强载体（类型/唯一入口/对账测试/红线）⇒ **必须写清升到哪**，否则无从核对。
  if (to === '已毕业' && !note)
    die('--to 已毕业 必须同时给 --note "<升到哪个载体：文件:行>"', '如 --note "类型层：core/utils.ts:120 deepClone<T>"');
  if (to === '已毕业' && note && note.includes('|')) die('--note 含裸竖线 `|`', '用「／」代替');

  let next = target.text.replace(/^- \*\*状态\*\*：.*$/m, `- **状态**：${to}`);
  if (by && !/^- \*\*被取代于\*\*/m.test(next)) next = next.trimEnd() + `\n- **被取代于**：ADR-${by}\n`;
  if (note) {
    next = /^- \*\*毕业去向\*\*/m.test(next)
      ? next.replace(/^- \*\*毕业去向\*\*：.*$/m, `- **毕业去向**：${note}`)
      : next.trimEnd() + `\n- **毕业去向**：${note}\n`;
  }
  if (flag('--dry')) {
    console.log(`（dry-run）${target.id} 状态 → ${to}${by ? `（被 ADR-${by} 取代）` : ''}${note ? `（毕业去向：${note}）` : ''}`);
    return;
  }
  writeFileSync(join(ADR_DIR, target.file), next, 'utf8');
  if (by) {
    const newer = adrs.find((a) => a.no === by);
    if (!/^- \*\*取代\*\*/m.test(newer.text))
      writeFileSync(join(ADR_DIR, newer.file), newer.text.trimEnd() + `\n- **取代**：${target.id}\n`, 'utf8');
  }
  writeIndex(loadAdrs());
  console.log(`✅ ${target.id} → ${to}${by ? `（被 ADR-${by} 取代）` : ''}${note ? `（毕业去向：${note}）` : ''}，索引已重生成`);
}

/**
 * `rm` —— **只用于误建 / 重复**（正常退役走 `status --to 已取代/已弃用/已毕业`，**不删**）。
 * 为什么必须由 CLI 提供：否则人会手删文件 → 索引漂移（本工具的第一个存在理由）。
 * 守卫：参与取代链的默认**不许删**；确认是**误建**才加 `--force`，它会**同时解开取代链**
 *   （被取代方状态还原为「生效」、删掉它的「被取代于」行）—— 否则"误建 + 已在链上"就无路可走，
 *   只能手工改文件绕开 CLI，正是本工具要消灭的形态（2026-09-18 负例实测）。
 */
function cmdRm() {
  const q = process.argv[3];
  const reason = val('--reason');
  if (!q || !reason) die('用法：node scripts/adr.mjs rm <NNNN> --reason "误建/重复" [--force]');
  const adrs = loadAdrs();
  const t = adrs.find((a) => a.no === q || a.id === q);
  if (!t) die(`没有匹配的 ADR：${q}`, '先 `list --all`');
  const inChain = Boolean(t.supersedes || t.supersededBy);
  if (inChain && !flag('--force'))
    die(
      `${t.id} 参与取代链（取代 ${t.supersedes || '—'} / 被 ${t.supersededBy || '—'} 取代），不许删`,
      '确认是**误建**才加 --force（会同时解开取代链）；正常退役请用 status --to 已取代/已弃用/已毕业',
    );
  if (flag('--dry')) {
    console.log(`（dry-run）将删除 docs/adr/${t.file}${inChain ? ' + 解开取代链' : ''} 并重生成索引（原因：${reason}）`);
    return;
  }
  if (flag('--force') && inChain) {
    const find = (ref) => adrs.find((a) => a.no === ref || a.id === ref);
    const old = t.supersedes ? find(t.supersedes) : null;
    if (old) {
      writeFileSync(
        join(ADR_DIR, old.file),
        old.text
          .replace(/^- \*\*状态\*\*：.*$/m, '- **状态**：生效')
          .replace(/^- \*\*被取代于\*\*：.*\n?/m, ''),
        'utf8',
      );
    }
    const newer = t.supersededBy ? find(t.supersededBy) : null;
    if (newer) {
      writeFileSync(
        join(ADR_DIR, newer.file),
        newer.text.replace(/^- \*\*取代\*\*：.*\n?/m, ''),
        'utf8',
      );
    }
  }
  rmSync(join(ADR_DIR, t.file));
  writeIndex(loadAdrs());
  console.log(`🗑 ${t.id} 已删除（原因：${reason}）${inChain ? '，取代链已解开' : ''}，索引已重生成`);
}

function cmdAudit() {
  const adrs = loadAdrs();
  // 键同时收 `0005` 与 `ADR-0005` —— 头部字段里「取代/被取代于」写的是 **ID 形态**（带前缀），
  // 而取号用的是裸编号；只按裸编号建键会误报「取代了不存在的 ADR-XXXX」（2026-09-18 负例实测）。
  const byNo = new Map();
  for (const a of adrs) {
    byNo.set(a.no, a);
    byNo.set(a.id, a);
  }
  const problems = [];
  const seen = new Map();
  const conclusions = new Map();
  /** 近义对（只在两者**都还在生效**时报 —— 已取代的追溯链不算问题）。 */
  const nearDup = new Set();
  const notes = [];
  for (const a of adrs) {
    if (a.status !== '生效') continue;
    for (const b of adrs) {
      if (b.status !== '生效' || b.no <= a.no) continue;
      const score = diceCoefficient(
        normalizeForCompare(a.conclusion),
        normalizeForCompare(b.conclusion),
      );
      if (score >= SIMILAR_THRESHOLD) {
        nearDup.add(
          `${a.id} 与 ${b.id} 结论近义（相似度 ${(score * 100).toFixed(0)}%）⇒ 同义 ADR 应合并（人工判：确属不同判据可忽略）`,
        );
      }
    }
  }
  for (const a of adrs) {
    if (seen.has(a.no)) problems.push(`${a.id}：编号重复（与 ${seen.get(a.no)} 撞号）`);
    seen.set(a.no, a.file);
    const req = { 状态: a.status, 结论: a.conclusion, 日期: a.date, 裁定人: a.decider };
    for (const f of REQUIRED) if (!req[f]) problems.push(`${a.id}：缺必填字段「${f}」`);
    if (!STATUS.includes(a.status)) problems.push(`${a.id}：状态非法「${a.status}」`);
    if (!a.file.includes(`ADR-${a.no}-`)) problems.push(`${a.id}：文件名编号与标题不一致`);
    if (a.conclusion.length > 120) problems.push(`${a.id}：结论超 120 字（${a.conclusion.length}）`);
    // 【占位符残留（2026-09-18）】模板没填完就落盘 = 空壳 ADR。原先只在 add 里**打印**提醒，从不检查。
    const ph = placeholderLines(a.text);
    if (ph.length)
      problems.push(
        `${a.id}：正文残留 ${ph.length} 处**模板占位符**（第 ${ph.map((p) => p.line).join('/')} 行）⇒ 这是空壳 ADR，不是判据`,
      );
    // 【缺段（2026-09-18）】ADR 是一页且固定四段：背景/判据/决议/后果。缺段 = 没写完整。
    const miss = missingSections(a.text);
    if (miss.length) problems.push(`${a.id}：缺必填段落「${miss.join(' / ')}」`);
    if (a.bodyLines > MAX_BODY_LINES)
      problems.push(
        `${a.id}：正文 ${a.bodyLines} 行 > ${MAX_BODY_LINES}（ADR 是**一页**：压缩，或把过程挪去区域日志）`,
      );
    if (conclusions.has(a.conclusion))
      problems.push(`${a.id}：结论与 ${conclusions.get(a.conclusion)} 重复（同义 ADR 应合并）`);
    conclusions.set(a.conclusion, a.id);    if (a.status === '生效' && !a.text.includes('违反时的判据'))
      problems.push(`${a.id}：生效 ADR 缺「📌 违反时的判据」（没有它 = 发现不了回潮）`);
    if (a.supersedes) {
      const t = byNo.get(a.supersedes);
      if (!t) problems.push(`${a.id}：取代了不存在的 ${a.supersedes}`);
      else {
        if (t.status !== '已取代')
          problems.push(`${a.id} 取代 ${t.id}，但 ${t.id} 状态是「${t.status}」（应为 已取代）`);
        if (t.supersededBy !== a.id)
          problems.push(`${t.id}：被 ${a.id} 取代，但未标「被取代于：${a.id}」（取代链断）`);
      }
      // 【取代轮必须交代教训（行业 Template 4「Lessons Learned」）】取代 = 承认前一条错了，
      //   **必须写"从被取代那条学到什么"** —— 否则后人只看到"换了个做法"，看不到"为什么原来的想法有道理"。
      //   本仓「弯路留痕」的结构化版本，且可机器校验。
      if (!/##\s*Lessons Learned/i.test(a.text))
        problems.push(
          `${a.id}：取代了 ${a.supersedes} 却没写「## Lessons Learned」（取代轮必须交代从被取代那条学到什么）`,
        );
    }
    if (a.supersededBy && a.status !== '已取代')
      problems.push(`${a.id}：标了被取代但状态是「${a.status}」（应为 已取代）`);
    if (a.status === '已取代' && !a.supersededBy) problems.push(`${a.id}：已取代但没写「被取代于」`);
    // 行业区分：Superseded（有取代者）≠ Deprecated（只是不再相关，**没有**取代者）
    if (a.status === '已弃用' && a.supersededBy)
      problems.push(`${a.id}：已弃用却写了「被取代于」（已弃用 = 无取代者；被取代请用「已取代」）`);
    if (a.status === '已毕业' && !a.graduatedTo)
      problems.push(`${a.id}：已毕业但没写「毕业去向」（约束升到哪个更强的载体了）`);
  }
  const { block } = readIndexBlock();
  // 索引过期**不算 problem**（它是产物，`index` 已自愈）：只顺手刷成最新并留一行提示。
  if (block !== renderIndex(adrs)) {
    writeIndex(adrs);
    notes.push(`README 索引已过期 → 已自动重生成（${adrs.length} 条）`);
  }

  // 【Find 升级触发器】索引表会随条数失效 —— 到点必须换载体（见文件头 FIND_WARN/FIND_CRITICAL）。
  if (adrs.length >= FIND_CRITICAL)
    problems.push(
      `⚠️ 共 ${adrs.length} 条 ≥ ${FIND_CRITICAL}：索引表**已不可导航**（行业实测 300 条即废）⇒ 必须换载体（发布站点 / 按 tag 拆多索引）`,
    );
  else if (adrs.length >= FIND_WARN)
    problems.push(
      `⚠️ 共 ${adrs.length} 条 ≥ ${FIND_WARN}：接近索引表导航上限（行业实测 80 条）⇒ 启动 Find 升级（按 status/tag 分表 + list --tag）`,
    );

  // 【近义对（只读提示，不算 hard problem）】合并建议 —— 误报代价只是多看一眼。
  for (const n of nearDup) notes.push(n);

  const active = adrs.filter((a) => !RETIRED.includes(a.status)).length;
  if (flag('--json')) {
    console.log(JSON.stringify({ count: adrs.length, active, problems, notes }, null, 2));
    return;
  }
  console.log(
    `🔍 adr audit（只读 · **不是闸**）｜ ${adrs.length} 条（现行 ${active} · 已退出 ${adrs.length - active}）｜ 问题 ${problems.length} 项`,
  );
  for (const p of problems) console.log(`   ${p}`);
  if (!problems.length) console.log('   （无）');
  if (notes.length) {
    console.log(`   —— 另 ${notes.length} 条**建议**（人工判，不影响 exit code）：`);
    for (const n of notes) console.log(`   💡 ${n}`);
  }
}

function cmdStats() {
  const adrs = loadAdrs();
  const by = (s) => adrs.filter((a) => a.status === s).length;
  console.log(`📊 ADR 状态分布（共 ${adrs.length} 条）`);
  for (const s of STATUS) console.log(`   ${STATUS_ICON[s]} ${s}：${by(s)}`);
  const deciders = new Map();
  for (const a of adrs) {
    // 裁定人按**首段**归类（去掉括号里的原话/补充）—— 否则一行会被长文本撑爆（见 README §6.6 自查项）
    const label = (a.decider.split(/[（(]/)[0] || a.decider).replace(/\*\*/g, '').trim().slice(0, 24);
    deciders.set(label, (deciders.get(label) ?? 0) + 1);
  }
  console.log('   裁定人：' + [...deciders].map(([k, v]) => `${k} ×${v}`).join(' · '));
}

/**
 * 【卫生检查（2026-09-18 · 治"ADR 滥用/垃圾横行"）】
 *   `audit` 答的是"**有没有违规**"；`hygiene` 答的是"**这些 ADR 还值不值得留着**"。
 *   区别很重要：audit 是**对账**，hygiene 是**体检** —— 全绿也可能已经很胖。
 *
 * 四个指标（都是**可数**的，不看感觉）：
 *   ① 空壳率（占位符 / 缺段）      —— 硬伤，应为 0
 *   ② 近义簇                       —— 同一件事散在几条（本轮真实病灶）
 *   ③ 未毕业率                     —— ADR 是**孵化器不是仓库**（README §6.3）
 *   ④ 增长速率（当日新增）         —— 一天 +N 条通常意味着"没有先想清楚类别"
 */
function cmdHygiene() {
  const adrs = loadAdrs();
  const active = adrs.filter((a) => a.status === '生效');
  const total = adrs.length;

  // ① 空壳
  const shells = active.filter((a) => placeholderLines(a.text).length || missingSections(a.text).length);

  // ② 近义簇（并查集：把两两近义的连成一簇）
  const parent = new Map(active.map((a) => [a.no, a.no]));
  const find = (x) => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x))), parent.get(x)));
  let pairs = 0;
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const s = diceCoefficient(
        normalizeForCompare(active[i].conclusion),
        normalizeForCompare(active[j].conclusion),
      );
      if (s >= SIMILAR_THRESHOLD) {
        pairs++;
        parent.set(find(active[i].no), find(active[j].no));
      }
    }
  }
  const clusters = new Map();
  for (const a of active) {
    const r = find(a.no);
    if (!clusters.has(r)) clusters.set(r, []);
    clusters.get(r).push(a);
  }
  const dupClusters = [...clusters.values()].filter((c) => c.length > 1);

  // ③ 未毕业
  const notGraduated = active.length;

  console.log(`🩺 adr hygiene（只读 · **不是闸**）｜ ${total} 条（现行 ${active.length} · 已退出 ${total - active.length}）`);
  console.log('');
  console.log(`   ① 空壳率        ${shells.length === 0 ? '✅ 0' : `❌ ${shells.length}`}${shells.length ? ` —— ${shells.map((a) => a.id).join(' ')}` : ''}`);
  console.log(`   ② 近义簇        ${dupClusters.length === 0 ? '✅ 0' : `⚠️ ${dupClusters.length} 簇（${pairs} 对）`}`);
  for (const c of dupClusters) console.log(`        ${c.map((a) => a.id).join(' ↔ ')}  ⇒ 同一件事散在 ${c.length} 条，考虑合并`);
  console.log(`   ③ 未毕业        ⚠️ ${notGraduated}/${active.length} —— ADR 是**判据的孵化器，不是永久仓库**（README §6.3）`);
  console.log(`        手段优先级：结构上不可能 ＞ 类型层 ＞ 唯一入口 ＞ 对账测试 ＞ **文档留痕** ＞ 机器闸`);
  console.log(`        能升为自动检查的 ⇒ \`status <NNNN> --to 已毕业 --note "<载体:文件:行>"\``);

  const active_ = active.map((a) => a.date).filter(Boolean).sort();
  if (active_.length) {
    const byDate = new Map();
    for (const d of active_) byDate.set(d, (byDate.get(d) ?? 0) + 1);
    const today = new Date().toISOString().slice(0, 10);
    const todayN = byDate.get(today) ?? 0;
    console.log(`   ④ 今日新增      ${todayN === 0 ? '✅ 0' : `⚠️ ${todayN} 条`}${todayN >= 3 ? ' —— 一天 ≥3 条通常意味着"没先想清楚内容类别"（ADR-0025 Lessons 1）' : ''}`);
  }

  console.log('');
  console.log('   ── 判断口径（不看感觉，看这四个数）──');
  console.log('   · ① 必须为 0（硬伤）；② 必须为 0（同义就该合并）；');
  console.log('   · ③ 高不一定是病（判据还没找到更强载体），但**长期不降**要问"是不是该升级了"；');
  console.log('   · ④ 是**预警**：一天加多条时，回头问 ADR-0025 的归位表 —— 这几条属于**同一类**吗？');

  if (flag('--json')) return;
  process.exit(shells.length || dupClusters.length ? 1 : 0);
}

const cmd = process.argv[2];
const table = {
  list: cmdList,
  show: cmdShow,
  search: cmdSearch,
  index: cmdIndex,
  add: cmdAdd,
  status: cmdStatus,
  rm: cmdRm,
  audit: cmdAudit,
  hygiene: cmdHygiene,
  stats: cmdStats,
};
if (!cmd || !table[cmd]) {
  die(
    `未知命令：${cmd ?? '(空)'}`,
    'list ／ show <NNNN> ／ search <关键词> ／ index [--write] ／ add ／ status ／ audit ／ hygiene ／ stats',
  );
}

/**
 * 【读时自愈（2026-09-18）】凡"会碰 ADR 数据"的命令（读 + 写），先确保索引块是最新。
 *
 * 判据：**生成挂在"读"这一侧，不挂在"写的人的收尾"上** —— 写的人做完事，没人看，
 * 此刻生成 = 白做一次（下次内容物一变即作废）；**读的人读之前那一刻**才是有意义的。
 * 故此处**不要求任何流程记得跑 `index`**：只要用本 CLI（读或写）就顺带刷新。
 *
 * 幂等 ⇒ 无"何时该跑"问题：`renderIndex` 纯派生，一致时**零写入**（不产生 git 噪音）。
 * `index` / `rm` 自行处理（前者就是生成器；后者会删文件），故排除。
 */
const SELF_HEAL = new Set(['list', 'show', 'search', 'add', 'status', 'audit', 'hygiene', 'stats']);
if (SELF_HEAL.has(cmd)) {
  try {
    const adrs = loadAdrs();
    if (readIndexBlock().block !== renderIndex(adrs)) writeIndex(adrs);
  } catch {
    /* 自愈失败不阻断主命令（真坏了由主命令自己报） */
  }
}

table[cmd]();
