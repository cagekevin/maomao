/**
 * AgentMessage 深度测试。
 *
 * AgentMessage 是 AI 助手面板的消息气泡（近 200 次提交改动 10 次，高频无测组件）。
 * 消息结构契约复杂：user / assistant / tool 三态渲染 + 思考折叠 + 工具调用标签 +
 * 生成步骤卡片 + 确认/重试回调，且内置「图片 URL 判定 / 文本切图」纯逻辑
 * （blob:/ipfs:/ipns: 排除、data:image 接受、图片后缀渲染、网页后缀保留为文本）。
 *
 * 此前无任何测试，任何「消息结构契约」或「图片判定」回归都测不出。
 * 本文件断言真实渲染行为与回调：
 *  - 纯逻辑：markdown/裸 URL/非图片 URL → 渲染成图 or 保留为文本
 *  - 三态渲染：user 气泡 / assistant 思考+工具+步骤卡片 / tool 成败+重试
 *  - 交互：思考折叠展开、确认按钮触发 onConfirmPlan、重试触发 onRetryStep
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
vi.mock('../../src/components/base/api/filesApi.ts', () => ({
  toAbsoluteFileUrl: (u) => `ABS:${u}`,
}));
vi.mock('../../src/components/base/ui/LazyImage.tsx', () => ({
  default: ({ src }) => React.createElement('img', { src }),
}));

import AgentMessage from '../../src/components/panels/AgentMessage.tsx';

const noop = () => {};

describe('AgentMessage — 图片 URL 判定与文本切图', () => {
  it('纯文本 content → 原样文本，不产生图片链接', () => {
    render(<AgentMessage message={{ role: 'assistant', content: '你好，这是纯文本' }} />);
    expect(screen.getByText('你好，这是纯文本')).toBeTruthy();
    expect(document.querySelector('a')).toBeNull();
    expect(document.querySelector('img')).toBeNull();
  });

  it('markdown 图片 ![](url) → 渲染成图（img src=ABS:url）', () => {
    render(
      <AgentMessage message={{ role: 'assistant', content: '看这张图：![alt](http://x/a.png)' }} />,
    );
    const img = document.querySelector('img');
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe('http://x/a.png');
    // 前后文本仍保留
    expect(screen.getByText('看这张图：')).toBeTruthy();
  });

  it('裸 http 图片 URL（带图片后缀）→ 渲染成图', () => {
    render(<AgentMessage message={{ role: 'assistant', content: 'http://cdn.x/pic.webp' }} />);
    expect(document.querySelector('img')).toBeTruthy();
  });

  it('无后缀且非网页后缀的 http URL → 按图片渲染（兼容无后缀图床）', () => {
    render(<AgentMessage message={{ role: 'assistant', content: 'https://img.x/a1b2c3' }} />);
    expect(document.querySelector('img')).toBeTruthy();
  });

  it('blob:/ipfs:/ipns: URL → 不当图片，保留为文本', () => {
    render(
      <AgentMessage
        message={{ role: 'assistant', content: 'blob:http://x/abc 和 ipfs://QmXyz' }}
      />,
    );
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByText(/blob:http:\/\/x\/abc/)).toBeTruthy();
  });

  it('网页类后缀 URL（.html/.json 等）→ 保留为文本，不渲染图', () => {
    render(
      <AgentMessage message={{ role: 'assistant', content: '参考 https://api.x/list.json' }} />,
    );
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByText(/list\.json/)).toBeTruthy();
  });

  it('data:image/ URL → 渲染成图', () => {
    render(<AgentMessage message={{ role: 'assistant', content: 'data:image/png;base64,AAAA' }} />);
    expect(document.querySelector('img')).toBeTruthy();
  });

  it('多图按出现顺序切分，文本段与图交错保留', () => {
    render(
      <AgentMessage
        message={{ role: 'assistant', content: '前段 http://x/1.png 中段 http://y/2.png 尾段' }}
      />,
    );
    expect(document.querySelectorAll('img')).toHaveLength(2);
    expect(screen.getByText('前段')).toBeTruthy();
    expect(screen.getByText('中段')).toBeTruthy();
    expect(screen.getByText('尾段')).toBeTruthy();
  });
});

describe('AgentMessage — user 消息', () => {
  it('渲染 content 与已使用 Skill 标签', () => {
    render(
      <AgentMessage
        message={{
          role: 'user',
          content: '帮我生成图',
          skills: [{ name: '生图' }, { name: '放大' }],
        }}
      />,
    );
    expect(screen.getByText('帮我生成图')).toBeTruthy();
    expect(screen.getByText('生图')).toBeTruthy();
    expect(screen.getByText('放大')).toBeTruthy();
  });

  it('渲染 attachments 缩略图', () => {
    render(
      <AgentMessage
        message={{ role: 'user', content: '参考这张', attachments: [{ url: 'http://x/ref.png' }] }}
      />,
    );
    expect(document.querySelector('img')).toBeTruthy();
  });
});

describe('AgentMessage — assistant 消息（思考/工具/步骤卡片）', () => {
  it('reasoning 默认折叠，点击展开显示内容', () => {
    render(<AgentMessage message={{ role: 'assistant', content: 'ok', reasoning: '先想后做' }} />);
    expect(screen.getByText('思考过程')).toBeTruthy();
    expect(screen.queryByText('先想后做')).toBeNull();
    fireEvent.click(screen.getByText('思考过程'));
    expect(screen.getByText('先想后做')).toBeTruthy();
    // 再点折叠
    fireEvent.click(screen.getByText('思考过程'));
    expect(screen.queryByText('先想后做')).toBeNull();
  });

  it('streaming=true 时 reasoning 显示「思考中...」且默认展开', () => {
    render(
      <AgentMessage
        message={{ role: 'assistant', content: '', reasoning: '过程', streaming: true }}
      />,
    );
    expect(screen.getByText('思考中...')).toBeTruthy();
    expect(screen.getByText('过程')).toBeTruthy();
  });

  // 【简洁化改造 2026-09-05】工具标签只显示工具名，参数收进 title（避免长参数串撑爆消息行、抢正文视觉）
  it('tool_calls → 渲染工具名，参数收进 title', () => {
    render(
      <AgentMessage
        message={{
          role: 'assistant',
          content: 'done',
          tool_calls: [
            {
              function: {
                name: 'generate_node',
                arguments: '{"nodeType":"imageNode","prompt":"猫"}',
              },
            },
          ],
        }}
      />,
    );
    // 注意：getByText 命中的是内层文本 span，title 在外层 .agent-toolchip 上（closest 需带自身选择器）
    const chip = screen.getByText('generate_node').closest('.agent-toolchip');
    expect(chip).toBeTruthy();
    expect(chip.getAttribute('title')).toContain('nodeType=imageNode');
    expect(chip.getAttribute('title')).toContain('prompt=猫');
  });

  it('generations → 渲染生成步骤卡片（条数+步骤标题）', () => {
    render(
      <AgentMessage
        message={{
          role: 'assistant',
          content: 'ok',
          generations: [
            { id: 'g1', title: '第一步', professionalPrompt: 'p1', ratio: '1:1' },
            { id: 'g2', title: '第二步' },
          ],
        }}
      />,
    );
    expect(screen.getByText('生成步骤方案')).toBeTruthy();
    expect(screen.getByText('2 条')).toBeTruthy();
    expect(screen.getByText('第一步')).toBeTruthy();
    expect(screen.getByText('第二步')).toBeTruthy();
  });

  it('awaiting_confirm → 点击「确认，按此执行」触发 onConfirmPlan', () => {
    const onConfirmPlan = vi.fn();
    render(
      <AgentMessage
        message={{ role: 'assistant', content: 'plan', awaiting_confirm: true }}
        onConfirmPlan={onConfirmPlan}
      />,
    );
    fireEvent.click(screen.getByText('确认，按此执行'));
    expect(onConfirmPlan).toHaveBeenCalledTimes(1);
  });

  it('streaming 消息不渲染确认按钮', () => {
    render(
      <AgentMessage
        message={{ role: 'assistant', content: 'plan', awaiting_confirm: true, streaming: true }}
        onConfirmPlan={noop}
      />,
    );
    expect(screen.queryByText('确认，按此执行')).toBeNull();
  });
});

describe('AgentMessage — tool 消息（成败与重试）', () => {
  it('成功 → 显示「操作成功：nodeId」，无重试按钮', () => {
    render(
      <AgentMessage
        message={{ role: 'tool', content: JSON.stringify({ ok: true, nodeId: 'n1' }) }}
      />,
    );
    expect(screen.getByText(/操作成功/)).toBeTruthy();
    expect(screen.queryByText('重试')).toBeNull();
  });

  it('失败且带 nodeId → 显示「重试」，点击触发 onRetryStep(nodeId)', () => {
    const onRetryStep = vi.fn();
    render(
      <AgentMessage
        message={{
          role: 'tool',
          content: JSON.stringify({ ok: false, nodeId: 'n2', error: '超时' }),
        }}
        onRetryStep={onRetryStep}
      />,
    );
    fireEvent.click(screen.getByText('重试'));
    expect(onRetryStep).toHaveBeenCalledWith('n2');
  });

  it('execute_plan 多失败步 → 每个失败步提供「重试此步」', () => {
    const onRetryStep = vi.fn();
    render(
      <AgentMessage
        message={{
          role: 'tool',
          content: JSON.stringify({
            ok: true,
            data: {
              entries: [
                { status: 'completed', nodeId: 'a' },
                { status: 'failed', nodeId: 'b', error: '生成失败', id: 'e1' },
                { status: 'failed', nodeId: 'c', error: '超时', id: 'e2' },
              ],
            },
          }),
        }}
        onRetryStep={onRetryStep}
      />,
    );
    expect(screen.getByText('计划执行：2 步失败')).toBeTruthy();
    const retryBtns = screen.getAllByText('重试此步');
    expect(retryBtns).toHaveLength(2);
    fireEvent.click(retryBtns[0]);
    expect(onRetryStep).toHaveBeenCalledWith('b');
  });
});
