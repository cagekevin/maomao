/**
 * applyNodeTypeDefaults / NODE_TYPE_DEFAULTS 单测（节点结构默认补齐）。
 * 对齐原 App.jsx 行为：缺字段补默认、已有字段不覆盖、group 用真实尺寸兜底。
 */
import { describe, it, expect } from 'vitest';
import {
  applyNodeTypeDefaults,
  NODE_TYPE_DEFAULTS,
} from '../../src/components/base/canvas/nodeDefaults.ts';

describe('applyNodeTypeDefaults — 节点结构默认补齐', () => {
  it('imageGenerateNode 缺宽高/style → 补 420×420', () => {
    const r = applyNodeTypeDefaults({
      id: 'x',
      type: 'imageGenerateNode',
      position: { x: 0, y: 0 },
      data: {},
    });
    expect(r.width).toBe(420);
    expect(r.height).toBe(420);
    expect(r.style).toEqual({ width: 420, height: 420 });
  });

  it('gridSplitNode 只缺 width（无 height 默认）→ 只补 width=280', () => {
    const r = applyNodeTypeDefaults({
      id: 'x',
      type: 'gridSplitNode',
      position: { x: 0, y: 0 },
      data: {},
    });
    expect(r.width).toBe(280);
    expect(r.height).toBeUndefined();
    expect(r.style).toEqual({ width: 280 });
  });

  it('已有字段不覆盖', () => {
    const r = applyNodeTypeDefaults({
      id: 'x',
      type: 'imageGenerateNode',
      position: { x: 0, y: 0 },
      width: 999,
      height: 888,
      data: {},
    });
    expect(r.width).toBe(999);
    expect(r.height).toBe(888);
  });

  it('未知类型返回原 node（不补）', () => {
    const node = { id: 'x', type: 'unknownType', data: {} };
    expect(applyNodeTypeDefaults(node)).toBe(node);
  });

  it('group 缺 data.name → 补 label「编组」（name 已收敛为全画布通用 label）', () => {
    const r = applyNodeTypeDefaults({ id: 'g', type: 'group', data: {}, position: { x: 0, y: 0 } });
    expect((r.data as Record<string, unknown>).label).toBe('编组');
  });

  it('group 有 data.name → 源头收敛进 label 并清除遗留 name', () => {
    const r = applyNodeTypeDefaults({
      id: 'g',
      type: 'group',
      data: { name: '我的组' },
      position: { x: 0, y: 0 },
    });
    const d = r.data as Record<string, unknown>;
    expect(d.label).toBe('我的组');
    // 遗留 name 应被迁移清除（「名字双字段」在数据模型层消亡，非末端兼容保留）
    expect(d.name).toBeUndefined();
  });

  it('group 同时有 label/name → label 优先且 name 清除', () => {
    const r = applyNodeTypeDefaults({
      id: 'g',
      type: 'group',
      data: { label: '新名', name: '旧名' },
      position: { x: 0, y: 0 },
    });
    const d = r.data as Record<string, unknown>;
    expect(d.label).toBe('新名');
    expect(d.name).toBeUndefined();
  });

  it('group 的 expandedWidth/expandedHeight 为死字段 → 忽略，仍用默认 300×200', () => {
    const r = applyNodeTypeDefaults({
      id: 'g',
      type: 'group',
      data: { expandedWidth: 700, expandedHeight: 500 },
      position: { x: 0, y: 0 },
    });
    expect(r.width).toBe(300);
    expect(r.height).toBe(200);
  });

  it('group 无 expanded → 用默认 300×200 + initialWidth/Height + className', () => {
    const r = applyNodeTypeDefaults({ id: 'g', type: 'group', data: {}, position: { x: 0, y: 0 } });
    expect(r.width).toBe(300);
    expect(r.height).toBe(200);
    expect(r.initialWidth).toBe(300);
    expect(r.initialHeight).toBe(200);
    expect(r.className).toBe('yimao-group-node');
  });

  it('NODE_TYPE_DEFAULTS 覆盖关键类型', () => {
    expect(NODE_TYPE_DEFAULTS).toHaveProperty('imageGenerateNode');
    expect(NODE_TYPE_DEFAULTS).toHaveProperty('group');
    expect(NODE_TYPE_DEFAULTS).toHaveProperty('videoProcessNode');
  });
});
