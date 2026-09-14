#!/usr/bin/env node
/**
 * 2026-09-14 · cutia i18n 第三类形态：带插值的 t("X {{a}} Y", { a: val }) → `X ${val} Y`
 * 依据：docs/130-cutia搬迁计划书 §S2。
 *
 * 安全约束：
 *   - 只在**单行**（或结构简单的多行）范围内匹配，避免跨语句误吞；
 *   - 变量值必须是**简单的表达式**（不含逗号外的复杂逻辑）——否则跳过并报告；
 *   - 键内 `{{name}}` 必须都能在同一次 vars 里找到，否则跳过并报告。
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const TARGET = join(ROOT, 'src/components/videoEditor/ui');
const DRY = process.argv.includes('--dry');

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    statSync(p).isDirectory() ? walk(p, out) : /\.tsx?$/.test(n) && out.push(p);
  }
  return out;
}

/** 解析 vars 字面量 `{a: x, b: y,}` → Map */
function parseVars(body) {
  const out = new Map();
  const parts = body.split(',').map((s) => s.trim()).filter(Boolean);
  for (const p of parts) {
    const m = p.match(/^([A-Za-z_$][\w$]*)\s*:\s*([\s\S]+)$/);
    if (!m) return null; // 形态复杂，放弃
    out.set(m[1], m[2].trim());
  }
  return out;
}

/** 把键里的 {{x}} 换成 ${vars.x}（逐段处理，避免转义与注入互相干扰） */
function toTemplate(key, vars) {
  // 先把 key 里的 \" 还原为 "，再按 {{占位符}} 切分
  const text = key.replace(/\\"/g, '"').replace(/\\'/g, "'");
  const segments = text.split(/(\{\{\w+\}\})/);
  const out = [];
  for (const seg of segments) {
    const m = seg.match(/^\{\{(\w+)\}\}$/);
    if (m) {
      const v = vars.get(m[1]);
      if (v === undefined) return null; // 占位符与 vars 不匹配 → 放弃
      out.push('${' + v + '}');
    } else {
      // 纯文本段：转义模板字符串的危险字符
      out.push(seg.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${'));
    }
  }
  return '`' + out.join('') + '`';
}

const stats = { replaced: 0, skipped: [] };
for (const f of walk(TARGET)) {
  let src = readFileSync(f, 'utf8');
  const before = src;
  const rel = f.replace(ROOT + '/', '');

  // 单行形态优先
  src = src.replace(/\bt\(\s*(["'])((?:\\.|(?!\1)[\s\S])*?)\1\s*,\s*\{([^{}]*)\}\s*\)/g, (m, q, key, varsBody) => {
    const vars = parseVars(varsBody);
    if (!vars) { stats.skipped.push(`${rel}: vars 形态复杂 → ${varsBody.trim().slice(0, 60)}`); return m; }
    if (!/\{\{\w+\}\}/.test(key)) return m; // 无插值，交给普通替换
    const tpl = toTemplate(key, vars);
    if (!tpl) { stats.skipped.push(`${rel}: 键内占位符与 vars 不匹配 → ${key.slice(0, 60)}`); return m; }
    stats.replaced++;
    return tpl;
  });

  if (src !== before && !DRY) writeFileSync(f, src);
}

console.log(`替换（插值）次数：${stats.replaced}`);
if (stats.skipped.length) {
  console.log(`\n⚠️ 跳过 ${stats.skipped.length} 处（需人工处理）：`);
  for (const s of stats.skipped) console.log('  ' + s);
}
console.log(DRY ? '[dry-run]' : '已写入');
