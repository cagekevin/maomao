'use strict';
// 符号提取（任务书 line 240 的「阅读副本」配套）：从 src/bundle 提取顶层绑定符号清单到 readable/symbols.json，
// 供 rename.cjs / 人工推导 name_rules 时参考。只读分析，不改任何文件。
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..').replace(/\\/g, '/');
const BUNDLE = path.join(ROOT, 'src/bundle').replace(/\\/g, '/');
const OUT = path.join(ROOT, 'readable').replace(/\\/g, '/');
fs.mkdirSync(OUT, { recursive: true });

const syms = {};
for (const f of fs.readdirSync(BUNDLE)) {
  if (!f.endsWith('.js')) continue;
  const src = fs.readFileSync(path.join(BUNDLE, f), 'utf8');
  const names = new Set();
  const re = /(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g;
  let m; while ((m = re.exec(src))) names.add(m[1]);
  syms[f] = [...names].sort();
}
fs.writeFileSync(path.join(OUT, 'symbols.json'), JSON.stringify(syms, null, 2));
console.log('已提取顶层符号到 readable/symbols.json（共 ' + Object.keys(syms).length + ' 个 chunk）');
