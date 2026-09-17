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
 *   node scripts/arch-index.mjs          # 校验：与实况不一致 → 打印差异 + exit 1（可挂 push 层闸）
 *   node scripts/arch-index.mjs --write  # 重生成 index.md（整份覆盖）
 *
 * 【★闸的申诉口 · 三问（架构师心法 §零.4.2）】
 *   Q1 守什么：**结构偏好闸** —— 进度表必须与轮次文件实况一致（防"进度表失真"误导下一轮起点）。
 *   Q2 何时该改：① 区域名 / 编号 / 层变化 → 改下方 `AREAS`；② 文件名约定变化 → 改 `listRounds`；
 *               ③ 状态行句式变化 → 改 `RE_STATE`（`_template.md` §七 为唯一真源）。
 *   Q3 怎么改：改本文件（真源），**不要手改 index.md**（整份是产物，下次生成即覆盖）；
 *               改完跑 `--write` 再跑校验确认一致。
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
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
 * 单区内所有轮次文件（`<NN>-*.md`）升序：**先日期，同日期再按「轮次序号」，最后才名字**。
 *
 * ⚠️ **不能只用文件名排序**（原实现 `(dateOf(a)+a).localeCompare(...)` 的缺陷）：
 *   · 「四轮」按 Unicode 排在「十四轮」**之后**（01 区实测踩过）；
 *   · 更隐蔽的一例（**17 区实证 2026-09-16**）：汉字码位 **三(4E09) < 五(4E94) < 四(56DB)**
 *     ⇒ 同日期下「五轮」排在「四轮」**之前** ⇒ `files[last]` 取到「四轮」，
 *     于是**「最新轮次」指向更早的那一轮**，且 `readState()` 从"最新"往回找时**先撞上四轮**、
 *     五轮里的状态行被**遮蔽**（进度表因此可能报错灯 —— 本轮就是这样被实锤的）。
 * 修法 = 显式解析序号（`roundNo`），序号取不到（跨区轮 / 无序号）再退化为名字比较 ⇒ 跨区文件的相对次序不变。
 *
 * 更新(2026-09-17 · 工具债当场修 · 第三例)：**同日期、双方都取不到轮次号**的跨区轮之间，名字比较同样给错时序 ——
 *   02 区实证：`…可引用媒体源导入弹窗体检-2026-09-17` 与 `…可引用媒体源首消费-导入弹窗-2026-09-17`
 *   （汉字码位 导(5BFC) < 首(9996)）⇒ 后写的"体检"被判在"首消费"**之前** ⇒ `files[last]` 指向更早那份，
 *   于是新写入的 🔴 回退状态被**遮蔽**、进度表仍报 🟢（与 17 区同款失效，只是成因从"轮次号"换成"跨区名"）。
 *   修法 = 在"名字比较"**之前**插入 **mtime 升序**（同日期同序号时取真实写入顺序）；
 *   mtime 取不到或并列（如 git clone 后 mtime 全等的场景）→ 仍退化为名字比较，**纯名字场景的相对次序不变**。
 */
function listRounds(nn) {
  return readdirSync(ARCH_DIR)
    .filter((f) => f.startsWith(nn + '-') && f.endsWith('.md'))
    .sort((a, b) => {
      const byDate = dateOf(a).localeCompare(dateOf(b));
      if (byDate !== 0) return byDate;
      const byNo = roundNo(a) - roundNo(b);
      if (byNo !== 0) return byNo;
      // 同日期同序号（跨区轮 / 无序号文件）：按**真实写入顺序**（mtime）定先后，名字只作最后兜底。
      // 为什么：汉字码位序 ≠ 时序（见文件头 2026-09-17 第三例），名字比较会把"最新轮次"指错。
      //
      // ⚠️ **已知限制（2026-09-17 实测 · 已登记 TD-17-14，勿在此就地再改判据）**：
      //   跨区轮文件名不含「N轮」⇒ roundNo = -1 ⇒ 恒排在**同日期有号轮之前**，
      //   除非同日期**全部**是无号文件才轮到 mtime 决胜负。
      //   ⇒ 后果：新写入的跨区轮**不会成为该区"最新轮次"**（16 区本轮实证：新文件已落盘，index 仍指向前一份）。
      //   ⇒ 为什么不当场修：曾试「mtime 提到 roundNo 之前」与「有号/无号分开判」两版，均**各错一边** ——
      //     07 区「二轮/三轮」被 mtime 指反（文件被后编辑 ⇒ mtime 变新）；15 区无号**旧**文件（首轮）
      //     因 mtime 较新被误判为最新。**"无号旧文件"与"无号新文件"在当前信息下不可区分**（15 vs 16 实证）
      //     ⇒ 需先引入可判据（如跨区轮统一带「跨区N轮」号 / index 增列"最近写入"栏），再改排序。
      const byMtime = mtimeOf(a) - mtimeOf(b);
      if (byMtime !== 0) return byMtime;
      return a.localeCompare(b);
    });
}

/** 轮次文件 mtime（ms）。取不到 → 0（排序退化为名字比较，纯名字场景次序不变）。 */
function mtimeOf(f) {
  try {
    return statSync(join(ARCH_DIR, f)).mtimeMs;
  } catch {
    return 0;
  }
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
        ? [
            `> ⚠️ 下列区号在 ` + '`AREAS`' + ` 中登记但目录里无轮次文件：${missing.join(' / ')}`,
            '',
          ]
        : [],
    )
    .join('\n');
}

const next = render();
const WRITE = process.argv.includes('--write');
const current = existsSync(INDEX_PATH) ? readFileSync(INDEX_PATH, 'utf8') : '';

if (WRITE) {
  writeFileSync(INDEX_PATH, next);
  console.log('✅ 已重生成 daily/架构日志/index.md（区域 ' + AREAS.length + ' 个）');
  process.exit(0);
}

if (current !== next) {
  console.error('❌ index.md 与轮次文件实况不一致（进度表失真）：');
  console.error('   修法：node scripts/arch-index.mjs --write');
  console.error('   （不要手改 index.md —— 它是产物；要改区域/层请改 scripts/arch-index.mjs 的 AREAS）');
  const curLines = current.split('\n');
  const nextLines = next.split('\n');
  const shown = [];
  const max = Math.max(curLines.length, nextLines.length);
  for (let i = 0; i < max && shown.length < 8; i++) {
    if (curLines[i] !== nextLines[i]) {
      shown.push('   L' + (i + 1) + '  - ' + String(curLines[i] ?? '').slice(0, 110));
      shown.push('   L' + (i + 1) + '  + ' + String(nextLines[i] ?? '').slice(0, 110));
    }
  }
  if (shown.length) console.error('\n' + shown.join('\n'));
  process.exit(1);
}

console.log('✅ index.md 与轮次文件实况一致（区域 ' + AREAS.length + ' 个）');
