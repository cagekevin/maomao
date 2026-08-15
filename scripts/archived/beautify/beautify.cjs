#!/usr/bin/env node
/**
 * 反编译美化脚本（1.4.0 版，glob 自适应）——逆向还原的"一键复现"工具
 *
 * 作用：把原始样本 dist/assets 中的压缩 chunk，用 esbuild 重新排版为可读的多行源码，
 * 输出到 src/bundle/ 与 public/，逻辑与标识符（除已被压缩器混淆者外）保持 1:1。
 *
 * 用法：
 *   SAMPLE=<1.4.0 样本 dist/assets 绝对或相对路径> node scripts/beautify.cjs
 *   （默认 SAMPLE = ../一毛AI画布多端合一版本1.4.0/dist/assets）
 *
 * 版本安全（铁律 #2）：所有参与处理的 chunk 名一律用 glob（fs.readdirSync 过滤 *.js / *.css）
 * 取得，绝不写死任何 1.3.5 文件名（如 App-B9jVCs-a.js / index-CZiVAxxw.js）。
 * 证据：本工程逆向自 1.4.0（src/bundle 含 App-D5SRQxl_.js / vendor-Z-adA07W.js / share-CymbjOw4.js 等）。
 */
'use strict';
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..').replace(/\\/g, '/');
const SAMPLE = (process.env.SAMPLE || '../一毛AI画布多端合一版本1.4.0/dist/assets').replace(/\\/g, '/');
const SAMPLE_DIR = path.resolve(ROOT, SAMPLE).replace(/\\/g, '/');
const SAMPLE_ROOT = path.resolve(SAMPLE_DIR, '..').replace(/\\/g, '/'); // .../1.4.0/dist

if (!fs.existsSync(SAMPLE_DIR)) {
  console.error('未找到原始样本 assets 目录：', SAMPLE_DIR);
  process.exit(1);
}

const BUNDLE = path.join(ROOT, 'src', 'bundle').replace(/\\/g, '/');
const PUB = path.join(ROOT, 'public').replace(/\\/g, '/');
fs.mkdirSync(BUNDLE, { recursive: true });
fs.mkdirSync(path.join(PUB, 'assets'), { recursive: true });

// 1) 所有 js chunk：glob 取得，绝不以写死 1.3.5 名当默认
const jsFiles = fs.readdirSync(SAMPLE_DIR).filter((f) => f.endsWith('.js')).sort();
if (jsFiles.length === 0) {
  console.error('样本 assets 目录下没有任何 .js chunk，请检查 SAMPLE 指向是否正确（应指向 1.4.0/dist/assets）。');
  process.exit(1);
}
for (const f of jsFiles) {
  const srcPath = path.join(SAMPLE_DIR, f);
  const dst = path.join(BUNDLE, f).replace(/\\/g, '/');
  const code = fs.readFileSync(srcPath, 'utf8');
  let out = code;
  try {
    out = esbuild.transformSync(code, {
      loader: 'js',
      target: 'esnext',
      format: 'esm',
      legalComments: 'none',
    }).code;
  } catch (e) {
    console.warn('  [esbuild 美化失败，原样复制]', f, '-', e.message);
  }
  fs.writeFileSync(dst, out);
  console.log('beautify ->', dst, `(${code.length} bytes)`);
}

// 2) css：glob 原样复制到 public/assets/
for (const f of fs.readdirSync(SAMPLE_DIR).filter((f) => f.endsWith('.css'))) {
  const from = path.join(SAMPLE_DIR, f);
  const to = path.join(PUB, 'assets', f).replace(/\\/g, '/');
  fs.copyFileSync(from, to);
  console.log('css ->', to);
}

// 3) background.js 是经典脚本（无 import/export），原样复制（不 esbuild，避免任何改写）
const bgSrc = path.join(SAMPLE_ROOT, 'background.js').replace(/\\/g, '/');
const bgDst = path.join(PUB, 'background.js').replace(/\\/g, '/');
if (fs.existsSync(bgSrc)) {
  fs.copyFileSync(bgSrc, bgDst);
  console.log('background ->', bgDst);
} else {
  console.warn('跳过（不存在）：', bgSrc);
}
console.log('done. js chunks:', jsFiles.length);
