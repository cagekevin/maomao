import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// L4 共用 helper：AI 助手面板（消息区宽度约束）回归
//
// 【为什么要这个 helper · 2026-09-07 修复记录】
//   AI 回复里的代码块用 <pre white-space:pre> 渲染，整行不可断行 → 它的 min-content 宽度
//   等于整行代码宽度（实测 2000px+）。这个宽度会沿 flex 链向上把容器撑开：
//     .agent-body > .flex-1 → .agent-messages → .agent-msg-wrap → .agent-ai-row → .agent-ai-text
//   只要链上任一环不能收缩（缺 min-w-0），.agent-messages 会连自身一起变宽，
//   「横向 overflow 滚动」随之失效（容器都变宽了就没有滚动条），AI 回复直接冲出面板溢出屏幕。
//
// 【测什么】不测 Markdown 解析结果，测**布局收缩链**：把与 ChatMarkdown 输出同构的 DOM
//   注入消息容器，断言任何内容都不把面板撑宽。走注入而非真实 LLM 调用——e2e 不该依赖网络与
//   模型输出，且真实回复内容不可控（今天刚好多一段代码块才复现）。
//   DOM 结构与 src/components/panels/ChatMarkdown.tsx、AgentMessage.tsx 保持一致，
//   改这两个组件的渲染结构时，fixture 需同步更新。

export const AGENT_PANEL = '.agent-panel';
export const AGENT_MESSAGES = '.agent-messages';

/** 打开 AI 助手面板（面板常驻 DOM，open 只切 CSS hidden，故点顶栏按钮即可） */
export async function openAgentPanel(page: Page): Promise<void> {
  const toggle = page.getByTitle('打开 AI 助手').first();
  if ((await toggle.count()) > 0) await toggle.click();
  await page.waitForSelector(`${AGENT_PANEL}:not(.hidden)`, { timeout: 10000 });
  await expect(page.locator(AGENT_MESSAGES)).toBeVisible({ timeout: 5000 });
}

// ── 各类消息的 DOM fixture（对齐真实组件输出的类名/结构）────────────────────
const LONG = 'A'.repeat(400);
const LONG_URL = 'https://example.com/' + 'segment/'.repeat(40) + '?token=' + 'b'.repeat(200);
const CODE_LINE =
  '{"rows":[{"id":"r1","values":{"c1":"这是一个非常非常长的中文内容用来测试代码块是否会撑破面板宽度导致溢出到屏幕右边","c2":"another very long english value without any break opportunity at all"}}],"globalStyle":"cinematic lighting, ultra detailed"}';

/** 包一层 AI 消息外壳（AgentPanel 的 .agent-msg-wrap → AgentMessage 的 .agent-ai-row） */
function ai(inner: string): string {
  return `<div class="agent-msg-wrap"><div class="agent-ai-row"><div class="agent-ai-text">${inner}</div></div></div>`;
}

/** ChatMarkdown 根节点（组件返回的就是这个 div） */
function md(inner: string): string {
  return `<div class="min-w-0 [overflow-wrap:anywhere]">${inner}</div>`;
}

export const MESSAGE_FIXTURES: Record<string, string> = {
  '代码块·超长单行': ai(
    md(
      `<div class="group/code relative my-2 overflow-hidden rounded-lg border border-edge bg-code-bg"><div class="flex h-8 items-center justify-between border-b border-edge px-2.5 text-caption text-muted"><span class="font-medium uppercase">json</span></div><pre class="max-h-80 overflow-auto p-3 text-body-xs leading-5 text-secondary"><code class="font-mono">${CODE_LINE}</code></pre></div>`,
    ),
  ),
  '宽表格·6列': ai(
    md(
      `<div class="my-2 overflow-x-auto rounded-lg border border-edge"><table class="w-full min-w-[280px] border-collapse text-left text-body-xs"><thead class="bg-surface-hover text-secondary"><tr>${['镜头', '景别', '画面内容', '运镜', '台词', '时长'].map((t) => `<th class="border-b border-edge px-2.5 py-2 font-medium">${t}</th>`).join('')}</tr></thead><tbody><tr class="border-b border-edge/60">${['SH-01', '大远景', '雨夜霓虹街头主角撑伞走过积水倒影', '缓慢推轨', '无', '4s'].map((t) => `<td class="px-2.5 py-2 align-top text-body/90">${t}</td>`).join('')}</tr></tbody></table></div>`,
    ),
  ),
  图片: ai(
    md(
      `<button type="button" class="my-1 block w-full max-w-[280px] overflow-hidden rounded-md border border-white/15 p-0 text-left cursor-zoom-in"><div class="w-full bg-black/30"><img src="https://picsum.photos/seed/maomao/1600/900" alt="" class="w-full h-auto max-h-[240px] object-contain"></div></button>`,
    ),
  ),
  '段落·超长URL': ai(
    md(`<p class="my-1.5 text-body/90 first:mt-0 last:mb-0">参考 ${LONG_URL}</p>`),
  ),
  '段落·不可断长单词': ai(md(`<p class="my-1.5 text-body/90 first:mt-0 last:mb-0">${LONG}</p>`)),
  '列表·不可断长项': ai(
    md(
      `<ul class="my-1.5 list-disc space-y-1 pl-5 text-body/90"><li class="pl-0.5 marker:text-muted">${LONG}</li></ul>`,
    ),
  ),
  '标题+引用': ai(
    md(
      `<h2 class="mt-3 mb-1 text-[14px] font-semibold">分镜方案</h2><blockquote class="my-2 border-l-2 border-edge pl-3 text-muted"><span class="block">整体基调：冷色调、低饱和、电影感${LONG_URL}</span></blockquote>`,
    ),
  ),
  '思考过程·展开': `<div class="agent-msg-wrap"><div class="agent-ai-row"><button type="button" class="agent-trace is-open"><span class="agent-dot"></span><span class="agent-trace-label">思考过程</span></button><div class="agent-trace-detail">需要先分析 ${LONG_URL} 再执行 ${LONG}</div></div></div>`,
  '工具chips·超长名': `<div class="agent-msg-wrap"><div class="agent-ai-row"><div class="agent-toolchips"><span class="agent-toolchip"><span class="font-mono truncate max-w-[150px]">generate_image_with_super_long_name_${LONG}</span></span></div></div></div>`,
  生成步骤卡: `<div class="agent-msg-wrap"><div class="agent-ai-row"><button type="button" class="agent-trace is-open"><span class="agent-dot"></span><span class="agent-trace-label">生成步骤方案</span><span class="agent-step-meta">2 条</span></button><div class="agent-trace-detail"><div class="agent-steps"><div><div class="agent-step-head"><span class="agent-step-index">1</span><span class="agent-step-title">雨夜街头</span></div><div class="agent-step-prompt">${LONG_URL}</div></div><div><div class="agent-step-head"><span class="agent-step-index">2</span><span class="agent-step-title">${LONG}</span></div></div></div></div></div></div>`,
  确认卡: `<div class="agent-msg-wrap"><div class="agent-ai-row"><div class="mt-2 border border-edge-faint rounded-md bg-surface-sunken"><div class="flex items-center gap-1.5 px-2.5 py-1.5 text-caption-sm text-body"><span class="text-emerald-400 shrink-0 flex">✓</span><span class="font-medium truncate">确认生成 3 张图/视频</span></div><div class="px-2.5 pb-2 border-t border-edge-subtle"><div class="pt-1.5 text-caption text-muted whitespace-pre-wrap break-words leading-snug">节点已建好，确认后开始生成（预计消耗积分）。</div><div class="flex items-center gap-1.5 mt-2"><button class="inline-flex items-center gap-1 px-3 py-1 text-caption-sm bg-emerald-600 text-white rounded-md">确认生成</button></div></div></div></div></div>`,
  '工具结果·失败重试': `<div class="agent-msg-wrap"><div class="agent-toolmsg-wrap"><div class="agent-toolmsg"><div class="agent-toolmsg-line"><span>计划执行：2 步失败</span></div><div class="agent-failed-steps"><div class="agent-failed-row"><span class="agent-failed-msg">${LONG}</span><button class="agent-retry"><span>重试此步</span></button></div></div></div></div></div>`,
  '混合·代码块+表格+列表': ai(
    md(
      `<h2 class="mt-3 mb-1 text-[14px] font-semibold">分镜方案</h2><ul class="my-1.5 list-disc space-y-1 pl-5 text-body/90"><li class="pl-0.5 marker:text-muted">${LONG}</li></ul><div class="group/code relative my-2 overflow-hidden rounded-lg border border-edge bg-code-bg"><pre class="max-h-80 overflow-auto p-3 text-body-xs leading-5 text-secondary"><code class="font-mono">${CODE_LINE}</code></pre></div><div class="my-2 overflow-x-auto rounded-lg border border-edge"><table class="w-full min-w-[280px] border-collapse text-left text-body-xs"><thead class="bg-surface-hover text-secondary"><tr><th class="border-b border-edge px-2.5 py-2 font-medium">镜头</th><th class="border-b border-edge px-2.5 py-2 font-medium">画面</th></tr></thead><tbody><tr class="border-b border-edge/60"><td class="px-2.5 py-2 align-top text-body/90">SH-01</td><td class="px-2.5 py-2 align-top text-body/90">${LONG_URL}</td></tr></tbody></table></div>`,
    ),
  ),
  '用户气泡·不可断长单词': `<div class="agent-msg-wrap"><div class="agent-user-row"><div class="agent-user-col"><div class="agent-user-bubble">${LONG}</div></div></div></div>`,
  '用户气泡·长URL+附件': `<div class="agent-msg-wrap"><div class="agent-user-row"><div class="agent-user-col"><div class="agent-user-att"><button><img src="https://picsum.photos/seed/att/200/200" alt="" class="w-full h-full"></button></div><div class="agent-user-bubble">按 ${LONG_URL} 生成</div></div></div></div>`,
  错误提示: `<div class="agent-msg-wrap"><div class="agent-error">请求失败：${LONG_URL}</div></div>`,
  表格模式条: `<div class="agent-mode-bar"><span>表格协作中 · ${LONG}</span><button class="agent-mode-clear">取消选中</button></div>`,
};

export interface OverflowReport {
  /** 面板宽度 */
  panelW: number;
  /** .agent-messages 实际宽度 */
  msgsW: number;
  /** .agent-messages 右缘超出面板右缘的 px（>1 即已被内容撑开） */
  msgsOver: number;
  /** 文档横向溢出 px（>0 即内容冲出屏幕） */
  docOver: number;
  /** 未被 overflow 祖先裁剪、却仍越出面板右缘的元素（描述串） */
  bad: string[];
  /** 代码块 <pre> 是否自身可横向滚动（null = 该 fixture 无代码块） */
  preScrollable: boolean | null;
}

/**
 * 在指定面板宽度下渲染一条消息并测量横向溢出。
 * 「设宽度 + 注入 DOM + 测量」必须在同一次 evaluate 内完成：面板宽度是 React 受控 style，
 * 一旦中间发生重渲染（滚动 effect / ResizeObserver 都会 setState）就会被写回 state 值。
 */
export async function renderAndMeasure(
  page: Page,
  html: string,
  panelWidth: number,
): Promise<OverflowReport> {
  return page.evaluate(
    ({ html, panelWidth }) => {
      const panel = document.querySelector('.agent-panel') as HTMLElement;
      panel.style.width = panelWidth + 'px';
      const wrap = document.querySelector('.agent-messages') as HTMLElement;
      wrap.innerHTML = html;

      const pr = panel.getBoundingClientRect();
      const wr = wrap.getBoundingClientRect();

      // 被 scroll container 裁剪的元素不算越界（它在自己容器内滚动，视觉上看不见）
      const clipped = (el: Element): boolean => {
        let p = el.parentElement;
        while (p && p !== document.body) {
          if (getComputedStyle(p).overflowX !== 'visible') return true;
          p = p.parentElement;
        }
        return false;
      };
      const bad: string[] = [];
      wrap.querySelectorAll('*').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width && !r.height) return;
        if (clipped(el)) return;
        const over = r.right - pr.right;
        if (over > 1) {
          bad.push(
            `${el.tagName}.${String(el.className || '').slice(0, 30)} 越界${Math.round(over)}px`,
          );
        }
      });

      const pre = wrap.querySelector('pre');
      return {
        panelW: Math.round(pr.width),
        msgsW: Math.round(wr.width),
        msgsOver: Math.round(wr.right - pr.right),
        docOver: document.documentElement.scrollWidth - window.innerWidth,
        bad: bad.slice(0, 5),
        preScrollable: pre ? pre.scrollWidth > pre.clientWidth + 1 : null,
      };
    },
    { html, panelWidth },
  );
}
