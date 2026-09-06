import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerTool,
  getTools,
  resetTools,
  type ToolDef,
} from '../../src/components/base/canvas/toolRegistry.ts';

beforeEach(() => {
  resetTools();
});

describe('toolRegistry（docs/25 阶段2：工具轴注册表）', () => {
  it('registerTool 追加 + getTools 返回注册表数组（live）', () => {
    registerTool({ name: 'read_canvas', execute: () => ({ ok: true }) });
    registerTool({ name: 'create_node', execute: () => ({ ok: true }) });
    const names = getTools().map((t) => t.name);
    expect(names).toEqual(['read_canvas', 'create_node']); // 注册序 = 模型选择优先级
  });

  it('resetTools 清空（测试隔离）', () => {
    registerTool({ name: 'a' } as unknown as ToolDef);
    expect(getTools()).toHaveLength(1);
    resetTools();
    expect(getTools()).toHaveLength(0);
  });

  it('非法 def（无 name / 非对象）被忽略，不污染注册表', () => {
    registerTool({ name: 'ok1', execute: () => {} });
    registerTool(null);
    registerTool({ execute: () => {} } as unknown as ToolDef);
    expect(getTools().map((t) => t.name)).toEqual(['ok1']);
  });

  it('注册条目保留 toolDef 字段并可挂 mutating（供 buildCanvasAgentTools 压撤销栈）', () => {
    registerTool({
      name: 'mut_tool',
      description: 'd',
      parameters: {},
      execute: () => {},
      mutating: true,
    });
    const t = getTools()[0];
    expect(t).toMatchObject({ name: 'mut_tool', description: 'd', parameters: {}, mutating: true });
  });
});
