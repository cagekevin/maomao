const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 3 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto('http://localhost:8899/camera-params-mockup.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.locator('.cam-prev').first().screenshot({ path: '/tmp/ear.png' });
  console.log('errors:', errs.length ? errs : 'none');
  await browser.close();
})();
