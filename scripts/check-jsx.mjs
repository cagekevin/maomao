/**
 * check-jsx.mjs —— 用 esbuild 批量校验 src 下组件的 JSX/TSX 语法。
 * 防止手工复制/拼接大段 JSX 时出现括号/闭合错误。
 *
 * 更新(2026-09-02)：src 已全 TS 化（.js/.jsx 归零，只剩 .ts/.tsx），本脚本实际只命中 .tsx。
 *   仍保留 `.jsx` 收集分支与 `loader: {'.jsx'}` 是零成本兜底——万一有人手滑新建 .jsx 也能照常
 *   校验，不会因为「脚本只认 .tsx」形成漏扫盲区。
 *   脚本名沿用 check-jsx：`package.json` 的 `check:jsx` 与多份历史文档/check 脚本注释已引用，
 *   改名的同步成本 > 收益，故只在此说明「实际校验的是 .tsx」，避免后续 AI 按名字误判范围。
 *
 * 用法：
 *   node scripts/check-jsx.mjs                 # 校验全部
 *   node scripts/check-jsx.mjs src/App.tsx     # 校验指定文件
 */
import { build } from 'esbuild';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');

function collectJsx(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      collectJsx(full, acc);
    } else if (extname(name) === '.jsx' || extname(name) === '.tsx') {
      acc.push(full);
    }
  }
  return acc;
}

const args = process.argv.slice(2);
const targets = args.length > 0 ? args.map((a) => resolve(root, a)) : collectJsx(join(root, 'src'));

let failed = 0;

for (const file of targets) {
  const rel = file.replace(root + '/', '');
  try {
    await build({
      entryPoints: [file],
      bundle: false,
      write: false,
      format: 'esm',
      loader: { '.jsx': 'jsx' },
      jsx: 'automatic',
      logLevel: 'silent',
    });
    console.log(`  ✔ ${rel}`);
  } catch (err) {
    failed++;
    console.error(`  ✖ ${rel}`);
    for (const e of err.errors || []) {
      console.error(`      ${e.location?.line}:${e.location?.column}  ${e.text}`);
    }
  }
}

console.log(`\n${failed === 0 ? '全部通过 ✔' : `失败 ${failed} 个文件 ✖`}`);
process.exit(failed === 0 ? 0 : 1);
