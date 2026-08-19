/**
 * fix_cmp_imported.cjs —— 修复 02_split 早期 bug 遗留：
 * import { _cmp_Qt as _Component3 } from '../vendor-xxx.js'
 *                ^^^^ imported 位属于对方模块导出名，不该被本地 renameMap 改写
 * 本脚本把「非本目录 shared.js」的 import 语句中 imported 位的 _cmp_ 前缀剥掉。
 *
 * 用法: node fix_cmp_imported.cjs <工程根目录>
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2];
if (!ROOT) { console.error('用法: node fix_cmp_imported.cjs <工程根目录>'); process.exit(1); }

function walk(dir, cb) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.vite' || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, cb);
    else if (/\.(jsx?|mjs|cjs)$/.test(e.name)) cb(p);
  }
}

// 匹配整条 import { ... } from '...';
const IMPORT_RE = /import\s*\{([^}]*)\}\s*from\s*(['"])([^'"]+)\2\s*;?/g;

let fileCount = 0, fixCount = 0;
walk(ROOT, (fp) => {
  const src = fs.readFileSync(fp, 'utf8');
  if (!src.includes('_cmp_')) return;
  let localFix = 0;

  const out = src.replace(IMPORT_RE, (whole, body, q, source) => {
    // 只处理「指向同目录抽出组件之外」的模块：
    // 同目录 ./XXX.jsx 是抽出组件本身（default import，不走这个分支）
    // 这里针对 ../vendor-*.js / ../src-*.js 这类外部 chunk
    if (!/^\.\.\//.test(source)) return whole;

    const newBody = body.replace(
      /(^|,)(\s*)_cmp_([A-Za-z_$][\w$]*)(\s+as\s+)/g,
      (m, lead, sp, name, asPart) => { localFix++; return `${lead}${sp}${name}${asPart}`; }
    ).replace(
      // 无 as 的裸形式: { _cmp_X }
      /(^|,)(\s*)_cmp_([A-Za-z_$][\w$]*)(\s*)(?=,|$)/g,
      (m, lead, sp, name, tail) => { localFix++; return `${lead}${sp}${name} as _cmp_${name}${tail}`; }
    );
    return whole.replace(body, newBody);
  });

  if (localFix > 0) {
    fs.writeFileSync(fp, out);
    fileCount++;
    fixCount += localFix;
    console.log(`  修复 ${localFix} 处: ${path.relative(ROOT, fp)}`);
  }
});

console.log(`\n✅ 共修复 ${fixCount} 处 imported 位 _cmp_ 前缀，涉及 ${fileCount} 个文件`);
