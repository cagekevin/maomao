'use strict';
// 安全可读性增强：仅把「无插值的反引号模板字符串」还原为真正的字符串字面量（"..." 而非 `...`）。
// 排除标签模板(tag`...`)、含插值的模板字符串（保持 ${} 语义），并且【不做】JSX 语法还原
// （保持 (0, X.jsx)(...) 运行时调用形式，确保 .js 文件仍能被 vite/esbuild 正常解析构建）。
// 纯语法等价转换，不改变任何运行时行为。作用于业务 chunk（vendor / runtime / browser-external 不改）。

const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');
const t = require('@babel/types');

function stringifyPlugin() {
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

// 全局取得业务 chunk（排除第三方/运行时垫片）
const BUNDLE = path.join(__dirname, '..', '..', '..', 'src', 'bundle').replace(/\\/g, '/');
const SKIP = /^(vendor-|rolldown-runtime|__vite-browser-external)/;
const TARGETS = (fs.existsSync(BUNDLE)
  ? fs.readdirSync(BUNDLE).filter((f) => f.endsWith('.js') && !SKIP.test(f))
  : []
).map((f) => path.join(BUNDLE, f).replace(/\\/g, '/'));

for (const fp of TARGETS) {
  if (!fs.existsSync(fp)) {
    console.warn('[stringify] 跳过缺失文件:', fp);
    continue;
  }
  const code = fs.readFileSync(fp, 'utf8');
  let result;
  try {
    result = babel.transformSync(code, {
      filename: fp,
      babelrc: false,
      configFile: false,
      sourceType: 'module',
      plugins: [stringifyPlugin],
    });
  } catch (e) {
    console.error('[stringify] Babel 转换失败:', fp, e.message);
    process.exitCode = 1;
    continue;
  }
  const out = result.code || code;
  fs.writeFileSync(fp, out);
  const before = (code.match(/`/g) || []).length;
  const after = (out.match(/`/g) || []).length;
  console.log(`[stringify] ${path.basename(fp)}: 反引号 ${before} -> ${after}；文件大小 ${code.length} -> ${out.length}`);
}
console.log('[stringify] 完成。请运行 npm run build 验证可构建。');
