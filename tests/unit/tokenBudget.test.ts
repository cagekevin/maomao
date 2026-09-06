// @vitest-environment node
/**
 * tokenBudget（上下文 token 估算 + 预算触发压缩决策）单测。
 *
 * 【2026-08-30 · estimateTokens.js 并入 tokenBudget.js 后两份测试合为本文件】
 *   - estimateTokens（单段）已私有化。其估算口径改由导出的 estimateMessagesTokens
 *     反推验证（见 estimateOne helper），测试不依赖任何私有符号。
 *   - 原「导出阈值常量合理（force > precompress）」用例已删除：断言两个常量字面量的
 *     相对大小，永远为真，属自证式断言。阈值由下方 force / precompress / none 三档
 *     实测锁死——改阈值这些用例会红，那才是有效断言。
 *
 * 阈值：≥0.9 强制压缩，≥0.75 预压缩，否则不压缩。
 * 估算口径：中文 1 字符≈1 token，拉丁约 4 字符≈1 token，每条消息另计结构开销。
 */
import { describe, it, expect } from 'vitest';

const { resolveInputBudget, decideContextCompression, estimateMessagesTokens } =
  await import('../../src/components/agent/runtime/tokenBudget.ts');

/**
 * 单条消息的结构开销，与 tokenBudget.js 的 PER_MESSAGE_OVERHEAD 对齐。
 * 这是有意保留的耦合：估算口径是「预算决策」的输入，口径漂移必须让本文件的断言变红。
 * 改动该常量时同步更新此处。
 */
const MSG_OVERHEAD = 8;

/** 单段估算 = 整组估算 − 单条开销。用于在不依赖私有符号的前提下验证估算口径 */
const estimateOne = (s) => estimateMessagesTokens([{ role: 'user', content: s }]) - MSG_OVERHEAD;

/** 构造单条消息，使其估算总 token 恰为 n（content 全 CJK → 1 字符 1 token） */
const tokensOf = (n) => [{ role: 'user', content: '长'.repeat(Math.max(0, n - MSG_OVERHEAD)) }];

describe('估算口径（经 estimateMessagesTokens 验证）', () => {
  it('空/非字符串内容 → 0', () => {
    expect(estimateOne('')).toBe(0);
    expect(estimateOne(null)).toBe(0);
    expect(estimateOne(undefined)).toBe(0);
  });

  it('中文字符按 1 字符 ≈ 1 token', () => {
    expect(estimateOne('一二三四')).toBe(4);
  });

  it('拉丁按约 4 字符 ≈ 1 token（向上取整）', () => {
    expect(estimateOne('abcdefgh')).toBe(2);
    expect(estimateOne('abc')).toBe(1); // 3/4 向上取整 1
    expect(estimateOne('a'.repeat(5))).toBe(2); // 5/4 向上取整 2
  });

  it('中英混排叠加', () => {
    expect(estimateOne('你好test')).toBe(3); // 2 汉字 + 4 拉丁 = 2 + 1
  });

  it('整组：逐条叠加开销，tool_calls 一并计入', () => {
    const messages = [
      { role: 'user', content: '你好' }, // 8 + 2
      {
        role: 'assistant',
        content: 'ok',
        tool_calls: [{ id: 'a', function: { name: 'read', arguments: '{}' } }],
      },
    ];
    expect(estimateMessagesTokens(messages)).toBeGreaterThan(10 + 9);
    expect(estimateMessagesTokens([])).toBe(0);
    expect(estimateMessagesTokens(null)).toBe(0);
  });

  it('整组：忽略 null/非对象条目；缺 content 仍计单条开销', () => {
    const messages = [null, 'bad', { role: 'assistant' }, { role: 'user', content: '哈哈' }];
    // 仅 {role:'assistant'}（8）与 {content:'哈哈'}（8+2=10）计入，共 18
    expect(estimateMessagesTokens(messages)).toBe(18);
  });
});

describe('resolveInputBudget —— 输入预算解析', () => {
  it('= contextWindow × (1 − outputBudgetRatio)', () => {
    expect(resolveInputBudget({ contextWindow: 128_000, outputBudgetRatio: 0.2 })).toBe(102_400);
    expect(resolveInputBudget({ contextWindow: 8192, outputBudgetRatio: 0.25 })).toBe(6144);
  });

  it('无效/缺省输入返回 0', () => {
    expect(resolveInputBudget({ contextWindow: 0 })).toBe(0);
    expect(resolveInputBudget({ contextWindow: -1 })).toBe(0);
    expect(resolveInputBudget({})).toBe(0);
  });

  it('输出比例钳制到 [0,1]', () => {
    expect(resolveInputBudget({ contextWindow: 1000, outputBudgetRatio: 1.5 })).toBe(0);
    expect(resolveInputBudget({ contextWindow: 1000, outputBudgetRatio: -1 })).toBe(1000);
  });
});

describe('decideContextCompression —— 压缩决策', () => {
  it('≥ FORCE 阈值 → force', () => {
    const budget = 1000;
    expect(decideContextCompression({ messages: tokensOf(900), inputBudget: budget })).toBe(
      'force',
    );
    expect(decideContextCompression({ messages: tokensOf(999), inputBudget: budget })).toBe(
      'force',
    );
  });

  it('在 [precompress, force) 区间 → precompress', () => {
    const budget = 1000;
    expect(decideContextCompression({ messages: tokensOf(750), inputBudget: budget })).toBe(
      'precompress',
    );
    expect(decideContextCompression({ messages: tokensOf(890), inputBudget: budget })).toBe(
      'precompress',
    );
  });

  it('低于 precompress 阈值 → none', () => {
    const budget = 1000;
    expect(decideContextCompression({ messages: tokensOf(749), inputBudget: budget })).toBe('none');
    expect(decideContextCompression({ messages: [], inputBudget: budget })).toBe('none');
  });

  it('预算无效 → 保守 none（不因缺预算误触发）', () => {
    const msgs = tokensOf(900);
    expect(decideContextCompression({ messages: msgs, inputBudget: 0 })).toBe('none');
    expect(decideContextCompression({ messages: msgs, inputBudget: -1 })).toBe('none');
  });
});
