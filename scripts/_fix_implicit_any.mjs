// 批量消除 tests 下隐式 any 等严格类型错误。支持 --dry（只打印不写）。
// 处理范围：
//   TS7006 形参 / TS7005+TS7034 变量声明 / TS7019 rest 参数 / TS7031 解构绑定 / TS6133 未使用
// 安全策略：
//   - .ts/.tsx 用 : any / : any[] 后缀注解；.mjs(JS) 用 /** @type {any} */ 前缀 JSDoc。
//   - 变量只在「声明位置」插（前一词为 let/const/var 或多声明逗号前），使用点/赋值点跳过。
//   - 形参后接 ./(/[ 视为误报跳过。
//   - 解构绑定：在解构模式 { 前插 JSDoc(.mjs) 或匹配 } 后插 : any(.ts)。
//   - 未使用：重命名为 _name（仅当为普通形参/变量，解构内跳过）。
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();
const DRY = process.argv.includes('--dry');

function runTsc() {
  try {
    const out = execFileSync('npx', ['tsc', '--noEmit'], {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    return out.split('\n').filter((l) => /^tests\//.test(l));
  } catch (e) {
    return ((e.stdout || '') + (e.stderr || '')).split('\n').filter((l) => /^tests\//.test(l));
  }
}

const HANDLED = new Set(['TS7005', 'TS7006', 'TS7034', 'TS7019', 'TS7031', 'TS6133']);
const re = /^(tests\/\S+\.(?:ts|tsx|mjs))\((\d+),(\d+)\): error (TS\d+): .*?'([^']+)'/;

const lines = runTsc();
const opsByFile = {};
const skipped = [];
for (const l of lines) {
  const m = l.match(re);
  if (!m) continue;
  const [, file, ln, col, code, name] = m;
  if (!HANDLED.has(code)) { skipped.push(l.trim()); continue; }
  (opsByFile[file] ||= []).push({ ln: +ln, col: +col, code, name });
}

let totalEdits = 0;
const plan = [];

for (const [file, ops] of Object.entries(opsByFile)) {
  const abs = path.join(ROOT, file);
  const src = readFileSync(abs, 'utf8');
  const arr = src.split('\n');
  const isMjs = file.endsWith('.mjs');
  const edits = [];

  const absOffsetOf = (lineIdx, inLine) => {
    let o = 0;
    for (let i = 0; i < lineIdx; i++) o += arr[i].length + 1;
    return o + inLine;
  };

  for (const op of ops) {
    const lineIdx = op.ln - 1;
    const lineStr = arr[lineIdx];
    if (lineStr === undefined) { skipped.push(`${file}:${op.ln} 行不存在`); continue; }
    const col0 = op.col - 1;
    const idEnd = col0 + op.name.length;
    const slice = lineStr.slice(col0, idEnd);

    if (op.code === 'TS7019') {
      // rest 参数
      if (isMjs) {
        edits.push({ offset: absOffsetOf(lineIdx, col0), text: '/** @type {any[]} */ ', ln: op.ln, ctx: lineStr.trim() });
      } else {
        const rm = lineStr.match(new RegExp('\\.\\.\\.\\s*' + op.name + '\\b'));
        if (!rm) { skipped.push(`${file}:${op.ln} 找不到 rest ...${op.name}`); continue; }
        edits.push({ offset: absOffsetOf(lineIdx, rm.index + rm[0].length), text: ': any[]', ln: op.ln, ctx: lineStr.trim() });
      }
      continue;
    }

    if (op.code === 'TS7031') {
      // 解构绑定元素：找包含它的 { 及其匹配 }
      let depth = 0, bracePos = -1;
      for (let i = col0 - 1; i >= 0; i--) {
        const c = lineStr[i];
        if (c === '}') depth++;
        else if (c === '{') { if (depth === 0) { bracePos = i; break; } depth--; }
      }
      if (bracePos < 0) { skipped.push(`${file}:${op.ln} 找不到解构 {`); continue; }
      if (isMjs) {
        edits.push({ offset: absOffsetOf(lineIdx, bracePos), text: '/** @type {any} */ ', ln: op.ln, ctx: lineStr.trim() });
      } else {
        // 找匹配 }
        let d = 0, closePos = -1;
        for (let i = bracePos; i < lineStr.length; i++) {
          if (lineStr[i] === '{') d++;
          else if (lineStr[i] === '}') { d--; if (d === 0) { closePos = i; break; } }
        }
        if (closePos < 0) { skipped.push(`${file}:${op.ln} 找不到匹配 }`); continue; }
        edits.push({ offset: absOffsetOf(lineIdx, closePos + 1), text: ': any', ln: op.ln, ctx: lineStr.trim() });
      }
      continue;
    }

    if (op.code === 'TS6133') {
      // 未使用：重命名为 _name（仅普通形参/变量；解构内跳过）
      if (slice !== op.name) { skipped.push(`${file}:${op.ln} 标识符不匹配`); continue; }
      const before = lineStr.slice(0, col0);
      const prevWord = (before.match(/(\w+)\s*$/) || [])[1];
      const prevChar = lineStr[col0 - 1];
      const isSimple = prevWord === 'let' || prevWord === 'const' || prevWord === 'var' || prevChar === '(' || prevChar === ',';
      if (!isSimple) { skipped.push(`${file}:${op.ln} '${op.name}' 解构/非常规位置未使用，跳过`); continue; }
      if (op.name.startsWith('_')) { skipped.push(`${file}:${op.ln} '${op.name}' 已带下划线`); continue; }
      edits.push({ offset: absOffsetOf(lineIdx, col0), text: '_' + op.name, ln: op.ln, ctx: lineStr.trim(), replaceLen: op.name.length });
      continue;
    }

    // TS7006 形参 / TS7005+TS7034 变量
    if (slice !== op.name) {
      skipped.push(`${file}:${op.ln} 列 ${op.col} 处不是标识符 '${op.name}'（实际='${slice}'）`);
      continue;
    }
    if (op.code === 'TS7006') {
      if (!isMjs) {
        const nextChar = lineStr[idEnd];
        if (nextChar === '.' || nextChar === '(' || nextChar === '[') {
          skipped.push(`${file}:${op.ln} 形参 '${op.name}' 后接 '${nextChar}' 疑似误报，跳过`); continue;
        }
      }
      if (isMjs) edits.push({ offset: absOffsetOf(lineIdx, col0), text: '/** @type {any} */ ', ln: op.ln, ctx: lineStr.trim() });
      else edits.push({ offset: absOffsetOf(lineIdx, idEnd), text: ': any', ln: op.ln, ctx: lineStr.trim() });
      continue;
    }

    // TS7005 / TS7034 变量：仅声明位置
    const before = lineStr.slice(0, col0);
    const prevWord = (before.match(/(\w+)\s*$/) || [])[1];
    const prevChar = lineStr[col0 - 1];
    const isDecl = prevWord === 'let' || prevWord === 'const' || prevWord === 'var' || prevChar === ',';
    if (!isDecl) {
      skipped.push(`${file}:${op.ln} '${op.name}' 非声明位置（prevWord='${prevWord}' prevChar='${prevChar}'），跳过`);
      continue;
    }
    const nextChar = lineStr[idEnd];
    if (nextChar === '.' || nextChar === '(' || nextChar === '[') {
      skipped.push(`${file}:${op.ln} '${op.name}' 后接 '${nextChar}' 疑似使用点，跳过`); continue;
    }
    if (isMjs) edits.push({ offset: absOffsetOf(lineIdx, col0), text: '/** @type {any} */ ', ln: op.ln, ctx: lineStr.trim() });
    else edits.push({ offset: absOffsetOf(lineIdx, idEnd), text: ': any', ln: op.ln, ctx: lineStr.trim() });
  }

  if (edits.length === 0) continue;
  // 去重：同一偏移（如解构模式共享的 } 或 {）只插一次
  const seen = new Set();
  const deduped = [];
  for (const e of edits) {
    const key = e.offset + '::' + e.text;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(e);
  }
  edits.length = 0;
  edits.push(...deduped);
  edits.sort((a, b) => b.offset - a.offset);

  if (DRY) {
    for (const e of edits) {
      plan.push({ file, ln: e.ln, text: e.text, ctx: e.ctx });
      totalEdits++;
    }
  } else {
    let s = src;
    for (const e of edits) {
      const repl = e.replaceLen ? s.slice(e.offset, e.offset + e.replaceLen) : '';
      s = s.slice(0, e.offset) + e.text + s.slice(e.offset + (e.replaceLen || 0));
    }
    writeFileSync(abs, s);
    totalEdits += edits.length;
  }
}

if (DRY) {
  console.log(`[DRY-RUN] 计划修改 ${totalEdits} 处，涉及 ${Object.keys(opsByFile).length} 个文件。不写入任何文件。`);
  console.log('--- 计划明细（前 80）---');
  for (const p of plan.slice(0, 80)) console.log(`${p.file}:${p.ln}  +${p.text}   | ${p.ctx}`);
  if (plan.length > 80) console.log(`... 其余 ${plan.length - 80} 处省略`);
} else {
  console.log(`[APPLY] 实际修改 ${totalEdits} 处。`);
}
console.log(`\n[跳过/未处理] 共 ${skipped.length} 条：`);
for (const s of skipped.slice(0, 50)) console.log('  - ' + s);
if (skipped.length > 50) console.log(`  ... 其余 ${skipped.length - 50} 条省略`);
