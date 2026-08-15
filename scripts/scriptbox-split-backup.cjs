#!/usr/bin/env node
/**
 * scriptbox-split-backup.cjs — 剧本盒子引擎拆分专用「改动前快照 + 恢复」
 *
 * 与 scripts/rollback（改名专用）不同，本工具专为「大段代码从 H_.jsx 抽到独立文件」
 * 这类跨文件、大段、不可逆性高的操作设计。
 *
 * 用法:
 *   node scripts/scriptbox-split-backup.cjs --save    # 拆分前：快照 src/bundle 受保护文件
 *   node scripts/scriptbox-split-backup.cjs --check   # 任何时点：比对当前 vs 快照哈希
 *   node scripts/scriptbox-split-backup.cjs --restore # 拆分失败：从快照目录恢复原件
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BUNDLE = path.join(ROOT, 'src', 'bundle', 'httpClient-BknZwXjG_components');
const SNAP_DIR = path.join(__dirname, 'scriptbox-split-snapshot');
const META = path.join(SNAP_DIR, 'meta.json');

// 受保护文件：引擎拆分涉及改动的都记录，恢复时整组还原
const PROTECTED = ['H_.jsx', 'c_.jsx', 'shared.js'];

function hashFile(p) {
  if (!fs.existsSync(p)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 16);
}

function snapshot() {
  if (!fs.existsSync(SNAP_DIR)) fs.mkdirSync(SNAP_DIR, { recursive: true });
  const meta = {
    created: new Date().toISOString(),
    commit: execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim(),
    files: {},
  };
  for (const f of PROTECTED) {
    const src = path.join(BUNDLE, f);
    if (!fs.existsSync(src)) continue;
    // 副本（restore 用）
    fs.copyFileSync(src, path.join(SNAP_DIR, f));
    meta.files[f] = { size: fs.statSync(src).size, hash: hashFile(src) };
  }
  fs.writeFileSync(META, JSON.stringify(meta, null, 2));
  console.log(`✅ 快照已保存: ${Object.keys(meta.files).length} 文件 → ${SNAP_DIR}`);
  for (const f of PROTECTED) {
    const m = meta.files[f];
    if (m) console.log(`   ${f}  ${m.hash}  (${m.size} B)`);
  }
}

function check() {
  if (!fs.existsSync(META)) {
    console.error('❌ 无快照。请先运行: node scripts/scriptbox-split-backup.cjs --save');
    process.exit(1);
  }
  const meta = JSON.parse(fs.readFileSync(META, 'utf-8'));
  let fail = 0;
  for (const f of PROTECTED) {
    const m = meta.files[f];
    if (!m) continue;
    const now = hashFile(path.join(BUNDLE, f));
    const ok = now === m.hash;
    console.log(`   ${ok ? '✅' : '🔶 变化'} ${f}  快照 ${m.hash} | 当前 ${now}`);
    if (!ok) fail++;
  }
  console.log(`\n📊 结果: ${fail === 0 ? '全部未动，与快照一致' : `${fail} 个文件已偏离快照`}`);
  console.log(`   快照 commit: ${meta.commit}  (${meta.created})`);
  process.exit(fail > 0 ? 1 : 0);
}

function restore() {
  if (!fs.existsSync(META)) {
    console.error('❌ 无快照可恢复。');
    process.exit(1);
  }
  const meta = JSON.parse(fs.readFileSync(META, 'utf-8'));
  for (const f of PROTECTED) {
    const copy = path.join(SNAP_DIR, f);
    const dst = path.join(BUNDLE, f);
    if (fs.existsSync(copy)) {
      fs.copyFileSync(copy, dst);
      console.log(`✅ 已恢复 ${f}`);
    }
  }
  console.log(`   恢复完成（快照 commit: ${meta.commit}）`);
}

const arg = process.argv[2];
if (arg === '--save') snapshot();
else if (arg === '--check') check();
else if (arg === '--restore') restore();
else {
  console.log('用法: node scripts/scriptbox-split-backup.cjs [--save | --check | --restore]');
  process.exit(1);
}
