#!/usr/bin/env node
/**
 * 统一门3 机器校验脚本（跨 AI01~AI12 全量版）
 *
 * 作用：扫描 docs/AI01 ~ docs/AI12 下所有 .md，抽出 `App.js:Lnnnn` / `文件:Lnnnn` /
 *       `name`@Lnnnn 等引用，去对应源码验证行号/符号存在性。
 * 设计原则：不依赖任何 AI 自述，纯文本核对，专治幻觉（CLAUDE.md 门3）。
 *
 * 用法：node scripts/check-doc-citations-all.cjs
 * 输出：docs/audit/校验报告-总.md
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const APP_JS = path.join(ROOT, 'src', '_engine', 'App.js');
const CONFIG_JS = path.join(ROOT, 'src', '_engine', 'config.js');

// 源码读取
function readLines(p) {
  try { return fs.readFileSync(p, 'utf8').split('\n'); }
  catch (e) { return null; }
}
const appLines = readLines(APP_JS);
const configLines = readLines(CONFIG_JS);

// 扫描所有 AIxx 目录
const aiDirs = [];
for (let i = 1; i <= 12; i++) {
  const d = path.join(DOCS, `AI${String(i).padStart(2, '0')}`);
  if (fs.existsSync(d)) aiDirs.push(d);
}

// 收集所有 .md
const mdFiles = [];
for (const dir of aiDirs) {
  (function walk(d) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else if (f.endsWith('.md') && !/校验报告/.test(f)) mdFiles.push(p);
    }
  })(dir);
}

// 正则
const CITE_RE = /`?([\w/\\.\-]*?(?:App\.js|config\.js|main\.py|index\.ts|files\.ts|resources\.ts|tasks\.ts)[^\s`]*?)[:\s]L(\d+)`?/g;
const FUNC_RE = /`([A-Za-z_$][\w$]*)`\s*(?:\([^)]*\))?@L(\d+)/g;

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function lineExists(fileTag, lineNo) {
  let lines = null;
  if (/App\.js/.test(fileTag)) lines = appLines;
  else if (/config\.js/.test(fileTag)) lines = configLines;
  // 其他文件(.py/.ts)本次仅验证行号范围(源码未全量载入)，行号>0 即视为通过(待扩展)
  if (lines) return lineNo > 0 && lineNo <= lines.length;
  return lineNo > 0; // 非 App/config 文件暂不深校
}

function symbolHit(name, lineNo) {
  if (!appLines) return false;
  const from = Math.max(0, lineNo - 8);
  const to = Math.min(appLines.length, lineNo + 8);
  const win = appLines.slice(from, to).join('\n');
  const nameRe = escapeRe(name);
  return new RegExp(`(function\\s+${nameRe}\\s*\\(|\\b${nameRe}\\s*=|${nameRe}=\\(|\\b${nameRe}\\(\\s*|\\$\\{${nameRe}\\}|['"\`\`]${nameRe}['"\`\`])`).test(win)
    || win.includes(`\${${name}}`);
}

const results = [];
for (const md of mdFiles) {
  const text = fs.readFileSync(md, 'utf8');
  const rel = path.relative(ROOT, md);
  let m;
  CITE_RE.lastIndex = 0;
  while ((m = CITE_RE.exec(text))) {
    const tag = m[1]; const lineNo = parseInt(m[2], 10);
    const ok = lineExists(tag, lineNo);
    results.push({ file: rel, type: 'line', cite: `${tag}:L${lineNo}`, ok, detail: ok ? '行存在' : '行越界/文件未载入' });
  }
  FUNC_RE.lastIndex = 0;
  while ((m = FUNC_RE.exec(text))) {
    const name = m[1]; const lineNo = parseInt(m[2], 10);
    const ok = symbolHit(name, lineNo);
    results.push({ file: rel, type: 'symbol', cite: `${name}@L${lineNo}`, ok, detail: ok ? `L${lineNo}±8 出现 ${name}` : `L${lineNo}±8 未出现 ${name}` });
  }
}

// 按 AI 目录聚合
const byDir = {};
for (const r of results) {
  const top = r.file.split(path.sep)[1]; // docs/AIxx/...
  byDir[top] = byDir[top] || { pass: 0, fail: 0, total: 0 };
  byDir[top].total++; byDir[top].pass += r.ok ? 1 : 0; byDir[top].fail += r.ok ? 0 : 1;
}

const pass = results.filter(r => r.ok).length;
const fail = results.length - pass;

let report = `# 门3 统一机器校验报告（跨 AI01~AI12）\n\n`;
report += `> 生成时间：${new Date().toISOString()}\n`;
report += `> 校验对象：docs/AI01~AI12 全部 .md\n`;
report += `> 权威源：src/_engine/App.js（${appLines ? appLines.length : '未载入'} 行）、config.js（${configLines ? configLines.length : '未载入'} 行）\n`;
report += `> 注：非 App/config 源文件(.py/.ts)仅验证行号>0，未深校符号。\n\n`;
report += `## 总汇总\n\n`;
report += `- ✅ 通过：${pass}\n- ❌ 失败：${fail}\n- 总计：${results.length}\n\n`;
report += `## 分目录汇总\n\n| 目录 | ✅ | ❌ | 总计 |\n|------|------|------|------|\n`;
for (const d of Object.keys(byDir).sort()) {
  report += `| ${d} | ${byDir[d].pass} | ${byDir[d].fail} | ${byDir[d].total} |\n`;
}
report += `\n## 逐条结果\n\n| 文件 | 类型 | 引用 | 结果 | 说明 |\n|------|------|------|------|------|\n`;
for (const r of results) {
  report += `| ${r.file} | ${r.type} | ${r.cite} | ${r.ok ? '✅' : '❌'} | ${r.detail} |\n`;
}

const outDir = path.join(DOCS, 'audit');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, '校验报告-总.md'), report, 'utf8');
console.log(`统一校验完成：✅${pass} / ❌${fail} / 共${results.length}`);
console.log(`报告已写：docs/audit/校验报告-总.md`);
