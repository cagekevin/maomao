#!/usr/bin/env node
/**
 * deobfuscate-rename.cjs
 * 消费 docs/func-mapping.txt + docs/var-mapping.txt，对反编译源码做
 * 「作用域感知」的安全重命名（基于 @babel 工具链，项目已自带，零新依赖）。
 *
 * 关键安全点：
 *  1. 仅重命名「模块级绑定」——通过 programScope.getBinding(name) 获取，
 *     嵌套函数内的同名参数（遮蔽）不会被误伤（babel 按 binding 追踪引用）。
 *  2. import 源导出名不动，只改本地别名（import { X as Pe } → import { X as jsxRuntime }）。
 *  3. 若可读名已存在冲突绑定则跳过，避免产生非法代码。
 *  4. 标注「局部 / 非模块级」的条目（如 Xt=tabInstanceRef）自动跳过。
 *
 * 用法：node scripts/deobfuscate-rename.cjs
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;

const ROOT = path.resolve(__dirname, '..');
const DECOMPILED = path.join(ROOT, 'reference/decompiled/App-B9jVCs-a.decompiled.js');
const FUNC_MAP = path.join(ROOT, 'docs/func-mapping.txt');
const VAR_MAP = path.join(ROOT, 'docs/var-mapping.txt');
const OUT = path.join(ROOT, 'reference/decompiled/App-B9jVCs-a.deobfuscated.js');

// ── 1. 解析映射表 ──
function loadMap(file) {
  const text = fs.readFileSync(file, 'utf8');
  const map = {};
  const skippedLocal = [];
  for (const line of text.split('\n')) {
    if (line.trim().startsWith('#')) continue;
    const m = line.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*#/);
    if (!m) continue;
    const oldName = m[1], newName = m[2];
    if (/局部|非模块级/.test(line)) { skippedLocal.push(oldName); continue; }
    if (map[oldName] && map[oldName] !== newName) {
      console.warn(`  ⚠️ 映射冲突: ${oldName} => ${map[oldName]} / ${newName}（保留前者）`);
    }
    map[oldName] = map[oldName] || newName;
  }
  return { map, skippedLocal };
}

const f = loadMap(FUNC_MAP);
const v = loadMap(VAR_MAP);
const map = { ...v.map, ...f.map }; // func 覆盖 var（同名词以 func 为准）
const skippedLocal = [...new Set([...v.skippedLocal, ...f.skippedLocal])];
console.log(`映射表: func ${Object.keys(f.map).length} + var ${Object.keys(v.map).length} = 合并 ${Object.keys(map).length} 条；跳过局部 ${skippedLocal.length} 条`);

// ── 2. 解析 AST ──
console.log(`解析: ${path.basename(DECOMPILED)} ...`);
const code = fs.readFileSync(DECOMPILED, 'utf8');
const ast = parser.parse(code, {
  sourceType: 'module',
  plugins: ['jsx'],
});

// ── 3. 作用域感知重命名 ──
const stats = { applied: 0, notFound: 0, collision: 0, notFoundList: [] };
traverse(ast, {
  Program(p) {
    const prog = p.scope;
    for (const [oldName, newName] of Object.entries(map)) {
      const binding = prog.getBinding(oldName);
      if (!binding || binding.scope !== prog) { stats.notFound++; stats.notFoundList.push(oldName); continue; }
      if (prog.hasBinding(newName) && prog.getBinding(newName) !== binding) { stats.collision++; continue; }
      try { binding.scope.rename(oldName, newName); stats.applied++; }
      catch (e) { stats.collision++; console.warn(`  ⚠️ rename 失败 ${oldName}: ${e.message}`); }
    }
  },
});

// ── 4. 生成输出 ──
console.log(`生成: ${path.basename(OUT)} ...`);
const output = generate(ast, { concise: false, jsescOption: { minimal: true } }, code).code;
fs.writeFileSync(OUT, output);

console.log('──────── 结果 ────────');
console.log(`  成功重命名 : ${stats.applied}`);
console.log(`  跳过(无模块级绑定): ${stats.notFound}`);
console.log(`  跳过(可读名冲突): ${stats.collision}`);
console.log(`  跳过(标注局部): ${skippedLocal.length} -> ${skippedLocal.join(', ')}`);
if (stats.notFoundList.length) {
  console.log(`  notFound 样例(前40): ${stats.notFoundList.slice(0, 40).join(', ')}`);
}
console.log(`输出已写入: ${OUT}`);
