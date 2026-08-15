#!/usr/bin/env node
/**
 * verify-chunks.cjs — gougou 动态 chunk 逐个 import 验收（思路来自第二步 verifiers/AI05_checks/check3/check4）
 *
 * 自动扫描 dist/assets/*.js，在已加载的扩展同源页面里逐个 `import()` 验证顶层执行
 * （动态/异步 chunk 不一定被 index.html 渲染走到，本脚本补这块覆盖）。
 * 仅「应用级错误」（非噪声）才判失败；结果写入 scripts/report-chunks.json。
 *
 * 用法:
 *   npm run verify:chunks
 * 依赖: playwright（devDependency）
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { resolveExtPath, isNoise, launchExtContext, findExtId } = require('./verify-common.cjs');

const PROFILE = path.join(os.tmpdir(), 'gougou-chunks-profile');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const watchdog = setTimeout(() => { console.error('WATCHDOG: forced exit'); process.exit(9); }, 180000);
watchdog.unref();

const events = [];
function rec(scope, kind, text) {
  const noise = isNoise(String(text));
  events.push({ scope, kind, text: String(text).slice(0, 800), noise });
  const bad = kind === 'error' || kind === 'pageerror';
  const tag = bad ? (noise ? '⚪' : '❌') : '·';
  console.log(`${tag} [${scope}] ${kind}: ${String(text).slice(0, 300)}`);
}

(async () => {
  const { extPath, cleanup } = resolveExtPath();
  const context = await launchExtContext(extPath, PROFILE);
  try {
    const extId = await findExtId(context);
    if (!extId) {
      console.error('❌ 扩展未加载（extId=null）。请先 npm run build 生成 dist/，再确认 manifest 正常。');
      await context.close();
      cleanup();
      process.exit(2);
    }
    console.log('extension id:', extId);

    const assetsDir = path.resolve(__dirname, '..', 'dist', 'assets');
    if (!fs.existsSync(assetsDir)) { console.error('❌ 找不到 dist/assets'); await context.close(); cleanup(); process.exit(2); }
    const chunks = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
    console.log(`🔍 发现 ${chunks.length} 个 chunk`);

    // 先打一个同源页面（import() 需要同源 chrome-extension:// 上下文）
    const page = await context.newPage();
    page.on('pageerror', (e) => rec('page', 'pageerror', e.message));
    page.on('console', (m) => { if (m.type() === 'error') rec('page', 'error', m.text()); });
    await page.goto(`chrome-extension://${extId}/index.html`, { waitUntil: 'load', timeout: 20000 })
      .catch((e) => rec('page', 'error', 'goto index.html: ' + e.message));
    await sleep(2000);

    const results = [];
    for (const c of chunks) {
      const url = `chrome-extension://${extId}/assets/${c}`;
      // eslint-disable-next-line no-await-in-loop
      const r = await page.evaluate(async (u) => {
        try { await import(u); return { ok: true }; }
        catch (e) { return { ok: false, msg: (e && e.message) || String(e) }; }
      }, url).catch((e) => ({ ok: false, msg: 'evaluate fail: ' + e.message }));
      const ok = r.ok && !isNoise(r.msg || '');
      if (!ok) rec('chunk', 'error', `${c}: ${r.msg}`);
      console.log(`${ok ? 'OK  ' : 'FAIL'} ${c}${r.ok ? '' : '  -> ' + (r.msg || '')}`);
      results.push({ c, ok: r.ok, msg: r.msg || null });
    }
    await page.close();

    const failed = results.filter((r) => !r.ok);
    const realErrors = events.filter((e) => (e.kind === 'error' || e.kind === 'pageerror') && !e.noise);
    console.log(`\n════════ chunk 验收摘要 ════════`);
    console.log(`chunks: ${chunks.length} | 失败: ${failed.length} | 应用级错误: ${realErrors.length}`);
    const out = path.resolve(__dirname, 'report-chunks.json');
    fs.writeFileSync(out, JSON.stringify({ extId, total: chunks.length, failed: failed.length, realErrorCount: realErrors.length, results, events }, null, 2));
    console.log('report →', out);

    await context.close();
    cleanup();
    process.exit(realErrors.length || failed.length ? 1 : 0);
  } catch (e) {
    await context.close().catch(() => {});
    cleanup();
    console.error('harness crash:', e);
    process.exit(3);
  }
})();
