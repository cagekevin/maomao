'use strict';
// 一次性资源复制 + manifest 净化（不属于核心流水线，仅供搭建 A22 工程用）。
// 从原始样本 dist/ 复制扩展壳资源到 public/，并删除 MV3 不识别的 changelog / localToolChanged 键。
// 样本根目录通过 SAMPLE_ROOT 环境变量指定（默认 ../一毛AI画布多端合一版本1.4.0/dist），
// 不写死任何绝对路径（铁律 #2）。

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..').replace(/\\/g, '/');
const SRC = (process.env.SAMPLE_ROOT || '../一毛AI画布多端合一版本1.4.0/dist').replace(/\\/g, '/');
const SRC_DIR = path.resolve(ROOT, SRC).replace(/\\/g, '/');
const DST = path.join(ROOT, 'public').replace(/\\/g, '/');

if (!fs.existsSync(SRC_DIR)) {
  console.error('未找到样本 dist 目录：', SRC_DIR);
  process.exit(1);
}

function cpFile(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}
function cpDir(s, d) {
  for (const e of fs.readdirSync(s, { withFileTypes: true })) {
    const ss = path.join(s, e.name);
    const dd = path.join(d, e.name);
    if (e.isDirectory()) cpDir(ss, dd);
    else cpFile(ss, dd);
  }
}

const icons = ['icon16.png', 'icon48.png', 'icon128.png', 'logo.png', 'favicon.svg', 'icons.svg'];
for (const f of icons) {
  const s = path.join(SRC_DIR, f);
  if (fs.existsSync(s)) cpFile(s, path.join(DST, f));
}
if (fs.existsSync(path.join(SRC_DIR, 'mediapipe'))) cpDir(path.join(SRC_DIR, 'mediapipe'), path.join(DST, 'mediapipe'));
if (fs.existsSync(path.join(SRC_DIR, 'models'))) cpDir(path.join(SRC_DIR, 'models'), path.join(DST, 'models'));

// 净化 manifest：移除 Chrome 不识别的 changelog / localToolChanged；保留 CSP 的 wasm-unsafe-eval
const m = JSON.parse(fs.readFileSync(path.join(SRC_DIR, 'manifest.json'), 'utf8'));
delete m.changelog;
delete m.localToolChanged;
fs.writeFileSync(path.join(DST, 'manifest.json'), JSON.stringify(m, null, 2) + '\n');

console.log('manifest keys:', Object.keys(m).join(','));
console.log('copied icons + mediapipe + models; manifest 已净化');
