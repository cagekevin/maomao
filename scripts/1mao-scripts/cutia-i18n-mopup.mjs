#!/usr/bin/env node
/**
 * 2026-09-14 · cutia i18n 收尾：处理三类残留边界形态。
 *   ① 多行 t("...", {vars},) —— 跨行插值
 *   ② 多行 t("...",) —— 纯文本跨行
 *   ③ t={t} 传参（BlurPreview 的 props）→ 改为直接传已翻译的中文函数 stub
 * 依据：docs/130-cutia搬迁计划书 §S2。
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

const MAP = JSON.parse(readFileSync(join(__dirname, 'cutia-i18n-zh-map.json'), 'utf8'));
delete MAP._comment;

/** 单行 vars 解析 */
function parseVars(body) {
  const out = new Map();
  for (const p of body.split(',').map((s) => s.trim()).filter(Boolean)) {
    const m = p.match(/^([A-Za-z_$][\w$]*)\s*:\s*([\s\S]+)$/);
    if (!m) return null;
    out.set(m[1], m[2].trim());
  }
  return out;
}

/** t("key") 或 t("key", {vars}) → 目标字面量（无插值 → "中文"；有插值 → 模板串） */
function resolveCall(key, varsBody) {
  let text = MAP[key];
  const useTemplate = /\{\{\w+\}\}/.test(key);

  if (!useTemplate) {
    // 无插值：优先对照表；未命中则原样（保留英文文案，不猜）
    return text ? `"${text.replace(/"/g, '\\"')}"` : `"${key.replace(/"/g, '\\"')}"`;
  }
  // 有插值：必须走模板字符串
  const vars = varsBody ? parseVars(varsBody) : null;
  if (!vars) return null;

  // 以中文对照为基底（若对照表有），否则用英文原文
  const base = text ?? key;
  const segments = base.replace(/\\"/g, '"').split(/(\{\{\w+\}\})/);
  const out = [];
  for (const seg of segments) {
    const m = seg.match(/^\{\{(\w+)\}\}$/);
    if (m) {
      const v = vars.get(m[1]);
      if (v === undefined) return null;
      out.push('${' + v + '}');
    } else {
      out.push(seg.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${'));
    }
  }
  return '`' + out.join('') + '`';
}

let count = 0;
const skipped = [];

for (const f of walk(TARGET)) {
  let src = readFileSync(f, 'utf8');
  const before = src;

  // ① 多行 / 单行统一处理：t( <str> [, {vars}] [,] )
  src = src.replace(
    /\bt\(\s*(["'])((?:\\.|(?!\1)[\s\S])*?)\1\s*(?:,\s*\{([\s\S]*?)\}\s*)?,?\s*\)/g,
    (m, q, key, varsBody) => {
      // 排除明显是别名的（key 里出现换行打头的 JSX 等）——用长度与形态粗筛
      const repl = resolveCall(key, varsBody);
      if (!repl) { skipped.push(`${f.replace(ROOT + '/', '')}: ${key.slice(0, 50)}`); return m; }
      count++;
      return repl;
    },
  );

  // ③ t={t} → 去掉该 prop（BlurPreview 已改为直接显示 label）
  src = src.replace(/\n\s*t=\{t\}/g, '');
  src = src.replace(/,\s*\bt\b(?=\])/g, '');
  src = src.replace(/\[([^\]]*?),,?\s*\]/g, '[$1]');

  if (src !== before && !DRY) writeFileSync(f, src);
}

console.log(`替换次数：${count}`);
if (skipped.length) {
  console.log(`\n⚠️ 需人工（${skipped.length}）：`);
  for (const s of skipped) console.log('  ' + s);
}
console.log(DRY ? '[dry-run]' : '已写入');
