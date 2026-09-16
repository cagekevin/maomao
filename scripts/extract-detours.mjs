#!/usr/bin/env node
/**
 * 「弯路提取器」—— 把 `daily/架构日志/**` 里所有"走过的弯路 / 教训"段落抽成一份汇总，供人一次看全。
 *
 * 【为什么存在】提炼《架构师改码7步法》附录 C（常见错误图鉴）时，架构师（AI）只做了 4 次定向 grep、
 *   读了约 12 个文件片段，就误以为"弯路已看全" —— 实测 198 个 md / 37 个文件 / 115 处命中。
 *   检索工具**按相关性截断输出**，会让人把"我看到的"当成"全部"，这正是弯路本身。
 *   本工具把"提取"从人肉 grep 变成一条命令，**产出固定、可复核、不截断**。
 *
 * 【只做一件事】扫 md → 切出含弯路关键词的**小节块** → 汇总写出 → 打印统计。
 *
 * 【关键设计：为什么切"块"而不是"行"】
 *   `grep -A 14 弯路` 会**截断跨行正文**（本仓已翻车：TD-02-45 取证时用 `grep -A 2` 得出
 *   "36 处真静默"，改块级扫描才得出 0 处 —— 教训原话："跨行结构问题不能用固定行数的 grep 判"）。
 *   故本工具用**标题层级**切块：从命中行向上找到最近的标题行，向下取到下一个
 *   **同级或更高级**标题为止 —— 正文完整，且不会吞掉下一节。
 *
 * 【用法】
 *   node scripts/extract-detours.mjs                    # 汇总到 daily/架构日志/弯路汇编.md
 *   node scripts/extract-detours.mjs --dry              # 只看统计，不写盘
 *   node scripts/extract-detours.mjs --out <path>       # 自定义输出路径
 *   node scripts/extract-detours.mjs --kw "弯路,教训,误诊"  # 自定义关键词（逗号分隔）
 *   node scripts/extract-detours.mjs --dir <目录>        # 换扫描目录
 *   node scripts/extract-detours.mjs --require-heading  # 只要"标题里含关键词"的块（更严，噪声更少）
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// ── 参数 ──────────────────────────────────────────────────────────────────────
function val(name, dflt = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}
function flag(name) {
  return process.argv.includes(name);
}

const DRY = flag('--dry');
const STRICT = flag('--require-heading');
const DIR = val('--dir', join(ROOT, 'daily', '架构日志'));
const OUT = val('--out', join(DIR, '弯路汇编.md'));
const KW = val('--kw', '弯路,教训,踩坑,误诊,假绿,回退,错在,差点,翻车')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// ── 排除：账本 / 归档 / 本工具产物自身（它们会假命中"改判非债"等词）────────────────
const EXCLUDE = [/^债务\.md$/, /^债务-.*\.md$/, /^index.*\.md$/, /^弯路汇编\.md$/, /^探索.*\.md$/];

/** 递归收 md */
function collect(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...collect(p));
    else if (name.endsWith('.md') && !EXCLUDE.some((re) => re.test(name))) out.push(p);
  }
  return out;
}

/** 解析标题行 → 层级（# 的个数）；非标题返回 null */
function headingLevel(line) {
  const m = /^(#{1,6})\s+(.*)$/.exec(line);
  return m ? { level: m[1].length, text: m[2].trim() } : null;
}

/**
 * 从 `lines` 里切出所有"命中关键词的小节块"。
 * 规则：命中行 → 向上找最近标题（记录其层级 L）→ 向下直到遇到 level <= L 的标题为止。
 */
function extractBlocks(lines) {
  const blocks = [];
  const seen = new Set(); // 防止同一块被同节内多次命中重复收录

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!KW.some((k) => line.includes(k))) continue;

    // 向上找最近标题
    let start = i;
    let h = null;
    for (let j = i; j >= 0; j--) {
      const hd = headingLevel(lines[j]);
      if (hd) {
        start = j;
        h = hd;
        break;
      }
    }

    // 向下找同级或更高级标题
    let end = lines.length - 1;
    if (h) {
      for (let j = start + 1; j < lines.length; j++) {
        const hd = headingLevel(lines[j]);
        if (hd && hd.level <= h.level) {
          end = j - 1;
          break;
        }
      }
    }

    const key = `${start}-${end}`;
    // 严格模式：标题本身必须含关键词
    const headingHit = h ? KW.some((k) => h.text.includes(k)) : false;
    if (STRICT && !headingHit) continue;

    if (seen.has(key)) continue;
    seen.add(key);

    blocks.push({
      start, // 0-based
      end,
      level: h ? h.level : 0,
      title: h ? h.text : '(无标题)',
      headingHit,
      hitLines: [], // 本块内命中关键词的行号（1-based）
    });
  }

  // 回填本块内的命中行号
  for (const b of blocks) {
    for (let i = b.start; i <= b.end; i++) {
      if (KW.some((k) => lines[i].includes(k))) b.hitLines.push(i + 1);
    }
  }
  return blocks;
}

// ── 主流程 ────────────────────────────────────────────────────────────────────
const files = collect(DIR).sort();
const perFile = [];
let totalBlocks = 0;
let totalLines = 0;

for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  const blocks = extractBlocks(lines);
  if (!blocks.length) continue;
  totalBlocks += blocks.length;
  totalLines += blocks.reduce((s, b) => s + (b.end - b.start + 1), 0);
  perFile.push({ file, lines, blocks });
}

// ── 报表（stdout）────────────────────────────────────────────────────────────
console.log(`📐 弯路提取（扫 ${files.length} 文件）`);
console.log(`   关键词：${KW.join(' · ')}${STRICT ? '（严格：标题须含关键词）' : ''}`);
console.log(`   命中：${perFile.length} 文件 / ${totalBlocks} 节块 / ${totalLines} 行\n`);
console.log('   按命中节块数降序：');
for (const { file, blocks } of [...perFile].sort((a, b) => b.blocks.length - a.blocks.length)) {
  const rel = relative(ROOT, file);
  const lines = blocks.map((b) => b.hitLines[0]).join(',');
  console.log(`     ${String(blocks.length).padStart(2)}  ${rel}  (行 ${lines})`);
}

if (DRY) {
  console.log('\n(--dry：未写盘)');
  process.exit(0);
}

// ── 写盘 ─────────────────────────────────────────────────────────────────────
const md = [];
md.push('# 弯路汇编（自动生成 · 勿手改）');
md.push('');
md.push('> **由 `node scripts/extract-detours.mjs` 生成**。用途：一次看全所有区域日志里的「弯路 / 教训」段落。');
md.push(`> 扫描 \`${relative(ROOT, DIR)}/**\` —— ${files.length} 文件，命中 **${perFile.length} 文件 / ${totalBlocks} 节块 / ${totalLines} 行**。`);
md.push(`> 关键词：${KW.map((k) => `\`${k}\``).join(' · ')}${STRICT ? '（严格模式：仅取标题含关键词的节）' : ''}。`);
md.push('> 切块规则：命中行 → 向上取最近标题 → 向下取到**同级或更高级标题**为止（正文完整，见脚本头 JSDoc「为什么切块不切行」）。');
md.push('');

for (const { file, lines, blocks } of perFile.sort((a, b) => a.file.localeCompare(b.file))) {
  const rel = relative(ROOT, file);
  md.push(`## ${rel}`);
  md.push('');
  for (const b of blocks) {
    md.push(`### ${b.title}  \`L${b.start + 1}–${b.end + 1}\``);
    md.push('');
    md.push(lines.slice(b.start, b.end + 1).join('\n').trim());
    md.push('');
    md.push('---');
    md.push('');
  }
}

writeFileSync(OUT, md.join('\n'), 'utf8');
console.log(`\n✅ 已写出 ${relative(ROOT, OUT)}（${md.length} 行）`);
