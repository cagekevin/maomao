#!/usr/bin/env node
'use strict';
/**
 * 一键傻瓜式美化：dist/（压缩单行）→ 可读版，写回 dist/。
 *
 * 完整 4 步流水线（全自动、零人工核对、零行为改动）：
 *   1) esbuild 重排版 + babel 结构展开 + prettier 统一格式
 *   2) 每个 chunk 顶部加角色注释头
 *   3) 无插值反引号模板 → 字符串字面量（纯等价）
 *   4) 提取顶层符号 → dist/symbols.json 索引
 *
 * 用法（一键）：
 *   node scripts/beautify-dist.cjs
 * 原版备份：dist-orig/（已存在则跳过，不重复备份）
 */

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const WORKSPACE = path.resolve(__dirname, '..').replace(/\\/g, '/');
const DIST = path.join(WORKSPACE, 'dist').replace(/\\/g, '/');
const ORIG = path.join(WORKSPACE, 'dist-orig').replace(/\\/g, '/');
const STAMP = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
const OUT = path.join(WORKSPACE, `dist-tmp_${STAMP}`).replace(/\\/g, '/');

if (!fs.existsSync(DIST)) {
  console.error('未找到 dist/ 目录：', DIST);
  process.exit(1);
}

// ---- 可选依赖 ----
let babel = null, prettier = null;
try { babel = require('@babel/core'); } catch { /* noop */ }
try { prettier = require('prettier'); } catch { /* noop */ }

// ==================== 步骤 1：排版（esbuild + babel 结构展开 + prettier） ====================

function aiPlugin({ types: t }) {
  return {
    name: 'dist-beautify-ai',
    visitor: {
      UnaryExpression(p) {
        const { operator, argument } = p.node;
        if (operator === '!' && argument.type === 'NumericLiteral') {
          if (argument.value === 0) p.replaceWith(t.booleanLiteral(true));
          else if (argument.value === 1) p.replaceWith(t.booleanLiteral(false));
        }
      },
      VariableDeclaration(p) {
        const parent = p.parentPath;
        if (p.node.declarations.length > 1 && (parent.isBlockStatement() || parent.isProgram())) {
          const news = p.node.declarations.map((decl) => t.variableDeclaration(p.node.kind, [decl]));
          p.replaceWithMultiple(news);
        }
      },
      IfStatement(p) {
        if (p.node.consequent && p.node.consequent.type !== 'BlockStatement') {
          p.node.consequent = t.blockStatement([p.node.consequent]);
        }
        const alt = p.node.alternate;
        if (alt && alt.type !== 'BlockStatement' && alt.type !== 'IfStatement') {
          p.node.alternate = t.blockStatement([alt]);
        }
      },
      'ForStatement|ForInStatement|ForOfStatement|WhileStatement|DoWhileStatement'(p) {
        if (p.node.body && p.node.body.type !== 'BlockStatement') {
          p.node.body = t.blockStatement([p.node.body]);
        }
      },
      ExpressionStatement(p) {
        const e = p.node.expression;
        if (e && e.type === 'SequenceExpression') {
          p.replaceWithMultiple(e.expressions.map((ex) => t.expressionStatement(ex)));
        }
      },
    },
  };
}

async function aiOptimize(code) {
  if (!babel) return code;
  let generated = code;
  try {
    const res = babel.transformSync(code, {
      parserOpts: { sourceType: 'module', plugins: ['jsx'] },
      plugins: [aiPlugin],
      generatorOpts: { compact: false, retainLines: false },
      babelrc: false, configFile: false, comments: true,
    });
    generated = res.code;
  } catch (e) {
    console.warn('  [babel 结构展开失败，退回 esbuild 结果]', String(e.message).split('\n')[0]);
    return code;
  }
  if (prettier) {
    try {
      if (typeof prettier.formatSync === 'function') {
        return prettier.formatSync(generated, {
          parser: 'babel', printWidth: 120, tabWidth: 2,
          singleQuote: true, semi: true, trailingComma: 'none',
        });
      }
      return await prettier.format(generated, {
        parser: 'babel', printWidth: 120, tabWidth: 2,
        singleQuote: true, semi: true, trailingComma: 'none',
      });
    } catch (e) {
      console.warn('  [prettier 失败，用 babel 结果]', String(e.message).split('\n')[0]);
    }
  }
  return generated;
}

// ==================== 步骤 2：加 chunk 角色注释头（按文件名前缀匹配，1.4.2 实测名） ====================

const HEADER_PATTERNS = {
  'main-': {
    role: '侧边栏入口（side_panel bootstrap）',
    exports: 'export { j as _ }（preload 助手）',
    dep: '引用 endpointConfig（接入点引导）、App（动态 import 主程序）',
    note: '勿改 ES module 加载顺序；引导/RootErrorBoundary 在此。改端点只走 endpointConfig。',
  },
  'App-': {
    role: '主程序：节点画布 / 资源库 / 多账号 / 提示词库 / 本地引擎对接',
    exports: 'export { mr as default }（主组件 mr）',
    dep: '引用 vendor / endpointConfig / httpClient / src-_ 共享 chunk',
    note: '业务核心，可改功能但勿重构、勿重排初始化；运行时字符串契约（API 路径/存储键/端口）一个字都不能动。',
  },
  'share-': {
    role: '分享页入口（独立页面，非 side_panel）',
    exports: '动态 import ShareAppPage 主程序',
    dep: '设置 window.__CANVAS_RUNTIME__={disableLocalTool:true}；引用 ShareAppPage',
    note: '分享/预览链接页面。改前确认这是独立入口，不影响侧边栏。',
  },
  'ShareAppPage-': {
    role: '分享页主程序（只读预览渲染）',
    exports: 'default 导出（分享页主组件）',
    dep: '引用 vendor / httpClient（只读拉取）',
    note: '只读渲染分享内容，勿引入写操作或本地引擎调用。',
  },
  'endpointConfig-': {
    role: '接入点配置（host 重写 / Chrome 扩展检测 / 端口 18080 / 默认端点）',
    exports: 'export { i as a, t as c, v as i, _ as n, n as o, g as r, r as s, c as t }',
    dep: '被 main / App / httpClient 引用；含存储键 active_api_endpoint',
    note: '改后端端点地址的唯一安全入口（只改 host/端口这类可切换项）。API 路径与存储键字符串契约不可动。',
  },
  'httpClient-': {
    role: 'HTTP 客户端（/api/* 本地引擎 + /v1/* AI 网关全路由）',
    exports: '导出全部 HTTP 函数（KV/文件/任务/资源/代理/剪映 + apimart /v1/* 生成）',
    dep: '引用 endpointConfig（基础 URL）；被 App / endpointConfig 等引用',
    note: '对接两后端：localTool(127.0.0.1:18080) 与 apimart-gateway(:8000/:9004)。路径与请求体形状必须与契约一致，一个字都不能动。',
  },
  'src-_': {
    role: '共享业务 chunk（公共依赖，被 App 等引用）',
    exports: '导出公共业务符号',
    dep: '被 App 等引用',
    note: '共享代码，改动需全树 grep 引用确认同步。',
  },
  'src-': {
    role: 'Vite modulepreload polyfill（纯副作用，无导出）',
    exports: '无导出（仅注入 modulepreload 助手）',
    dep: '被各 chunk 作为副作用 import',
    note: '运行时代码，勿改。',
  },
  'mediabunny-': {
    role: '音频 MP3 编码（第三方包装）',
    exports: 'export { v as registerMp3Encoder }',
    dep: '被业务 chunk 引用',
    note: '原样携带，勿反编译、勿改导出名 registerMp3Encoder。',
  },
  'vendor-': {
    role: '第三方依赖（React / ReactDOM / @xyflow/react / localforage / lucide 等）',
    exports: '以压缩别名暴露（Fr=React、Ir=ReactDOM、Pr=preload 助手…）',
    dep: '被全部业务 chunk 引用',
    note: '禁止反编译、禁止改导出别名（会破坏所有 import 源名）。',
  },
  'rolldown-': {
    role: 'rolldown 运行时节（内部运行时符号）',
    exports: '导出运行时内部符号（e/t/n/r/i/a/o/s 等）',
    dep: '被全部 chunk 引用',
    note: '禁止改动；运行时代码。',
  },
  '__vite-': {
    role: 'Vite 浏览器外置垫片（external 模块桩）',
    exports: '垫片导出（如 node 内置模块 stub）',
    dep: '被业务 chunk 引用',
    note: '原样携带，勿改。',
  },
};

const MARKER = '[auto chunk header]';

function addChunkHeaders(assetsDir) {
  let added = 0;
  for (const f of fs.readdirSync(assetsDir).sort()) {
    if (!f.endsWith('.js')) continue;
    const fp = path.join(assetsDir, f).replace(/\\/g, '/');
    let src = fs.readFileSync(fp, 'utf8');

    // 匹配 header pattern（按前缀匹配，因为哈希名会变）
    const matchKey = Object.keys(HEADER_PATTERNS).find(k => f.startsWith(k));
    if (!matchKey) { console.log('  [注释头] 跳过未识别 chunk：', f); continue; }

    const meta = HEADER_PATTERNS[matchKey];
    const block = [
      '/**',
      ` * ${MARKER}`,
      ` * 角色：${meta.role}`,
      ` * 主要导出：${meta.exports}`,
      ` * 对接模块：${meta.dep}`,
      ` * 改动注意：${meta.note}`,
      ' */',
      '',
    ].join('\n');

    // 幂等：如果已有旧注释头则先剥掉再重加
    const re = /^\/\*\*\s*\n(?:\s*\*.*\n)*\s*\*\/\s*\n/;
    if (re.test(src)) src = src.replace(re, '');

    fs.writeFileSync(fp, block + src);
    added++;
    console.log('  [注释头] ->', f);
  }
  console.log('  已加注释头：' + added + ' 个');
}

// ==================== 步骤 3：无插值反引号模板 → 字符串（babel 插件） ====================

function stringifyPlugin({ types: t }) {
  return {
    name: 'stringify-template-literals',
    visitor: {
      TemplateLiteral(path) {
        const n = path.node;
        if (
          n.quasis.length === 1 &&
          n.expressions.length === 0 &&
          path.parent.type !== 'TaggedTemplateExpression'
        ) {
          path.replaceWith(t.stringLiteral(n.quasis[0].value.cooked));
        }
      },
    },
  };
}

function stringifyAllJs(assetsDir) {
  const SKIP = /^(vendor-|rolldown-|__vite-)/; // 第三方/运行时不动
  let changed = 0;
  for (const f of fs.readdirSync(assetsDir).sort()) {
    if (!f.endsWith('.js')) continue;
    if (SKIP.test(f)) continue;
    const fp = path.join(assetsDir, f).replace(/\\/g, '/');
    const code = fs.readFileSync(fp, 'utf8');
    try {
      const res = babel.transformSync(code, {
        filename: fp, babelrc: false, configFile: false,
        sourceType: 'module', plugins: [stringifyPlugin],
      });
      const out = res.code || code;
      if (out !== code) {
        fs.writeFileSync(fp, out);
        changed++;
        console.log('  [stringify] ->', f, '(' + code.length + ' -> ' + out.length + ' bytes)');
      }
    } catch (e) {
      console.warn('  [stringify 失败]', f, '-', e.message);
    }
  }
  console.log('  反引号→字符串：' + changed + ' 个文件');
}

// ==================== 步骤 4：提取顶层符号 → symbols.json ====================

function extractSymbols(assetsDir) {
  const syms = {};
  for (const f of fs.readdirSync(assetsDir).sort()) {
    if (!f.endsWith('.js')) continue;
    const src = fs.readFileSync(path.join(assetsDir, f), 'utf8');
    const names = new Set();
    const re = /(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g;
    let m; while ((m = re.exec(src))) names.add(m[1]);
    syms[f] = [...names].sort();
  }
  fs.writeFileSync(
    path.join(assetsDir, 'symbols.json'),
    JSON.stringify(syms, null, 2)
  );
  console.log('  [symbols] -> dist/assets/symbols.json（共 ' + Object.keys(syms).length + ' 个 chunk）');
}

// ==================== 工具函数 ====================

function copyTree(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name).replace(/\\/g, '/');
    const d = path.join(dst, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) copyTree(s, d);
    else fs.copyFileSync(s, d);
  }
}

// ==================== 主流程 ====================

// 1) 备份
if (fs.existsSync(ORIG)) {
  console.log('==> 原版备份已存在，跳过：', ORIG);
} else {
  console.log('==> 备份原版 dist/ ->', ORIG);
  copyTree(DIST, ORIG);
}

// 2) 拷到临时目录
console.log('==> 拷贝 dist/ ->', OUT, '（排版中）');
copyTree(DIST, OUT);

const assetsDir = path.join(OUT, 'assets').replace(/\\/g, '/');
if (!fs.existsSync(assetsDir)) {
  console.error('dist/assets 不存在，异常中止。');
  process.exit(1);
}

let jsCount = 0, cssCount = 0;

async function main() {
  // ---- 步骤 1：排版 ----
  for (const f of fs.readdirSync(assetsDir).sort()) {
    const fp = path.join(assetsDir, f).replace(/\\/g, '/');
    if (f.endsWith('.js')) {
      const code = fs.readFileSync(fp, 'utf8');
      let out = code;
      try {
        out = esbuild.transformSync(code, {
          loader: 'js', target: 'esnext', format: 'esm', legalComments: 'none',
        }).code;
      } catch (e) {
        console.warn('  [esbuild 失败]', f, '-', e.message);
      }
      out = await aiOptimize(out);
      fs.writeFileSync(fp, out);
      jsCount++;
      console.log('  [排版] ->', f, '(' + code.length + ' -> ' + out.length + ' bytes)');
    } else if (f.endsWith('.css')) {
      cssCount++;
    }
  }

  // ---- 步骤 2：加注释头 ----
  console.log('\n==> 步骤 2：加 chunk 角色注释头');
  addChunkHeaders(assetsDir);

  // ---- 步骤 3：反引号模板 → 字符串 ----
  console.log('\n==> 步骤 3：反引号模板 → 字符串字面量');
  stringifyAllJs(assetsDir);

  // ---- 步骤 4：提符号 ----
  console.log('\n==> 步骤 4：提取顶层符号 → symbols.json');
  extractSymbols(assetsDir);

  // 3) 替换回 dist/
  console.log('\n==> 把排版结果写回 dist/ ...');
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.renameSync(OUT, DIST);

  console.log('\n========================================');
  console.log('  全部完成！dist/ 已是美化版');
  console.log('========================================');
  console.log('  排版 JS :', jsCount, ' | CSS(原样):', cssCount);
  console.log('  原版备份: dist-orig/');
  console.log('  阅读    : 直接打开 dist/assets/*.js');
  console.log('  索引    : dist/assets/symbols.json');
}

main().catch((e) => {
  console.error('执行出错：', e);
  process.exit(1);
});
