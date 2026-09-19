// @vitest-environment node
/**
 * agentCanvasHost.updateNodeData —— 字典归一化接线（TD-05-13 · I1）。
 *
 * 为什么单独测这条路径：写 node.data 有**两条**入口 —— 界面写回（`useNodeData.patchData`，
 * 见 useNodeData.test.ts）与 Agent 写回（`agentCanvasHost.updateNodeData`，本文件）。
 * 债的症状原文即点名「含 Agent `update_node_any_field`」，故两条路径都要有行为锁，
 * 否则某一侧漏接线时单测仍全绿（假绿）。
 */
import { describe, it, expect } from 'vitest';
import { createAgentCanvasHost } from '../../src/components/agent/canvas/agentCanvasHost.ts';
import type { AgentCanvasHostCtx } from '../../src/components/agent/canvas/agentCanvasHost.ts';
import type { Node, Edge } from '@xyflow/react';

/** 最小 ctx：内存 nodes，setNodes 支持函数式更新 */
function makeCtx(initial: Node[]): AgentCanvasHostCtx & { current: () => Node[] } {
  let nodes = initial;
  return {
    getNodes: () => nodes,
    setNodes: (updater) => {
      nodes = typeof updater === 'function' ? updater(nodes) : updater;
    },
    getEdges: () => [] as Edge[],
    setEdges: () => {},
    current: () => nodes,
  };
}

describe('agentCanvasHost.updateNodeData — 字典 GC（Agent 写回路径）', () => {
  it('Agent 改写 prompt 去掉胶囊 → 孤儿字典项被裁掉', () => {
    const ctx = makeCtx([
      {
        id: 'n1',
        position: { x: 0, y: 0 },
        data: {
          prompt: '@{cp_style-643:暖阳}',
          creativePresets: {
            'cp_style-643': { kind: 'style', prompt: '暖阳' },
            'cp_style-999': { kind: 'style', prompt: '孤儿' },
          },
        },
      } as Node,
    ]);
    const host = createAgentCanvasHost(ctx);
    // Agent 经 update_node_any_field 写入不带胶囊的新 prompt
    host.updateNodeData('n1', { prompt: '改造后的提示词' });
    const data = ctx.current()[0].data as Record<string, unknown>;
    expect(data.creativePresets).toEqual({});
  });

  it('写非 chip 字段 → 字典原引用不动（无谓重建）', () => {
    const dict = { 'cp_style-1': { kind: 'style', prompt: 'x' } };
    const ctx = makeCtx([
      {
        id: 'n1',
        position: { x: 0, y: 0 },
        data: { prompt: '无胶囊', creativePresets: dict },
      } as Node,
    ]);
    const host = createAgentCanvasHost(ctx);
    host.updateNodeData('n1', { assetUrl: '/x.png' });
    expect((ctx.current()[0].data as Record<string, unknown>).creativePresets).toBe(dict);
  });

  it('无 creativePresets 的节点不受影响（通用路径零副作用）', () => {
    const ctx = makeCtx([{ id: 'n1', position: { x: 0, y: 0 }, data: { prompt: 'x' } } as Node]);
    const host = createAgentCanvasHost(ctx);
    host.updateNodeData('n1', { prompt: 'y' });
    const data = ctx.current()[0].data as Record<string, unknown>;
    expect(data.prompt).toBe('y');
    expect('creativePresets' in data).toBe(false);
  });
});
