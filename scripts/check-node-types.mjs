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
 *  - **多行调用**（`useNodePrefs(\n 'xxxNode',`）：2026-09-19 前逐行 exec ⇒ 永不命中 ⇒
 *    在最常见写法下等于不设防（负例探针实测漏报）。现与 check-events.mjs 同款做
 *    「括号未闭合则向后合并到配对再匹配」；三同构闸（keys/events/node-types）判据须保持同步。
 *
 * 【★闸的申诉口 · 三问（2026-09-14 入规 → 架构师心法 §零.4.2）】
 *   Q1 守什么：**红线闸** —— `NODE_TYPES` 是 P0 登记表（与 `STORAGE_KEYS`/`EVENTS` 同构：新增必须先登记）。
 *   Q2 何时该改：新增节点类型 → **登记一行真源即可，本闸不必改**；若合法命名空间被判红 → 是登记表缺项，补真源。
 *   Q3 怎么改：改 `src/components/base/core/contracts.ts::NODE_TYPES`。**本闸零白名单，不得新增豁免**
 *               （文件头已定调：动态拼接不拦、由运行时自洽，已把豁免面压到 0）。
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

// 基数自检（防「扫 0 却绿灯」——TD-02-9 同款）：扫描目标为 0 = 闸在守卫 0 个文件，静默通过 = 最危险的失效
if (targets.length === 0) {
  console.error('❌ 扫描目标为 0（defaultTargets 未返回任何文件 → 本闸扫 0 却绿灯）→ 拒绝放行');
  process.exit(1);
}

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
    /* 语法问题交给 tsc（type-check）与 test:smoke 的 esbuild 检查，本脚本不重复报错。
       （原写「交给 check-jsx」——该闸 2026-09-15 已删：判据被上面两者完全覆盖，属冗余闸。） */
  }

  const lines = src.split('\n');
  // 【★ 2026-09-19 修：多行调用漏检（TD 见 check-storage-keys.mjs 同款说明）】
  //   真实代码大量写作 `useNodePrefs(\n  'xxxNode',\n  DEF,\n)` —— 逐行 exec 时
  //   `useNodePrefs(` 行后无字符串、字符串行前无 `useNodePrefs(` ⇒ 永不命中。
  //   本闸守护 NODE_TYPES（P0 登记表），在最常见写法下等于不设防（负例探针实测：
  //   注 5 处未登记命名空间仍报「通过 ✔」）。
  //   治法与 check-events.mjs 一致：括号未闭合则向后合并到配对，再在合并片段上匹配。
  const CALL_OPEN_RE = new RegExp(`\\b(?:${[...PREFS_FNS].join('|')})\\s*\\(`, 'g');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('/*') || t.startsWith('*') || t.startsWith('*/'))
      continue;

    LITERAL_PREFS_RE.lastIndex = 0;
    let m;
    let hitOnLine = false;
    while ((m = LITERAL_PREFS_RE.exec(line)) !== null) {
      hitOnLine = true;
      const name = m[3];
      if (!isRegistered(name)) {
        violations++;
        console.error(`  ✖ ${rel}:${lineNo}  裸 useNodePrefs 命名空间未登记: ${m[1]}('${name}')`);
      }
    }
    if (hitOnLine) continue;

    // 本行有「到行尾仍未闭合」的 useNodePrefs 调用 → 向后合并找其首参字面量
    CALL_OPEN_RE.lastIndex = 0;
    let leftover = 0;
    let oc;
    while ((oc = CALL_OPEN_RE.exec(line)) !== null) {
      const tail = line.slice(oc.index + oc[0].length);
      let depth = 1;
      for (const ch of tail) {
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
      }
      if (depth > leftover) leftover = depth;
    }
    if (leftover <= 0) continue;

    let merged = line;
    let k = i + 1;
    while (k < lines.length && leftover > 0) {
      const nextLine = lines[k];
      merged += '\n' + nextLine;
      const cand = nextLine.trim();
      if (!cand.startsWith('//') && !cand.startsWith('*')) {
        for (const ch of nextLine) {
          if (ch === '(') leftover++;
          else if (ch === ')') leftover--;
        }
      }
      k++;
    }
    LITERAL_PREFS_RE.lastIndex = 0;
    let mm;
    let guard = 0;
    while ((mm = LITERAL_PREFS_RE.exec(merged)) !== null && guard++ < 10) {
      const name = mm[3];
      const upTo = merged.slice(0, mm.index);
      const realLine = lineNo + (upTo.match(/\n/g) || []).length;
      if (!isRegistered(name)) {
        violations++;
        console.error(`  ✖ ${rel}:${realLine}  裸 useNodePrefs 命名空间未登记: ${mm[1]}('${name}')`);
      }
      break; // 一个多行调用只取首个命名空间
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
