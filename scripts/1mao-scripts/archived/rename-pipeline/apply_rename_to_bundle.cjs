'use strict';
// 把「压缩名 -> 语义名」规则通过 AST 作用域精确重命名，应用到「参与构建」的
// src/bundle/*.js，使构建源码本身可读、可维护，且 100% 行为不变。
//
// 安全保证（来自 scope_rename_plugin.cjs）：只改真正的绑定引用，绝不碰字符串/模板字面量内容；
// 绝不碰 vendor 导入源名；同名绑定在作用域树里不唯一(遮蔽/歧义)时跳过；目标名已被占用时跳过。
//
// 【1.4.0 注意】name_rules.cjs 当前对 1.4.0 返回空规则（任务书红线：禁止直接复用
// 1.3.5 根目录三本字典）。需基于 1.4.0 重新推导命名规则后再跑本脚本（见 README）。
// 当前运行仅为空跑/占位，对源码零改动，可安全反复执行。

const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');
const scopeRenamePlugin = require('./scope_rename_plugin.cjs');
const { getRules } = require('./name_rules.cjs');

const RULES = getRules();
const BUNDLE = path.join(__dirname, '..', '..', '..', 'src', 'bundle').replace(/\\/g, '/');
const SKIP = /^(vendor-|rolldown-runtime|__vite-browser-external)/;
const TARGETS = (fs.existsSync(BUNDLE)
  ? fs.readdirSync(BUNDLE).filter((f) => f.endsWith('.js') && !SKIP.test(f))
  : []
).map((f) => path.join(BUNDLE, f).replace(/\\/g, '/'));

console.log(`[apply_rename] 载入规则数: ${Object.keys(RULES).length}`);

function countOccurrences(src, names) {
  const set = new Set(names);
  let n = 0;
  for (const name of set) {
    const re = new RegExp('\\b' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g');
    n += (src.match(re) || []).length;
  }
  return n;
}

for (const fp of TARGETS) {
  if (!fs.existsSync(fp)) {
    console.warn('[apply_rename] 跳过缺失文件:', fp);
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
      plugins: [scopeRenamePlugin],
    });
  } catch (e) {
    console.error('[apply_rename] Babel 转换失败:', fp, e.message);
    process.exitCode = 1;
    continue;
  }
  const out = result.code || code;
  fs.writeFileSync(fp, out);
  const beforeOld = countOccurrences(code, Object.keys(RULES));
  const afterOld = countOccurrences(out, Object.keys(RULES));
  const afterNew = countOccurrences(out, Object.values(RULES));
  console.log(
    `[apply_rename] ${path.basename(fp)}: 原压缩名出现 ${beforeOld} -> ${afterOld}；语义名出现 ${afterNew}；文件大小 ${code.length} -> ${out.length}`
  );
}
console.log('[apply_rename] 完成。请运行 npm run build 验证可构建。');
