/**
 * 第 1 步：AI 结构展开（升级版）
 * - 拆分合并变量声明 (var a=1,b=2 → var a=1; var b=2)
 * - 强制补全所有控制流大括号 (if/for/while/for-in/for-of)
 * - 还原布尔值 (!0→true, !1→false, void 0→undefined)
 * - 剥离 (0, fn)() 零调用
 * - 展开独立逗号表达式 (a(),b() → a(); b())
 * - 嵌入式逗号提权 (if(a=1,b()) → a=1; if(b()))
 * - 展开三元运算符 (return a?b:c → if/else)
 * - 展开逻辑表达式 (a&&b() → if(a){b()})
 * - 单行箭头函数强制转 block
 *
 * 用法：node 01_ai_expand.cjs <输入> <输出>
 */
const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');
const prettier = require('prettier');

const inputFile = process.argv[2];
const outputFile = process.argv[3];
if (!inputFile || !outputFile) {
  console.error('用法: node 01_ai_expand.cjs <输入> <输出>');
  process.exit(1);
}

async function run() {
  const inSize = (fs.statSync(inputFile).size / 1024).toFixed(0);
  console.log(`⏳ 读取: ${inputFile} (${inSize}KB)`);
  const rawCode = fs.readFileSync(inputFile, 'utf-8');
  const ast = parser.parse(rawCode, { sourceType: 'module', plugins: ['jsx'] });
  let changes = 0;

  function ok(p) {
    try { return !p.removed && p.node; } catch (e) { return false; }
  }

  traverse(ast, {
    // ========== 0. 安全守卫 ==========
    VariableDeclaration(path) {
      try {
        if (path.removed || !path.node || !path.node.declarations) return;
      } catch (e) { return; }
      const declCount = path.node.declarations.length;
      if (
        declCount > 1 &&
        (path.parentPath.isBlockStatement() || path.parentPath.isProgram())
      ) {
        const nodes = path.node.declarations.map(d => t.variableDeclaration(path.node.kind, [d]));
        path.replaceWithMultiple(nodes);
        changes += declCount - 1;
      }
    },

    // ========== 新增：变量初始化中的隐式逗号提权 ==========
    VariableDeclarator(path) {
      if (!ok(path)) return;
      if (t.isSequenceExpression(path.node.init)) {
        const exprs = path.node.init.expressions.slice();
        const last = exprs.pop();
        const stmts = exprs.map((e) => t.expressionStatement(e));
        const stmtParent = path.getStatementParent();
        if (stmtParent && stmts.length > 0) {
          stmtParent.insertBefore(stmts);
        }
        path.node.init = last;
        changes += stmts.length;
      }
    },

    // ========== 1. 布尔值 / void 0 还原 ==========
    UnaryExpression(path) {
      if (!ok(path)) return;
      if (path.node.operator === '!' && t.isNumericLiteral(path.node.argument)) {
        path.replaceWith(t.booleanLiteral(path.node.argument.value === 0));
        changes++;
      } else if (path.node.operator === 'void' && t.isNumericLiteral(path.node.argument, { value: 0 })) {
        path.replaceWith(t.identifier('undefined'));
        changes++;
      }
    },

    // ========== 2. 剥离 (0, fn)() → fn() ==========
    CallExpression(path) {
      if (!ok(path)) return;
      const callee = path.node.callee;
      if (
        t.isSequenceExpression(callee) &&
        callee.expressions.length === 2 &&
        t.isNumericLiteral(callee.expressions[0], { value: 0 })
      ) {
        path.node.callee = callee.expressions[1];
        changes++;
      }
    },

    // ========== 3. 嵌入式逗号表达式提权 ==========
    SequenceExpression(path) {
      if (!ok(path)) return;
      // 非独立语句的逗号表达式 → 提取前面的表达式到语句上方
      if (!path.parentPath.isExpressionStatement() && !path.parentPath.isReturnStatement()) {
        const exprs = path.node.expressions.slice();
        const last = exprs.pop();
        const stmts = exprs.map(e => t.expressionStatement(e));
        const stmtParent = path.getStatementParent();
        if (stmtParent && stmts.length > 0) {
          stmtParent.insertBefore(stmts);
        }
        path.replaceWith(last);
        changes += stmts.length;
      }
    },

    // ========== 4. 独立逗号表达式展开 ==========
    ExpressionStatement(path) {
      if (!ok(path)) return;
      const expr = path.node.expression;

      // 4a. a(), b() → a(); b()
      if (t.isSequenceExpression(expr)) {
        const stmts = expr.expressions.map(e => t.expressionStatement(e));
        path.replaceWithMultiple(stmts);
        changes++;
        return;
      }

      // 4b. a && b() → if (a) { b() }
      if (t.isLogicalExpression(expr) && expr.operator === '&&') {
        path.replaceWith(
          t.ifStatement(expr.left, t.blockStatement([t.expressionStatement(expr.right)]))
        );
        changes++; return;
      }
      if (t.isLogicalExpression(expr) && expr.operator === '||') {
        path.replaceWith(
          t.ifStatement(
            t.unaryExpression('!', expr.left),
            t.blockStatement([t.expressionStatement(expr.right)])
          )
        );
        changes++; return;
      }

      // 4c. a = b ? c : d → if/else
      if (t.isAssignmentExpression(expr) && t.isConditionalExpression(expr.right)) {
        const c = expr.right;
        path.replaceWith(
          t.ifStatement(
            c.test,
            t.blockStatement([t.expressionStatement(t.assignmentExpression(expr.operator, expr.left, c.consequent))]),
            t.blockStatement([t.expressionStatement(t.assignmentExpression(expr.operator, expr.left, c.alternate))])
          )
        );
        changes++; return;
      }
    },

    // ========== 5. return 三元展开 ==========
    ReturnStatement(path) {
      if (!ok(path)) return;
      const arg = path.node.argument;
      if (!arg) return;

      if (t.isSequenceExpression(arg)) {
        const exprs = arg.expressions.slice();
        const last = exprs.pop();
        const stmts = exprs.map(e => t.expressionStatement(e));
        stmts.push(t.returnStatement(last));
        path.replaceWithMultiple(stmts);
        changes++; return;
      }

      if (t.isConditionalExpression(arg)) {
        path.replaceWith(
          t.ifStatement(
            arg.test,
            t.blockStatement([t.returnStatement(arg.consequent)]),
            t.blockStatement([t.returnStatement(arg.alternate)])
          )
        );
        changes++;
      }
    },

    // ========== 6. 强制补全大括号 ==========
    IfStatement(path) {
      if (!ok(path)) return;
      if (!t.isBlockStatement(path.node.consequent)) {
        path.node.consequent = t.blockStatement([path.node.consequent]); changes++;
      }
      if (path.node.alternate && !t.isBlockStatement(path.node.alternate) && !t.isIfStatement(path.node.alternate)) {
        path.node.alternate = t.blockStatement([path.node.alternate]); changes++;
      }
    },
    ForStatement(path) { if (!ok(path)) return; if (!t.isBlockStatement(path.node.body)) { path.node.body = t.blockStatement([path.node.body]); changes++; } },
    WhileStatement(path) { if (!ok(path)) return; if (!t.isBlockStatement(path.node.body)) { path.node.body = t.blockStatement([path.node.body]); changes++; } },
    ForInStatement(path) { if (!ok(path)) return; if (!t.isBlockStatement(path.node.body)) { path.node.body = t.blockStatement([path.node.body]); changes++; } },
    ForOfStatement(path) { if (!ok(path)) return; if (!t.isBlockStatement(path.node.body)) { path.node.body = t.blockStatement([path.node.body]); changes++; } },

    // ========== 新增：Switch case 块级防护 ==========
    SwitchCase(path) {
      if (!ok(path)) return;
      if (path.node.consequent.length > 0 && path.node.consequent[0].type !== 'BlockStatement') {
        path.node.consequent = [t.blockStatement(path.node.consequent)];
        changes++;
      }
    },

    // ========== 7. 单行箭头 → block ==========
    ArrowFunctionExpression(path) {
      if (!ok(path)) return;
      if (!t.isBlockStatement(path.node.body)) {
        path.node.body = t.blockStatement([t.returnStatement(path.node.body)]); changes++;
      }
    },
  });

  console.log(`⏳ 生成代码 (${changes} 处改动)...`);
  const { code: expandedCode } = generate(ast, { retainLines: false, comments: true });
  console.log('⏳ Prettier 美化...');
  const finalCode = await prettier.format(expandedCode, {
    parser: 'babel', printWidth: 100, tabWidth: 2, singleQuote: true, trailingComma: 'none', semi: true,
  });
  fs.writeFileSync(outputFile, finalCode, 'utf-8');
  const outSize = (fs.statSync(outputFile).size / 1024).toFixed(0);
  console.log(`✅ 完成: ${inSize}KB → ${outSize}KB (${changes} 处展开)`);
}

run().catch(e => { console.error('❌', e.message); console.error(e.stack?.split('\n').slice(0,10).join('\n')); process.exit(1); });
