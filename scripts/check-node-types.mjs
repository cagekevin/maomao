/**
 * check-node-types.mjs
 * 编译期（静态）拦截「useNodePrefs 裸命名空间名字符串」—— Node 类型契约登记表的硬门禁。
 *
 * 背景：与 check-storage-keys.mjs / check-events.mjs 同构。nodePrefs 的 useNodePrefs(首参) 是
 * 「节点上次参数记忆」的命名空间，拼错/漏登记只在运行时静默失效（该节点跨窗口默认参数不记忆）。
 * 本脚本在「编译期」拦截：扫描所有对 useNodePrefs 传入的**字面量**首参，校验其是否在 contracts.js 的
 * NODE_TYPES 登记。未登记 → 报错退出（exit 1）。零新依赖（复用 esbuild 已装）。
 *
 * 边界：
 *  - 动态拼接/变量命名空间无法静态判定，由运行时自洽，本脚本不拦（与存储键白名单一致）。
 *  - 纯注释行整行跳过（借鉴 check-events），避免文档示例因滞后于登记表误报红。
 *
 * 用法：
 *   node scripts/check-node-types.mjs                 # 校验全部 components
 *   node scripts/check-node-types.mjs src/App.jsx     # 指定文件
 */
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { defaultTargets } from './check-targets.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');

// useNodePrefs 入口（首参为节点类型命名空间）
const PREFS_FNS = new Set(['useNodePrefs']);

// 字面量首参正则：fn('name' 或 "name"，紧跟左括号的首个字符串
const LITERAL_PREFS_RE = new RegExp(
  `\\b(${[...PREFS_FNS].join('|')})\\s*\\(\\s*(['"])([a-zA-Z0-9_:-]+)\\2`,
  'g',
);

// ── 加载节点类型登记表 ──
let NODE_TYPE_SET = new Set();
try {
  const mod = await import(
    pathToFileURL(resolve(root, 'src/components/base/core/contracts.ts')).href
  );
  NODE_TYPE_SET = mod.NODE_TYPE_SET || new Set();
} catch (e) {
  console.error('  ✖ 无法加载 contracts.ts 节点类型登记表：', e.message);
  process.exit(1);
}

function isRegistered(name) {
  return NODE_TYPE_SET.has(name);
}

const args = process.argv.slice(2);
const targets = args.length > 0 ? args.map((a) => resolve(root, a)) : defaultTargets(root); // 扫描根见 check-targets.mjs（含 src/hooks，避免收口后形成校验盲区）

let violations = 0;

for (const file of targets) {
  const rel = file.replace(root + '/', '');
  let src;
  try {
    src = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  // 跳过登记表自身与 nodePrefs 定义（文档示例，且自身是校验目标）
  const relNoExt = rel.slice(0, rel.length - extname(rel).length);
  if (relNoExt.endsWith('contracts') || relNoExt.endsWith('nodePrefs')) continue;

  // 语法校验（esbuild，确保 JSX .jsx 也能读；失败仅警告不阻断扫描）
  try {
    await build({
      entryPoints: [file],
      bundle: false,
      write: false,
      format: 'esm',
      loader: { '.jsx': 'jsx' },
      jsx: 'automatic',
      logLevel: 'silent',
    });
  } catch {
    /* 语法问题交给 check-jsx，本脚本不重复报错 */
  }

  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('/*') || t.startsWith('*') || t.startsWith('*/'))
      continue;

    LITERAL_PREFS_RE.lastIndex = 0;
    let m;
    while ((m = LITERAL_PREFS_RE.exec(line)) !== null) {
      const name = m[3];
      if (!isRegistered(name)) {
        violations++;
        console.error(`  ✖ ${rel}:${i + 1}  裸 useNodePrefs 命名空间未登记: ${m[1]}('${name}')`);
      }
    }
  }
}

if (violations === 0) {
  console.log(`\n节点类型契约校验通过 ✔（已扫描 ${targets.length} 个文件）`);
  process.exit(0);
} else {
  console.error(`\n发现 ${violations} 处未登记裸 useNodePrefs 命名空间 ✖`);
  console.error(
    '请先在 src/components/base/core/contracts.ts 的 NODE_TYPES 登记（禁止裸字符串 nodePrefs 命名空间）。',
  );
  process.exit(1);
}
