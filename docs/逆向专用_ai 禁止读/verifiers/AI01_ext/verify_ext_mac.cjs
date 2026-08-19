/**
 * macOS 真机验收脚本（系统 Google Chrome + --headless=old 加载扩展，纯 Playwright CDP）
 *
 * 前置：系统 Chrome 以 --headless=old --load-extension=<dist> --remote-debugging-port=<PORT> 启动。
 * 本脚本通过 Playwright connectOverCDP：
 *   1) 浏览器级 CDP Target.getTargets 拿到 service_worker target（connectOverCDP 的 context.serviceWorkers 不暴露 SW）
 *   2) Target.attachToTarget 附加到 SW，Runtime.enable 监听异常
 *   3) 用 context 打开 popup(index.html) / share(share/index.html) 捕获 console/pageerror
 * 判分同 SOP：仅真机 ReferenceError/TypeError/removeChild 级联为应用错误；
 *   404 / localhost / sw.createCDPSession 兼容问题不计入。
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PORT = process.env.CDP_PORT || '9223';
const DIST = process.env.EXT_PATH ? path.resolve(process.env.EXT_PATH) : null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const events = [];
function rec(scope, kind, text, loc) {
  events.push({ scope, kind, text: String(text).slice(0, 800), loc: loc || null });
  const bad = kind === 'error' || kind === 'exception' || kind === 'pageerror';
  console.log(`${bad ? '❌' : '·'} [${scope}] ${kind}: ${String(text).slice(0, 300)}`);
}
const watchdog = setTimeout(() => { console.error('WATCHDOG: forced exit'); process.exit(9); }, 120000);
watchdog.unref();

(async () => {
  const browser = await chromium.connectOverCDP(`http://localhost:${PORT}`);
  const context = browser.contexts()[0];
  const bcdp = await browser.newBrowserCDPSession();

  // 1) targets
  const { targetInfos } = await bcdp.send('Target.getTargets');
  let extId = null, swTargetId = null;
  for (const t of targetInfos) {
    const m = (t.url || '').match(/chrome-extension:\/\/([a-z]+)\//);
    if (m) {
      extId = m[1];
      if (t.type === 'service_worker') swTargetId = t.targetId;
    }
  }
  console.log('extension id:', extId || '(unknown)', ' swTargetId:', swTargetId || 'none');

  // 2) attach SW + Runtime.enable
  if (swTargetId) {
    const { sessionId } = await bcdp.send('Target.attachToTarget', { targetId: swTargetId, flatten: true });
    const swcdp = await browser.newBrowserCDPSession(); // 复用 bcdp 通道
    // flatten 模式下用同一 browser session 发消息，指定 sessionId
    await bcdp.send('Runtime.enable', {}, sessionId);
    bcdp.on('Runtime.exceptionThrown', (params, session) => {
      if (session !== sessionId) return;
      const d = params.exceptionDetails;
      rec('sw', 'exception', (d.exception && d.exception.description) || d.text || 'sw exception', d.url);
    });
    bcdp.on('Runtime.consoleAPICalled', (params, session) => {
      if (session !== sessionId) return;
      const txt = (params.args || []).map((a) => a.value !== undefined ? a.value : (a.description || '')).join(' ');
      rec('sw', params.type, txt);
    });
  }

  // 3) 开页面
  async function openPage(rel) {
    if (!extId) { rec('page', 'error', 'no extId, skip ' + rel); return; }
    const page = await context.newPage();
    page.on('console', (msg) => { if (msg.type() === 'error') rec('page', 'error', msg.text()); else rec('page', msg.type(), msg.text()); });
    page.on('pageerror', (err) => rec('page', 'pageerror', err.message + '\n' + (err.stack || '').split('\n').slice(0, 4).join('\n')));
    page.on('requestfailed', (req) => rec('page', 'error', 'reqfail ' + req.url() + ' ' + (req.failure() && req.failure().errorText)));
    const url = `chrome-extension://${extId}/${rel}`;
    try { await page.goto(url, { waitUntil: 'load', timeout: 20000 }); }
    catch (e) { rec('page', 'error', 'goto ' + rel + ': ' + e.message); }
    await sleep(5000);
    await page.close();
  }
  if (extId) {
    await openPage('index.html');
    await openPage('share/index.html');
  }
  await sleep(2000);

  const errors = events.filter((e) => e.kind === 'error' || e.kind === 'exception' || e.kind === 'pageerror');
  console.log('\n════════ 验收摘要 ════════');
  console.log('total events:', events.length, 'errors:', errors.length);
  fs.writeFileSync(path.resolve(__dirname, 'report.json'), JSON.stringify({ extId, dist: DIST, events, errorCount: errors.length }, null, 2));

  try { await browser.close(); } catch (e) {}
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error('harness crash:', e); process.exit(3); });
