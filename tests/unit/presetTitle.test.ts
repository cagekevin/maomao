/**
 * 预设卡片悬停标题的契约（TD-05-19 · 2026-11-07 从 TSX 渲染测试迁来）。
 *
 * 原锁法：`renderToString` 后断言 HTML 里同时出现名字与 prompt —— 锁的是「字符串拼接」这一件事，
 * 却要拉起整个组件树。现改锁唯一构造点 `presetCardTitle`（AGENTS.md §2.3：判据下沉成纯函数再测）。
 */
import { describe, it, expect } from 'vitest';
import { presetCardTitle } from '@/components/creative/presetTitle.ts';

describe('presetCardTitle —— 悬停必须看得到提示词正文（TD-05-19）', () => {
  it('名字与提示词正文都在，按换行分隔', () => {
    const title = presetCardTitle('暖阳', '视觉风格：暖阳，柔和暖色调');
    expect(title).toContain('暖阳');
    expect(title).toContain('视觉风格：暖阳，柔和暖色调');
    expect(title).toBe('暖阳\n视觉风格：暖阳，柔和暖色调');
  });

  it('prompt 缺失/空白 → 只显示名字，不留尾随空行', () => {
    expect(presetCardTitle('冷静')).toBe('冷静');
    expect(presetCardTitle('冷静', '   ')).toBe('冷静');
  });

  it('prompt 前后空白被裁掉（数据层偶发带缩进）', () => {
    expect(presetCardTitle('冷调', '  正文：冷色调  ')).toBe('冷调\n正文：冷色调');
  });
});
