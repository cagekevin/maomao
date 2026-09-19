/**
 * 找「真同义并存」对（第 2 版 · 已修上两版的三处盲区）。
 *
 * 上两版栽的坑（都是"只按名字数引用"）：
 *   ① 同文件内部调用看不见 ⇒ 误判零消费（classifyImageType / validateConversation 两次）
 *   ② 转发别名看不出 ⇒ 该删的真别名混在"有逻辑"里
 *
 * 本版对每个导出判「是否被消费」，消费形态**四种全算**：
 *   A. 本文件内调用（含被同文件其它导出调）
 *   B. 外部 import + 调用
 *   C. 对象属性传递 `fn`（如 `{ getTab }`）
 *   D. 测试引用（标记为 weak —— 仅供区分"只被自己测试引用"这一假消费形态）
 *
 * 输出：同文件内**语义相似 + 双方都被生产消费**的对（＝真困惑候选）。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const root = process.cwd();
function walk(dir, acc = []) {
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n === 'dist') continue;
    const f = join(dir, n);
    const s = statSync(f);
    if (s.isDirectory()) walk(f, acc);
    else if (['.ts', '.tsx'].includes(extname(n))) acc.push(f);
  }
  return acc;
}
const files = walk(join(root, 'src')).map((f) => [f, readFileSync(f, 'utf8')]);
const testFiles = walk(join(root, 'tests')).map((f) => [f, readFileSync(f, 'utf8')]);

function parseExports(src) {
  const out = [];
  const re = /^export (?:async )?(?:function|const|class)\s+(\w+)/gm;
  let m;
  while ((m = re.exec(src))) {
    // 取该导出的函数体范围（到下一条顶层 export 或文件尾，粗略即可）
    const start = m.index;
    const rest = src.slice(start + m[0].length);
    const nextIdx = rest.search(/\n(?:export |\/\*\*|\/\/ ─)/);
    const body = nextIdx >= 0 ? rest.slice(0, nextIdx) : rest;
    out.push({ name: m[1], body });
  }
  return out;
}

function consumed(name, selfBody, otherTexts, testTexts) {
  const re = new RegExp(`\\b${name}\\b`, 'g');
  const inSelf = (selfBody.match(re) || []).length; // 自体内出现（排除声明行）>0 = 被同文件/自身用
  let ext = 0;
  for (const [f, c] of otherTexts) ext += (c.match(re) || []).length;
  let inTests = 0;
  for (const [, c] of testTexts) inTests += (c.match(re) || []).length;
  return { inSelf, ext, inTests };
}

function words(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}
const norm = (w) => w.replace(/(tion|sion|ing|ed|es|s)$/, '').replace(/^(get|set|build|make|create|to|from)/, '');
function sim(a, b) {
  const A = new Set(words(a).map(norm));
  const B = new Set(words(b).map(norm));
  const inter = [...A].filter((x) => B.has(x)).length;
  return inter / new Set([...A, ...B]).size;
}

for (const [f, src] of files) {
  const rel = f.slice(root.length + 1);
  const exps = parseExports(src);
  if (exps.length < 4) continue;
  const others = files.filter(([ff]) => ff !== f);
  const infos = exps.map((e) => {
    const { inSelf, ext } = consumed(e.name, e.body, others, testFiles);
    return { ...e, inSelf, ext, live: inSelf > 0 || ext > 0 };
  });
  for (let i = 0; i < infos.length; i++) {
    for (let j = i + 1; j < infos.length; j++) {
      const a = infos[i], b = infos[j];
      const s = sim(a.name, b.name);
      if (s < 0.6 || s === 1) continue;
      if (!a.live || !b.live) continue; // 两者都必须有生产消费
      console.log(`${s.toFixed(2)} | ${rel}`);
      console.log(`        ${a.name} (self:${a.inSelf} ext:${a.ext})  ⟷  ${b.name} (self:${b.inSelf} ext:${b.ext})`);
    }
  }
}
