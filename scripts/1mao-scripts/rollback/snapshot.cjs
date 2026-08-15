'use strict';
// 快照 src/bundle + public 到 scripts/rollback/snapshot-<时间戳>/（改名前打点，任务书安全网）。
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..').replace(/\\/g, '/');
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const DST = path.join(__dirname, 'snapshot-' + ts).replace(/\\/g, '/');

function cpDir(s, d) {
  fs.mkdirSync(d, { recursive: true });
  for (const e of fs.readdirSync(s, { withFileTypes: true })) {
    const ss = path.join(s, e.name), dd = path.join(d, e.name);
    if (e.isDirectory()) cpDir(ss, dd);
    else fs.copyFileSync(ss, dd);
  }
}
for (const sub of ['src/bundle', 'public']) {
  const s = path.join(ROOT, sub).replace(/\\/g, '/');
  if (fs.existsSync(s)) cpDir(s, path.join(DST, sub).replace(/\\/g, '/'));
}
console.log('已创建快照：', DST);
