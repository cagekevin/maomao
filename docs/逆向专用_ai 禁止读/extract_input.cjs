/**
 * extract_input.cjs — 从「最初的 dist」提取方法包所需的 step0_raw/
 *
 * 背景：我们最初只有一个官方编译好的扩展 dist（如 C:\Users\xinye\Downloads\11\dist）。
 * 逆向方法包的输入 step0_raw/ 就是从这个 dist 里提取出来的：
 *   - assets/*.js 里的业务混淆 chunk  →  step0_raw/chunks/
 *   - 入口 html / manifest / 静态资源    →  step0_raw/static/
 *
 * chunk 提取采用 **glob 自适应**（fs.readdirSync 过滤），不再写死文件名：
 *   只收「业务 chunk」（走完整 webcrack→拆分流程），剔除纯第三方依赖
 *   （vendor-* / rolldown-runtime-* / __vite-browser-external-*）。
 *   这样换版本 / 换源无需改白名单，版本无关。
 *
 * 用法：
 *   node extract_input.cjs <dist路径>
 *   node extract_input.cjs C:\Users\xinye\Downloads\11\dist
 *
 * 不改写任何文件内容，只做复制。
 */

const fs = require('fs');
const path = require('path');

const DIST = process.argv[2];
if (!DIST) {
  console.error('用法: node extract_input.cjs <dist路径>');
  process.exit(1);
}
if (!fs.existsSync(DIST)) {
  console.error(`❌ dist 不存在: ${DIST}`);
  process.exit(1);
}

const ROOT = __dirname;
const CHUNKS_DST = path.join(ROOT, 'step0_raw', 'chunks');
const STATIC_DST = path.join(ROOT, 'step0_raw', 'static');

function copyIfExists(src, dst) {
  if (fs.existsSync(src)) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    return true;
  }
  return false;
}

/**
 * 业务 chunk 判定：剔除纯第三方依赖，保留业务代码。
 * 排除：vendor-* / rolldown-runtime-* / __vite-browser-external-*（这些是打包器/框架层，不走 webcrack）。
 * 其它 assets/*.js 一律视为业务 chunk 收齐。
 */
function isBusinessChunk(name) {
  if (!name.endsWith('.js')) return false;
  if (/^vendor-/.test(name)) return false;
  if (/^rolldown-runtime-/.test(name)) return false;
  if (/^__vite-browser-external-/.test(name)) return false;
  return true;
}

// ① 提取业务 chunk（glob 自适应，不再写死白名单）
fs.mkdirSync(CHUNKS_DST, { recursive: true });
const assetsDir = path.join(DIST, 'assets');
let ok = 0, miss = [];
if (fs.existsSync(assetsDir)) {
  for (const f of fs.readdirSync(assetsDir).filter(isBusinessChunk)) {
    const src = path.join(assetsDir, f);
    if (copyIfExists(src, path.join(CHUNKS_DST, f))) ok++;
    else miss.push(f);
  }
}
console.log(`✅ chunks: ${ok} 个业务 chunk 已提取到 step0_raw/chunks/`);
if (miss.length) console.log(`⚠️ 提取失败: ${miss.join(', ')}`);

// ② 提取 static
fs.mkdirSync(STATIC_DST, { recursive: true });

// 入口 html
copyIfExists(path.join(DIST, 'index.html'), path.join(STATIC_DST, 'index.html'));
copyIfExists(path.join(DIST, 'share', 'index.html'), path.join(STATIC_DST, 'share.html'));

// 配置（若 dist 根有 tsconfig/tailwind 则一并拿，没有则保留方法包自带模板）
copyIfExists(path.join(DIST, 'tsconfig.json'), path.join(STATIC_DST, 'tsconfig.json'));
copyIfExists(path.join(DIST, 'tailwind.config.js'), path.join(STATIC_DST, 'tailwind.config.js'));

// public 静态资源（mediapipe / models / 图标 / wasm 等）
// 注意：manifest.json 和 background.js 在 dist 根（不在 dist/public/），必须显式复制
const PUBLIC_SRC = path.join(DIST, 'public');
const PUBLIC_DST = path.join(STATIC_DST, 'public');
fs.mkdirSync(PUBLIC_DST, { recursive: true });

// 优先复制 dist/public/ 下的子目录资源（mediapipe/models/share 等）
if (fs.existsSync(PUBLIC_SRC)) {
  fs.cpSync(PUBLIC_SRC, PUBLIC_DST, { recursive: true });
  console.log('✅ public/ 子目录资源已提取');
}

// dist 根的扩展必需文件（manifest / background / 图标 / wasm 等）补进 public/
// 这些不在 dist/public/ 下，但扩展加载必须有 manifest.json
const PUBLIC_ROOT_FILES = ['manifest.json', 'background.js', 'icon16.png', 'icon48.png', 'icon128.png'];
for (const f of PUBLIC_ROOT_FILES) {
  copyIfExists(path.join(DIST, f), path.join(PUBLIC_DST, f));
}
// 若 dist 根还有 mediapipe/models/share 等顶层目录，也并入 public/
for (const d of ['mediapipe', 'models', 'share', 'icons', 'wasm', 'assets']) {
  const s = path.join(DIST, d);
  if (fs.existsSync(s)) fs.cpSync(s, path.join(PUBLIC_DST, d), { recursive: true });
}
console.log('✅ dist 根 manifest/background + 静态资源已提取到 step0_raw/static/public/');

console.log('\n完成。接下来跑: node pipeline/run.cjs');
