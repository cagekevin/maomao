/**
 * 真实 Chromium 验收脚本（唯一真值裁判）
 * 用 Playwright 把 dist/ 作为未打包 MV3 扩展加载，捕获：
 *   - popup / options 页面 console + pageerror
 *   - service worker 的 Runtime.exceptionThrown / consoleAPICalled
 * 只要存在任何 error/exception 即非零退出。
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = process.env.EXT_PATH ? path.resolve(process.env.EXT_PATH) : path.resolve(ROOT, 'output', 'project', 'dist');
const PROFILE = path.resolve(__dirname, '.profile');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const events = [];
function rec(scope, kind, text, loc) {
  events.push({ scope, kind, text: String(text).slice(0, 800), loc: loc || null });
  const bad = kind === 'error' || kind === 'exception' || kind === 'pageerror';
  console.log(`${bad ? '❌' : '·'} [${scope}] ${kind}: ${String(text).slice(0, 300)}`);
}

const watchdog = setTimeout(() => { console.error('WATCHDOG: forced exit'); process.exit(9); }, 90000);
watchdog.unref();
const log = (...a) => console.log('[step]', ...a);

(async () => {
  if (!fs.existsSync(DIST)) { console.error('dist not found:', DIST); process.exit(2); }
  const extPath = DIST.replace(/\\/g, '/');
  log('launching', extPath);
  const context = await chromium.launchPersistentContext(PROFILE, {
    headless: false, // 配合 --headless=new 才支持扩展加载
    args: [
      `--headless=new`,
      `--load-extension=${extPath}`,
      `--disable-extensions-except=${extPath}`,
      '--allow-extensions-in-headless-mode',
      '--no-sandbox', '--disable-gpu',
    ],
  });
  log('launched');

  function attachSW(sw) {
    return (async () => {
      try {
        const cdp = await sw.createCDPSession();
        await cdp.send('Runtime.enable');
        cdp.on('Runtime.exceptionThrown', (e) => {
          const d = e.exceptionDetails;
          rec('sw', 'exception', (d && (d.exception && d.exception.description || d.text)) || 'sw exception', d && d.url);
        });
        cdp.on('Runtime.consoleAPICalled', (e) => {
          const txt = (e.args || []).map((a) => a.value !== undefined ? a.value : (a.description || '')).join(' ');
          rec('sw', e.type, txt);
        });
      } catch (e) { rec('sw', 'error', 'attach failed: ' + e.message); }
    })();
  }

  // 轮询等待 service worker 注册，拿到扩展 id（辅以浏览器级 CDP Target 发现）
  let extId = null, swCdpAttached = false;
  async function discoverViaCDP() {
    try {
      const browser = context.browser();
      const cdp = await browser.newBrowserCDPSession();
      const { targetInfos } = await cdp.send('Target.getTargets');
      for (const t of targetInfos) {
        const m = (t.url || '').match(/chrome-extension:\/\/([a-z]+)\//);
        if (m) { extId = m[1]; }
      }
    } catch (e) { /* ignore */ }
  }
  for (let i = 0; i < 20; i++) {
    for (const sw of context.serviceWorkers()) {
      const u = String(sw.url || '');
      const m = u.match(/chrome-extension:\/\/([a-z]+)\//);
      if (m) extId = m[1];
      if (!swCdpAttached) { await attachSW(sw); swCdpAttached = true; }
    }
    if (!extId) await discoverViaCDP();
    if (extId) break;
    await sleep(500);
  }
  console.log('extension id:', extId || '(unknown)');
  if (!extId) {
    try {
      const cdp = await context.browser().newBrowserCDPSession();
      const { targetInfos } = await cdp.send('Target.getTargets');
      console.log('TARGETS:', targetInfos.map((t) => t.type + ':' + t.url).join('\n  '));
    } catch (e) { console.log('target dump failed', e.message); }
  }
  context.on('serviceworker', (sw) => attachSW(sw));

  async function openPage(rel) {
    if (!extId) { rec('page', 'error', 'no extId, skip ' + rel); return; }
    const page = await context.newPage();
    page.on('console', (msg) => { if (msg.type() === 'error') rec('page', 'error', msg.text()); else rec('page', msg.type(), msg.text()); });
    page.on('pageerror', (err) => rec('page', 'pageerror', err.message + '\n' + (err.stack || '').split('\n').slice(0, 4).join('\n')));
    page.on('requestfailed', (req) => rec('page', 'error', 'reqfail ' + req.url() + ' ' + (req.failure() && req.failure().errorText)));
    const url = `chrome-extension://${extId}/${rel}`;
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 20000 });
    } catch (e) { rec('page', 'error', 'goto ' + rel + ': ' + e.message); }
    await sleep(5000); // 让 React 渲染 / 副作用执行
    await page.close();
  }

  await openPage('index.html');
  await openPage('share/index.html');
  await sleep(2000);

  const errors = events.filter((e) => e.kind === 'error' || e.kind === 'exception' || e.kind === 'pageerror');
  console.log('\n════════ 验收摘要 ════════');
  console.log('total events:', events.length, 'errors:', errors.length);
  fs.writeFileSync(path.resolve(__dirname, 'report.json'), JSON.stringify({ extId, events, errorCount: errors.length }, null, 2));

  await context.close();
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error('harness crash:', e); process.exit(3); });
