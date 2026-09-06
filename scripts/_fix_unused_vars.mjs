// 一次性脚本：根治 @typescript-eslint/no-unused-vars（根因修复，非屏蔽）
//
// 策略（与 .eslintrc.cjs 的 argsIgnorePattern:'^_' / varsIgnorePattern:'^_' 对齐）：
//  - 未使用的具名/默认/命名空间 import -> 从 import 子句移除（保留副作用 import）
//  - 未使用的回调参数(简单标识符) -> 改名成 `_` 前缀
//  - 解构中未使用的绑定 -> 【重命名】(对象解构保留属性键 `env: _env`，数组解构保留位置 `[_v, x]`)
//       —— 绝不删除元素，否则数组会错位、对象解构会丢失契约属性
//  - 未使用的 `const` 声明 -> 初值含副作用(调用/await/yield/tagged template)则保留调用、去掉绑定；否则整行删除
//  - `let`/`var` 的「只赋值从未读取」变量 -> 跳过(赋值点仍引用，删除会破坏)留待手工
//  - 类型参数/函数声明/类型别名/非标识符绑定 -> 跳过(留待手工)
//
// 安全护栏（2026-09-06 重写，全部针对旧版踩坑）：
//  1. 作用域检查：参数/解构/const 在改名或删除前，扫描其作用域范围内同名 Identifier 是否再次出现。
//     - 出现即跳过：write-only 参数(`x = 5`)、类型位置引用(`typeof x`) 改名后 tsc 必报错，
//       ESLint 无类型信息看不到这两类，脚本必须自己拦。
//     - 宁可多 skip 留给手工清单，不可改坏代码（用户铁律：不做「拿错误掩盖」）。
//  2. import 处理统一以 ImportClause 为 Map key（旧版 ImportSpecifier 分支取到 ImportDeclaration，
//     与 default/namespace 分支的 ImportClause 不是同一个 key，同一语句产生重叠编辑互相覆盖）。
//  3. 多声明 const 删除时的逗号处理：前后都跳过空白找逗号（旧版只查相邻字符，
//     `const a = 1, b = 2;` 删 b 时会留下 `const a = 1, ;` 语法错误）。
//  4. 副作用判断改为递归：表达式树内任意位置含 Call/New/Await/Yield/TaggedTemplate 即保留调用。
//  5. tsc 兜底：每轮改完全部文件后跑 `npx tsc --noEmit`，报错文件自动写回原始内容并打印清单。
//     基线 tsc = 0 错误，任何新增错误必来自本轮改动 → 回退即保无回归。
//  6. 级联收敛：no-unused-vars 删除一项可能暴露新的未用项，脚本内部循环多轮直到不再变化。
//  7. ESLint column 按 code point 计、TS position 按 UTF-16 code unit 计 → 定位时做转换，
//     避免含 emoji/非 BMP 字符行导致节点定位漂移。

import * as ts from 'typescript';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const MAX_ROUNDS = 10;

// ---------- ESLint 扫描 ----------
const ESLINT_BIN = path.join(cwd, 'node_modules', '.bin', 'eslint');
const TSC_BIN = path.join(cwd, 'node_modules', '.bin', 'tsc');

function runEslint() {
  const jsonRaw = execSync(`"${ESLINT_BIN}" src tests --ext .ts,.tsx,.js,.jsx -f json`, {
    encoding: 'utf8',
    cwd,
    maxBuffer: 1024 * 1024 * 128,
  });
  return JSON.parse(jsonRaw);
}

// ---------- TS 工具 ----------
function kindOf(p) {
  const ext = p.slice(p.lastIndexOf('.'));
  if (ext === '.tsx' || ext === '.jsx') return ts.ScriptKind.TSX;
  if (ext === '.js' || ext === '.jsx') return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

// ESLint line(1-based)/column(1-based, code point) -> TS UTF-16 position
function posFromMsg(sf, code, msg) {
  const lineStart = sf.getPositionOfLineAndCharacter(msg.line - 1, 0);
  let colPoints = msg.column - 1;
  let i = lineStart;
  while (colPoints > 0 && i < code.length) {
    i += code.codePointAt(i) > 0xffff ? 2 : 1;
    colPoints--;
  }
  return i;
}

function findInnermost(root, pos) {
  let res = null;
  function walk(n) {
    const s = n.getStart(root);
    const e = n.getEnd();
    if (s <= pos && pos < e) {
      res = n;
      n.forEachChild(walk);
    }
  }
  walk(root);
  return res;
}

// 递归判断表达式是否含副作用（调用/构造/await/yield/tagged template）
function hasSideEffect(node) {
  if (!node) return false;
  switch (node.kind) {
    case ts.SyntaxKind.CallExpression:
    case ts.SyntaxKind.NewExpression:
    case ts.SyntaxKind.AwaitExpression:
    case ts.SyntaxKind.YieldExpression:
    case ts.SyntaxKind.TaggedTemplateExpression:
      return true;
    default:
      break;
  }
  let found = false;
  node.forEachChild((c) => {
    if (!found && hasSideEffect(c)) found = true;
  });
  return found;
}

// 向上找最近的 FunctionLike（参数改名后的作用域边界）
function containingFunctionLike(node) {
  let cur = node.parent;
  while (cur) {
    if (
      ts.isFunctionDeclaration(cur) ||
      ts.isFunctionExpression(cur) ||
      ts.isArrowFunction(cur) ||
      ts.isMethodDeclaration(cur) ||
      ts.isConstructorDeclaration(cur) ||
      ts.isGetAccessor(cur) ||
      ts.isSetAccessor(cur) ||
      ts.isSourceFile(cur) ||
      ts.isModuleBlock(cur) ||
      ts.isClassStaticBlockDeclaration(cur)
    ) {
      return cur;
    }
    cur = cur.parent;
  }
  return null;
}

// 作用域范围：从 start 位置到所在函数体/模块结束（保守：含嵌套函数，宁多勿漏）
function scopeEnd(node) {
  const fn = containingFunctionLike(node);
  return fn ? fn.getEnd() : node.getSourceFile().getEnd();
}

// 判断 Identifier 是否处于「名称位」（声明名/属性键/JSX 属性名/import 键），而非值/类型引用位。
// 名称位不是变量引用：类型注解键(`idx: number`)、JSX 属性名(`idx={x}`)、对象字面量键(`{ idx: v }`)、
// 解构键(`{ idx: local }`)、属性访问名(`obj.cancel`) 等。若不排除，保守检查会把这些误当
// 「同名引用」导致该改的绑定被误拦（踩坑：`wf.cancel()` 的 cancel / `.fps` 的 fps 被误判）。
// 唯一特例：ShorthandPropertyAssignment `{ idx }` 简写键读取变量，属真引用。
// 注意：`p.name === n` 只命中「name/propertyName 位」，`a.b` 的 a、`A.B` 类型的 B、
// `typeof x` 的 x、`x = 5` 的 x 都不在此列 → 自然按引用处理（保守拦截）。
function isNamePos(n) {
  const p = n.parent;
  if (!p) return false;
  if (p.name === n || p.propertyName === n) {
    return p.kind !== ts.SyntaxKind.ShorthandPropertyAssignment;
  }
  return false;
}

// 检查 [from, to) 范围内是否存在同名 Identifier（排除 excludeStart 处自身声明）
function hasSameNameRef(sf, name, from, to, exclude) {
  let found = false;
  function walk(n) {
    if (found) return;
    if (ts.isIdentifier(n) && n.text === name) {
      const p = n.getStart(sf);
      if (p !== exclude && p >= from && p < to && !isNamePos(n)) {
        found = true;
        return;
      }
    }
    n.forEachChild(walk);
  }
  // 从整文件根开始遍历（范围过滤交由位置判断）
  walk(sf);
  return found;
}

// 收集函数体（含嵌套）内所有【值/类型引用位】的 Identifier 位置（排除名称位误报）。
// 只扫 fn.body，不扫参数列表：参数默认值里的 `.fps` 等属性名不应算「函数体内同名引用」。
function collectBodyRefs(sf, fnNode, name) {
  const refs = [];
  function walk(n) {
    if (ts.isIdentifier(n) && n.text === name && !isNamePos(n)) refs.push(n.getStart(sf));
    n.forEachChild(walk);
  }
  if (fnNode.body) fnNode.body.forEachChild(walk);
  return refs;
}

// ---------- 单文件一轮处理：返回编辑数 ----------
function processFile(filePath, code) {
  const sf = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true, kindOf(filePath));

  const importClauses = new Map(); // ImportClause -> {specs:Set, defaultUnused, namespaceUnused}
  const params = []; // {id, fn} 待重命名的未用参数
  const bindings = []; // {pattern, be} 待重命名的未用解构绑定
  const constVars = []; // 待删除的未用 const 声明
  const skipped = [];

  for (const msg of fileRes(filePath)) {
    if (msg.ruleId !== '@typescript-eslint/no-unused-vars') continue;
    const pos = posFromMsg(sf, code, msg);
    const node = findInnermost(sf, pos);
    if (!node) continue;
    const p = node.parent;
    if (!p) continue;

    if (p.kind === ts.SyntaxKind.ImportSpecifier) {
      const ic = p.parent.parent; // ImportSpecifier -> NamedImports -> ImportClause（统一 key！旧版取到 ImportDeclaration）
      if (!importClauses.has(ic)) importClauses.set(ic, { specs: new Set(), defaultUnused: false, namespaceUnused: false });
      importClauses.get(ic).specs.add(p);
    } else if (p.kind === ts.SyntaxKind.ImportClause && p.name === node) {
      if (!importClauses.has(p)) importClauses.set(p, { specs: new Set(), defaultUnused: false, namespaceUnused: false });
      importClauses.get(p).defaultUnused = true;
    } else if (p.kind === ts.SyntaxKind.NamespaceImport) {
      const ic = p.parent; // NamespaceImport -> ImportClause
      if (!importClauses.has(ic)) importClauses.set(ic, { specs: new Set(), defaultUnused: false, namespaceUnused: false });
      importClauses.get(ic).namespaceUnused = true;
    } else if (p.kind === ts.SyntaxKind.Parameter || p.kind === ts.SyntaxKind.CatchClause) {
      params.push({ id: node, fn: containingFunctionLike(node) });
    } else if (p.kind === ts.SyntaxKind.VariableDeclaration && p.name === node) {
      const vdl = p.parent;
      const isConst = (vdl.flags & ts.NodeFlags.Const) !== 0;
      if (isConst) constVars.push(p);
      else skipped.push(`${msg.line} let/var 未用，跳过（留手工）`);
    } else if (p.kind === ts.SyntaxKind.BindingElement && p.name === node) {
      bindings.push({ pattern: p.parent, be: p });
    } else {
      skipped.push(`${msg.line} ${msg.message}`);
    }
  }

  const edits = [];

  // 1) import 子句（整句重写一次，key 统一为 ImportClause）
  for (const [ic, info] of importClauses) {
    const { specs, defaultUnused, namespaceUnused } = info;
    const defaultName = ic.name && !defaultUnused ? ic.name.text : null;
    const nb = ic.namedBindings;
    let namedText = null;
    if (nb) {
      if (nb.kind === ts.SyntaxKind.NamedImports) {
        const kept = nb.elements.filter((el) => !specs.has(el)).map((el) => el.getText(sf));
        namedText = kept.length ? `{ ${kept.join(', ')} }` : null;
      } else if (nb.kind === ts.SyntaxKind.NamespaceImport) {
        namedText = namespaceUnused ? null : nb.getText(sf);
      }
    }
    let replacement;
    if (defaultName && namedText) replacement = `${defaultName}, ${namedText}`;
    else if (defaultName) replacement = defaultName;
    else if (namedText) replacement = namedText;
    else replacement = '{}'; // 全部未用 -> 保留 `import {} from`（等价副作用 import，不破坏模块执行）
    if (replacement === ic.getText(sf)) continue;
    edits.push({ start: ic.getStart(sf), end: ic.getEnd(), replacement });
  }

  // 2) 参数改名（仅简单标识符 + 函数体内零引用才改）
  for (const { id, fn } of params) {
    if (id.kind !== ts.SyntaxKind.Identifier) {
      skipped.push(`param ${id.getText(sf)} (non-identifier)`);
      continue;
    }
    const name = id.text;
    if (name.startsWith('_')) continue;
    // 函数体内出现同名 -> 可能是 write-only(`x = 5`) 或类型引用(`typeof x`)，改名必炸，跳过
    if (fn) {
      const bodyRefs = collectBodyRefs(sf, fn, name).filter((p) => p !== id.getStart(sf));
      if (bodyRefs.length > 0) {
        skipped.push(`param ${name} -> 函数体内仍有同名引用(写/类型)，跳过`);
        continue;
      }
    }
    edits.push({ start: id.getStart(sf), end: id.getEnd(sf), replacement: '_' + name });
  }

  // 3) 解构绑定重命名（绝不删除，保留键/位置）+ 作用域零引用检查
  for (const { pattern, be } of bindings) {
    const name = be.name;
    if (name.kind !== ts.SyntaxKind.Identifier) {
      skipped.push(`binding ${be.getText(sf)} (non-identifier name)`);
      continue;
    }
    if (name.text.startsWith('_')) continue;
    const exclude = name.getStart(sf);
    if (hasSameNameRef(sf, name.text, exclude + 1, scopeEnd(be), exclude)) {
      skipped.push(`binding ${name.text} -> 作用域内仍有同名引用(写/类型/shadow)，跳过`);
      continue;
    }
    const replacement =
      pattern.kind === ts.SyntaxKind.ObjectBindingPattern
        ? `${name.text}: _${name.text}`
        : `_${name.text}`;
    edits.push({ start: name.getStart(sf), end: name.getEnd(), replacement });
  }

  // 4) const 变量声明
  for (const vd of constVars) handleConstVar(vd, sf, edits, skipped);

  if (edits.length === 0) return { count: 0, skipped };
  edits.sort((a, b) => b.start - a.start);
  let text = code;
  for (const e of edits) {
    text = text.slice(0, e.start) + e.replacement + text.slice(e.end);
  }
  fs.writeFileSync(filePath, text);
  return { count: edits.length, skipped };
}

function handleConstVar(vd, sf, edits, skipped) {
  const vdl = vd.parent;
  const stmt = vdl.parent;
  const name = vd.name;
  const line = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  if (name.kind !== ts.SyntaxKind.Identifier) {
    skipped.push(`${line(vd)} const ${vd.name?.getText?.(sf) ?? '?'} (non-identifier binding)`);
    return;
  }
  // 作用域内同名引用检查（防 typeof x 等类型引用、write 引用）
  const exclude = name.getStart(sf);
  if (hasSameNameRef(sf, name.text, exclude + 1, scopeEnd(vd), exclude)) {
    skipped.push(`${line(vd)} const ${name.text} -> 作用域内仍有同名引用(类型/shadow)，跳过`);
    return;
  }

  // 多声明：只删本声明 + 一个逗号（前后都跳过空白找逗号）
  if (vdl.declarations.length > 1) {
    let s = vd.getStart(sf);
    let e = vd.getEnd();
    const txt = sf.text;
    // 先看尾逗号
    let j = e;
    while (j < txt.length && (txt[j] === ' ' || txt[j] === '\t' || txt[j] === '\r' || txt[j] === '\n')) j++;
    if (j < txt.length && txt[j] === ',') {
      edits.push({ start: s, end: j + 1, replacement: '' });
      return;
    }
    // 再看前逗号
    let i = s - 1;
    while (i >= 0 && (txt[i] === ' ' || txt[i] === '\t' || txt[i] === '\r' || txt[i] === '\n')) i--;
    if (i >= 0 && txt[i] === ',') {
      edits.push({ start: i, end: e, replacement: '' });
      return;
    }
    // 都没有逗号（不应发生）-> 保守跳过
    skipped.push(`${line(vd)} const ${name.text} 多声明无逗号可删，跳过`);
    return;
  }

  if (stmt.kind !== ts.SyntaxKind.VariableStatement) {
    skipped.push(`${line(vd)} const ${name.text} in non-statement; skipped`);
    return;
  }
  // 带 export 修饰符（export const / 被 re-export）的一律跳过：删除会改变模块导出面
  if (stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
    skipped.push(`${line(vd)} const ${name.text} is exported; skipped`);
    return;
  }

  const init = vd.initializer;
  if (hasSideEffect(init)) {
    // 保留调用、去掉绑定：`const x = await f();` -> `await f();`
    edits.push({ start: stmt.getStart(sf), end: stmt.getEnd(), replacement: init.getText(sf) + ';' });
  } else {
    let s = stmt.getStart(sf);
    let e = stmt.getEnd(sf);
    const full = sf.text;
    while (e < full.length && full[e] === ';') e++;
    if (e < full.length && full[e] === '\n') e++;
    else if (e < full.length && full[e] === '\r' && full[e + 1] === '\n') e += 2;
    edits.push({ start: s, end: e, replacement: '' });
  }
}

// ---------- tsc 兜底回退 ----------
function tscErrorFiles() {
  let out;
  try {
    out = execSync(`"${TSC_BIN}" --noEmit 2>&1 || true`, { encoding: 'utf8', cwd, maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return [];
  }
  const files = new Set();
  for (const line of out.split('\n')) {
    const m = line.match(/^([^(]+)\((\d+),\d+\): error/);
    if (m) {
      const p = path.resolve(cwd, m[1]);
      files.add(p);
    }
  }
  return [...files];
}

// ---------- 主流程：级联收敛 ----------
let totalApplied = 0;
let round = 0;

// eslint 结果按文件分组，方便 processFile 读取
const byFile = new Map();
function refillByFile() {
  byFile.clear();
  const results = runEslint();
  for (const r of results) {
    const arr = byFile.get(r.filePath) ?? [];
    arr.push(...r.messages);
    byFile.set(r.filePath, arr);
  }
}
refillByFile();
function fileRes(p) {
  return byFile.get(p) ?? [];
}

const allSkipped = new Map(); // filePath -> Set<string>
const backups = new Map(); // filePath -> 原始内容（round 级，供 tsc 回退）
const poison = new Set(); // tsc 回退过的文件：本轮不再自动改（留人工，避免改→回退死循环）

function addSkipped(filePath, msg) {
  let s = allSkipped.get(filePath);
  if (!s) {
    s = new Set();
    allSkipped.set(filePath, s);
  }
  s.add(msg);
}

while (round < MAX_ROUNDS) {
  round++;
  backups.clear();
  let roundEdits = 0;

  for (const [filePath, messages] of byFile) {
    if (poison.has(filePath)) continue;
    if (!messages.some((m) => m.ruleId === '@typescript-eslint/no-unused-vars')) continue;
    let code;
    try {
      code = fs.readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }
    backups.set(filePath, code);
    const { count, skipped } = processFile(filePath, code);
    roundEdits += count;
    for (const s of skipped) addSkipped(filePath, s);
  }

  totalApplied += roundEdits;
  console.log(`round ${round}: applied ${roundEdits} edits`);

  if (roundEdits === 0) break;

  // tsc 兜底：回退报错文件
  const badFiles = tscErrorFiles();
  if (badFiles.length) {
    for (const f of badFiles) {
      const orig = backups.get(f);
      if (orig !== undefined) {
        fs.writeFileSync(f, orig);
        poison.add(f);
        addSkipped(f, 'tsc 校验失败已整体回退，本文件需人工处理（poison）');
        console.log(`  tsc 回退: ${path.relative(cwd, f)}`);
      } else {
        console.log(`  ⚠ tsc 报错但非本轮改动文件: ${path.relative(cwd, f)}（未回退，需人工查）`);
      }
    }
  }

  // 重扫一轮（级联：删一项可能暴露新的未用项）
  refillByFile();
}

console.log(`\ntotal applied edits: ${totalApplied} (rounds: ${round})`);

const skippedCount = [...allSkipped.values()].reduce((n, a) => n + a.size, 0);
if (skippedCount) {
  console.log(`\n--- skipped (${skippedCount}) 需人工处理 ---`);
  for (const [f, arr] of allSkipped) {
    console.log(`${path.relative(cwd, f)}:`);
    for (const s of arr) console.log(`  ${s}`);
  }
}

// 终态校验
console.log('\n--- 终态校验 ---');
try {
  const jsonRaw = execSync(`"${ESLINT_BIN}" src tests --ext .ts,.tsx,.js,.jsx -f compact`, {
    encoding: 'utf8',
    cwd,
    maxBuffer: 1024 * 1024 * 128,
  });
  const m = jsonRaw.match(/(\d+) problems$/m);
  console.log(`eslint remaining: ${m ? m[1] : 'unknown'}`);
} catch (err) {
  console.log(`eslint remaining: (eslint exit code ${err.status})`);
}
