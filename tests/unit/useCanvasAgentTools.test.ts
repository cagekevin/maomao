// @vitest-environment jsdom
/**
 * useCanvasAgentTools 单测（批 3）。
 * 覆盖对外暴露的纯函数（脱离 React 可测）：
 *   - getNodeAssetUrl：data.assetUrl / data.url / data.images[] / data.assetUrls[] 各种形态取主图，无图→''
 *   - buildCanvasAgentToolSchemas()：OpenAI function-calling 格式 schema
 *   - CANVAS_AGENT_TOOL_NAMES：工具名数组（snake_case，如 create_node/delete_node/generate_node）
 *   - buildCanvasAgentTools(ctx)：返回工具 Map；写工具异常被包成 {ok:false,error} 不冒泡；
 *     读工具（read_canvas/list_nodes）透传 ctx；create_node 调用 ctx.addNodes 并返回新 id
 */
import { describe, it, expect, vi } from 'vitest';
import type { Node } from '@xyflow/react';

const mkNode = (data: Record<string, unknown> = {}): Node => ({
  id: 'n',
  position: { x: 0, y: 0 },
  data,
});

const mod = await import('../../src/components/agent/canvas/useCanvasAgentTools.ts');
const { buildCanvasAgentTools, buildCanvasAgentToolSchemas, CANVAS_AGENT_TOOL_NAMES } = mod;
// getNodeAssetUrl 已收口至横切层 `base/utils/media/nodeMedia.ts`（2026-09-25 按件切）。
const { getNodeAssetUrl } = await import('../../src/components/base/utils/media/nodeMedia.ts');
/** 无 resource 可解析（本组用例不含 contentId，等价于真实调用方在无 resource 时的行为） */
const noResolve = () => null;
// 【TD-11-83】AI 可建类型白名单真源 + 提示词（断言"两处 schema / 提示词均派生自真源"）
const { AGENT_PROMPTS, CREATABLE_NODE_TYPES } =
  await import('../../src/components/agent/agentConfig.ts');

describe('getNodeAssetUrl', () => {
  it('data.assetUrl 优先', () => {
    expect(getNodeAssetUrl(mkNode({ assetUrl: 'A' }), noResolve)).toBe('A');
  });
  it('data.url 兜底字符串', () => {
    expect(getNodeAssetUrl(mkNode({ url: 'B' }), noResolve)).toBe('B');
  });
  it('images 数组（字符串元素 / {url} / {assetUrl}）', () => {
    expect(getNodeAssetUrl(mkNode({ images: ['http://a'] }), noResolve)).toBe('http://a');
    expect(getNodeAssetUrl(mkNode({ images: [{ url: 'http://b' }] }), noResolve)).toBe('http://b');
    expect(getNodeAssetUrl(mkNode({ images: [{ assetUrl: 'http://c' }] }), noResolve)).toBe(
      'http://c',
    );
  });
  it('assetUrls 数组', () => {
    expect(getNodeAssetUrl(mkNode({ assetUrls: ['http://d'] }), noResolve)).toBe('http://d');
  });
  it('无图 → 空串', () => {
    expect(getNodeAssetUrl(mkNode({}), noResolve)).toBe('');
    expect(getNodeAssetUrl(mkNode(), noResolve)).toBe('');
  });
});

describe('tool schemas / names', () => {
  it('CANVAS_AGENT_TOOL_NAMES 是字符串数组且含核心工具', () => {
    expect(Array.isArray(CANVAS_AGENT_TOOL_NAMES)).toBe(true);
    expect(CANVAS_AGENT_TOOL_NAMES).toContain('create_node');
    expect(CANVAS_AGENT_TOOL_NAMES).toContain('delete_node');
    expect(CANVAS_AGENT_TOOL_NAMES).toContain('generate_node');
    expect(CANVAS_AGENT_TOOL_NAMES).toContain('read_canvas');
    expect(CANVAS_AGENT_TOOL_NAMES).toContain('skill_read_file'); // 渐进披露第三层（按需读资料）
  });

  it('buildCanvasAgentToolSchemas 返回 function calling 格式', () => {
    const schemas = buildCanvasAgentToolSchemas();
    expect(Array.isArray(schemas)).toBe(true);
    expect(schemas[0]).toMatchObject({ type: 'function', function: { name: expect.any(String) } });
  });
});

describe('buildCanvasAgentTools', () => {
  function makeCtx(overrides = {}) {
    return {
      getNodes: vi.fn(() => []),
      getEdges: vi.fn(() => []),
      setNodes: vi.fn(),
      setEdges: vi.fn(),
      addNodes: vi.fn(),
      screenToFlowPosition: vi.fn(() => ({ x: 0, y: 0 })),
      fitView: vi.fn(),
      ...overrides,
    };
  }

  it('返回工具 Map，含 create_node/delete_node/read_canvas/list_nodes/generate_node', () => {
    const tools = buildCanvasAgentTools(makeCtx());
    expect(typeof tools.create_node).toBe('function');
    expect(typeof tools.delete_node).toBe('function');
    expect(typeof tools.read_canvas).toBe('function');
    expect(typeof tools.list_nodes).toBe('function');
    expect(typeof tools.generate_node).toBe('function');
  });

  it('read_canvas / list_nodes 透传 ctx', () => {
    const ctx = makeCtx({ getNodes: vi.fn(() => [{ id: 'z' }]) });
    const tools = buildCanvasAgentTools(ctx);
    const r = tools.read_canvas({});
    expect(r.ok).toBe(true);
    expect(ctx.getNodes).toHaveBeenCalled();
  });

  it('读工具内部异常被包成 {ok:false,error}（不冒泡）', () => {
    const ctx = makeCtx({
      getNodes: vi.fn(() => {
        throw new Error('boom');
      }),
    });
    const tools = buildCanvasAgentTools(ctx);
    const res = tools.read_canvas({});
    expect(res.ok).toBe(false);
    expect(res.error).toContain('read_canvas');
  });

  it('skill_read_file 是**异步**工具：无本轮 Skill 时如实拒绝（不静默回空内容）', async () => {
    const tools = buildCanvasAgentTools(makeCtx());
    // async 工具经注册表包装后仍是 Promise（runToolCalls 会 await）——此处显式 await 验证这一点
    const res = await tools.skill_read_file({ path: 'references/风格.md' });
    expect(res.ok).toBe(false);
    expect(res.error).toContain('本轮没有启用 Skill');
  });

  it('create_node 用合法 type → setNodes 追加节点并返回新 id', () => {
    const ctx = makeCtx();
    const tools = buildCanvasAgentTools(ctx);
    const res = tools.create_node({
      type: 'textGenerateNode',
      prompt: '你好',
      position: { x: 1, y: 2 },
    });
    expect(res.ok).toBe(true);
    expect(res.data.id).toMatch(/^textGenerateNode_/);
    expect(ctx.setNodes).toHaveBeenCalled();
    // 断言「写」的行为而非 setNodes 的实现形式（host 走函数式更新）：传入当前节点数组，
    // 应追加正确 data 的新节点、且不影响既有节点。
    const applyFn = ctx.setNodes.mock.calls[0][0] as (
      nodes: Record<string, unknown>[],
    ) => Record<string, unknown>[];
    expect(typeof applyFn).toBe('function');
    const result = applyFn([{ id: 'existing', data: {} }]);
    expect(
      result.some(
        (n) => n.id === res.data.id && (n.data as Record<string, unknown>).prompt === '你好',
      ),
    ).toBe(true);
    expect(result.some((n) => n.id === 'existing')).toBe(true);
  });

  it('create_node 对 textGenerateNode 传 text → 内容落生成区 data.text（而非抽屉 data.prompt）', () => {
    const ctx = makeCtx();
    const tools = buildCanvasAgentTools(ctx);
    const res = tools.create_node({
      type: 'textGenerateNode',
      text: 'AI 回复内容',
      position: { x: 1, y: 2 },
    });
    expect(res.ok).toBe(true);
    const applyFn = ctx.setNodes.mock.calls[0][0] as (
      nodes: Record<string, unknown>[],
    ) => Record<string, unknown>[];
    const result = applyFn([{ id: 'existing', data: {} }]);
    const created = result.find((n) => n.id === res.data.id);
    expect((created!.data as Record<string, unknown>).text).toBe('AI 回复内容');
    expect((created!.data as Record<string, unknown>).prompt).toBeUndefined();
  });

  it('create_node 对 textGenerateNode 仅传 prompt → 内容落抽屉区 data.prompt（AI 既有行为不变）', () => {
    const ctx = makeCtx();
    const tools = buildCanvasAgentTools(ctx);
    const res = tools.create_node({
      type: 'textGenerateNode',
      prompt: '抽屉提示词',
      position: { x: 1, y: 2 },
    });
    const applyFn = ctx.setNodes.mock.calls[0][0] as (
      nodes: Record<string, unknown>[],
    ) => Record<string, unknown>[];
    const result = applyFn([{ id: 'existing', data: {} }]);
    const created = result.find((n) => n.id === res.data.id);
    expect((created!.data as Record<string, unknown>).prompt).toBe('抽屉提示词');
  });

  it('create_node 用非法 type → ok:false 且给出可选类型', () => {
    const ctx = makeCtx();
    const tools = buildCanvasAgentTools(ctx);
    const res = tools.create_node({ type: 'notExist' });
    expect(res.ok).toBe(false);
    expect(res.error).toContain('未知节点类型');
  });
});

/**
 * 【TD-11-83】AI 可建节点类型白名单：两处 tool schema 与提示词必须**派生自唯一真源**。
 * 反证：把任一处 schema enum 改回手抄字面量（哪怕只漏一项）⇒ 对应断言红；
 *       把提示词列举改回手抄（成员/顺序不符）⇒ 第三条断言红。
 */
describe('CREATABLE_NODE_TYPES — AI 可建类型白名单唯一真源（TD-11-83）', () => {
  // LLM 实际收到的是 JSON 序列化后的 schema ⇒ 断言走同一形态（按 JSON 路径取值，不 import 内部结构）。
  // ⚠️ 两处 enum 的**路径不同**：create_node 在 `properties.type`；batch_create_nodes 在
  //    `properties.nodes.items.type` —— 这正是"手抄"曾经可能漂移的地方，故按各自真实路径分别取值。
  const enumAt = (toolName: string, path: string): string[] => {
    const tools: Record<string, unknown>[] = JSON.parse(
      JSON.stringify(buildCanvasAgentToolSchemas()),
    );
    const tool = tools.find(
      (x) => (x.function as { name?: string } | undefined)?.name === toolName,
    );
    const found = path
      .split('.')
      .reduce<unknown>((acc, k) => (acc as Record<string, unknown> | undefined)?.[k], tool);
    return Array.isArray(found) ? (found as string[]) : [];
  };

  it('create_node / batch_create_nodes 的 type enum 与真源逐项一致', () => {
    expect(enumAt('create_node', 'function.parameters.properties.type.enum')).toEqual([
      ...CREATABLE_NODE_TYPES,
    ]);
    expect(
      enumAt(
        'batch_create_nodes',
        'function.parameters.properties.nodes.items.properties.type.enum',
      ),
    ).toEqual([...CREATABLE_NODE_TYPES]);
  });

  it('CANVAS_RULES 提示词里的类型列举由真源插值（非手抄）', () => {
    expect(AGENT_PROMPTS.CANVAS_RULES).toContain(CREATABLE_NODE_TYPES.join(' / '));
  });
});
