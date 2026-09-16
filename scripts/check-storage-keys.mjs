/**
 * check-storage-keys.mjs
 * 编译期（静态）拦截「裸存储键字符串」—— Storage 契约登记表的硬门禁。
 *
 * 背景：CLAUDE.md §3.1 已定「lint 全量门禁已移除，门禁靠类型检查+测试」。
 * 但 STORAGE_KEYS 契约登记表是单一事实来源，裸 key 拼错/漏登记只在运行时
 * （contentStore.checkRegistered dev 环境 throw）才暴露。本脚本补一层「编译期」
 * 静态校验，且**不引入任何新依赖**（复用 esbuild 已装），不恢复全量 lint 门禁。
 *
 * 它扫描所有对存储入口（content / s / storage / kv 系列函数）传入的裸字符串字面量 key，
 * 校验该 key 是否在 contracts.js 的 STORAGE_KEYS 登记（含 pattern 动态模板）。
 * 未登记 → 报错退出（exit 1），可挂 CI / 冒烟 / health。
 *
 * 白名单：非存储函数（如 resolveAsset 资源路径）不扫；动态拼接/变量 key 无法静态
 * 判定，由 runtime throw 兜底，本脚本不拦。
 *
 * 【★闸的申诉口 · 三问（2026-09-14 入规 → 架构师心法 §零.4.2）】
 *   Q1 守什么：**红线闸** —— STORAGE_KEYS 登记表是 P0 红线（CLAUDE §5.4.5「存储键禁止裸字符串」）。
 *   Q2 何时该改：新增存储键 → **登记真源一行，本闸不必改**；若"非存储函数"被误扫 → 是白名单判据该修。
 *   Q3 怎么改：改 `src/components/base/core/contracts.ts::STORAGE_KEYS`；**禁止为本闸加 key 豁免**
 *               （动态拼接不拦已由运行时 `contentStore.checkRegistered` 兜底，豁免面已压到 0）。
 *
 * 用法：
 *   node scripts/check-storage-keys.mjs                 # 校验全部 components
 *   node scripts/check-storage-keys.mjs src/components/base/contentStore.js  # 指定文件
 */
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { defaultTargets } from './check-targets.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');

// 待校验的存储入口函数名（第一个参数为 key）
const STORAGE_FNS = new Set([
  'contentGet',
  'contentSet',
  'contentDelete',
  'contentHas',
  'contentGetAsync',
  'contentSetAsync',
  'contentDeleteAsync',
  'contentSubscribe',
  'contentGetKeySnapshot',
  'contentGetSnapshot',
  'sGet',
  'sSet',
  'sRemove',
  'storageGet',
  'storageSet',
  'storageDelete',
  'kvGet',
  'kvSet',
  'kvDelete',
]);

// 易与存储调用混淆、但参数不是 key 的函数（资源路径等），排除
const EXCLUDE_FNS = new Set(['resolveAsset']);

// 裸字符串字面量 key 的正则：fn('literal' 或 "literal"，可含 . _ - { }
const LITERAL_KEY_RE = new RegExp(
  `\\b(${[...STORAGE_FNS].join('|')})\\s*\\(\\s*(['"])([a-zA-Z0-9_.<>{}/-]+)\\2`,
  'g',
);

// ── 加载登记表（运行时导入 contracts.js，含 pattern 模板）──
let STORAGE_KEYS = {};
try {
  const mod = await import(
    pathToFileURL(resolve(root, 'src/components/base/core/contracts.ts')).href
  );
  STORAGE_KEYS = mod.STORAGE_KEYS || {};
} catch (e) {
  console.error('  ✖ 无法加载 contracts.ts 登记表：', e.message);
  process.exit(1);
}

function isRegistered(key) {
  if (key in STORAGE_KEYS) return true;
  // pattern 模板匹配：把 {xxx} 当 .+ 动态段
  for (const pattern of Object.keys(STORAGE_KEYS)) {
    if (!STORAGE_KEYS[pattern].pattern) continue;
    const re = new RegExp(
      '^' +
        pattern
          .split(/\{[^}]+\}/)
          .map((p) => p.replace(/[.+^$()|[\]\\]/g, '\\$&'))
          .join('.+') +
        '$',
    );
    if (re.test(key)) return true;
  }
  return false;
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
  // 跳过合约登记表自身与 contentStore（其定义含 pattern 键，且自身是校验目标）
  const relNoExt = rel.slice(0, rel.length - extname(rel).length);
  if (relNoExt.endsWith('contracts') || relNoExt.endsWith('contentStore')) continue;

  // 语法校验（esbuild，确保 JSX 也能读；失败仅警告不阻断扫描）
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
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    LITERAL_KEY_RE.lastIndex = 0;
    let m;
    while ((m = LITERAL_KEY_RE.exec(line)) !== null) {
      const fn = m[1];
      const key = m[3];
      if (EXCLUDE_FNS.has(fn)) continue;
      if (!isRegistered(key)) {
        violations++;
        console.error(`  ✖ ${rel}:${i + 1}  裸存储键未登记: ${fn}('${key}')`);
      }
    }
  }
}

if (violations === 0) {
  console.log(`\n存储键契约校验通过 ✔（已扫描 ${targets.length} 个文件）`);
  process.exit(0);
} else {
  console.error(`\n发现 ${violations} 处未登记裸存储键 ✖`);
  console.error(
    '请先在 src/components/base/core/contracts.ts 的 STORAGE_KEYS 登记（禁止裸字符串 key）。',
  );
  process.exit(1);
}
