'use strict';
// 从指定快照目录恢复 src/bundle + public（改名失败回退，任务书安全网）。
// 用法：node scripts/rollback/restore.cjs scripts/rollback/snapshot-<时间戳>
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..').replace(/\\/g, '/');
const src = (process.argv[2] || '').replace(/\\/g, '/');
if (!src || !fs.existsSync(src)) { console.error('用法：node scripts/rollback/restore.cjs <snapshot-dir>'); process.exit(1); }

function cpDir(s, d) {
  fs.mkdirSync(d, { recursive: true });
  for (const e of fs.readdirSync(s, { withFileTypes: true })) {
    const ss = path.join(s, e.name), dd = path.join(d, e.name);
    if (e.isDirectory()) cpDir(ss, dd);
    else fs.copyFileSync(ss, dd);
  }
}
for (const sub of ['src/bundle', 'public']) {
  const s = path.join(src, sub).replace(/\\/g, '/');
  const d = path.join(ROOT, sub).replace(/\\/g, '/');
  if (fs.existsSync(s)) { fs.rmSync(d, { recursive: true, force: true }); cpDir(s, d); console.log('已恢复：', sub); }
}
console.log('回退完成。随后重跑 npm run build 验证。');
