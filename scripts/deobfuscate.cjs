/**
 * 一毛AI画布 - 反混淆/反编译批处理 (Babel AST 版)
 * 输入：reference/ 下的压缩 ESM（Rolldown/esbuild 产物）
 * 处理（AST 级，比正则更可靠）：
 *   1. 常量折叠：!0 -> true, !1 -> false, void 0 -> undefined
 *   2. 剥离 (0, fn)() 逗号表达式 -> fn()
 *   3. 中文 \uXXXX 转义解码为 UTF-8（通过 generator jsescOption.minimal）
 *   4. 字符串 extra 清理，避免二次转义
 * 输出：reference/decompiled/<name>.decompiled.js
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

const ROOT = __dirname.replace(/[\\/]scripts$/, '');
const REF = path.join(ROOT, 'reference');
const OUT = path.join(REF, 'decompiled');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const TARGETS = [
  'App-B9jVCs-a.js',
  'index-CZiVAxxw.js',
  'background.js',
  'captureVideoFrame-f-OS08uG.js',
  'rolldown-runtime-aKtaBQYM.js',
];

function processFile(file) {
  const inPath = path.join(REF, file);
  if (!fs.existsSync(inPath)) {
    console.log(`SKIP ${file} (not found)`);
    return;
  }
  const base = file.replace(/\.js$/, '');
  const raw = fs.readFileSync(inPath, 'utf8');

  const ast = parser.parse(raw, {
    sourceType: 'module',
    plugins: ['jsx'],
  });

  traverse(ast, {
    // 规则 A: 一元表达式常量折叠 !0/!1/void 0
    UnaryExpression(path) {
      const { operator, argument } = path.node;
      if (operator === '!' && t.isNumericLiteral(argument)) {
        if (argument.value === 0) path.replaceWith(t.booleanLiteral(true));
        else if (argument.value === 1) path.replaceWith(t.booleanLiteral(false));
      }
      if (operator === 'void' && t.isNumericLiteral(argument) && argument.value === 0) {
        path.replaceWith(t.identifier('undefined'));
      }
    },
    // 规则 B: 剥离 (0, fn)() 序列表达式
    CallExpression(path) {
      const callee = path.node.callee;
      if (t.isSequenceExpression(callee)) {
        const exprs = callee.expressions;
        if (
          exprs.length === 2 &&
          t.isNumericLiteral(exprs[0]) &&
          exprs[0].value === 0
        ) {
          path.get('callee').replaceWith(exprs[1]);
        }
      }
    },
    // 规则 C: 清理 StringLiteral.extra，强制重新输出（解码 unicode）
    StringLiteral(path) {
      if (path.node.extra) delete path.node.extra;
    },
  });

  const output = generate(ast, {
    retainLines: false,
    compact: false,
    minified: false,
    jsescOption: { minimal: true },
  }, raw);

  const outPath = path.join(OUT, `${base}.decompiled.js`);
  fs.writeFileSync(outPath, output.code, 'utf8');
  console.log(`OK  ${file} -> decompiled/${base}.decompiled.js  (${(output.code.length / 1024).toFixed(0)} KB)`);
}

console.log('=== 一毛AI画布 反编译/反混淆 (Babel AST) ===');
for (const f of TARGETS) processFile(f);
console.log('=== 完成 ===');
