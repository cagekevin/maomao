const fs = require('fs');
let s = fs.readFileSync('reference/decompiled/index-CZiVAxxw.decompiled.js', 'utf8');
s = s
  .replace(/\.\/rolldown-runtime-aKtaBQYM\.js/g, './runtime.js')
  .replace(/\.\/vendor-Cr1JWW-B\.js/g, './vendor.js')
  .replace(/\.\/App-B9jVCs-a\.js/g, './App.js');

const head = "import { ENDPOINTS, DEFAULT_ENDPOINT, localEngineBase } from './config.js';\n";
s = head + s;

// 把 l() 接入点列表替换为从 config 读取
s = s.replace(/let e = \[\{[\s\S]*?return n\.length > 0 \? n : e;\n  \}/, 'return ENDPOINTS;');
// 把 d() 兜底地址替换为 DEFAULT_ENDPOINT
s = s.replace(/return u\[0\]\?\.url \|\| c\(`http:\/\/154\.219\.102\.152:3012`\);/, 'return u[0]?.url || c(DEFAULT_ENDPOINT);');

fs.writeFileSync('src/restored/entry.js', s);
console.log('entry.js written, length', s.length);
