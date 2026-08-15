#!/usr/bin/env node
/**
 * verify-common.cjs — gougou 真机验收公共模块（适配自第二步 verifiers/AI01_ext/verify_ext.cjs）
 *
 * 提供的工具：
 *   - resolveExtPath()   解析要加载的 dist 路径；含中文时自动建 ASCII junction（--load-extension 对中文路径静默失败）
 *   - isNoise(text)      噪声过滤（网络/资源 404 / sw.createCDPSession 兼容问题等非应用错误）
 *   - launchExtContext() 用 Playwright 把 dist 当 MV3 扩展加载（headless=new + 允许扩展）
 *   - findExtId()        轮询拿到扩展 id（辅以 CDP Target 发现兜底）
 *   - attachSW()         监听 service worker 的 Runtime 异常（playwright 1.62 下 createCDPSession 不可用则跳过）
 *
 * 仅被 verify-ext.cjs / verify-chunks.cjs require；playwright 在 launchExtContext 内惰性 require。
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..'); // gougou 工程根

/**
 * 解析扩展加载路径。
 * 支持 EXT_PATH 环境变量覆盖；默认指向工程根 dist/。
 * 含非 ASCII（如中文）时自动建 junction 到 C:\ 下的 ASCII 临时目录，
 * 因为 Chrome 的 --load-extension 对中文路径会静默拒绝加载。
 * @returns {{ extPath: string, cleanup: () => void }}
 */
function resolveExtPath() {
  const requested = process.env.EXT_PATH
    ? path.resolve(process.env.EXT_PATH)
    : path.resolve(ROOT, 'dist');
  if (!fs.existsSync(requested)) {
    console.error('❌ 找不到 dist（或 EXT_PATH 指向的路径）：', requested);
    process.exit(2);
  }
  const isAscii = /^[\x00-\x7F]*$/.test(requested);
  if (isAscii) {
    return { extPath: requested.replace(/\\/g, '/'), cleanup: () => {} };
  }
  // 中文路径：建 junction 到 ASCII 临时目录
  const junc = `C:\\gougou_ext_${Date.now()}`;
  try {
    try { execSync(`cmd /c rmdir "${junc}"`, { stdio: 'ignore' }); } catch (e) { /* ignore */ }
    execSync(`cmd /c mklink /J "${junc}" "${requested}"`, { stdio: 'ignore' });
    console.log('· 检测到中文路径 → 已建 ASCII junction 用于加载:', junc);
    return {
      extPath: junc.replace(/\\/g, '/'),
      cleanup: () => {
        try { execSync(`cmd /c rmdir "${junc}"`, { stdio: 'ignore' }); } catch (e) { /* ignore */ }
      },
    };
  } catch (e) {
    console.error('⚠️ 建 junction 失败，改为直接尝试原路径（可能加载失败）:', e.message);
    return { extPath: requested.replace(/\\/g, '/'), cleanup: () => {} };
  }
}

/**
 * 噪声判断：以下一律不计入「拆分 / 运行期」问题（来自第二步 HANDOFF 判分口径）。
 * 只有真机调用栈里的 ReferenceError / TypeError / removeChild 级联才是真错。
 */
const NOISE = [
  /sw\.createCDPSession is not a function/i,
  /attach failed: sw\.createCDPSession/i,
  /Failed to load resource/i,
  /net::ERR/i,
  /ERR_CONNECTION/i,
  /127\.0\.0\.1/i,
  /localhost/i,
  /favicon/i,
  /status of 4\d\d/i,
  /status of 5\d\d/i,
];
function isNoise(text) {
  if (!text) return false;
  return NOISE.some((re) => re.test(String(text)));
}

/**
 * 用 Playwright 把 dist 作为未打包 MV3 扩展加载。
 * @param {string} extPath 已处理好的 ASCII 扩展路径（chrome-extension:// 形式）
 * @param {string} profileDir 持久化上下文目录
 */
async function launchExtContext(extPath, profileDir) {
  const { chromium } = require('playwright');
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false, // 配合 --headless=new 才支持扩展加载
    args: [
      '--headless=new',
      `--load-extension=${extPath}`,
      `--disable-extensions-except=${extPath}`,
      '--allow-extensions-in-headless-mode',
      '--no-sandbox',
      '--disable-gpu',
    ],
  });
  return context;
}

/**
 * 轮询等待 service worker 注册，拿到扩展 id；辅以浏览器级 CDP Target 发现兜底。
 */
async function findExtId(context, timeoutMs = 15000) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const deadline = Date.now() + timeoutMs;
  let extId = null;
  while (Date.now() < deadline) {
    for (const sw of context.serviceWorkers()) {
      const m = String(sw.url || '').match(/chrome-extension:\/\/([a-z]+)\//);
      if (m) extId = m[1];
    }
    if (extId) break;
    try {
      const browser = context.browser();
      if (browser) {
        const cdp = await browser.newBrowserCDPSession();
        const { targetInfos } = await cdp.send('Target.getTargets');
        for (const t of targetInfos) {
          const m = (t.url || '').match(/chrome-extension:\/\/([a-z]+)\//);
          if (m) extId = m[1];
        }
      }
    } catch (e) { /* ignore */ }
    if (extId) break;
    await sleep(500);
  }
  return extId;
}

/**
 * 监听 service worker 的 Runtime 异常 / console。
 * playwright 1.62 下 sw.createCDPSession 不存在 → 跳过（属脚本兼容，非应用错误）。
 * @param {any} sw service worker 对象
 * @param {(scope:string, kind:string, text:string, loc?:string)=>void} rec 记录回调
 */
async function attachSW(sw, rec) {
  if (typeof sw.createCDPSession !== 'function') {
    rec('sw', 'warn', 'createCDPSession 不可用（playwright 版本差异），跳过 SW CDP 监听');
    return;
  }
  try {
    const cdp = await sw.createCDPSession();
    await cdp.send('Runtime.enable');
    cdp.on('Runtime.exceptionThrown', (e) => {
      const d = e.exceptionDetails;
      rec('sw', 'exception', (d && (d.exception && d.exception.description || d.text)) || 'sw exception', d && d.url);
    });
    cdp.on('Runtime.consoleAPICalled', (e) => {
      const txt = (e.args || []).map((a) => (a.value !== undefined ? a.value : (a.description || ''))).join(' ');
      rec('sw', e.type, txt);
    });
  } catch (e) {
    rec('sw', 'error', 'attach failed: ' + e.message);
  }
}

module.exports = { resolveExtPath, isNoise, launchExtContext, findExtId, attachSW, ROOT };
