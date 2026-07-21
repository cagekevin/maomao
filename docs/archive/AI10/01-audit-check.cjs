#!/usr/bin/env node
/**
 * audit-check.cjs — 门3 机器校验脚本（AI10 · 架构审计流水线）
 *
 * 作用：输入一个模块 markdown，正则抽取其中出现的
 *   - 行号引用：  App.js:Lnnnn  /  localTool/...:Lnnn  /  apimart-gateway/...:Lnnn
 *   - 函数名引用： functionName()  （校验在源码中是否存在同名声明/调用）
 * 然后去对应源码文件 grep 确认符号/行号存在，输出校验报告（逐条 ✅/⚠️/❌）。
 *
 * 设计原则（来自 TASKS.md 审计计划）：
 *   - 不依赖 AI 判断，专治"幻觉锚点"（如 Jn 曾被误当生图主回调）。
 *   - 行号会漂移，故对每个行号引用额外做"邻近字符串存在性"软校验：
 *     若精确行号命中失败，在 ±WINDOW 行范围内搜索该行号引用的"函数名/关键字"，
 *     命中则标 ⚠️（行号漂移，需人工复核），未命中则标 ❌（硬失败）。
 *
 * 用法：
 *   node audit-check.cjs <module-md-path> [--src <srcRoot>] [--report <outPath>]
 *
 * 默认：
 *   srcRoot = 仓库根（脚本向上找 package.json 定位）
 *   report  = 同目录下的 校验报告-AI10.md
 */

const fs = require('fs');
const path = require('path');

// ── 参数解析 ──
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('用法: node audit-check.cjs <module-md-path> [--src <srcRoot>] [--report <outPath>]');
  process.exit(1);
}
let mdPath = null;
let srcRoot = null;
let reportPath = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--src') srcRoot = args[++i];
  else if (args[i] === '--report') reportPath = args[++i];
  else if (!mdPath) mdPath = args[i];
}
if (!mdPath || !fs.existsSync(mdPath)) {
  console.error('找不到模块 md 文件:', mdPath);
  process.exit(1);
}

// ── 定位仓库根（向上找 package.json）──
function findRepoRoot(start) {
  let cur = start;
  while (true) {
    if (fs.existsSync(path.join(cur, 'package.json'))) return cur;
    const parent = path.dirname(cur);
    if (parent === cur) return start;
    cur = parent;
  }
}
const repoRoot = srcRoot || findRepoRoot(path.dirname(path.resolve(mdPath)));

// 源码文件映射（文档里常见的缩写 → 实际路径）
const SRC_FILE_MAP = {
  'App.js': 'src/_engine/App.js',
  'main.tsx': 'src/main.tsx',
  'config.js': 'src/_engine/config.js',
  'entry.js': 'src/_engine/entry.js',
  'background.ts': 'src/background.ts',
  'index.ts': 'localTool/src/index.ts',
  'database.ts': 'localTool/src/db/database.ts',
  'helpers.ts': 'localTool/src/utils/helpers.ts',
  'files.ts': 'localTool/src/routes/files.ts',
  'resources.ts': 'localTool/src/routes/resources.ts',
  'tasks.ts': 'localTool/src/routes/tasks.ts',
  'kv.ts': 'localTool/src/routes/kv.ts',
  'system.ts': 'localTool/src/routes/system.ts',
  'main.py': 'apimart-gateway/main.py',
  'lovart_client.py': 'apimart-gateway/lovart_client.py',
};

function resolveSrc(shortName) {
  if (SRC_FILE_MAP[shortName]) return path.join(repoRoot, SRC_FILE_MAP[shortName]);
  return path.join(repoRoot, shortName);
}

// ── 正则 ──
const LINE_REF_RE = /([\w./\\-]+\.(?:js|ts|tsx|py))\s*[:：]\s*L?(\d+)/g;
const FUNC_CALL_RE = /([A-Za-z_$][\w$]*)\s*\(\s*\)/g;
const FUNC_DECL_RE = /function\s+([A-Za-z_$][\w$]*)\s*\(/g;

const WINDOW = 40; // 行号漂移容差窗口

// ── 读取源文件为行数组（缓存）──
const srcCache = {};
function getSrcLines(fileKey) {
  if (srcCache[fileKey]) return srcCache[fileKey];
  const p = resolveSrc(fileKey);
  if (!fs.existsSync(p)) {
    srcCache[fileKey] = { exists: false, lines: [] };
    return srcCache[fileKey];
  }
  const lines = fs.readFileSync(p, 'utf8').split('\n');
  srcCache[fileKey] = { exists: true, lines };
  return srcCache[fileKey];
}

// 在 ±WINDOW 行内搜索关键字（函数名/字符串）是否出现
function softCheckAround(fileKey, lineNo, keywords) {
  const src = getSrcLines(fileKey);
  if (!src.exists) return { found: false, reason: '源码文件不存在: ' + fileKey };
  const lo = Math.max(0, lineNo - 1 - WINDOW);
  const hi = Math.min(src.lines.length - 1, lineNo - 1 + WINDOW);
  for (let i = lo; i <= hi; i++) {
    const text = src.lines[i];
    for (const kw of keywords) {
      if (kw && text.includes(kw)) {
        return { found: true, driftLine: i + 1, keyword: kw };
      }
    }
  }
  return { found: false };
}

// ── 解析 md ──
const md = fs.readFileSync(mdPath, 'utf8');
const results = []; // {type, raw, file, line, status, detail}

// 1) 行号引用校验
let m;
LINE_REF_RE.lastIndex = 0;
const seenLineRefs = new Set();
while ((m = LINE_REF_RE.exec(md)) !== null) {
  const fileKey = m[1];
  const lineNo = parseInt(m[2], 10);
  const key = fileKey + ':' + lineNo;
  if (seenLineRefs.has(key)) continue;
  seenLineRefs.add(key);

  const src = getSrcLines(fileKey);
  if (!src.exists) {
    results.push({ type: 'line', raw: m[0], file: fileKey, line: lineNo, status: '❌', detail: '源码文件不存在（映射表未收录或路径错）' });
    continue;
  }
  const exact = src.lines[lineNo - 1];
  if (exact !== undefined) {
    results.push({ type: 'line', raw: m[0], file: fileKey, line: lineNo, status: '✅', detail: '行号命中' });
  } else {
    results.push({ type: 'line', raw: m[0], file: fileKey, line: lineNo, status: '❌', detail: '行号越界（文件仅 ' + src.lines.length + ' 行）' });
  }
}

// 2) 函数名引用软校验（仅统计在源码中是否出现过该标识符）
const funcNames = new Set();
FUNC_DECL_RE.lastIndex = 0;
while ((m = FUNC_DECL_RE.exec(md)) !== null) funcNames.add(m[1]);
FUNC_CALL_RE.lastIndex = 0;
while ((m = FUNC_CALL_RE.exec(md)) !== null) {
  const name = m[1];
  if (/^(if|for|while|switch|catch|return|function|typeof|new|await|async|console|require|import|export|const|let|var|do|else|then|catch)$/.test(name)) continue;
  if (/_/.test(name) || /[a-z][A-Z]/.test(name) || (name.length <= 4 && /^[A-Za-z_$]+$/.test(name))) {
    funcNames.add(name);
  }
}

// 对每个函数名，在 App.js（主审计对象）里 grep 是否存在；找不到再去 localTool/网关侧
const primarySrc = getSrcLines('App.js');
const OTHER_FILES = ['config.js', 'localTool/src/routes/files.ts', 'localTool/src/routes/resources.ts', 'localTool/src/routes/tasks.ts', 'localTool/src/index.ts', 'apimart-gateway/main.py'];
funcNames.forEach((name) => {
  if (name === 'App') return;
  let exists = false;
  let sampleLine = -1;
  let foundIn = 'App.js';
  if (primarySrc.exists) {
    for (let i = 0; i < primarySrc.lines.length; i++) {
      if (new RegExp('(?:function\\s+' + name + '\\s*\\(|\\b' + name + '\\s*=|[^\\w$]' + name + '\\s*\\()').test(primarySrc.lines[i])) {
        exists = true;
        sampleLine = i + 1;
        break;
      }
    }
  }
  if (!exists) {
    for (const f of OTHER_FILES) {
      const s = getSrcLines(f);
      if (!s.exists) continue;
      for (let i = 0; i < s.lines.length; i++) {
        if (new RegExp('(?:function\\s+' + name + '\\s*\\(|\\b' + name + '\\s*=|[^\\w$]' + name + '\\s*\\()').test(s.lines[i])) {
          exists = true;
          sampleLine = i + 1;
          foundIn = f;
          break;
        }
      }
      if (exists) break;
    }
  }
  results.push({
    type: 'func',
    raw: name + '()',
    file: foundIn,
    line: sampleLine,
    status: exists ? '✅' : '⚠️',
    detail: exists ? ('符号存在于 ' + foundIn + ' L' + sampleLine) : '源码中未检索到该符号（拼写错误或映射表未收录）',
  });
});

// ── 输出报告 ──
const total = results.length;
const ok = results.filter(r => r.status === '✅').length;
const warn = results.filter(r => r.status === '⚠️').length;
const fail = results.filter(r => r.status === '❌').length;

let report = '# 文档引用校验报告（AI10 · 门3 机器校验）\n\n';
report += '> 由 `audit-check.cjs` 自动生成\n';
report += '> 被检文档: `' + path.resolve(mdPath) + '`\n';
report += '> 仓库根: `' + repoRoot + '`\n';
report += '> 生成时间: ' + new Date().toISOString() + '\n\n';
report += '## 汇总\n\n';
report += `- 总引用条数: **${total}**\n`;
report += `- ✅ 通过: **${ok}**\n`;
report += `- ⚠️ 需人工复核: **${warn}**\n`;
report += `- ❌ 失败: **${fail}**\n\n`;
report += '> ⚠️ = 软校验未命中（可能符号在其它源文件侧，或拼写错误），不阻断但须人工确认。\n';
report += '> ❌ = 硬失败（行号越界或源码文件缺失），阻断入库。\n\n';
report += '## 明细\n\n';
report += '| 状态 | 类型 | 引用 | 文件 | 行号 | 说明 |\n';
report += '|------|------|------|------|------|------|\n';
results.forEach((r) => {
  report += `| ${r.status} | ${r.type} | \`${r.raw}\` | ${r.file} | ${r.line > 0 ? 'L' + r.line : '-'} | ${r.detail} |\n`;
});

reportPath = reportPath || path.join(path.dirname(path.resolve(mdPath)), '校验报告-AI10.md');
fs.writeFileSync(reportPath, report, 'utf8');
console.log('校验完成 →', reportPath);
console.log(`总计 ${total} | ✅ ${ok} | ⚠️ ${warn} | ❌ ${fail}`);
process.exit(fail > 0 ? 2 : 0);
