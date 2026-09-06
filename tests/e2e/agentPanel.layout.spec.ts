import { test, expect } from '@playwright/test';
import { MESSAGE_FIXTURES, openAgentPanel, renderAndMeasure } from './utils/agentPanelHelpers';

// L4：AI 助手面板 —— 消息渲染的横向宽度约束（布局回归，非 Markdown 解析内容断言）
//
// 【背景】2026-09-07 实测 bug：AI 回复含代码块时整条回复冲出面板、溢出到屏幕右侧。
//   根因不在 ChatMarkdown 解析，而在 flex 收缩链：代码块 <pre white-space:pre> 的
//   min-content = 整行代码宽度，沿 .agent-body > .flex-1 → .agent-messages →
//   .agent-msg-wrap → .agent-ai-row → .agent-ai-text 一路向上撑开容器，
//   容器变宽后横向 overflow 失效（没有滚动条），内容直接溢出屏幕。
//   修复 = 这条链上每层都必须能收缩（min-w-0 / min-width:0）。
//
// 【本套件的作用】锁死这条链：任何一类消息内容（含不可断长单词、超长 URL、代码块、
//   宽表格、图片、思考过程、工具结果…）都不得把面板撑宽。以后谁动了消息区的 DOM 结构
//   或样式，这里会立刻报出「哪个 fixture 撑开了多少 px」。
//
// 【宽度分档】320 = AgentPanel 的 MIN_WIDTH（最窄，最容易被撑破）；640 = 常规使用宽度。
test.describe('AI 助手面板 · 消息渲染不横向溢出', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.react-flow', { timeout: 10000 });
    await openAgentPanel(page);
  });

  test('窄面板 320px：所有消息元素都不撑破面板', async ({ page }) => {
    for (const [name, html] of Object.entries(MESSAGE_FIXTURES)) {
      const r = await renderAndMeasure(page, html, 320);
      expect(
        r.msgsOver,
        `【${name}】消息区被撑宽：${r.msgsW}px > 面板 ${r.panelW}px`,
      ).toBeLessThanOrEqual(1);
      expect(r.bad, `【${name}】元素越出面板右缘：${r.bad.join('；')}`).toEqual([]);
      expect(
        r.docOver,
        `【${name}】内容冲出屏幕（文档横向溢出 ${r.docOver}px）`,
      ).toBeLessThanOrEqual(0);
    }
  });

  test('常规面板 640px：所有消息元素都不撑破面板', async ({ page }) => {
    for (const [name, html] of Object.entries(MESSAGE_FIXTURES)) {
      const r = await renderAndMeasure(page, html, 640);
      expect(
        r.msgsOver,
        `【${name}】消息区被撑宽：${r.msgsW}px > 面板 ${r.panelW}px`,
      ).toBeLessThanOrEqual(1);
      expect(r.bad, `【${name}】元素越出面板右缘：${r.bad.join('；')}`).toEqual([]);
      expect(
        r.docOver,
        `【${name}】内容冲出屏幕（文档横向溢出 ${r.docOver}px）`,
      ).toBeLessThanOrEqual(0);
    }
  });

  // 反向保护：不许为了「不溢出」把代码块压成不可读——它应当保持自身横向滚动
  test('代码块保持自身横向滚动，不被压扁也不撑破面板', async ({ page }) => {
    const r = await renderAndMeasure(page, MESSAGE_FIXTURES['代码块·超长单行'], 640);
    expect(
      r.msgsOver,
      `代码块撑破了消息区（${r.msgsW}px > 面板 ${r.panelW}px）`,
    ).toBeLessThanOrEqual(1);
    expect(r.preScrollable, '代码块应保留自身横向滚动，否则长行无法查看').toBe(true);
  });
});
