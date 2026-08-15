#!/usr/bin/env node
'use strict';
/**
 * ai_ask.cjs — AI 检索总入口（让 AI 一条命令拿到答案，不用自己 parse JSON）
 *
 * 用法:
 *   npm run ask -- symbol Bl          # 查符号：短名是啥 → 用途 + 落点(文件:行) + 同名影子
 *   npm run ask -- contract 18080     # 查契约：影响哪些文件/端 → 改前必看
 *   npm run ask -- file proxyMode     # 查文件：哪个文件用了某特征(api/契约/关键词)
 *
 * 设计初衷：这些自动生成物(BUNDLE_MAP/symbol_map/CONTRACTS)是"被动数据库"，
 * AI 不会主动浏览目录。本命令把"我要查 X"变成"一条命令出人话答案"，零记忆成本。
 * 数据源均来自已有的生成物，不重复扫描，秒级返回。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BUNDLE = path.join(ROOT, 'src/bundle');
const SYMBOL_MAP = path.join(BUNDLE, 'symbol_map.json');
const CONTRACTS_MD = path.join(ROOT, 'CONTRACTS.md');
const CONTRACTS_JSON = path.join(ROOT, 'scripts/contracts.json');
const BUNDLE_MAP = path.join(BUNDLE, 'BUNDLE_MAP.md');

const args = process.argv.slice(2);
const mode = args[0] || 'help';
const query = args[1];

function help() {
  console.log(`
AI 检索总入口 — 一条命令拿到答案，不用自己 parse JSON

  npm run ask -- symbol <短名>     查符号：用途 + 落点(文件:行) + 同名影子警示
  npm run ask -- contract <键>     查契约：影响哪些文件/端（改契约前必看）
  npm run ask -- file <关键词>     查文件：哪个文件用了某特征(api/契约/关键字)

例:
  npm run ask -- symbol Bl
  npm run ask -- contract 18080
  npm run ask -- file proxyMode
`);
}

// ── symbol 查询 ──
function askSymbol(q) {
  if (!fs.existsSync(SYMBOL_MAP)) {
    console.error('❌ symbol_map.json 不存在，请先跑 npm run map');
    return 1;
  }
  const map = JSON.parse(fs.readFileSync(SYMBOL_MAP, 'utf8'));
  const entries = map[q];
  if (!entries) {
    console.log(`\n❌ 未找到符号 "${q}"。`);
    console.log('   可尝试: npm run ask -- symbol <前几个字符>（不支持模糊，但可查全量文件确认）\n');
    return 1;
  }
  console.log(`\n🔍 符号 "${q}" — ${entries.length} 处定义\n`);
  for (const e of entries) {
    const role = e.role || '(无用途推断，可能为工具/短函数)';
    console.log(`  📄 ${e.file}:${e.line}`);
    console.log(`     用途: ${role}`);
    if (e.apis && e.apis.length) console.log(`     api: ${e.apis.join(', ')}`);
    console.log('');
  }
  if (entries.length > 1) {
    console.log(`⚠️ 同名×${entries.length}（影子文件）！改前务必确认是哪个文件，改错目录即改漏。`);
  }
  return 0;
}

// ── contract 查询 ──
function askContract(q) {
  // 先看 CONTRACTS.md 是否命中
  let found = false;
  if (fs.existsSync(CONTRACTS_MD)) {
    const md = fs.readFileSync(CONTRACTS_MD, 'utf8');
    // 匹配契约名或字面量
    const re = new RegExp(`^\\| \`([^\`]*${escapeRe(q)}[^\`]*)\` \\| \\w+ \\| \\d+ \\| (.+)$`, 'm');
    const m = md.match(re);
    if (m) {
      found = true;
      console.log(`\n🔍 契约命中 "${m[1]}"\n`);
      console.log(`  📊 文件分布: ${m[2]}\n`);
    }
  }
  // 契约字典兜底
  if (!found && fs.existsSync(CONTRACTS_JSON)) {
    const dict = JSON.parse(fs.readFileSync(CONTRACTS_JSON, 'utf8'));
    for (const [id, c] of Object.entries(dict.contracts || {})) {
      if (id.includes(q) || JSON.stringify(c).includes(q)) {
        found = true;
        console.log(`\n🔍 契约 "${id}"（${c.severity}）\n`);
        if (c.desc) console.log(`  📝 ${c.desc}`);
        if (c.scopes) console.log(`  🎯 scope: ${c.scopes.join(', ')}`);
        if (c.patterns) console.log(`  🔢 模式: ${c.patterns.map(p => p.value || JSON.stringify(p)).join(', ')}`);
        console.log('\n  ⚠️ 改任何一端引用前，先跑 npm run contracts 确认全端同步。');
        console.log('');
        break;
      }
    }
  }
  if (!found) {
    console.log(`\n❌ 未找到契约 "${q}"。可看 CONTRACTS.md 或 scripts/contracts.json 全量。\n`);
    return 1;
  }
  return 0;
}

// ── file 查询 ──
function askFile(q) {
  if (!fs.existsSync(BUNDLE_MAP)) {
    console.error('❌ BUNDLE_MAP.md 不存在，请先跑 npm run map');
    return 1;
  }
  const md = fs.readFileSync(BUNDLE_MAP, 'utf8');
  // 扫描大文件表 + 功能域速查里的关键特征行，提取干净列（去 markdown 表格语法）
  const hits = [];
  const lines = md.split('\n');
  for (const line of lines) {
    if (!line.startsWith('| `') || !line.includes(q)) continue;
    // 解析 `| a | b | c | d | ...` → 拆列
    const cells = line.split('|').map((s) => s.trim()).filter(Boolean);
    const file = (cells[0] || '').replace(/^`|`$/g, '');
    // 只保留真实源文件（跳过符号索引/契约/目录等非文件行）
    if (!file || !/\.(jsx?|tsx?)$/.test(file)) continue;
    // 特征列：取含关键词的列，或 api 列（大文件表第3列）
    const featCol = cells.find((c) => c.includes(q)) || cells[2] || '';
    hits.push({ file, feat: featCol.replace(/`/g, '').slice(0, 80) });
  }
  // 去重同名文件
  const seen = new Set();
  const uniq = hits.filter((h) => (seen.has(h.file) ? false : (seen.add(h.file), true)));
  if (!uniq.length) {
    console.log(`\n❌ BUNDLE_MAP.md 中未命中 "${q}"。可全文 grep src/bundle 确认。\n`);
    return 1;
  }
  console.log(`\n🔍 "${q}" 命中 ${uniq.length} 个文件（来源 BUNDLE_MAP.md）\n`);
  for (const h of uniq.slice(0, 20)) {
    console.log(`  📄 ${h.file}${h.feat ? `\n     ↳ ${h.feat}` : ''}`);
    console.log('');
  }
  console.log(`  想查具体符号用途，可再跑: npm run ask -- symbol <短名>\n`);
  return 0;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

if (mode === 'symbol') return process.exit(askSymbol(query));
if (mode === 'contract') return process.exit(askContract(query));
if (mode === 'file') return process.exit(askFile(query));
help();
