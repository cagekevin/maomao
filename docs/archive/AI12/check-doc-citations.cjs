#!/usr/bin/env node
/**
 * AI12 · 门3 机器校验脚本（check-doc-citations.cjs）
 *
 * 作用：扫描 docs/AI12 下所有 .md，抽出 `App.js:Lnnnn` 引用，
 *       去 src/_engine/App.js 验证该行存在；并对「函数名(...)@Lnnnn」
 *       类断言做符号存在性核验（grep 该行附近是否出现该函数声明/调用）。
 *
 * 用法：node docs/AI12/check-doc-citations.cjs
 * 输出：docs/AI12/校验报告.md（逐条 ✅/❌）
 *
 * 设计原则：不依赖 AI 判断，纯文本核对，专治幻觉。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const AI12 = path.join(ROOT, 'docs', 'AI12');
const APP_JS = path.join(ROOT, 'src', '_engine', 'App.js');

// 读取 App.js 全部行（用于行号校验）
let appLines = [];
try {
  appLines = fs.readFileSync(APP_JS, 'utf8').split('\n');
} catch (e) {
  console.error('无法读取 App.js:', APP_JS);
  process.exit(1);
}

// 收集 AI12 下所有 .md（排除本脚本与校验报告自身）
const mdFiles = [];
(function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (f.endsWith('.md') && f !== '校验报告.md') mdFiles.push(p);
  }
})(AI12);

// 正则：匹配 `App.js:Lnnnn` 或 `App.js Lnnnn`
const CITE_RE = /`?App\.js[:\s]L(\d+)`?/g;
// 正则：匹配 `name`@Lnnnn 或 `name`(...)@Lnnnn 形式（函数名锚点）
const FUNC_RE = /`([A-Za-z_$][\w$]*)`\s*(?:\([^)]*\))?@L(\d+)/g;

const results = [];
for (const md of mdFiles) {
  const text = fs.readFileSync(md, 'utf8');
  const rel = path.relative(ROOT, md);

  // 1) 行号存在性校验
  let m;
  CITE_RE.lastIndex = 0;
  while ((m = CITE_RE.exec(text))) {
    const lineNo = parseInt(m[1], 10);
    const exists = lineNo > 0 && lineNo <= appLines.length;
    results.push({
      file: rel,
      type: 'line',
      cite: `App.js:L${lineNo}`,
      ok: exists,
      detail: exists ? `行存在（共 ${appLines.length} 行）` : `行号越界`,
    });
  }

  // 2) 函数名+行号符号校验：grep 该行 ±8 行是否出现该符号声明/调用
  FUNC_RE.lastIndex = 0;
  while ((m = FUNC_RE.exec(text))) {
    const name = m[1];
    const lineNo = parseInt(m[2], 10);
    const from = Math.max(0, lineNo - 8);
    const to = Math.min(appLines.length, lineNo + 8);
    const window = appLines.slice(from, to).join('\n');
    // 命中规则（任一即过）：
    //   1) 函数声明 function X( / X = / X=(
    //   2) 调用 X(
    //   3) 模板字符串/表达式中的变量引用 ${X} 或 ${X}/ 或 ${X}`
    //   4) 字符串字面量 'X' / "X"
    const nameRe = escapeRe(name);
    const hit = new RegExp(`(function\\s+${nameRe}\\s*\\(|\\b${nameRe}\\s*=|${nameRe}=\\(|\\b${nameRe}\\(\\s*|\\$\\{${nameRe}\\}|['"\u0060]${nameRe}['"\u0060])`).test(window)
      || window.includes(`\${${name}}`);
    results.push({
      file: rel,
      type: 'symbol',
      cite: `${name}@L${lineNo}`,
      ok: hit,
      detail: hit ? `L${lineNo}±8 内出现 ${name} 声明/调用` : `L${lineNo}±8 未出现 ${name}`,
    });
  }
}

// 汇总
const pass = results.filter(r => r.ok).length;
const fail = results.length - pass;
let report = `# AI12 · 门3 机器校验报告\n\n`;
report += `> 生成时间：${new Date().toISOString()}\n`;
report += `> 校验对象：docs/AI12/*.md\n`;
report += `> 权威源：src/_engine/App.js（${appLines.length} 行）\n\n`;
report += `## 汇总\n\n`;
report += `- ✅ 通过：${pass}\n`;
report += `- ❌ 失败：${fail}\n`;
report += `- 总计：${results.length}\n\n`;
report += `## 逐条结果\n\n`;
report += `| 文件 | 类型 | 引用 | 结果 | 说明 |\n`;
report += `|------|------|------|------|------|\n`;
for (const r of results) {
  report += `| ${r.file} | ${r.type} | ${r.cite} | ${r.ok ? '✅' : '❌'} | ${r.detail} |\n`;
}

fs.writeFileSync(path.join(AI12, '校验报告.md'), report, 'utf8');
console.log(`校验完成：✅${pass} / ❌${fail} / 共${results.length}`);
console.log(`报告已写：docs/AI12/校验报告.md`);

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
