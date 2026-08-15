#!/usr/bin/env node
/**
 * verify-ext.cjs — gougou 真机验收（适配自第二步 verifiers/AI01_ext/verify_ext.cjs）
 *
 * 用 Playwright 把 dist/ 作为未打包 MV3 扩展加载，捕获：
 *   - popup / 分享页 的 console + pageerror
 *   - service worker 的 Runtime.exceptionThrown / consoleAPICalled
 *   - 页面 UI 元素断言（side_panel 渲染 / 分享页渲染 / 无 crash）
 * 仅「应用级错误」（非噪声）才判失败并非零退出；结果写入 scripts/report.json。
 *
 * 用法:
 *   npm run verify                 # 默认加载工程根 dist/
 *   EXT_PATH=<某dist路径> npm run verify
 * 依赖: playwright（devDependency，浏览器二进制复用已缓存 chromium）
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { resolveExtPath, isNoise, launchExtContext, findExtId, attachSW } = require('./verify-common.cjs');

const PROFILE = path.join(os.tmpdir(), 'gougou-verify-profile');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const watchdog = setTimeout(() => { console.error('WATCHDOG: forced exit'); process.exit(9); }, 120000);
watchdog.unref();

const events = [];
function rec(scope, kind, text, loc) {
  const noise = isNoise(String(text));
  events.push({ scope, kind, text: String(text).slice(0, 800), loc: loc || null, noise });
  const bad = kind === 'error' || kind === 'exception' || kind === 'pageerror';
  const tag = bad ? (noise ? '⚪' : '❌') : '·';
  console.log(`${tag} [${scope}] ${kind}: ${String(text).slice(0, 300)}`);
}

(async () => {
  const { extPath, cleanup } = resolveExtPath();
  const context = await launchExtContext(extPath, PROFILE);
  try {
    const extId = await findExtId(context);
    console.log('extension id:', extId || '(unknown)');

    // 监听已注册的 SW
    let swAttached = false;
    for (const sw of context.serviceWorkers()) {
      if (!swAttached) { await attachSW(sw, rec); swAttached = true; }
    }
    context.on('serviceworker', (sw) => attachSW(sw, rec));

    async function openPage(rel) {
      if (!extId) { rec('page', 'error', 'no extId, skip ' + rel); return; }
      const page = await context.newPage();
      page.on('console', (msg) => { if (msg.type() === 'error') rec('page', 'error', msg.text()); else rec('page', msg.type(), msg.text()); });
      page.on('pageerror', (err) => rec('page', 'pageerror', err.message + '\n' + (err.stack || '').split('\n').slice(0, 4).join('\n')));
      page.on('requestfailed', (req) => rec('page', 'error', 'reqfail ' + req.url() + ' ' + (req.failure() && req.failure().errorText)));
      const url = `chrome-extension://${extId}/${rel}`;
      try { await page.goto(url, { waitUntil: 'load', timeout: 20000 }); }
      catch (e) { rec('page', 'error', 'goto ' + rel + ': ' + e.message); }
      await sleep(5000); // 等 React 渲染 / 副作用执行

      // ── UI 元素断言 ──
      const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 100) || '');
      if (!bodyText) {
        rec('page', 'error', rel + ' — 页面无内容（可能渲染崩溃）');
      } else {
        rec('page', 'assert', rel + ' ✓ 页面已渲染');
      }
      await page.close();
    }

    await openPage('index.html');
    await openPage('share/index.html');
    await sleep(2000);

    const allErrs = events.filter((e) => e.kind === 'error' || e.kind === 'exception' || e.kind === 'pageerror' || e.text?.includes('页面无内容'));
    const realErrors = allErrs.filter((e) => !e.noise);
    const noiseErrors = allErrs.filter((e) => e.noise);

    console.log('\n════════ 真机验收摘要 ════════');
    console.log(`total events: ${events.length} | 应用级错误: ${realErrors.length} | 噪声(忽略): ${noiseErrors.length}`);
    const out = path.resolve(__dirname, 'report.json');
    fs.writeFileSync(out, JSON.stringify({ extId, realErrorCount: realErrors.length, noiseCount: noiseErrors.length, events }, null, 2));
    console.log('report →', out);

    await context.close();
    cleanup();
    process.exit(realErrors.length ? 1 : 0);
  } catch (e) {
    await context.close().catch(() => {});
    cleanup();
    console.error('harness crash:', e);
    process.exit(3);
  }
})();
