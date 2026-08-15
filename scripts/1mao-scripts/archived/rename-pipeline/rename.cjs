'use strict';
// 只读副本语义名覆盖（任务书 line 240）：把 name_rules 应用到 `readable/` 副本，**绝不写回构建源 src/bundle**。
// 与 apply_rename_to_bundle.cjs（作用域精确、写回构建源）不同，本脚本是「阅读副本」机制：
// 仅在 readable/ 下生成带语义名的副本，方便人类/AI 只读对照；构建仍以 src/bundle 为准。
// 1.4.0 当前 name_rules 返回空规则 → 副本与源 1:1（等价无改名），安全 no-op。
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..').replace(/\\/g, '/');
const BUNDLE = path.join(ROOT, 'src/bundle').replace(/\\/g, '/');
const OUT = path.join(ROOT, 'readable').replace(/\\/g, '/');
const { getRules } = require('./name_rules.cjs');

const rulesMap = getRules(); // {from:to}；1.4.0 默认 {}
const rules = Object.entries(rulesMap).map(([from, to]) => ({ from, to }));
fs.mkdirSync(OUT, { recursive: true });
// 递归复制 src/bundle/ 下所有 .js（含 *_components/ 子目录），使 readable/ 与构建源结构一致，
// 供 _smoke_checks.checkReadableParity 逐文件比对行数/标记。
let n = 0;
const walk = (dir, base) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = base ? base + '/' + entry.name : entry.name;
    if (entry.isDirectory()) {
      fs.mkdirSync(path.join(OUT, rel), { recursive: true });
      walk(full, rel);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      const src = fs.readFileSync(full, 'utf8');
      let out = src;
      for (const r of rules) {
        if (!r.from || !r.to) continue;
        out = out.split(r.from).join(r.to); // 仅阅读副本的宽松替换；构建源绝不用此方式
      }
      fs.writeFileSync(path.join(OUT, rel), out);
      n++;
    }
  }
};
walk(BUNDLE, '');
console.log(`已生成可读副本 ${n} 个到 readable/（规则 ${rules.length} 条；空规则=等价副本，非构建源）`);
