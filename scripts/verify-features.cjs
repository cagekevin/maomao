#!/usr/bin/env node
/**
 * verify-features.cjs — gougou P1-5b 运行时标记验证
 *
 * 用 Playwright 加载 dist 扩展，打开 side_panel 页，读取 window.__gougou_features__，
 * 验证各功能域 barrel 是否在真机中被加载。
 *
 * 用法: node scripts/verify-features.cjs
 * 预期: 11 域标记（model-config/video-config/prompt-management/media-processing/
 *       utility-functions/task-scheduler/canvas-editor/endpoint-share/
 *       ui-app/ui-http/ui-src）按接线状态输出 true/false/missing
 */
const path = require('path');
const { resolveExtPath, launchExtContext, findExtId } = require('./verify-common.cjs');

const EXPECTED = [
  'model-config', 'video-config', 'prompt-management',
  'media-processing', 'utility-functions', 'task-scheduler',
  'canvas-editor', 'endpoint-share',
  'ui-app', 'ui-http', 'ui-src',
];

async function main() {
  const { extPath, cleanup } = resolveExtPath();
  const profileDir = path.join(__dirname, '..', '.playwright-profile-features');
  const context = await launchExtContext(extPath, profileDir);
  let errors = [];

  try {
    const extId = await findExtId(context, 15000);
    if (!extId) {
      console.error('❌ 未找到扩展 id');
      process.exitCode = 1;
      return;
    }

    // 打开 side_panel 页面
    const pageUrl = `chrome-extension://${extId}/index.html`;
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push({ scope: 'page', text: e.message }));

    try {
      await page.goto(pageUrl, { waitUntil: 'load', timeout: 20000 });
    } catch (e) {
      errors.push({ scope: 'goto', text: e.message });
    }

    // 等 React 初始化 (side_panel)
    await page.waitForTimeout(3000);

    // 读取 runtime 标记
    const features = await page.evaluate(() => {
      const w = /** @type {any} */ (window);
      return w.__gougou_features__ || {};
    });

    console.log('\n════════ runtime 标记验证 ════════');
    let allWired = true;
    let missing = [];
    let present = [];

    for (const name of EXPECTED) {
      const val = features[name];
      if (val === true) {
        present.push(name);
        console.log(`  ✅ ${name}`);
      } else {
        missing.push(name);
        allWired = false;
        console.log(`  ❌ ${name}  — ${val === false ? 'false' : '未置位'}`);
      }
    }

    // 摘要
    const total = EXPECTED.length;
    const ok = present.length;
    const fail = missing.length;
    const extra = Object.keys(features).filter(k => !EXPECTED.includes(k));

    console.log(`\n════════ 摘要 ════════`);
    console.log(`  域标记: ${ok}/${total} true, ${fail} 未置位`);
    if (extra.length) console.log(`  额外标记: ${extra.join(', ')}`);
    if (errors.length) console.log(`  页面错误: ${errors.length}`);
    console.log(allWired ? '\n✅ 全部接线 → 标记全量置位' : '\n⚠️ 存在未接线域');

    if (fail > 0) process.exitCode = 1;
  } finally {
    await context.close();
    cleanup();
  }
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(2);
});
