#!/usr/bin/env node
/**
 * AI 助手面板几何测量器 —— 真实浏览器量「横向越界 / 高度压缩 / 嵌套滚动」等布局问题。
 *
 * 【背景】本工具从排查「AI 助手表格预览内容超出屏幕」的临时脚本固化而来。那个问题卡了很久，
 *   因为它不是"用户气泡溢出"，而是**左侧表格(.sbt)因 width:max-content 把左栏撑破、压进右侧
 *   对话区/面板外**——光靠看截图/改气泡 CSS 都复现不了，必须起真实浏览器量 .sb/.sb-body/.sbt
 *   的几何链才能定位（缺 .sb-body{min-width:0} 所致）。后续同类"某内容看起来超出去"的问题，
 *   直接用本工具在真实浏览器里量各容器边界，别猜。
 *
 * 【能测什么】
 *  - 指定选择器列表的几何（left/right/top/bottom/width/height + scrollWidth/clientWidth）。
 *  - 「面板右缘之外的任何可见元素」越界扫描（含越界 px / 元素标签+类名+文本前缀）。
 *  - 场景预设：可注入消息流 + 表格 + AI 表格预览（预览贴底操作区），复刻真实工作状态。
 *
 * 【用法】
 *   node scripts/ui-geometry/measure-panel.mjs            # 默认：表格模式 + 用户长消息 + 表格数据
 *   node scripts/ui-geometry/measure-panel.mjs --width 1280 --height 720
 *   node scripts/ui-geometry/measure-panel.mjs --sels '.agent-panel,.sb,.sb-body,.sbt,.pv'
 *
 * 【输出】控制台打 JSON：viewport/面板链/越界元素；并落一张截图到 --shot <path>。
 * 【自包含】内置 dev server 拉起（复用已在跑的端口则直接连）；连不上会自起 vite。
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const PORT = 5199;
const URL = `http://localhost:${PORT}/`; // vite 监听 [::1]，须用 localhost 而非 127.0.0.1

/* ── CLI 参数 ── */
const argv = process.argv.slice(2);
const flag = (k, d) => {
  const i = argv.indexOf('--' + k);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d;
};
const has = (k) => argv.includes('--' + k);
const VW = parseInt(flag('width', '1440'), 10);
const VH = parseInt(flag('height', '900'), 10);
const SHOT = flag('shot', '/tmp/measure-panel.png');
// 默认关注 AI 助手面板相关容器；可 --sels 覆盖（逗号分隔）
const DEFAULT_SELS =
  '.agent-panel,.agent-body,.agent-body > div.flex-1,.agent-messages,' +
  '.agent-user-bubble,.agent-user-col,.agent-body .sb,.agent-body .sb-body,table.sbt,' +
  '.agent-panel .pv,.agent-body .sb-preview,.agent-composer';
const SELS = (flag('sels', '') || DEFAULT_SELS).split(',').map((s) => s.trim()).filter(Boolean);

/* ── 场景数据：贴近真实的表格 + 长文本 + 长 JSON ── */
function makeRows(n) {
  const rows = [];
  for (let i = 1; i <= n; i++) {
    rows.push({
      场景: `第${i}场景 · 河岸草地`,
      镜头: '全景',
      角色: '小马、老牛、小松鼠、白鹭、蝴蝶、蜻蜓',
      动作: '小马低头喝水，小松鼠在树枝上焦急地挥舞爪子跳上跳下示意危险，老牛缓缓转头看向水面',
      对白: '小松鼠：「别下水！水很深，会淹死你的！我的同伴就是在这儿被冲走的！快上来！」',
      氛围: '紧张急促',
      角色设定: '小马：棕红色小马驹，大眼睛灵动，鬃毛蓬松柔软',
    });
  }
  return rows;
}
const TABLE_COLUMNS = ['场景', '镜头', '角色', '动作', '对白', '氛围', '角色设定'].map((l, i) => ({
  id: 'c' + (i + 1),
  label: l,
}));
const USER_LONG =
  '帮我按这张参考分镜，逐格补充对白与动作细节，注意人物关系和情绪变化，最终按表格 JSON 返回完整的分镜表。';

/* ── dev server 拉起（已有在跑端口则直接复用） ── */
async function alive() {
  try {
    return (await fetch(URL)).ok;
  } catch {
    return false;
  }
}
let srv = null;
async function ensureServer() {
  if (await alive()) return;
  srv = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
    cwd: process.cwd(),
    stdio: 'ignore',
  });
  for (let i = 0; i < 240 && !(await alive()); i++) await new Promise((r) => setTimeout(r, 500));
  if (!(await alive())) throw new Error('dev server 启动超时');
}

/* ── 注入状态：user + assistant(表格) + memory.assistantTable + AI 表格预览 ── */
async function injectState(page, { withPreview }) {
  const rows = makeRows(6);
  const tableRows = rows.map((r, i) => ({
    id: 'r' + (i + 1),
    values: Object.fromEntries(TABLE_COLUMNS.map((c) => [c.id, r[c.label]])),
  }));
  const aiText =
    '```json\n' +
    JSON.stringify({ globalStyle: '暖色调，柔和自然光', rows }) +
    '\n```';
  await page.evaluate(
    async (payload) => {
      const s = await import('/src/components/agent/conversation/conversationStore.ts');
      s.ensureActiveConversation();
      const msgs = [
        { id: 'q1', role: 'user', content: '帮我补全这个分镜表', createdAt: Date.now() },
        { id: 'a1', role: 'assistant', content: payload.ai, createdAt: Date.now() + 1 },
        { id: 'u2', role: 'user', content: payload.userLong, createdAt: Date.now() + 2 },
      ];
      s.setCurrentSnapshot({
        messages: msgs,
        skills: [],
        draft: '',
        memory: {
          assistantTable: { columns: payload.columns, rows: payload.rows },
        },
      });
    },
    { ai: aiText, userLong: USER_LONG, columns: TABLE_COLUMNS, rows: tableRows },
  );
  await page.waitForTimeout(800);
  // AI 表格回复若命中预览，会在左栏正式表格下方挂 .sb-preview（2026-09-06 起收进左栏，原为输入区上方 .agent-pv-dock）
  await page.evaluate(() => {
    const m = document.querySelector('.agent-messages');
    if (m) m.scrollTop = m.scrollHeight;
  });
  await page.waitForTimeout(400);
}

/* ── 采集：几何 + 面板右缘越界扫描 ── */
async function collect(page) {
  return page.evaluate(
    ({ sels }) => {
      const rect = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const b = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          left: Math.round(b.left), right: Math.round(b.right), top: Math.round(b.top),
          bottom: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height),
          scrollW: el.scrollWidth, clientW: el.clientWidth,
          scrollH: el.scrollHeight, clientH: el.clientHeight,
          overflowX: cs.overflowX, overflowWrap: cs.overflowWrap,
          cls: (typeof el.className === 'string' ? el.className : '').slice(0, 40),
        };
      };
      const bySel = {};
      for (const s of sels) bySel[s] = rect(s);
      const panel = document.querySelector('.agent-panel');
      const pr = panel ? panel.getBoundingClientRect() : null;
      // 真正「撑破面板外溢」的元素：它越出面板右缘，且不在任何一个 overflow:auto 滚动容器内。
      // 否则只是「被某滚动容器正常收纳的横向滚动内容」（如 .sb-body 里的超宽表格），不算溢出。
      const realOverflow = [];
      if (panel) {
        const inScrollable = (el) => {
          let n = el.parentElement;
          while (n && n !== panel) {
            const cs = getComputedStyle(n);
            if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && n.clientWidth < n.scrollWidth)
              return true;
            n = n.parentElement;
          }
          return false;
        };
        panel.querySelectorAll('*').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return;
          if (r.right > pr.right + 1 && !inScrollable(el)) {
            const tag = el.tagName.toLowerCase();
            const cls = typeof el.className === 'string' ? el.className.slice(0, 40) : '';
            realOverflow.push({
              el: tag + (cls ? '.' + cls : ''),
              text: (el.textContent || '').replace(/\s+/g, ' ').slice(0, 30),
              over: Math.round(r.right - pr.right),
              right: Math.round(r.right),
            });
          }
        });
      }
      return {
        viewport: { w: innerWidth, h: innerHeight },
        // body 是否出现横向滚动（= 有内容真正把页面撑宽，最硬的溢出信号）
        bodyOverflowX: document.body.scrollWidth > document.body.clientWidth,
        docScrollW: document.documentElement.scrollWidth,
        docScrollH: document.documentElement.scrollHeight,
        panelRight: pr ? Math.round(pr.right) : null,
        // 真正撑破面板（不在滚动容器内）的越界
        overflowCount: realOverflow.length,
        overflow: realOverflow.slice(0, 30),
        sels: bySel,
      };
    },
    { sels: SELS },
  );
}

/* ── 主流程 ── */
try {
  await ensureServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: VW, height: VH } });
  page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 160)));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.react-flow', { timeout: 60_000 }).catch(() => {});
  await page.evaluate(async () => {
    const m = await import('/src/components/base/store/appSettings.ts');
    m.setSetting('agentOpen', true);
  });
  await page.waitForSelector('.agent-panel', { timeout: 20_000 });
  await page.click('button[title*="分镜表格"]'); // 表格模式
  await page.waitForTimeout(500);

  await injectState(page, { withPreview: true });
  const result = await collect(page);
  console.log(JSON.stringify(result, null, 2));

  await page.screenshot({ path: SHOT, fullPage: false });
  console.log(`\n[截图] ${SHOT}`);
  await browser.close();
} catch (e) {
  console.error('FAILED:', e);
  process.exitCode = 1;
} finally {
  if (srv) srv.kill('SIGKILL');
}
