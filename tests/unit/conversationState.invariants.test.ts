import { describe, it, expect } from 'vitest';
/**
 * AI 助手 · 会话域不变量校验单测网（spec/AI-ASSISTANT-STATE-INVARIANTS-SSOT.md 批1/L5）。
 *
 * 覆盖 validateConversation / validateMemory / validateWorkflow / validateConversationState 的
 * I/S/T/P 各条，并含「错误注入」用例（故意弄坏 activeId / message id / creditGate / streaming /
 * 体积 / workflow.status），断言校验本身报 error/warn —— 否则校验形同虚设。
 */
import {
  validateConversation,
  validateConversationState,
  validateMemory,
  validateWorkflow,
  CONV_MSG_MAX,
  KNOWN_WORKFLOW_STATUS,
} from '../../src/components/agent/conversation/conversationInvariants.ts';
import {
  normalizeConversation,
  AGENT_MSG_MAX,
} from '../../src/components/agent/conversation/conversationState.ts';
import { WORKFLOW_STATUS } from '../../src/components/agent/runtime/workflowState.ts';
import type {
  Conversation,
  ConversationStoreState,
} from '../../src/components/agent/conversation/conversationState.ts';

/** 构造一条健康会话（经 normalizeConversation 归一，所有字段齐全） */
function validConv(overrides: Record<string, unknown> = {}): Conversation {
  return normalizeConversation({
    id: 'ac_1',
    title: '对话',
    messages: [{ id: 'msg1', role: 'user', content: 'hi' }],
    skills: [],
    attachments: [],
    draft: '',
    workflow: { id: 'wf1', status: 'planning', nodeIds: [] },
    memory: {
      global_contract: {
        visual_positioning: '',
        unified_style_prompt: '',
        unified_negative_prompt: '',
      },
    },
    ...overrides,
  } as never) as Conversation;
}

function errs(v: { level: string; code: string }[]): string[] {
  return v.filter((x) => x.level === 'error').map((x) => x.code);
}
function warns(v: { level: string; code: string }[]): string[] {
  return v.filter((x) => x.level === 'warn').map((x) => x.code);
}

describe('validateConversation · 健康态', () => {
  it('归一后的合法会话 → 无违规', () => {
    expect(validateConversation(validConv())).toEqual([]);
  });

  it('null conv → S0 错误', () => {
    expect(errs(validateConversation(null))).toContain('S0');
  });
});

describe('validateConversation · 错误注入（I2/S1/S3/S4/P4）', () => {
  it('I2：message id 重复 → error', () => {
    const conv = validConv({
      messages: [
        { id: 'dup', role: 'user', content: 'a' },
        { id: 'dup', role: 'assistant', content: 'b' },
      ],
    });
    expect(errs(validateConversation(conv))).toContain('I2');
  });

  it('I2：message 缺 id → error（刻意删掉 id 也要被抓住）', () => {
    const conv = validConv();
    delete (conv.messages[0] as { id?: unknown }).id;
    expect(errs(validateConversation(conv))).toContain('I2');
  });

  it('S1：消息数超过 AGENT_MSG_MAX → error', () => {
    const many = Array.from({ length: AGENT_MSG_MAX + 1 }, (_, i) => ({
      id: `m${i}`,
      role: i % 2 ? 'assistant' : ('user' as string),
      content: 'x',
    }));
    const conv = validConv({ messages: many });
    expect(errs(validateConversation(conv))).toContain('S1');
  });

  it('S3：creditGate 形状非法 → error', () => {
    const conv = validConv();
    (conv as Record<string, unknown>).creditGate = { pending: false, gens: [], map: {} };
    expect(errs(validateConversation(conv))).toContain('S3');
  });

  it('S4：memory.global_contract 字段非 string → error', () => {
    const conv = validConv();
    conv.memory!.global_contract = {
      visual_positioning: 123 as never,
      unified_style_prompt: '',
      unified_negative_prompt: '',
    };
    expect(errs(validateConversation(conv))).toContain('S4');
  });

  it('P4：终态残留 streaming:true → error', () => {
    const conv = validConv({ messages: [{ id: 'm1', role: 'assistant', streaming: true }] });
    expect(errs(validateConversation(conv))).toContain('P4');
  });
});

describe('validateMemory / validateWorkflow', () => {
  it('validateMemory：健康记忆 → 无违规；非 string 契约 → S4', () => {
    expect(validateMemory(validConv().memory!)).toEqual([]);
    const bad = validConv();
    bad.memory!.global_contract!.unified_style_prompt = 5 as unknown as string;
    expect(errs(validateMemory(bad.memory!))).toContain('S4');
  });

  it('validateWorkflow：未知 status → S2 warn（不炸）；健康 → 无违规', () => {
    expect(validateWorkflow(validConv().workflow)).toEqual([]);
    const conv = validConv({ workflow: { id: 'wf1', status: 'bogus', nodeIds: [] } });
    expect(warns(validateWorkflow(conv.workflow))).toContain('S2');
  });
});

describe('validateConversationState · I1/I3/T3', () => {
  it('健康整包状态 → 无违规', () => {
    const state: ConversationStoreState = {
      conversations: [validConv()],
      activeId: 'ac_1',
      sending: false,
    };
    expect(validateConversationState(state)).toEqual([]);
  });

  it('I3：activeId 不指向存在的对话 → error', () => {
    const state: ConversationStoreState = {
      conversations: [validConv()],
      activeId: 'does-not-exist',
      sending: false,
    };
    expect(errs(validateConversationState(state))).toContain('I3');
  });

  it('I1：conversation id 重复 → error', () => {
    const dup = validConv();
    const state: ConversationStoreState = {
      conversations: [dup, dup],
      activeId: dup.id,
      sending: false,
    };
    expect(errs(validateConversationState(state))).toContain('I1');
  });

  it('T3：零对话 → warn（不视为 error，兜底场景）', () => {
    const state: ConversationStoreState = { conversations: [], activeId: '', sending: false };
    expect(warns(validateConversationState(state))).toContain('T3');
  });
});

describe('常量镜像与真源一致（防漂移）', () => {
  it('CONV_MSG_MAX === AGENT_MSG_MAX', () => {
    expect(CONV_MSG_MAX).toBe(AGENT_MSG_MAX);
  });
  it('KNOWN_WORKFLOW_STATUS 覆盖 WORKFLOW_STATUS 全集', () => {
    for (const s of WORKFLOW_STATUS) expect(KNOWN_WORKFLOW_STATUS.has(s)).toBe(true);
  });
});
