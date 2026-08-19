/**
 * 一毛AI画布 深度逆向还原流水线
 *
 * 输入: step0_raw/  输出: output/project/
 * 用法: node run.cjs
 *
 * 步骤:
 *   ⓪ webcrack → JSX 标签真实还原
 *   ① expand   → 结构展开
 *   ② split    → 组件拆分
 *   ③ facade   → 门面替换
 *   ④ unicode  → 中文还原
 *   ⑤ assemble → Vite 工程
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const UNPACKED = path.resolve(__dirname, '..');
const SCRIPTS = __dirname;
const INPUT = path.join(UNPACKED, 'step0_raw');
const OUTPUT = path.join(UNPACKED, 'output');
const WORK = path.join(OUTPUT, '.work');
const PROJECT = path.join(OUTPUT, 'project');

// 输入源
const SRC = path.join(INPUT, 'chunks');           // 业务混淆 chunks（glob 提取）
const STATIC = path.join(INPUT, 'static');         // public + html + config

// 版本无关：从 step0_raw/chunks/ 自动读取，不再写死白名单。
// DEEP = 走完整 webcrack→展开→拆分 的核心业务文件（由文件名模式判定）
// OTHER = 其余业务 chunk（只拷贝，不拆分）
if (!fs.existsSync(SRC)) { console.error(`❌ 输入缺失: ${SRC}（先跑 extract_input.cjs）`); process.exit(1); }
const ALL_CHUNKS = fs.readdirSync(SRC).filter((f) => f.endsWith('.js'));
// DEEP 模式：App- / httpClient- / src-（核心业务）视为需深度还原
function isDeep(name) { return /^(App|httpClient|src)-/.test(name); }
const DEEP = ALL_CHUNKS.filter(isDeep);
const OTHER = ALL_CHUNKS.filter((f) => !isDeep(f));
console.log(`📦 自动识别 chunks: DEEP(${DEEP.length}) = ${DEEP.join(', ')}`);
console.log(`             OTHER(${OTHER.length}) = ${OTHER.join(', ')}`);

function run(cmd, label) {
  console.log(`\n🔹 ${label}`);
  try { execSync(cmd, { stdio: 'inherit' }); }
  catch (e) { console.error(`❌ ${label} 失败: ${e.message}`); process.exit(1); }
}

function cp(src, dest) {
  if (!fs.existsSync(src)) { console.log(`   ⚠️ 跳过(源不存在): ${path.relative(UNPACKED, src)}`); return; }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function cpDir(src, dest) {
  if (!fs.existsSync(src)) { console.log(`   ⚠️ 跳过(源不存在): ${path.relative(UNPACKED, src)}`); return; }
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dest, e.name);
    e.isDirectory() ? cpDir(s, d) : fs.copyFileSync(s, d);
  }
}

// ============================================================
console.log('══════════════════════════════════════');
console.log('  一毛AI画布 深度逆向还原流水线');
console.log('══════════════════════════════════════');

// 初始化
console.log('\n📁 初始化...');
fs.rmSync(OUTPUT, { recursive: true, force: true });
fs.mkdirSync(path.join(WORK, 'src', 'bundle'), { recursive: true });
fs.mkdirSync(path.join(PROJECT, 'src', 'bundle'), { recursive: true });
fs.mkdirSync(path.join(PROJECT, 'share'), { recursive: true });

// 拷贝源文件
// §4：vendor-/rolldown-runtime-/__vite-browser-external- 虽被 extract_input 判定为「非业务 chunk」剔除，
// 但其实是业务 chunk 的运行时依赖（React 实例在 vendor-Z 内），必须进工程供 Vite 解析。
// 这里从 dist/assets/ 直接补拷（只拷贝，不走 webcrack）。
const RUNTIME_CHUNK_RE = /^(vendor-|rolldown-runtime-|__vite-browser-external-)/;
function collectRuntimeChunks() {
  const dir = path.join(UNPACKED, 'dist', 'assets');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => RUNTIME_CHUNK_RE.test(f) && f.endsWith('.js'));
}
const RUNTIME = collectRuntimeChunks();
// 运行时 chunk 名并入 OTHER 集合，供后续 walkFixImports（§5）识别改写
OTHER.push(...RUNTIME);

console.log('\n📦 拷贝源文件...');
for (const f of [...DEEP, ...RUNTIME, ...OTHER.filter(f => !RUNTIME.includes(f))]) {
  const s = path.join(SRC, f);
  const srcFrom = fs.existsSync(s) ? s : path.join(UNPACKED, 'dist', 'assets', f);
  if (fs.existsSync(srcFrom)) { cp(srcFrom, path.join(WORK, 'src', 'bundle', f)); console.log(`   ✅ ${f}`); }
  else { console.log(`   ⚠️ 缺失: ${f}`); }
}

// 第 0 步: Webcrack JSX 还原
console.log('\n══════ ⓪ Webcrack JSX 还原 ══════');
for (const f of DEEP) {
  const fp = path.join(WORK, 'src', 'bundle', f);
  if (fs.existsSync(fp)) {
    const tmp = fp + '.wc_tmp';
    run(`npx webcrack "${fp}" -o "${tmp}"`, `webcrack: ${f}`);
    // 回退链：deobfuscated.js → index.js → 目录下最大的 .js
    let out = path.join(tmp, 'deobfuscated.js');
    if (!fs.existsSync(out)) out = path.join(tmp, 'index.js');
    if (!fs.existsSync(out) && fs.existsSync(tmp)) {
      let max = null;
      for (const e of fs.readdirSync(tmp, { recursive: true, withFileTypes: true })) {
        if (e.isFile() && e.name.endsWith('.js')) {
          const p = path.join(e.parentPath || tmp, e.name);
          if (!max || fs.statSync(p).size > fs.statSync(max).size) max = p;
        }
      }
      out = max || out;
    }
    if (out && fs.existsSync(out)) fs.copyFileSync(out, fp);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// 第 1 步: AI 结构展开
console.log('\n══════ ① AI 结构展开 ══════');
for (const f of DEEP) {
  const fp = path.join(WORK, 'src', 'bundle', f);
  if (fs.existsSync(fp)) {
    run(`node "${path.join(SCRIPTS, '01_expand.cjs')}" "${fp}" "${fp}"`, f);
  }
}

// 第 1.5 步: 伪迹清理（webcrack 把 Object/constructor 替换成 Object.toString() 文本）
console.log('\n══════ ①b 伪迹清理 ══════');
for (const f of DEEP) {
  const fp = path.join(WORK, 'src', 'bundle', f);
  if (fs.existsSync(fp)) {
    run(`node "${path.join(SCRIPTS, '00_sanitize.cjs')}" "${fp}"`, f);
  }
}

// 第 2 步: 智能组件拆分
console.log('\n══════ ② 智能组件拆分 ══════');
for (const f of DEEP) {
  const fp = path.join(WORK, 'src', 'bundle', f);
  if (!fs.existsSync(fp)) continue;
  const compDir = path.join(WORK, 'src', 'bundle', f.replace('.js', '_components'));
  run(`node "${path.join(SCRIPTS, '02_split.cjs')}" "${fp}" "${compDir}"`, f);
}

// 第 3 步: 门面替换（原始 JS → Re-export）
console.log('\n══════ ③ 门面替换 ══════');
for (const f of DEEP) {
  const fp = path.join(WORK, 'src', 'bundle', f);
  if (!fs.existsSync(fp)) continue;
  const compDir = path.join(WORK, 'src', 'bundle', f.replace('.js', '_components'));
  if (fs.existsSync(compDir)) {
    run(`node "${path.join(SCRIPTS, '03_facade.cjs')}" "${fp}" "${compDir}"`, f);
  }
}

// 第 4 步: Unicode 中文还原
console.log('\n══════ ④ Unicode 中文还原 ══════');
function walkJs(dir, cb) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name.includes('_components'))
        for (const f2 of fs.readdirSync(p).filter(x => /\.(js|jsx)$/.test(x))) cb(path.join(p, f2));
      else walkJs(p, cb);
    } else if (/\.(js|jsx)$/.test(e.name)) cb(p);
  }
}
walkJs(path.join(WORK, 'src', 'bundle'), (fp) => {
  try { execSync(`node "${path.join(SCRIPTS, '04_unicode.cjs')}" "${fp}"`, { stdio: 'inherit' }); }
  catch (e) { console.log(`   ⚠️ 跳过: ${path.basename(fp)}`); }
});

// 第 5 步: 组装工程
console.log('\n══════ ⑤ 组装工程 ══════');

// 修复 _components/ 子目录中对外部 chunk 的相对路径
// §5：改写集合改为「bundle 根所有 .js」，覆盖业务 chunk 与运行时 chunk（vendor/rolldown/__vite-browser-external），
// 这样 _components/ 内对它们的 './X.js' 一律改写为 '../X.js'（原 fix_components_imports.cjs 逻辑固化）。
const bundleRoot = path.join(WORK, 'src', 'bundle');
const rootChunkNames = new Set(fs.existsSync(bundleRoot) ? fs.readdirSync(bundleRoot).filter((f) => f.endsWith('.js')) : []);
function walkFixImports(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory() && e.name.includes('_components')) {
      for (const f2 of fs.readdirSync(p)) {
        if (!/\.(js|jsx)$/.test(f2)) continue;
        const fp = path.join(p, f2);
        let code = fs.readFileSync(fp, 'utf8');
        const old = code;
        code = code.replace(/(from\s+)?['"`]\.\/([^'"`/]+\.js)['"`]/g, (m, from, name) => {
          if (rootChunkNames.has(name)) return `${from || ''}'../${name}'`;
          return m;
        });
        if (code !== old) fs.writeFileSync(fp, code);
      }
    }
  }
}
walkFixImports(bundleRoot);

cp(path.join(STATIC, 'index.html'), path.join(PROJECT, 'index.html'));
cp(path.join(STATIC, 'share.html'), path.join(PROJECT, 'share', 'index.html'));

// §3：原 HTML 引用 ./assets/<chunk>.js（原扩展构建产物路径），但源文件实际在 src/bundle/ 下。
// 固化 fix_html_refs.cjs 逻辑：把 assets/<x>.js -> src/bundle/<x>.js，assets/<x>.css -> src/bundle/assets/<x>.css。
function fixHtmlRefs(rel) {
  const fp = path.join(PROJECT, rel);
  if (!fs.existsSync(fp)) return;
  let h = fs.readFileSync(fp, 'utf8');
  h = h.replace(/(src|href)="(\.\.?\/)assets\/([^"]+\.js)"/g,
    (m, attr, dot, name) => `${attr}="${dot}src/bundle/${name}"`);
  h = h.replace(/(href)="(\.\.?\/)assets\/([^"]+\.css)"/g,
    (m, attr, dot, name) => `${attr}="${dot}src/bundle/assets/${name}"`);
  fs.writeFileSync(fp, h);
}
fixHtmlRefs('index.html');
fixHtmlRefs('share/index.html');

// 写入 vite.config.ts
  // 单 React 实例 shim：把 'react' 指向 vendor 内联 React(Rr)，与入口 react-dom(Ir) 同一实例，
  // 杜绝 Invalid hook call / 多实例（AI01~AI11 全员翻车的真凶）。jsx 运行时也指向 vendor Fr。
  // 动态解析 vendor / rolldown-runtime 真实文件名（随官方版本变，勿写死旧 hash，如 1.4.2 的 vendor-Z-adA07W.js / rolldown-runtime-aKtaBQYM.js）
  const vendorFile = RUNTIME.find((f) => f.startsWith('vendor-')) || 'vendor-Z-adA07W.js';
  const runtimeFile = RUNTIME.find((f) => f.startsWith('rolldown-runtime-')) || 'rolldown-runtime-aKtaBQYM.js';
  const REACT_SHIM_SRC = `import { Rr as __Rr } from './${vendorFile}';
import { i as __e } from './${runtimeFile}';
const React = __e(__Rr(), 1);
export default React;
export const useState = React.useState;
export const useEffect = React.useEffect;
export const useMemo = React.useMemo;
export const useCallback = React.useCallback;
export const useRef = React.useRef;
export const useImperativeHandle = React.useImperativeHandle;
export const useContext = React.useContext;
export const useReducer = React.useReducer;
export const useLayoutEffect = React.useLayoutEffect;
export const useDebugValue = React.useDebugValue;
export const useDeferredValue = React.useDeferredValue;
export const useTransition = React.useTransition;
export const useId = React.useId;
export const useSyncExternalStore = React.useSyncExternalStore;
export const useInsertionEffect = React.useInsertionEffect;
export const useOptimistic = React.useOptimistic;
export const useActionState = React.useActionState;
export const useFormStatus = React.useFormStatus;
export const use = React.use;
export const forwardRef = React.forwardRef;
export const memo = React.memo;
export const lazy = React.lazy;
export const Suspense = React.Suspense;
export const StrictMode = React.StrictMode;
export const Fragment = React.Fragment;
export const createElement = React.createElement;
export const createContext = React.createContext;
export const createFactory = React.createFactory;
export const createRef = React.createRef;
export const cloneElement = React.cloneElement;
export const isValidElement = React.isValidElement;
export const Children = React.Children;
export const Component = React.Component;
export const PureComponent = React.PureComponent;
export const Profiler = React.Profiler;
export const startTransition = React.startTransition;
export const flushSync = React.flushSync;
export const unstable_batchedUpdates = React.unstable_batchedUpdates;
export const version = React.version;
`;
  const JSX_RUNTIME_SRC = `import { Fr as __Fr } from './${vendorFile}';
const __rt = __Fr();
export const jsx = __rt.jsx;
export const jsxs = __rt.jsxs;
export const Fragment = __rt.Fragment;
`;
  const viteConfig = `import { defineConfig } from 'vite';
import { resolve } from 'path';
import { transformWithEsbuild } from 'vite';
import fs from 'fs';
import path from 'path';
// 单 React 实例：所有 'react' / 'react/jsx-runtime' 导入统一指向 vendor-Z 内联 React(Rr)，
// 与入口 vendor react-dom(Ir) 同一实例，杜绝 Invalid hook call / 多实例。
const reactShim = resolve(__dirname, 'src', 'bundle', '_react_shim.js');
const jsxRuntimeShim = resolve(__dirname, 'src', 'bundle', '_jsx_runtime.js');
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  base: './',
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      'react/jsx-runtime': jsxRuntimeShim,
      'react/jsx-dev-runtime': jsxRuntimeShim,
      'react': reactShim,
    },
  },
  plugins: [
    {
      name: 'force-jsx-for-js',
      enforce: 'pre',
      async transform(code, id) {
        if (id.endsWith('.js') && !id.includes('node_modules')) {
          return await transformWithEsbuild(code, id, { loader: 'jsx', jsx: 'automatic' });
        }
        return null;
      },
    },
    {
      // 构建后收尾：每次 npm run build 自动执行（此前手动/构建前补丁会被 Vite 重写 index.html 冲掉）。
      // ① 拷贝图标（原始 dist/icon*.png 不在 public 内，Vite 不会自动带进 dist）
      // ④ 从 public/assets 拷真实 CSS 覆盖 dist + 修正 src/bundle/assets 悬空路径 + 补齐 index.html 引用别名（动态识别，勿写死 CSS 名）
      // ③ 剥离 data:text/javascript 的 modulepreload（Rolldown 内联，违反 MV3 CSP）
      name: 'post-build-fixups',
      apply: 'build',
      closeBundle() {
        const distDir = path.resolve(__dirname, 'dist');
        const origDist = path.resolve(__dirname, '..', '..', 'dist'); // 逆向专用/dist（原始发行）
        if (!fs.existsSync(distDir)) return;
        for (const n of ['icon16.png', 'icon48.png', 'icon128.png']) {
          const from = path.join(origDist, n);
          const to = path.join(distDir, n);
          if (fs.existsSync(from) && !fs.existsSync(to)) fs.copyFileSync(from, to);
        }
        // ④ CSS 兜底：从 public/assets 拷真实样式覆盖 dist（防空占位/缺失导致界面错乱；随官方版本动态，勿写死 CSS 名）
        const pubAssets = path.resolve(__dirname, 'public', 'assets');
        if (fs.existsSync(pubAssets)) {
          for (const f of fs.readdirSync(pubAssets)) {
            if (f.endsWith('.css')) {
              try { fs.copyFileSync(path.join(pubAssets, f), path.join(distDir, 'assets', f)); } catch (_) {}
            }
          }
        }
        const targets = [
          { f: path.join(distDir, 'index.html'), base: 'assets/' },
          { f: path.join(distDir, 'share', 'index.html'), base: 'assets/' },
        ];
        for (const { f, base } of targets) {
          if (!fs.existsSync(f)) continue;
          let h = fs.readFileSync(f, 'utf8');
          // ⑤ 修 src/bundle/assets 悬空 CSS 路径（split 保留原 ./ 或 ../ 前缀，base 只给 assets/）
          h = h.split('src/bundle/assets/').join(base);
          // 补齐 index.html 引用的主样式：若 dist/assets 无同名文件，用真实 CSS 内容兜底生成别名
          const cssRefs = [...h.matchAll(/href="([^"]+)"/g)].map(m => m[1]).filter(r => r.endsWith('.css'));
          const realCss = (fs.existsSync(pubAssets) ? fs.readdirSync(pubAssets).filter(x => x.endsWith('.css')) : []);
          for (const ref of cssRefs) {
            const name = ref.split('/').pop();
            const target = path.join(distDir, 'assets', name);
            if (!fs.existsSync(target) && realCss.length > 0) {
              const src = path.join(distDir, 'assets', realCss[0]);
              if (fs.existsSync(src)) { try { fs.copyFileSync(src, target); } catch (_) {} }
            }
          }
          h = h.replace(/<link[^>]+rel="modulepreload"[^>]+href="data:text\\/javascript[^"]*"[^>]*>\\s*/g, '');
          fs.writeFileSync(f, h);
        }
        console.log('  ✅ post-build 收尾：图标 + css 兜底 + CSP data: 剥离已固化');
      },
    },
  ],
  build: {
    outDir: 'dist', emptyOutDir: true, target: 'esnext', modulePreload: false,
    rollupOptions: {
      input: { index: resolve(__dirname, 'index.html'), share: resolve(__dirname, 'share', 'index.html') },
      output: {
        entryFileNames: 'assets/[name].js', chunkFileNames: 'assets/[name].js', assetFileNames: 'assets/[name][extname]',
        manualChunks(id) { const m = id.match(/[\\\\/]src[\\\\/]bundle[\\\\/]([^\\\\/]+\\.js)$/); if (m) return m[1].replace(/\\.js$/, ''); },
      },
    },
  },
});`;
fs.writeFileSync(path.join(PROJECT, 'vite.config.ts'), viteConfig);
// §2：tsconfig / tailwind 模板兜底。原生 dist 不产出这两个文件，
// 若 step0_raw/static 也没有，则用内置模板生成，避免 cp 缺失 + 工程缺配置。
const TS_TEMPLATE = JSON.stringify({
  compilerOptions: { target: 'ESNext', module: 'ESNext', moduleResolution: 'Bundler', jsx: 'react-jsx', strict: false, esModuleInterop: true, skipLibCheck: true, allowJs: true, lib: ['ESNext', 'DOM', 'DOM.Iterable'], types: ['chrome', 'react', 'react-dom'] },
  include: ['src'],
}, null, 2);
const TAILWIND_TEMPLATE = `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './share/index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
`;
function ensureTemplate(srcRel, destRel, template) {
  const src = path.join(STATIC, srcRel);
  const dest = path.join(PROJECT, destRel);
  if (fs.existsSync(src)) cp(src, dest);
  else { fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, template, 'utf8'); console.log(`   📄 内置模板生成: ${destRel}`); }
}
ensureTemplate('tsconfig.json', 'tsconfig.json', TS_TEMPLATE);
ensureTemplate('tailwind.config.js', 'tailwind.config.js', TAILWIND_TEMPLATE);
cpDir(path.join(STATIC, 'public'), path.join(PROJECT, 'public'));
cpDir(path.join(WORK, 'src'), path.join(PROJECT, 'src'));
// 写入单 React 实例 shim（'react' 经 vite alias 指向这两个文件 -> vendor 单实例）
fs.writeFileSync(path.join(PROJECT, 'src', 'bundle', '_react_shim.js'), REACT_SHIM_SRC, 'utf8');
fs.writeFileSync(path.join(PROJECT, 'src', 'bundle', '_jsx_runtime.js'), JSX_RUNTIME_SRC, 'utf8');
// 终检：对组装后的工程递归清理 webcrack 伪迹（function X(){[native code]}），确保 Vite 能正常解析
console.log('   🧼 终检伪迹清理...');
run(`node "${path.join(SCRIPTS, 'clean_project.cjs')}" "${path.join(PROJECT, 'src', 'bundle')}"`, 'clean');
console.log('   ✅ 配置 / public / 源码');

// CSS 占位文件（消除 Vite 警告 + 保证真实样式不丢失）
// 优先从「原始 dist/assets/」拷贝真实 CSS（若提取阶段没有带出），缺失才写占位符。
// 注意：绝不能把已存在的真实 CSS 覆盖成空占位符，否则构建产物样式为 0 字节 → 界面错乱。
const cssDir = path.join(PROJECT, 'src', 'bundle', 'assets');
const DIST_ASSETS = path.join(UNPACKED, 'dist', 'assets');
fs.mkdirSync(cssDir, { recursive: true });
// 动态识别「原始 dist/assets/」的真实 CSS 名（随官方版本变化，勿写死旧版名，如 1.4.2 的 src-BsO0T5Vc.css / src-DoQUrSOl.css、1.4.3 的 src-DQ-1CVtg.css）。
// 优先从原始 dist 拷真实样式，缺失才写空占位兜底（绝不能把已存在的真实 CSS 覆盖成空占位 → 界面错乱）。
const realCssList = fs.existsSync(DIST_ASSETS) ? fs.readdirSync(DIST_ASSETS).filter(f => f.endsWith('.css')) : [];
const cssNames = realCssList.length > 0 ? realCssList : ['src-BsO0T5Vc.css', 'vendor-Qkhkn02K.css', 'src-DoQUrSOl.css', 'httpClient-DFxwm5B3.css'];
cssNames.forEach(css => {
  const p = path.join(cssDir, css);
  const real = path.join(DIST_ASSETS, css);
  if (!fs.existsSync(p)) {
    if (fs.existsSync(real)) cp(real, p); // 用原始真实样式
    else fs.writeFileSync(p, '/* 逆向还原自动生成 */'); // 仅兜底占位
  }
});

// package.json (含 react 依赖)
fs.writeFileSync(path.join(PROJECT, 'package.json'), JSON.stringify({
  name: 'yimao-ai-canvas', private: true, version: '1.0.0',
  description: '一毛AI画布 深度逆向还原', type: 'module',
  scripts: { dev: 'vite', build: 'vite build' },
  dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' },
  devDependencies: { '@types/chrome': '^0.0.279', '@types/react': '^19.0.0', '@types/react-dom': '^19.0.0', typescript: '^5.6.3', vite: '^5.4.11' },
}, null, 2));

// ⑤ 修正产物 dist/index.html 的样式引用
// 逆向 JS 用 mapDeps 懒加载 CSS（非静态 import），Vite 构建时无法静态分析，
// 会把 stylesheet link 漏掉或只注入其中一个，导致界面错乱（布局丢失/上下颠倒）。
// 这里直接从「原始 dist」的 index.html 提取所有 stylesheet <link>，强制回写产物 HTML。
(function fixDistHtmlCss() {
  const origHtml = path.join(STATIC, 'index.html');
  const distHtml = path.join(PROJECT, 'dist', 'index.html');
  if (!fs.existsSync(origHtml) || !fs.existsSync(distHtml)) return;
  const orig = fs.readFileSync(origHtml, 'utf8');
  const cssLinks = [...orig.matchAll(/<link[^>]+rel="stylesheet"[^>]*>/g)].map(m => m[0]);
  if (!cssLinks.length) return;
  let html = fs.readFileSync(distHtml, 'utf8');
  // 移除产物中已有的 stylesheet（避免重复/空引用），再统一插入原始真实引用
  html = html.replace(/<link[^>]+rel="stylesheet"[^>]*>\s*/g, '');
  const headClose = html.indexOf('</head>');
  if (headClose === -1) return;
  html = html.slice(0, headClose) + cssLinks.join('\n    ') + '\n    ' + html.slice(headClose);
  fs.writeFileSync(distHtml, html);
  console.log(`   🎨 已修正 dist/index.html 样式引用: ${cssLinks.length} 个 CSS`);
})();

// ⑥ 剥离产物 HTML 中 data:text/javascript 的 modulepreload（MV3 CSP 报错根因）
// Rolldown 构建时即便 modulePreload:false 仍会把小模块内联成 data: URL 的 <link rel=modulepreload>，
// 而 MV3 扩展 CSP「script-src 'self' 'wasm-unsafe-eval'」禁止 data: 来源脚本 → 加载即报
// "Loading the script 'data:text/javascript...' violates the following Content Security Policy"。
// 这些 data: preload 是冗余（真实入口是 ./assets/*.js 普通 <script type=module>，符合 CSP），直接剥离即可。
(function stripDataUrlPreload() {
  const targets = [
    path.join(PROJECT, 'dist', 'index.html'),
    path.join(PROJECT, 'dist', 'share', 'index.html'),
  ];
  for (const f of targets) {
    if (!fs.existsSync(f)) continue;
    let html = fs.readFileSync(f, 'utf8');
    const stripped = html.replace(/<link[^>]+rel="modulepreload"[^>]+href="data:text\/javascript[^"]*"[^>]*>\s*/g, '');
    if (stripped !== html) {
      fs.writeFileSync(f, stripped);
      const n = (html.match(/data:text\/javascript/g) || []).length - (stripped.match(/data:text\/javascript/g) || []).length;
      console.log(`   🛡️ 已剥离 ${f.split(PROJECT)[1]} 中 ${n} 个 data: modulepreload（消除 CSP 报错）`);
    }
  }
})();

// 统计 & 清理
const count = fs.readdirSync(path.join(PROJECT, 'src', 'bundle'), { recursive: true }).length;
fs.rmSync(WORK, { recursive: true, force: true }); // 清临时目录

console.log(`\n══════════════════════════════════════`);
console.log(`  ✅ 完成！${count} 个文件`);
console.log(`  工程: ${PROJECT}`);
console.log(`  构建: cd output/project && npm install && npm run build`);
console.log(`══════════════════════════════════════`);
