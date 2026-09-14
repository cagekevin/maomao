#!/usr/bin/env node
/** 列出带插值的 t("...", {vars}) 形态（i18n 替换的第三类，需转模板字符串）。 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TARGET = join(ROOT, 'src/components/videoEditor/ui');

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    statSync(p).isDirectory() ? walk(p, out) : /\.tsx?$/.test(n) && out.push(p);
  }
  return out;
}

const re = /\bt\(\s*(["'])([\s\S]*?)\1\s*,\s*\{([\s\S]*?)\}\s*\)/g;
let total = 0;
for (const f of walk(TARGET)) {
  const s = readFileSync(f, 'utf8');
  for (const m of s.matchAll(re)) {
    total++;
    const rel = f.replace(ROOT + '/', '');
    const line = s.slice(0, m.index).split('\n').length;
    console.log(`${rel}:${line}`);
    console.log(`  key : ${JSON.stringify(m[2])}`);
    console.log(`  vars: {${m[3].replace(/\s+/g, ' ').trim()}}`);
  }
}
console.log(`\n合计 ${total} 处`);
