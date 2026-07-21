#!/usr/bin/env node
/**
 * check-doc-citations.cjs — 审计门3 机器校验脚本（AI02 自含）
 * ----------------------------------------------------------------
 * 用途：扫描 docs/AI02/*.md 中的 `File.js:Lnnnn` 引用，回源码 grep 校验
 *       「符号定义行」与文档引用的行号是否一致，专治 AI 幻觉锚点。
 *
 * 约束：
 *  - 只读 src/_engine/App.js / src/_engine/config.js，不修改任何文件。
 *  - 仅写入 docs/AI02/校验报告.md（本工作区内）。
 *  - 不触碰 docs/ 根与其他目录。
 *
 * 用法：node docs/AI02/scripts/check-doc-citations.cjs
 */

const fs = require('fs');
const path = require('path');

const AI02_DIR = path.resolve(__dirname, '..');
const ROOT = path.resolve(AI02_DIR, '..', '..'); // maomao/
const APP_JS = path.join(ROOT, 'src', '_engine', 'App.js');
const CONFIG_JS = path.join(ROOT, 'src', '_engine', 'config.js');

// 被扫描的 md（排除索引与报告自身，避免自引用）
const SKIP = new Set(['00_审计索引.md', '校验报告.md']);
const TOLERANCE = 5; // 行号容差（混淆代码局部变量重声明可能 ±几行）

// 读取文件为行数组（UTF-8）
function readLines(file) {
  const buf = fs.readFileSync(file, 'utf8');
  return buf.split(/\r?\n/);
}

const appLines = readLines(APP_JS);
const cfgLines = readLines(CONFIG_JS);
const appMax = appLines.length;
const cfgMax = cfgLines.length;

// 在源码中查找符号的"定义行"（多种声明形态）
function findDefLine(sym, lines) {
  const pats = [
    new RegExp(`function\\s+${sym}\\s*\\(`),
    new RegExp(`(let|var|const|async\\s+function)\\s+${sym}\\s*=`),
    new RegExp(`[,;\\s]${sym}\\s*=\\s*Y\\.useCallback`),
    new RegExp(`[,;\\s]${sym}\\s*=\\s*\\(`),
    new RegExp(`[,;\\s]${sym}\\s*=>`),
  ];
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (pats.some(p => p.test(ln))) hits.push(i + 1);
  }
  return hits;
}

// 抽取 md 中的引用：Name(Lnnnn) 或 Name（Lnnnn）或 File.js:Lnnnn
// 仅匹配「符号紧邻左括号」形式，避免把描述性文字（如 "CSS"、"true"、"effect"）误抓。
// 兼容半角 (L123) 与全角 （L123） 括号（文档混用）。
const CITE_RE = /([A-Za-z_$][\w$]*)\s*[\(（]L(\d+)[\)）]|(?:src\/_engine\/)?(App\.js|config\.js)[\(（]L(\d+)[\)）]/g;

function main() {
  const files = fs.readdirSync(AI02_DIR).filter(f => f.endsWith('.md') && !SKIP.has(f));
  const results = [];
  let total = 0, pass = 0, fail = 0, warn = 0;

  for (const f of files) {
    const text = fs.readFileSync(path.join(AI02_DIR, f), 'utf8');
    let m;
    while ((m = CITE_RE.exec(text)) !== null) {
      const sym = m[1];
      const lineNo = m[2] ? parseInt(m[2], 10) : parseInt(m[4], 10);
      const isCfg = !!(m[3] === 'config.js' || (m[4] && false));
      const target = isCfg ? 'config.js' : 'App.js';
      const lines = isCfg ? cfgLines : appLines;
      const max = isCfg ? cfgMax : appMax;

      total++;
      if (!sym) { // 纯 File:Lnnn 引用，仅校验行号边界
        if (lineNo > 0 && lineNo <= max) { pass++; results.push({file:f, target, line:lineNo, sym:'(bare)', status:'✅', msg:`行号有效(≤${max})`}); }
        else { fail++; results.push({file:f, target, line:lineNo, sym:'(bare)', status:'❌', msg:`行号越界(文件${max}行)`}); }
        continue;
      }

      const defs = findDefLine(sym, lines);
      if (defs.length === 0) {
        // 可能是组件内局部或非函数声明；退化为"行号存在且内容含该符号"
        const ln = lines[lineNo - 1] || '';
        if (lineNo > 0 && lineNo <= max && ln.includes(sym)) {
          warn++; results.push({file:f, target, line:lineNo, sym, status:'🟡', msg:`未找到定义行，但 L${lineNo} 含 '${sym}'（可能局部/赋值）`});
        } else {
          fail++; results.push({file:f, target, line:lineNo, sym, status:'❌', msg:`源码无 '${sym}' 定义，且 L${lineNo} 不含该符号`});
        }
        continue;
      }

      const nearest = defs.reduce((a, b) => Math.abs(b - lineNo) < Math.abs(a - lineNo) ? b : a, defs[0]);
      const diff = Math.abs(nearest - lineNo);
      // 容差分级：≤TOLERANCE 确信匹配；≤15 属"函数体内引用/局部重声明"🟡；≤40 同符号多定义🟡；>40 ❌
      if (diff <= TOLERANCE) {
        pass++; results.push({file:f, target, line:lineNo, sym, status:'✅', msg:`定义行 L${nearest} 匹配(Δ${diff})`});
      } else if (diff <= 40) {
        warn++; results.push({file:f, target, line:lineNo, sym, status:'🟡', msg:`引用 L${lineNo}，最近定义 L${nearest}(Δ${diff}，函数体内/同符号多定义)`});
      } else {
        fail++; results.push({file:f, target, line:lineNo, sym, status:'❌', msg:`引用 L${lineNo}，定义却在 L${nearest}(Δ${diff} 过大)`});
      }
    }
  }

  // 输出报告
  const lines = [];
  lines.push('# 审计门3 机器校验报告（AI02）');
  lines.push('');
  lines.push(`> 生成时间：${new Date().toISOString()}`);
  lines.push(`> 校验脚本：docs/AI02/scripts/check-doc-citations.cjs（只读源码，仅写本报告）`);
  lines.push(`> 源码快照：App.js ${appMax} 行 / config.js ${cfgMax} 行`);
  lines.push(`> 行号容差：±${TOLERANCE} 行（混淆代码局部重声明漂移）`);
  lines.push('');
  lines.push(`## 汇总：总计 ${total} · ✅${pass} · 🟡${warn} · ❌${fail}`);
  lines.push('');
  lines.push('| 文档 | 目标 | 行号 | 符号 | 状态 | 说明 |');
  lines.push('|------|------|------|------|------|------|');
  for (const r of results) {
    lines.push(`| ${r.file} | ${r.target} | L${r.line} | ${r.sym} | ${r.status} | ${r.msg} |`);
  }
  lines.push('');
  lines.push('## 结论');
  lines.push(`- ${fail === 0 ? '🟢 无硬错误锚点' : '🔴 存在 ' + fail + ' 个硬错误锚点，须打回修正'}`);
  lines.push(`- 🟡 项为同符号多定义或局部声明，需人工确认（符合审计计划"防污染"要求，不自动判错）`);
  lines.push(`- 本脚本仅校验"符号定义行 vs 引用行号"，逻辑正确性由门4 人工质询保证。`);

  fs.writeFileSync(path.join(AI02_DIR, '校验报告.md'), lines.join('\n'), 'utf8');
  console.log(`校验完成：总计 ${total} · ✅${pass} · 🟡${warn} · ❌${fail}`);
  console.log(`报告已写：docs/AI02/校验报告.md`);
}

main();
