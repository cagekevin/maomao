/**
 * 一毛AI画布 - vendor 依赖映射
 * 解析 vendor-Cr1JWW-B.js 尾部的 `as` 导出别名，
 * 生成「短名 -> 真实导出名」字典，例如：
 *   o as jsx       -> X(jsx) 表示 App 里 import { X as o } 时 X 是 jsx
 * 这样读 App 反编译代码时，X.jsx() 能对应到 jsx()
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname.replace(/[\\/]scripts$/, '');
const VENDOR = path.join(ROOT, 'reference', 'vendor-Cr1JWW-B.js');
const OUT = path.join(ROOT, 'reference', 'decompiled', 'vendor-map.json');

function main() {
  if (!fs.existsSync(VENDOR)) {
    console.log('vendor not found');
    return;
  }
  const text = fs.readFileSync(VENDOR, 'utf8');
  // 匹配导出别名: `,xxx as Yyy` 或 `xxx as Yyy};`
  const re = /([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)/g;
  const map = {}; // shortName -> realName
  let m;
  while ((m = re.exec(text)) !== null) {
    const [, real, short] = m;
    map[short] = real;
  }
  if (!fs.existsSync(path.dirname(OUT))) fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(map, null, 2), 'utf8');
  console.log(`vendor map: ${Object.keys(map).length} aliases -> ${OUT}`);
  // 打印几个关键映射示例
  const samples = ['jsx', 'jsxs', 'useState', 'useEffect', 'createContext', 'useContext', 'useRef', 'useMemo', 'useCallback'];
  for (const s of samples) {
    const found = Object.entries(map).find(([, v]) => v === s);
    if (found) console.log(`  ${found[1]} -> ${found[0]}`);
  }
}

main();
