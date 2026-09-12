#!/usr/bin/env node
/**
 * 「类型诚实性 · 显式/隐含 any」门禁 —— 补 `check:strict-src`（noImplicitAny）**看不见**的两类洞。
 *
 * 【背景】`check:strict-src` 只抓「隐式 any」。但以下写法同样产出 any 而它看不见：
 *   ① 显式断言 `as any` / `as never`（假收窄入口）；
 *   ② `strictNullChecks:false` 下 `useState(null)` / `useRef(null)` 被塌成 any（state/ref 全失类型，
 *      门禁与 IDE 都拦不住，是「类型诚实」的第二层盲区）。
 *   （`docs/类型诚实性审计-假收窄清单.md` 曾自称「`as any` 全仓 0 处」，实测 src 有 6 处 → 口径与机器护栏双缺。）
 *
 * 【为什么是正则、且全 src 零白名单】这两类可正则化且**零误报**：
 *   - `as any` / `as never` 只可能写在代码里（注释已剥离）；
 *   - `useRef(null)` 只匹配**未标注**形态；已标注的 `useRef<HTMLDivElement|null>(null)` 不匹配（`useRef` 后跟 `<`）。
 *   故本门禁**全 src、不做目录白名单**——不留「只守部分目录」的假护栏（那正是本仓批评过的形态）。
 *
 * 用法：`node scripts/check-any-honesty.mjs`（挂 `npm run check:any`，进 prebuild/pretest）
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');

/** 递归收集 src 下所有 .ts/.tsx */
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(name)) files.push(p);
  }
})(SRC);

// 自检 fail-loud：解析源为空 → 报错退出（防路径/遍历失效后静默「0 违规」）
if (files.length === 0) {
  console.error('❌ any 门禁自检失败：未扫描到任何 src/**/*.ts(x) 文件（路径或遍历逻辑失效）');
  process.exit(1);
}

const RULES = [
  { name: 'as any / as never', re: /\bas\s+(any|never)\b/ },
  {
    name: '未标注 useState(null)/useRef(null)',
    re: /\buse(?:State|Ref)\s*\(\s*null\s*\)/,
  },
];

const violations = [];
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((raw, i) => {
    const trimmed = raw.trim();
    // 跳过整行注释（// 与 JSDoc 的 * 开头）
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
    // 剥行尾注释（要求 // 前有空白，避免误伤 URL 里的 //）
    const code = raw.replace(/\s\/\/.*$/, '');
    for (const rule of RULES) {
      if (rule.re.test(code)) {
        violations.push(`${relative(ROOT, file)}:${i + 1}  [${rule.name}]  ${trimmed.slice(0, 120)}`);
      }
    }
  });
}

console.log('🔒 类型诚实性门禁（显式/隐含 any）');
console.log(`   扫描 src 共 ${files.length} 个 .ts/.tsx · 规则 ${RULES.length} 条（全 src，无白名单）`);

if (violations.length > 0) {
  console.error(`\n❌ 发现 ${violations.length} 处：`);
  for (const v of violations) console.error('   ' + v);
  console.error(
    '\n修法：`as any`/`as never` → 声明真实类型，或 `unknown` + 运行时守卫收窄；' +
      '`useState(null)`/`useRef(null)` → 补类型参数（如 `useRef<HTMLDivElement | null>(null)`）。',
  );
  process.exit(1);
}
console.log('   ✅ 0 违规');
