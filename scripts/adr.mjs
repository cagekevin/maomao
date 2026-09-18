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
 *   node scripts/adr.mjs index [--json]             # 校验 README 索引与文件是否一致（默认只读）
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
  console.log('❌ README 索引与 ADR 文件不一致（索引是产物，别手改）');
  console.log('   修法：node scripts/adr.mjs index --write');
  process.exit(1);
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
  console.log('   ↳ 下一步：把 §背景 / §判据 / §决议 / §后果 的占位符写成真内容（占位符留着 = 假账）');
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
  for (const a of adrs) {
    if (seen.has(a.no)) problems.push(`${a.id}：编号重复（与 ${seen.get(a.no)} 撞号）`);
    seen.set(a.no, a.file);
    const req = { 状态: a.status, 结论: a.conclusion, 日期: a.date, 裁定人: a.decider };
    for (const f of REQUIRED) if (!req[f]) problems.push(`${a.id}：缺必填字段「${f}」`);
    if (!STATUS.includes(a.status)) problems.push(`${a.id}：状态非法「${a.status}」`);
    if (!a.file.includes(`ADR-${a.no}-`)) problems.push(`${a.id}：文件名编号与标题不一致`);
    if (a.conclusion.length > 120) problems.push(`${a.id}：结论超 120 字（${a.conclusion.length}）`);
    if (a.bodyLines > MAX_BODY_LINES)
      problems.push(
        `${a.id}：正文 ${a.bodyLines} 行 > ${MAX_BODY_LINES}（ADR 是**一页**：压缩，或把过程挪去区域日志）`,
      );
    if (conclusions.has(a.conclusion))
      problems.push(`${a.id}：结论与 ${conclusions.get(a.conclusion)} 重复（同义 ADR 应合并）`);
    conclusions.set(a.conclusion, a.id);
    if (a.status === '生效' && !a.text.includes('违反时的判据'))
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
  if (block !== renderIndex(adrs)) problems.push('README 索引与 ADR 文件不一致（跑 index --write）');

  // 【Find 升级触发器】索引表会随条数失效 —— 到点必须换载体（见文件头 FIND_WARN/FIND_CRITICAL）。
  if (adrs.length >= FIND_CRITICAL)
    problems.push(
      `⚠️ 共 ${adrs.length} 条 ≥ ${FIND_CRITICAL}：索引表**已不可导航**（行业实测 300 条即废）⇒ 必须换载体（发布站点 / 按 tag 拆多索引）`,
    );
  else if (adrs.length >= FIND_WARN)
    problems.push(
      `⚠️ 共 ${adrs.length} 条 ≥ ${FIND_WARN}：接近索引表导航上限（行业实测 80 条）⇒ 启动 Find 升级（按 status/tag 分表 + list --tag）`,
    );

  const active = adrs.filter((a) => !RETIRED.includes(a.status)).length;
  if (flag('--json')) {
    console.log(JSON.stringify({ count: adrs.length, active, problems }, null, 2));
    return;
  }
  console.log(
    `🔍 adr audit（只读 · **不是闸**）｜ ${adrs.length} 条（现行 ${active} · 已退出 ${adrs.length - active}）｜ 问题 ${problems.length} 项`,
  );
  for (const p of problems) console.log(`   ${p}`);
  if (!problems.length) console.log('   （无）');
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
  stats: cmdStats,
};
if (!cmd || !table[cmd]) {
  die(
    `未知命令：${cmd ?? '(空)'}`,
    'list ／ show <NNNN> ／ search <关键词> ／ index [--write] ／ add ／ status ／ audit ／ stats',
  );
}
table[cmd]();
