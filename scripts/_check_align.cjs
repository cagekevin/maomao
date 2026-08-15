// 改名对齐校验（安全网）：扫描改名后源码里 /api/ 路径、端口（18080）、域名
// （127.0.0.1/localhost/jianying）等关键行为标记的位置，确认改名没有误伤字符串/行为。
// 跑完应与改名前输出一致；若某标记消失或位置异常，说明改名越界，立即回退。

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..').replace(/\\/g, '/');
// Tier 2 扩展：复用共享检查，作为对齐日志的 [PASS]/[FAIL] 段（与 smoke_test.cjs 同一套断言）。
let _smoke;
try { _smoke = require('./_smoke_checks.cjs'); } catch (_) { _smoke = null; }
const out = [];
const log = (...a) => out.push(a.join(' '));
const base = ROOT + '/src/bundle/';
const SKIP = /^(vendor-|rolldown-runtime|__vite-browser-external)/;
const files = (fs.existsSync(base)
  ? fs.readdirSync(base).filter((f) => f.endsWith('.js') && !SKIP.test(f))
  : []
);
log('ROOT=' + ROOT);
for (const f of files) {
  const p = base + f;
  log('FILE ' + f + ' exists=' + fs.existsSync(p));
}
for (const f of files) {
  const p = base + f;
  if (!fs.existsSync(p)) continue;
  const s = fs.readFileSync(p, 'utf8');
  const set = new Set();
  let i = 0;
  while ((i = s.indexOf('/api/', i)) >= 0) {
    let j = i;
    while (j < s.length && !'`"\'\s\\'.includes(s[j]) && s[j] !== ')' && s[j] !== ',') j++;
    set.add(s.slice(i, j));
    i = j + 1;
  }
  if (set.size) {
    log('### ' + f + ' (/api/ 路径)');
    [...set].sort().forEach((x) => log('  ' + x));
  }
}
const markers = ['127.0.0.1', 'localhost', '18080', 'jianying', '/plugin/manifest', 'workflow-apps', 'mediapipe', '/api/proxy', '/api/status'];
for (const f of files) {
  const p = base + f;
  if (!fs.existsSync(p)) continue;
  const s = fs.readFileSync(p, 'utf8');
  for (const mk of markers) {
    let i = -1, cnt = 0;
    while ((i = s.indexOf(mk, i + 1)) >= 0 && cnt < 3) {
      log('--- ' + f + ' [' + mk + '] @' + i);
      log('   ' + s.slice(Math.max(0, i - 80), i + 110).replace(/\n/g, ' '));
      cnt++;
    }
  }
}
if (_smoke) {
  for (const c of [
    _smoke.checkImportGraph(ROOT),
    _smoke.checkManifest(ROOT),
    _smoke.checkDistAssets(ROOT),
    _smoke.checkReadableParity(ROOT),
  ]) {
    log('');
    log('### ' + c.name + (c.pass ? ' [PASS]' : ' [FAIL]'));
    (c.details || []).forEach((d) => log('  ' + d));
  }
}
fs.writeFileSync(ROOT + '/scripts/_align_out.txt', out.join('\n') + '\n');
console.log('[check_align] 输出已写入 scripts/_align_out.txt' + (_smoke ? '（含 Tier 2 校验段）' : ''));
