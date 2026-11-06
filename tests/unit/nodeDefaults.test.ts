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
  NODE_TYPE_DEFAULTS,
} from '../../src/components/canvas/contract/nodeDefaults.ts';
import { NODE_TYPES } from '../../src/components/base/core/contracts.ts';
import { withNodeSize } from '../../src/components/base/core/nodeSizePatch.ts';
import { computeSizeSync } from '../../src/components/base/core/interaction/uiHooks.ts';
import { NODE_AREA_FIXED_BASE_SIZE } from '../../src/components/base/core/config.ts';

describe('withNodeSize — 尺寸「三写不变量」唯一实现（TD-04-28）', () => {
  it('同时产出 width/height 字段 + style.width/height（NodeShell 读 width 优先，缺一则塌陷）', () => {
    const patch = withNodeSize({ id: 'g', type: 'group', style: { background: '#fff' } }, 300, 200);
    expect(patch.width).toBe(300);
    expect(patch.height).toBe(200);
    expect(patch.style['width']).toBe(300);
    expect(patch.style['height']).toBe(200);
    // 既有 style 其余键保留
    expect(patch.style['background']).toBe('#fff');
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

  it('gridSplitNode 补宽高双维（2026-11-05 框选误选治本：只有 width 时框选面积算不出高）', () => {
    const r = applyNodeTypeDefaults({
      id: 'x',
      type: 'gridSplitNode',
      position: { x: 0, y: 0 },
      data: {},
    });
    expect(r.width).toBe(280);
    expect(r.height).toBe(420);
    expect(r.style).toEqual({ width: 280, height: 420 });
  });

  // 【框选误选治本 2026-11-05】只有 `measured/width/height/initialWidth` 全无的节点，框选守卫
  // `geometryOf` 只能返回 null ⇒ 放行 ⇒ 被库的 `forceInitialRender` 无条件选中。
  // 真实快照取证：807 个落盘节点中 66 个「几何全无」，100% 是 textGenerateNode。以下逐类型锁死。
  it('textGenerateNode 天生带 420×320（此前唯一「几何全无」类型，每次框选必被误选）', () => {
    const r = applyNodeTypeDefaults({
      id: 't',
      type: 'textGenerateNode',
      position: { x: 0, y: 0 },
      data: {},
    });
    expect(r.width).toBe(420);
    expect(r.height).toBe(320);
    expect(r.style).toEqual({ width: 420, height: 320 });
  });

  it('所有可框选类型在新建后都自带宽高（缺一类型 = 该类型每次框选必被误选）', () => {
    // 【清单从 `NODE_TYPES` 派生，不手写】手写清单只锁"当时想到的类型"：以后新增节点类型
    // 若忘了在 `NODE_TYPE_DEFAULTS` 登记几何，本条会直接红（这才是这条测试的价值）。
    // 排除项只有两类：`ghostTarget` 是连线占位（从不参与框选）、`assetNode` 走分档函数（TD-16-48）。
    const types = Object.keys(NODE_TYPES).filter((t) => t !== 'ghostTarget' && t !== 'assetNode');
    for (const type of types) {
      const r = applyNodeTypeDefaults({
        id: `n-${type}`,
        type,
        position: { x: 0, y: 0 },
        data: {},
      });
      expect(typeof r.width, `${type} 缺 width`).toBe('number');
      expect(typeof r.height, `${type} 缺 height`).toBe('number');
      expect(Number(r.width)).toBeGreaterThan(0);
      expect(Number(r.height)).toBeGreaterThan(0);
    }
  });

  it('assetNode 不进表（TD-16-48），但按 data.assetType 分档补几何（否则每次框选必被误选）', () => {
    const base = { id: 'a', type: 'assetNode', position: { x: 0, y: 0 }, data: {} };
    const image = applyNodeTypeDefaults({ ...base, data: { assetType: 'image' } });
    expect(image.width).toBe(360);
    expect(image.height).toBe(260);
    const video = applyNodeTypeDefaults({ ...base, data: { assetType: 'video' } });
    expect(video.width).toBe(420);
    expect(video.height).toBe(380);
    const audio = applyNodeTypeDefaults({ ...base, data: { assetType: 'audio' } });
    expect(audio.width).toBe(320);
    expect(audio.height).toBe(200);
    // 未知/缺省 assetType → 走 image 档（与 AssetNode 的默认呈现一致）
    const unknown = applyNodeTypeDefaults({ ...base, data: { assetType: 'weird' } });
    expect(unknown.width).toBe(360);
    expect(unknown.height).toBe(260);
    // 不进表：表里没有 assetNode 键，避免单档位与 style 多档位打架
    expect(NODE_TYPE_DEFAULTS).not.toHaveProperty('assetNode');
  });

  it('assetNode 半残几何逐维补齐（style 只有 width 时不与 height 打架）', () => {
    const r = applyNodeTypeDefaults({
      id: 'a',
      type: 'assetNode',
      position: { x: 0, y: 0 },
      style: { width: 500 },
      data: { assetType: 'video' },
    });
    // 取值优先级 = node.width → node.style.width → assetType 档位：已有 style 宽(500) 原样沿用，
    // 只有缺的那一维才回落到档位（否则「三写不变量」里字段与 style 会指向两个不同宽度）。
    expect(r.width).toBe(500);
    expect(r.height).toBe(380);
    expect(r.style['width']).toBe(500); // 已有 style 宽不被覆盖
    expect(r.style['height']).toBe(380); // 缺的一维才补
  });

  it('存量节点只有 style 宽高、没有 width 字段 → 补的 width 沿用 style 值（不得缩回表默认）', () => {
    // NodeShell / React Flow 的 `getNodeInlineStyleDimensions` 都是 `width ?? style.width`（**字段优先**）：
    // 若这里按表默认填 width=420，那个原本靠 style 撑到 600 的旧节点会当场缩水（布局回归）。
    const r = applyNodeTypeDefaults({
      id: 'x',
      type: 'textGenerateNode',
      position: { x: 0, y: 0 },
      style: { width: 600, height: 500 },
      data: {},
    });
    expect(r.width).toBe(600);
    expect(r.height).toBe(500);
    expect(r.style).toEqual({ width: 600, height: 500 });
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
    expect((r.data as Record<string, unknown>)['label']).toBe('编组');
  });

  it('group 有 data.name → 源头收敛进 label 并清除遗留 name', () => {
    const r = applyNodeTypeDefaults({
      id: 'g',
      type: 'group',
      data: { name: '我的组' },
      position: { x: 0, y: 0 },
    });
    const d = r.data as Record<string, unknown>;
    expect(d['label']).toBe('我的组');
    // 遗留 name 应被迁移清除（「名字双字段」在数据模型层消亡，非末端兼容保留）
    expect(d['name']).toBeUndefined();
  });

  it('group 同时有 label/name → label 优先且 name 清除', () => {
    const r = applyNodeTypeDefaults({
      id: 'g',
      type: 'group',
      data: { label: '新名', name: '旧名' },
      position: { x: 0, y: 0 },
    });
    const d = r.data as Record<string, unknown>;
    expect(d['label']).toBe('新名');
    expect(d['name']).toBeUndefined();
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

  it('videoGenerateNode 的 507×285 由 computeSizeSync 派生（不是手抄魔数，改 baseSize 会红）', () => {
    // 【2026-11-06 体检 #7】VideoGenerate 是 area-fixed + 默认 16:9，稳态尺寸 = computeSizeSync 的结果。
    // 表里若直接手写 507×285，`NODE_AREA_FIXED_BASE_SIZE` 一改就静默漂移（表与真实渲染不一致
    // ⇒ 框选几何再次对不上）。这条用同一个函数现算，把两处绑死。
    const steady = computeSizeSync(16 / 9, {
      mode: 'area-fixed',
      baseSize: NODE_AREA_FIXED_BASE_SIZE,
    });
    const d = NODE_TYPE_DEFAULTS['videoGenerateNode'];
    expect(d?.width).toBe(steady.width);
    expect(d?.height).toBe(steady.height);
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
      ['src/components/image/nodes/GridSplitNode.tsx', 'ASSET_NODE_SIZE'],
      ['src/components/image/nodes/GridMergeNode.tsx', 'ASSET_NODE_SIZE'],
      ['src/components/image/faceMosaic/FaceMosaicNode.tsx', 'ASSET_NODE_SIZE'],
      ['src/components/video/nodes/VideoProcessNode.tsx', 'ASSET_NODE_SIZE'],
      ['src/components/video/depthVideo/spawn.ts', 'ASSET_NODE_SIZE'],
      ['src/components/canvas/nodes/Director3DNode.tsx', 'IMAGE_BOX_NODE_SIZE'],
      ['src/components/image/nodes/PanoramaNode.tsx', 'IMAGE_BOX_NODE_SIZE'],
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
