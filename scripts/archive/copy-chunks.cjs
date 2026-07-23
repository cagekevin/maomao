const fs = require('fs');
const path = require('path');
const REF = path.join(__dirname.replace(/[\\/]scripts$/, ''), 'reference');
const REST = path.join(__dirname.replace(/[\\/]scripts$/, ''), 'src', 'restored');

// 扫描 restored 下所有 js，找出 import(`./xxx.js`) 的动态引用
function scanDir(dir) {
  const needed = new Set();
  for (const f of fs.readdirSync(dir)) {
    const fp = path.join(dir, f);
    if (fs.statSync(fp).isDirectory()) { scanDir(fp).forEach(x => needed.add(x)); continue; }
    if (!f.endsWith('.js')) continue;
    const s = fs.readFileSync(fp, 'utf8');
    const re = /import\(\s*[`']\.\/([A-Za-z0-9_.\-]+\.js)[`']\s*\)/g;
    let m;
    while ((m = re.exec(s))) needed.add(m[1]);
  }
  return needed;
}

const needed = scanDir(REST);
console.log('动态 import 需要的 chunk:', [...needed]);

// 这些已在 restored 的有：vendor-Cr1JWW-B.js, rolldown-runtime-aKtaBQYM.js, entry.js, App.js, config.js
const already = new Set(['vendor-Cr1JWW-B.js', 'rolldown-runtime-aKtaBQYM.js', 'entry.js', 'App.js', 'config.js']);
let copied = 0;
for (const name of needed) {
  if (already.has(name)) continue;
  const src = path.join(REF, name);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(REST, name));
    copied++;
    console.log('copied', name);
  } else {
    console.log('MISSING in reference:', name);
  }
}
console.log('copied', copied, 'chunks');
