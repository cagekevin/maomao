/**
 * Unicode 中文还原脚本
 * 把 \uXXXX 转义序列还原为实际中文字符
 * 只处理 StringLiteral 和 TemplateLiteral，不碰标识符
 *
 * 用法：node unicode_restore.cjs <目标.js>
 */
const fs = require('fs');
const babel = require('@babel/core');
const t = require('@babel/types');

const filePath = process.argv[2];
if (!filePath) {
  console.error('用法: node unicode_restore.cjs <文件路径>');
  process.exit(1);
}

const code = fs.readFileSync(filePath, 'utf8');
const beforeSize = (code.length / 1024).toFixed(0);

const result = babel.transformSync(code, {
  babelrc: false,
  configFile: false,
  parserOpts: { plugins: ['jsx'] },
  plugins: [
    {
      visitor: {
        // 还原普通字符串中的 \uXXXX
        StringLiteral(path) {
          const v = path.node.value;
          const decoded = v.replace(
            /\\u([0-9a-fA-F]{4})/g,
            (_, h) => String.fromCharCode(parseInt(h, 16))
          );
          if (decoded !== v) {
            path.replaceWith(t.stringLiteral(decoded));
          }
        },
        // 还原模板字符串中的 \uXXXX
        TemplateLiteral(path) {
          for (const q of path.node.quasis) {
            const raw = q.value.raw;
            const cooked = q.value.cooked || raw;
            const decoded = cooked.replace(
              /\\u([0-9a-fA-F]{4})/g,
              (_, h) => String.fromCharCode(parseInt(h, 16))
            );
            // 防破坏：模板串 quasi 内若还原出裸反引号(\u0060)，会破坏模板串语法，
            // 此时保持原样（保留 \uXXXX 转义文本），交由后续 esbuild 正常处理。
            if (decoded !== cooked && !decoded.includes('`')) {
              q.value.raw = decoded;
              q.value.cooked = decoded;
            }
          }
        },
      },
    },
  ],
});

fs.writeFileSync(filePath, result.code, 'utf8');
const afterSize = (result.code.length / 1024).toFixed(0);
const remaining = ((result.code || '').match(/\\u[0-9a-fA-F]{4}/g) || []).length;

console.log(`${filePath}`);
console.log(`  ${beforeSize}KB → ${afterSize}KB, \u005cuXXXX 剩余: ${remaining}`);
