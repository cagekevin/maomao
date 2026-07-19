const fs = require('fs');
let s = fs.readFileSync('src/restored/App.js', 'utf8');

// 顶部注入 config 导入（在第一个 import 之后）
if (!s.includes("from './config.js'")) {
  s = s.replace(
    /(import \{[^;]*\} from "\.\/runtime\.js";\n)/,
    `$1import { LOCAL_ENGINE, JIANYING_PORT, localEngineBase } from './config.js';\n`
  );
}

// 行 6: Wn = `18080`;  (剪映发送端口)
s = s.replace(/(\n\s*)Wn = `18080`;/, `$1Wn = JIANYING_PORT;`);

// 行 1697: var Hr = `http://127.0.0.1:18080`,
s = s.replace(/var Hr = `http:\/\/127\.0\.0\.1:18080`,/, 'var Hr = localEngineBase(),');

// 行 18969: var Bc = `18080`,
s = s.replace(/var Bc = `18080`,/, 'var Bc = LOCAL_ENGINE.port,');

// 行 19258: localPort: 18080
s = s.replace(/localPort: 18080/, 'localPort: LOCAL_ENGINE.port');

fs.writeFileSync('src/restored/App.js', s);
console.log('App.js patched');
