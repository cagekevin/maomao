#!/usr/bin/env node
/**
 * ── index.md 生成器（区域清单 + 审计进度 = **整份机器生成**）──────────────────────────
 * 【为什么存在】`daily/架构日志/index.md` 长期在**兼职**，结果必然漂移（2026-09-16 取证）：
 *   · 既当区域清单，又复述轮次结论（双写）→ 单行最长 **10007 字符**（叙述堆）
 *   · 又存"区域治理规则"，而规则 1（要写说明段）与规则 11（禁写说明段）**自相矛盾**
 *   · 又当"层（底→顶）"依据，但**那一列根本不存在**（`债务登记5步法` Step 1 依赖它 → 该步无法执行）
 *   · 人工维护已实证失效：**漏登记 20/23 两个区**、日志列积压 14~24 个链接/区
 * 【收口原则】只留它的**唯一定位 = 区域清单 + 进度**，且**内容全部可派生** → 整份生成，禁手改：
 *   · 区域清单（编号 / 名称 / 层）→ 下方 `AREAS` 常量（人的决策，不可派生，**唯一人工维护点**）
 *   · 最新轮次 + 轮次数          → 轮次文件名派生（`<NN>-*.md`）
 *   · 状态                       → 该区**最新有状态行的**轮次文件 §七「本区域状态」派生
 *   · 灯                         → 由状态映射（灯是"进度"的可视化，不是数据流的一部分）
 * 【与其它文件的边界（各自只干一件事，不重复、不互抄）】
 *   · 结论与证据   → `daily/架构日志/<NN>-*.md`（**唯一人工落盘**；本文件只引用不复述）
 *   · 债务登记     → `daily/架构日志/债务.md`（走 `node scripts/debt.mjs`，禁手写）
 *   · 数据流现状   → `spec/DATAFLOW.md`（**不放灯**：灯是审计进度，不是数据流）
 *   · 流程规则     → `.codebuddy/commands/债务登记5步法.md`（本文件**不复述**规则）
 *
 * 用法：
 *   node scripts/arch-index.mjs   # 【唯一入口 · 幂等】把 index.md 刷成最新
 *
 * 【幂等 ⇒ 无"何时该跑"这个问题（2026-09-18 定性）】────────────────────────
 *   `render()` 是**纯派生**（只读轮次文件 → 输出 index），故：
 *     · 内容物没变 → 生成结果 == 现状 → **跑了等于没跑**（写同一份字节）
 *     · 内容物变了 → 自动刷新
 *   ⇒ **跑不跑都对**，所以**不需要判断何时跑、也不需要谁来提醒**。
 *     消费者（`架构师心法` / `债务登记5步法` / `架构师改码7步法`）**照常直接读** index 即可。
 *
 * 【它曾是闸，为什么不炸（2026-09-18）】────────────────────────────────────
 *   曾作为 push 层闸（不一致即 exit 1）→ 净效果：**忘重生成 → 推送被拦 → 手跑 `--write` → 再推**。
 *   即**没阻止任何错误，只让正确动作多付一次代价**（对照「闸的成本守恒律」：合法通过成本 >
 *   绕行成本 `--no-verify` ⇒ 必被绕）。根因是**把它当错了东西**：`index.md` 是**产物**，
 *   产物过期是"**该重新生成**"，不是"**违规**" —— 判前者为后者 = 把体检单当罚单。
 *
 * 【★闸的申诉口 · 三问（架构师心法 §零.4.2）】
 *   Q1 守什么：**不是闸** —— 本脚本是**产物生成器**（`index.md` 整份派生自轮次文件）。
 *   Q2 何时该改：① 区域名 / 编号 / 层变化 → 改下方 `AREAS`；② 文件名约定变化 → 改 `listRounds`；
 *               ③ 状态行句式变化 → 改 `RE_STATE`（`_template.md` §七 为唯一真源）。
 *   Q3 怎么改：改本文件（真源），**不要手改 index.md**（整份是产物，下次生成即覆盖）。
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ARCH_DIR = join(ROOT, 'daily', '架构日志');
const INDEX_PATH = join(ARCH_DIR, 'index.md');

/**
 * 区域清单（**唯一人工维护点**）：[编号, 区域名, 层]
 * 层 ∈ 元层 / 地基 / 中间 / 上层 / 后端 —— 供"自底向上"排审计顺序（心法 §七）；
 * 此前该信息在 index 里**已丢失**（流程文档却依赖它），现固定在此，只此一处。
 */
const AREAS = [
  ['01', '生成链路', '上层'],
  ['02', '存储 / 持久化', '地基'],
  ['03', '资产 / 素材', '上层'],
  ['04', '画布 / 节点', '上层'],
  ['05', '提示词', '上层'],
  ['06', '编辑 / 查看', '上层'],
  ['07', '3D / 深度视频', '上层'],
  ['08', 'localTool 后端', '后端'],
  ['09', '类型诚实性', '地基'],
  ['10', '云同步', '中间'],
  ['11', 'AI 助手', '上层'],
  ['12', '文件管理', '中间'],
  ['13', '配置 / 账户 / 事件总线', '地基'],
  ['14', 'hooks 编排层', '中间'],
  ['15', '导出 / 备份', '中间'],
  ['16', 'utils 工具层', '地基'],
  ['17', '审计工具链治理', '元层'],
  ['18', 'core 横切基础设施', '地基'],
  ['19', 'UI 基础组件层', '上层'],
  ['20', '跨区清偿轮', '元层'],
  ['21', '视频剪辑器前置收口', '上层'],
  ['22', '视频（全量重审）', '上层'],
  ['23', '仓库根目录卫生', '元层'],
  ['24', '注释漂移横推（跨区）', '元层'],
  ['25', 'ADR 合规横扫', '元层'],
  ['26', '决策门槛形态与排序副本收敛', '元层'],
  ['27', '本机模型资产落点统一', '后端'],
];

/**
 * 状态行（`_template.md` §七 强制格式）—— 实测有**两种写法**，都要认（2026-09-16 取证）：
 *   · `- 本区域状态：**已验证(有债待还)**（…）`                    ← 裸标签
 *   · `- **本区域状态**：`待审计` → **`已验证(有债待还)`**（…）`      ← 星号包裹标签 + 迁移链
 * 且状态值本身有 `**x**` / `` `x` `` / 裸写三种包裹 → 统一交 `cleanState` 清洗。
 *
 * 【为什么要求行首 `- `/`* `（2026-09-16 收窄 · 工具债当场修）】原正则不限位置 ⇒ **正文里提到该标签也会
 * 被当成状态行**。本轮实证：一份轮次日志在"解释本生成器规则"时引用了「标签 + 冒号」的字面量 →
 * 该文件被误判成"含状态行"，而匹配到的是说明句（状态词全不匹配）→ **该区被判「未登记（无状态行）」⚪
 * 且进度表失真**（偏偏它还是该区排序最后的文件）。收窄后全库命中 47 → 46，**唯一差异就是那份假阳性**，
 * 46 个真实状态行全部是行首列表项 ⇒ **只收窄、零误伤**。
 * ⚠️ 写作建议（非强制，正则已挡）：任何文件里都别在非状态语境写出「该标签 + 冒号」。
 */
const RE_STATE = /^[-*]\s*\**本区域状态\**\s*[：:]\s*([^\n]+)/m;

/**
 * 状态行**漂移**检测 —— 与 `RE_STATE` **分开、不合并**（漂移必须可见，不许用"更宽松的解析"掩盖）。
 *
 * 【为什么需要（2026-09-18 工具债当场修 · A10/A11）】`RE_STATE` 只认 `_template.md` §七 的规范标签
 * `本区域状态`。实测**16 份**轮次文件写的是 `本区状态`（少一个「域」字）⇒ 这些文件**不被认作状态源**，
 * 而 `readState` 会**静默回退**到更旧的轮次文件 —— index 于是可能显示**过期状态**；
 * 更糟的是渲染结果常常没变 ⇒ `current !== next` 校验**照样通过**（**假绿**）。
 * 实证：区域 01 本轮已清零，index 仍显示 🔴「有债待还」，直到本轮逐处回改标签才暴露。
 * ⇒ 漂移必须独立报出：`--write` 与校验模式**都**红（否则 = 拿一个失真的进度源当真相）。
 *
 * 【为什么不干脆放宽 `RE_STATE` 认它】那会让「同一标签两种写法」永久合法 = 两名指一物；
 * 正解是**回改原文 + 让漂移可见**（铁律 6 / A7）。
 */
const RE_STATE_DRIFT = /^[-*]\s*\**本区状态\**\s*[：:]/m;

/** 扫描全部轮次文件，返回写了「近失标签」的文件名（行首列表项 + 冒号，与 RE_STATE 同款收窄防误报） */
function findStateDrift() {
  const hits = [];
  for (const [nn] of AREAS) {
    for (const f of listRounds(nn)) {
      let text;
      try {
        text = readFileSync(join(ARCH_DIR, f), 'utf8');
      } catch {
        continue;
      }
      if (RE_STATE_DRIFT.test(text)) hits.push(f);
    }
  }
  return hits;
}

/** 从文件名取日期 —— 文件名自带 `<YYYY-MM-DD>.md` 后缀，是唯一可靠的时间戳 */
function dateOf(f) {
  const m = f.match(/(\d{4}-\d{2}-\d{2})\.md$/);
  return m ? m[1] : '0000-00-00';
}

/**
 * 文件名里的**轮次序号**（「三轮」→3 ·「十四轮」→14 ·「二十三轮」→23 ·「12 轮」→12）。
 * 取不到 → `-1`（跨区轮 / 无序号文件；排序时退化为纯名字比较）。
 */
function roundNo(f) {
  const m = f.match(/第?([一二三四五六七八九十]+|\d+)\s*轮/);
  if (!m) return -1;
  const s = m[1];
  if (/^\d+$/.test(s)) return Number(s);
  const CN = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (s === '十') return 10;
  if (s.length === 1) return CN[s] ?? -1;
  if (s[0] === '十') return 10 + (CN[s[1]] ?? 0); // 十一…十九
  if (s[1] === '十') return (CN[s[0]] ?? 0) * 10 + (s[2] ? (CN[s[2]] ?? 0) : 0); // 二十…九十九
  return -1;
}

/**
 * 单区内所有轮次文件（`<NN>-*.md`）升序：**先日期，同日期再定序**。
 *
 * ⚠️ **不能只用文件名排序**（原实现 `(dateOf(a)+a).localeCompare(...)` 的缺陷）：
 *   · 「四轮」按 Unicode 排在「十四轮」**之后**（01 区实测踩过）；
 *   · 更隐蔽的一例（**17 区实证 2026-09-16**）：汉字码位 **三(4E09) < 五(4E94) < 四(56DB)**
 *     ⇒ 同日期下「五轮」排在「四轮」**之前** ⇒ `files[last]` 取到「四轮」，
 *     于是**「最新轮次」指向更早的那一轮**，且 `readState()` 从"最新"往回找时**先撞上四轮**、
 *     五轮里的状态行被**遮蔽**（进度表因此可能报错灯 —— 本轮就是这样被实锤的）。
 *
 * 【同日期定序（2026-09-18 · TD-17-14 收口）】
 *   ① **双方都是有号轮** → `roundNo`：轮次号是**作者显式标的顺序**，权威，优先于任何时间推断。
 *   ② **其余（含「无号 vs 有号」）** → **时序**：`git 首次加入时间` → `birthtime` → `mtime`。
 *   ③ 时间也不可分（同一次提交 / clone 后同时间）→ 有号优先于无号（无号多为更早的首轮 / 跨区轮）。
 *   ④ 仍不可分 → 名字比较（纯名字场景的相对次序不变）。
 *
 * 【病灶（TD-17-14）：把"没有轮次号"当成了"第 -1 轮"】原实现让 `roundNo` 的 `-1` **与有号轮直接比大小**
 *   ⇒ 无号轮**恒排在同日期有号轮之前**（＝被判"更旧"）⇒ **新写入的跨区轮不会成为该区"最新轮次"**。
 *   根因不是"排序键不够多"，是**把缺失值当数值用** —— `-1` 不是序数，是"无"。
 *
 * 【为什么改用 git 首次加入时间（2026-09-18 全库取证）】此前两版失败都因为**只用 mtime**，
 *   而 mtime 会被**后编辑**污染 —— 本仓 A7「修正必须回改原文」**注定**会去编辑旧文件（结构性，不是偶发）。
 *   `git log --diff-filter=A` 的加入时间**不受后编辑影响**，覆盖 **237/242** 文件；
 *   未提交的新文件 → 退 `birthtime`（创建时间，同样不受后编辑影响）→ `mtime`。
 *   **取证**：全库「同日期 + 有号/无号并存」共 **10 组**，其中 **7 组**原实现判的"最新"与 git 加入顺序**不一致** ⇒ 债成立。
 */
function listRounds(nn) {
  return readdirSync(ARCH_DIR)
    .filter((f) => f.startsWith(nn + '-') && f.endsWith('.md'))
    .sort((a, b) => {
      const byDate = dateOf(a).localeCompare(dateOf(b));
      if (byDate !== 0) return byDate;
      const na = roundNo(a);
      const nb = roundNo(b);
      // ① 都是有号轮：轮次号是作者显式标的顺序（权威）
      if (na > 0 && nb > 0) return na - nb;
      // ② 跨类型 / 都无号：用时序（git 首次加入 → birthtime → mtime）
      const byTs = tsOf(a) - tsOf(b);
      if (byTs !== 0) return byTs;
      // ③ 时间不可分：有号优先于无号（无号多为更早的首轮 / 跨区轮）
      if (na !== nb) return na - nb;
      return a.localeCompare(b);
    });
}

/**
 * 轮次文件的**时序真源**：`git 首次加入时间` → `birthtime`（创建时间）→ `mtime` → `0`。
 * 为什么不是 mtime 优先：A7 要求"修正必须回改原文" ⇒ 旧文件会被后编辑 ⇒ mtime 被污染。
 * 为什么补 birthtime：未提交的新文件 git 查不到，而它的**创建时间**同样不受后编辑影响。
 */
const ADD_TIME = loadAddTimes();
function tsOf(f) {
  const t = ADD_TIME.get(f);
  if (t) return t;
  try {
    const st = statSync(join(ARCH_DIR, f));
    return st.birthtimeMs || st.mtimeMs || 0;
  } catch {
    return 0;
  }
}

/**
 * 一次 `git log` 拿全部轮次文件的「首次加入时间」（ms）—— 避免逐文件起 git 进程（242 文件会很慢）。
 * `--diff-filter=A` 只列"新增"该文件的提交；同名多次出现时取**最早**（后赋值覆盖 ⇒ 首次加入）。
 *
 * ⚠️ **必须带 `-c core.quotePath=false`**（2026-09-18 实测踩坑）：git 默认把**非 ASCII 路径**转义成
 *   八进制（`"daily/\346\236..."`）⇒ 按 `split('/').pop()` 取出的名字**永远匹配不上真实文件名** ⇒
 *   整张表为空、排序静默退化为 `birthtime`（而同一 checkout 的文件 birthtime 只有**亚秒**差异 =
 *   噪声定序 ⇒ 又把"最新轮次"指错）。这类"解析器被打瞎却照样跑"的失效**不报错**，最危险。
 *
 * 非 git 环境 / git 不可用 → 空表（整体退化为 birthtime / mtime，行为不劣化）。
 */
function loadAddTimes() {
  const map = new Map();
  let out = '';
  try {
    out = execFileSync(
      'git',
      [
        '-c',
        'core.quotePath=false',
        'log',
        '--diff-filter=A',
        '--format=__C__%ct',
        '--name-only',
        '--',
        'daily/架构日志',
      ],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 },
    );
  } catch {
    return map; // 非 git 环境 / git 不可用 → 空表（合法降级，行为不劣化）
  }
  let ts = 0;
  for (const raw of out.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('__C__')) {
      ts = Number(line.slice(5)) * 1000;
      continue;
    }
    if (!line.endsWith('.md')) continue;
    map.set(line.split('/').pop(), ts);
  }
  // 【解析率自检 fail-loud】git 有输出却 0 条解析成功 = **解析器被打瞎**（不是"没有数据"）——
  // 这种失效**不报错、静默降级**，最危险（本文件 2026-09-18 就踩过一次：路径被转义）。
  if (!map.size && out.trim()) {
    console.error(
      '❌ arch-index：git log 有输出但 0 条解析成功 —— 解析器失效（检查 core.quotePath / 路径前缀）',
    );
    process.exit(2);
  }
  return map;
}

/**
 * 状态判定：**不取整行**，而是匹配「标准状态词」——因为状态行是人自由写的，同一句话里
 * 常混着说明（实测：`已验证(无债)。本轮 2 债当场还清`、`本区无待还债` 被推翻…）。
 * ⚠️ **顺序即语义：红 → 黄 → 绿 → 灰**（实测两例反过来就判错）：
 *   · 12 区 `回退(…·有债待还)。原「本区无待还债」结论被推翻` → 同时含红与绿 ⇒ 必须判红
 *   · 07 区 `…已还清，剩 TD-07-3/4 两条「持平·待裁定」`        → 同时含绿与黄 ⇒ 必须判黄
 */
const STATE_RULES = [
  { re: /有债待还|回退/, lamp: '🔴', state: '已验证(有债待还)' },
  { re: /待翻新|持平|待裁定|待用户拍板/, lamp: '🟡', state: '待翻新' },
  { re: /无债|已还清/, lamp: '🟢', state: '已验证(无债)' },
  { re: /审计中|待审计/, lamp: '⚪', state: '待审计' },
];

/** 取该区状态 + 灯：从**最新**轮次往前找第一个写了状态行的文件（老轮次可能没写） */
function readState(files) {
  for (let i = files.length - 1; i >= 0; i--) {
    let text;
    try {
      text = readFileSync(join(ARCH_DIR, files[i]), 'utf8');
    } catch {
      continue;
    }
    const m = text.match(RE_STATE);
    if (!m) continue;
    const s = m[1].replace(/[`*]/g, '');
    for (const r of STATE_RULES) if (r.re.test(s)) return { state: r.state, lamp: r.lamp };
    return { state: '', lamp: '⚪' };
  }
  return { state: '', lamp: '⚪' };
}

/** 生成整份 index.md —— 只有这一处产出，任何叙述都不该出现（本文件禁叙事） */
function render() {
  const rows = [];
  for (const [nn, name, layer] of AREAS) {
    const files = listRounds(nn);
    const { state, lamp } = readState(files);
    const stateCell = state || '未登记（该区无状态行）';
    const latest = files.length
      ? `[${files[files.length - 1].replace(/^\d\d-/, '').replace(/\.md$/, '')}](${files[files.length - 1]})（共 ${files.length} 轮）`
      : '—';
    rows.push(`| ${nn} | ${name} | ${layer} | ${stateCell} | ${lamp} | ${latest} |`);
  }

  const missing = AREAS.filter(([nn]) => listRounds(nn).length === 0).map(([nn]) => nn);

  return [
    '# 架构日志 · 区域清单（机器生成 · 禁手改）',
    '',
    '> **本文件 = 区域清单 + 审计进度**（唯一进度源）。读它即可知道：审到哪了 · 哪块最该动 · 最新结论在哪。',
    '> **整份由脚本生成**：重生成 `node scripts/arch-index.mjs --write` · 校验 `node scripts/arch-index.mjs`（可挂闸）。',
    '> **手改无效**（下次生成即覆盖）—— 要改区域/编号/层，改 `scripts/arch-index.mjs` 的 `AREAS`；要改状态，改对应轮次文件的 §七。',
    '',
    '## 本文件的边界（每个文件只干一件事，多余的都别往这塞）',
    '',
    '| 信息 | 去哪 | 说明 |',
    '| --- | --- | --- |',
    '| 结论与证据（探债 / 覆盖度 / 判断） | `daily/架构日志/<NN>-*.md`（**唯一人工落盘**） | 本文件只引用，**不复述** |',
    '| 债务登记 | `daily/架构日志/债务.md` | 走 `node scripts/debt.mjs`，**禁手写** |',
    '| 数据流现状 | `spec/DATAFLOW.md` | **不放灯**：灯是审计进度，不是数据流 |',
    '| 流程规则（治理规则 / 审计闭环） | `.codebuddy/commands/债务登记5步法.md` | 本文件**不复述**规则 |',
    '',
    '> 状态机：`待审计` / `审计中` / `已验证(无债)` / `已验证(有债待还)` / `待翻新` / `已还清` / `已退役`',
    '> 灯：🟢 已审·无债 · 🟡 已审·持平待裁定 · 🔴 有债待还 · ⚪ 未审',
    '> 旧版 index（含已废止的区域治理规则 + 45 行说明段 + 逐轮叙述）全文归档：`index-全文归档-2026-09-16.md`',
    '',
    '---',
    '',
    '## 区域清单（审计进度）',
    '',
    '| # | 区域 | 层 | 状态 | 灯 | 最新轮次 |',
    '| - | --- | --- | --- | --- | -------- |',
    ...rows,
    '',
  ]
    .concat(
      missing.length
        ? [`> ⚠️ 下列区号在 ` + '`AREAS`' + ` 中登记但目录里无轮次文件：${missing.join(' / ')}`, '']
        : [],
    )
    .join('\n');
}

const next = render();
const current = existsSync(INDEX_PATH) ? readFileSync(INDEX_PATH, 'utf8') : '';

// 状态行标签漂移：先报（它会让 index 静默回退到更旧轮次 ⇒ 显示过期状态而渲染结果可能没变）
const drift = findStateDrift();
if (drift.length) {
  console.error(
    '❌ 状态行标签漂移：以下轮次文件写的是 `本区状态`，规范是 `本区域状态`（见 _template.md §七）：',
  );
  for (const f of drift) console.error('   · ' + f);
  console.error(
    '   ⇒ 这些文件**不被认作状态源**，index 会静默回退到更旧的轮次（可能显示过期状态，且结果照过）。',
  );
  console.error('   修法：把该行的 `本区状态` 改成 `本区域状态`，再重跑本脚本。');
}

// ── 幂等：内容物没变就什么也不做（跑了等于没跑）────────────────────────────
if (current === next) {
  if (drift.length) process.exit(1);
  console.log('✅ index.md 已是最新（区域 ' + AREAS.length + ' 个）');
  process.exit(0);
}

// ── 内容物变了 → 刷新（唯一动作，无模式分支）──────────────────────────────
writeFileSync(INDEX_PATH, next);
if (drift.length) {
  console.error('⚠️ 已刷新，但状态源漂移未解决 ⇒ 进度表可能失真（见上）。退出码 1。');
  process.exit(1);
}
console.log('✅ 已刷新 daily/架构日志/index.md（区域 ' + AREAS.length + ' 个）');
