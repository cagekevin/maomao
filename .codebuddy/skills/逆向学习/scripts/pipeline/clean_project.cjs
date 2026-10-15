/**
 * 终检清理：递归清理某个目录下所有 .js/.jsx 中的 webcrack 伪迹
 *   function Object() { [native code] }  ->  constructor（构造方法/属性访问形式）
 *
 * 用法：node clean_project.cjs <目录>
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = process.argv[2];
if (!root) {
  console.error('用法: node clean_project.cjs <目录>');
  process.exit(1);
}
const sanitize = path.resolve(__dirname, '00_sanitize.cjs');

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(js|jsx)$/.test(e.name)) {
      try {
        execSync(`node "${sanitize}" "${p}"`, { stdio: 'inherit' });
      } catch (err) {
        console.error('   ⚠️ 清理失败:', p);
      }
    }
  }
}

walk(root);
console.log('✅ 终检清理完成');
