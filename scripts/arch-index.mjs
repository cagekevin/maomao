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
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
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
];

/**
 * 状态行（`_template.md` §七 强制格式）—— 实测有**两种写法**，都要认（2026-09-16 取证）：
 *   · `- 本区域状态：**已验证(有债待还)**（…）`                    ← 裸标签
 *   · `- **本区域状态**：`待审计` → **`已验证(有债待还)`**（…）`      ← 星号包裹标签 + 迁移链
 * 且状态值本身有 `**x**` / `` `x` `` / 裸写三种包裹 → 统一交 `cleanState` 清洗。
 */
const RE_STATE = /本区域状态\**[：:]\s*([^\n]+)/;

/** 从文件名取日期 —— 文件名自带 `<YYYY-MM-DD>.md` 后缀，是唯一可靠的时间戳 */
function dateOf(f) {
  const m = f.match(/(\d{4}-\d{2}-\d{2})\.md$/);
  return m ? m[1] : '0000-00-00';
}

/**
 * 单区内所有轮次文件（`<NN>-*.md`），**按文件名里的日期**升序。
 * ⚠️ 不能直接用文件名排序：「四轮」按 Unicode 排在「十四轮」**之后** → 会把旧轮当成最新
 *    （01 区实测踩过：显示成「四轮深探」而非「十四轮」）。
 */
function listRounds(nn) {
  return readdirSync(ARCH_DIR)
    .filter((f) => f.startsWith(nn + '-') && f.endsWith('.md'))
    .sort((a, b) => (dateOf(a) + a).localeCompare(dateOf(b) + b));
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
