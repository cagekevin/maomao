/**
 * applyNodeTypeDefaults / NODE_TYPE_DEFAULTS 单测（节点结构默认补齐）。
 * 对齐原 App.jsx 行为：缺字段补默认、已有字段不覆盖、group 用真实尺寸兜底。
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
  ASSET_NODE_SIZE,
  IMAGE_BOX_NODE_SIZE,
  applyNodeTypeDefaults,
  withNodeSize,
  NODE_TYPE_DEFAULTS,
} from '../../src/components/base/canvas/nodeDefaults.ts';

describe('withNodeSize — 尺寸「三写不变量」唯一实现（TD-04-28）', () => {
  it('同时产出 width/height 字段 + style.width/height（NodeShell 读 width 优先，缺一则塌陷）', () => {
    const patch = withNodeSize({ id: 'g', type: 'group', style: { background: '#fff' } }, 300, 200);
    expect(patch.width).toBe(300);
    expect(patch.height).toBe(200);
    expect(patch.style.width).toBe(300);
    expect(patch.style.height).toBe(200);
    // 既有 style 其余键保留
    expect(patch.style.background).toBe('#fff');
  });

  it('不含 initial* —— 已有节点不需要（不覆盖已测量的 initial）', () => {
    const patch = withNodeSize({ id: 'g' }, 100, 50);
    expect(patch.initialWidth).toBeUndefined();
    expect(patch.initialHeight).toBeUndefined();
  });

  it('includeInitial → 一并产出 initialWidth/Height（仅新建节点需要）', () => {
    const patch = withNodeSize({}, 300, 200, { includeInitial: true });
    expect(patch.initialWidth).toBe(300);
    expect(patch.initialHeight).toBe(200);
  });

  it('返回尺寸补丁而非整个 node —— 展开式写回不得覆盖 position/data', () => {
    const patch = withNodeSize({ id: 'g', position: { x: 9, y: 9 }, data: { label: 'A' } }, 10, 10);
    // 补丁里不应出现 id/position/data 等无关键（否则 `{...node, ...patch}` 会误盖）
    expect(patch).not.toHaveProperty('id');
    expect(patch).not.toHaveProperty('position');
    expect(patch).not.toHaveProperty('data');
  });
});

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

describe('造节点尺寸单源（TD-16-48）', () => {
  it('常量值 = 现网各造节点点原值（**改这里 = 改所有造节点默认尺寸，有布局影响**）', () => {
    expect(ASSET_NODE_SIZE.video).toEqual({ width: 420, height: 380 });
    expect(ASSET_NODE_SIZE.audio).toEqual({ width: 320, height: 200 });
    expect(ASSET_NODE_SIZE.image).toEqual({ width: 360, height: 260 });
    expect(ASSET_NODE_SIZE.gridCell).toEqual({ width: 320, height: 320 });
    expect(IMAGE_BOX_NODE_SIZE).toEqual({ width: 420, height: 420 });
  });

  it('★源码级：造节点点不再自持尺寸字面量（一律引用单源常量）', () => {
    const sites: Array<[string, string]> = [
      ['src/components/canvas/nodes/GridSplitNode.tsx', 'ASSET_NODE_SIZE'],
      ['src/components/canvas/nodes/GridMergeNode.tsx', 'ASSET_NODE_SIZE'],
      ['src/components/canvas/nodes/FaceMosaicNode.tsx', 'ASSET_NODE_SIZE'],
      ['src/components/canvas/nodes/VideoProcessNode.tsx', 'ASSET_NODE_SIZE'],
      ['src/components/base/depthVideo/spawn.ts', 'ASSET_NODE_SIZE'],
      ['src/components/canvas/nodes/Director3DNode.tsx', 'IMAGE_BOX_NODE_SIZE'],
      ['src/components/canvas/nodes/PanoramaNode.tsx', 'IMAGE_BOX_NODE_SIZE'],
    ];
    for (const [rel, constName] of sites) {
      const text = readFileSync(new URL('../../' + rel, import.meta.url), 'utf8');
      // ① 引用了单源常量（是委托，不是把尺寸删了）
      expect(text).toContain(`...${constName}`);
      // ② 不再自持尺寸字面量（否则 = 第二份真相源又回来了）
      expect(text).not.toMatch(/style: \{ width: \d+, height: \d+ \}/);
    }
  });

  it('★源码级：`imageGenerateNode` 的造节点尺寸走结构默认表（agent 造节点不再手抄 420×420）', () => {
    const text = readFileSync(
      new URL('../../src/components/agent/canvas/useCanvasAgentTools.ts', import.meta.url),
      'utf8',
    );
    expect(text).toContain('applyNodeTypeDefaults');
    expect(text).not.toMatch(/\{ width: 420, height: 420, style/);
  });
});
