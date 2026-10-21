import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerTool,
  getTools,
  resetTools,
  type ToolDef,
} from '../../src/components/canvas/toolRegistry.ts';

beforeEach(() => {
  resetTools();
});

/**
 * 故意缺 `name` 的 def —— **类型上不成立**（`ToolDef` 要求 name + execute）。
 * 本用例要验的正是「非法 def 被 registerTool 忽略、不污染注册表」，故必须交出一个
 * 类型层不可能的形状；断言只在这一处收口，调用点保持 `registerTool(defMissingName())` 的裸写法。
 */
function defMissingName(): ToolDef {
  return { execute: () => {} } as unknown as ToolDef;
}

describe('toolRegistry（docs/25 阶段2：工具轴注册表）', () => {
  it('registerTool 追加 + getTools 返回注册表数组（live）', () => {
    registerTool({ name: 'read_canvas', execute: () => ({ ok: true }) });
    registerTool({ name: 'create_node', execute: () => ({ ok: true }) });
    const names = getTools().map((t) => t.name);
    expect(names).toEqual(['read_canvas', 'create_node']); // 注册序 = 模型选择优先级
  });

  it('resetTools 清空（测试隔离）', () => {
    registerTool({ name: 'a', execute: () => ({ ok: true }) });
    expect(getTools()).toHaveLength(1);
    resetTools();
    expect(getTools()).toHaveLength(0);
  });

  it('非法 def（无 name / 非对象）被忽略，不污染注册表', () => {
    registerTool({ name: 'ok1', execute: () => {} });
    registerTool(null as never);
    registerTool(defMissingName());
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
