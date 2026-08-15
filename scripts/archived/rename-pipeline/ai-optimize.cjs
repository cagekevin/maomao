#!/usr/bin/env node
'use strict';
/**
 * AI 优化器（AI-Ready 视图生成器）——专为「接手改代码的 LLM」定制的结构展开脚本
 *
 * 痛点（来自任务书/协作实践）：AI 改混淆代码最怕三件事，本脚本逐一拆解：
 *   1) 合并变量声明  const a=1, b=2;          ->  const a=1; const b=2;   （拆开，便于局部替换单条）
 *   2) 缺大括号的控制流  if (x) foo();          ->  if (x) { foo(); }       （强制 {}，避免 AI 改写时格式崩）
 *   3) 语句级逗号表达式  a(), b(), c();          ->  a(); b(); c();          （拆开，降低逻辑误读）
 * 外加 !0 -> true / !1 -> false（与 deobfuscate 同源，确保本视图自带，不依赖 src/bundle 是否跑过 deobfuscate）。
 * 最后用 prettier 统一排版（printWidth 120 / trailingComma none，少换行、少噪音）。
 *
 * 铁律：输出到 src/bundle-ai/（只读视图），绝不写回 src/bundle（构建源，须保持与 build/smoke 一致）。
 *       AI 读 bundle-ai/ 理解结构，改代码时仍定位回 src/bundle 的精确行/符号，做局部替换。
 *
 * 用法：node scripts/ai-optimize.cjs   （建议在 beautify 之后；可重跑，幂等）
 */
const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

const ROOT = path.resolve(__dirname, '..', '..').replace(/\\/g, '/');
const BUNDLE = path.join(ROOT, 'src', 'bundle').replace(/\\/g, '/');
const OUT = path.join(ROOT, 'src', 'bundle-ai').replace(/\\/g, '/');

if (!fs.existsSync(BUNDLE)) {
  console.error('未找到 src/bundle：', BUNDLE, '请先运行 scripts/beautify.cjs');
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });

const stats = { files: 0, varSplit: 0, braces: 0, commas: 0, bool: 0, prettierFail: 0 };

function aiPlugin({ types: t }) {
  return {
    name: 'a22-ai-optimize',
    visitor: {
      // 1) !0 -> true / !1 -> false（其余 !n 不动，避免误判）
      UnaryExpression(p) {
        const { operator, argument } = p.node;
        if (operator === '!' && argument.type === 'NumericLiteral') {
          if (argument.value === 0) { p.replaceWith(t.booleanLiteral(true)); stats.bool++; }
          else if (argument.value === 1) { p.replaceWith(t.booleanLiteral(false)); stats.bool++; }
        }
      },
      // 2) 合并变量声明拆开：仅块级或模块顶层（非 export 包裹），for 循环 init 除外（parent 是 ForStatement）
      VariableDeclaration(p) {
        const parent = p.parentPath;
        if (p.node.declarations.length > 1 && (parent.isBlockStatement() || parent.isProgram())) {
          const news = p.node.declarations.map((decl) => t.variableDeclaration(p.node.kind, [decl]));
          p.replaceWithMultiple(news);
          stats.varSplit += news.length - 1;
        }
      },
      // 3) if 强制大括号（consequent 必加；alternate 仅在非 {} 且非 else-if 时加，保留 else-if 链）
      IfStatement(p) {
        if (p.node.consequent && p.node.consequent.type !== 'BlockStatement') {
          p.node.consequent = t.blockStatement([p.node.consequent]);
          stats.braces++;
        }
        const alt = p.node.alternate;
        if (alt && alt.type !== 'BlockStatement' && alt.type !== 'IfStatement') {
          p.node.alternate = t.blockStatement([alt]);
          stats.braces++;
        }
      },
      // 4) 循环体强制大括号（for/for-in/for-of/while/do-while）
      'ForStatement|ForInStatement|ForOfStatement|WhileStatement|DoWhileStatement'(p) {
        if (p.node.body && p.node.body.type !== 'BlockStatement') {
          p.node.body = t.blockStatement([p.node.body]);
          stats.braces++;
        }
      },
      // 5) 语句级逗号序列拆开：a(), b(), c(); -> a(); b(); c();（仅表达式语句位置，值上下文不动）
      ExpressionStatement(p) {
        const e = p.node.expression;
        if (e && e.type === 'SequenceExpression') {
          const stmts = e.expressions.map((ex) => t.expressionStatement(ex));
          p.replaceWithMultiple(stmts);
          stats.commas += stmts.length - 1;
        }
      },
    },
  };
}

(async () => {
  const files = fs.readdirSync(BUNDLE).filter((f) => f.endsWith('.js')).sort();
  if (files.length === 0) {
    console.error('src/bundle 下没有 .js chunk，请先运行 scripts/beautify.cjs');
    process.exit(1);
  }
  let prettier;
  try { prettier = require('prettier'); } catch { prettier = null; }

  for (const f of files) {
    const fp = path.join(BUNDLE, f).replace(/\\/g, '/');
    const code = fs.readFileSync(fp, 'utf8');
    let generated = code;
    try {
      const res = babel.transformSync(code, {
        parserOpts: { sourceType: 'module', plugins: ['jsx'] },
        plugins: [aiPlugin],
        generatorOpts: { compact: false, retainLines: false },
        babelrc: false,
        configFile: false,
        comments: true,
      });
      generated = res.code;
    } catch (e) {
      console.warn('  [babel 解析失败，原样写出]', f, '-', String(e.message).split('\n')[0]);
    }

    let finalCode = generated;
    if (prettier) {
      try {
        finalCode = await prettier.format(generated, {
          parser: 'babel',
          printWidth: 120,
          tabWidth: 2,
          singleQuote: true,
          semi: true,
          trailingComma: 'none',
        });
      } catch (e) {
        stats.prettierFail++;
        console.warn('  [prettier 失败，用 babel 生成结果]', f, '-', String(e.message).split('\n')[0]);
      }
    }
    fs.writeFileSync(path.join(OUT, f).replace(/\\/g, '/'), finalCode);
    stats.files++;
    console.log('ai-optimize ->', path.join('src/bundle-ai', f).replace(/\\/g, '/'));
  }

  console.log('\n=== AI 优化完成（输出到 src/bundle-ai/，只读，未触碰 src/bundle）===');
  console.log('文件数            :', stats.files);
  console.log('合并声明拆开      :', stats.varSplit);
  console.log('强制大括号(控制流):', stats.braces);
  console.log('逗号序列拆开      :', stats.commas);
  console.log('!0/!1->true/false :', stats.bool);
  if (stats.prettierFail) console.log('prettier 退化(babel):', stats.prettierFail);
})();
