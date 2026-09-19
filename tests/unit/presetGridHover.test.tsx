/**
 * PresetGridView 悬停标题契约（TD-05-19 · 2026-09-19）。
 *
 * 【锁什么】卡片 `<article title=…>` 必须**同时含名字与提示词正文** —— 此前只给名字
 * （`title={p.name}`），而 `p.prompt` 数据早已齐备（`creativeCatalog.ts:92/106` 归一化，
 * 实测 285/285 全有值）。用户需求：风格/滤镜/运镜三类悬停要能看到提示词正文。
 *
 * 【为什么不锁"MJ 不显示"】MJ 与 prompt 类**根本不走本组件**（各有专属视图，
 * 见 `CreativeLibrary.tsx:34`）⇒ 该行为由结构保证，不属本组件契约。
 * 若将来有人把 MJ 接进本组件，应在此补一条"MJ 不显示 prompt"的锁（本文件注释即提醒）。
 *
 * 【为什么用 renderToString 而非 @testing-library】本组件是纯展示（受 props 驱动、
 * 无 effect 依赖），服务端渲染字符串即可断言 title 属性 —— 更轻且不引入 jsdom 交互面。
 */
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createElement } from 'react';

const { default: PresetGridView } =
  await import('../../src/components/base/creative/views/PresetGridView.tsx');

const noop = () => {};

describe('PresetGridView —— 悬停显示提示词（TD-05-19）', () => {
  it('title 含名字 + 提示词正文（不只名字）', () => {
    const presets = [
      {
        id: 'cp_style-1',
        kind: 'style' as const,
        category: '视觉风格',
        name: '暖阳',
        prompt: '视觉风格：暖阳，柔和暖色调',
      },
    ];
    const html = renderToString(
      createElement(PresetGridView, { presets: presets as never, onApply: noop }),
    );
    // 名字在（行为不变）
    expect(html).toContain('暖阳');
    // prompt 正文也在（本债要治的点）——这条是"先红"的断言
    expect(html).toContain('视觉风格：暖阳，柔和暖色调');
  });

  it('卡片名条（.cl-name）仍只显示名字 —— prompt 不进名条', () => {
    const presets = [
      {
        id: 'cp_style-2',
        kind: 'style' as const,
        category: '视觉风格',
        name: '冷静',
        prompt: '正文：冷色调',
      },
    ];
    const html = renderToString(
      createElement(PresetGridView, { presets: presets as never, onApply: noop }),
    );
    // 名条内只有名字
    const nameBlock = html.match(/<div class="cl-name">(.*?)<\/div>/s)?.[1] ?? '';
    expect(nameBlock).toContain('冷静');
    expect(nameBlock).not.toContain('正文：冷色调');
  });
});
