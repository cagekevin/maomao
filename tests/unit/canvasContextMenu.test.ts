/**
 * canvasContextMenu 三态右键菜单生成器单测。
 *
 * 覆盖（纯函数 → 输入 ctx/state → 断言 items 结构）：
 *  - buildCanvasMenuItems：默认四项（文本/图片/视频/剧本盒子）+ 上传；pinnedTools 固定后
 *    该项升入一级，且二级「仍保留」（图钉是取消固定唯一把手，禁止删二级固定项 —— 防回归）。
 *  - buildNodeMenuItems：imageNode/promptNode 有「复制图片」，group 有「取消编组」，普通节点无。
 *  - buildSelectionMenuItems：选中 <2 无「编组」，≥2 有「编组」+ 复制 + 删除。
 *  - menuForState：按 state.type 正确分发到三态 builder。
 */
import { describe, it, expect, vi } from 'vitest';
import type { Node } from '@xyflow/react';
import {
  buildCanvasMenuItems,
  buildNodeMenuItems,
  buildSelectionMenuItems,
  menuForState,
  type MenuActionCtx,
} from '../../src/components/base/canvas/canvasContextMenu.tsx';
import type { ContextMenuItem } from '../../src/components/base/ui/ContextMenu.tsx';

/** 构造最小合法 Node（honest：字段齐整，非 as 强转） */
function makeNode(type: string): Node {
  return { id: 'n', type, position: { x: 0, y: 0 }, data: {} };
}

/** 构造最小可用 ctx（未覆盖字段用 no-op 桩） */
function makeCtx(over: Partial<MenuActionCtx> = {}): MenuActionCtx {
  return {
    pinnedTools: [],
    addNodeFromMenu: vi.fn(),
    togglePinTool: vi.fn(),
    prefetchHeavyNode: vi.fn(),
    uploadRef: { current: null },
    nodeById: () => undefined,
    selectedCount: () => 0,
    duplicateSelected: vi.fn(),
    copyNodeImage: vi.fn(),
    deleteNode: vi.fn(),
    applyUngroup: vi.fn(),
    applyGroup: vi.fn(),
    applyDeleteSelected: vi.fn(),
    ...over,
  };
}

const labels = (items: Array<{ label?: string; type?: string }>): string[] =>
  items.filter((i) => i.label).map((i) => String(i.label));

/** 去掉 divider（无 key），返回可安全访问 key 的项，便于递归收集子层 key */
const keyed = (
  items: ContextMenuItem[],
): Array<{ key?: string; items?: Array<{ key?: string }> }> =>
  items.filter((i) => i.type !== 'divider') as Array<{
    key?: string;
    items?: Array<{ key?: string }>;
  }>;

describe('buildCanvasMenuItems（空白右键）', () => {
  it('默认渲染四项 + 上传（文本/图片/视频/剧本盒子）', () => {
    const items = buildCanvasMenuItems(makeCtx());
    const ls = labels(items);
    expect(ls).toContain('文本');
    expect(ls).toContain('图片');
    expect(ls).toContain('视频');
    expect(ls).toContain('剧本盒子');
    expect(ls).toContain('上传');
  });

  it('pinnedTools 固定节点升入一级（pinned-<type>），且二级仍保留（图钉取消把手，禁删）', () => {
    // imageBoxNode 不在默认一级（一级固定是文本/图片/视频/剧本盒子），适合验证「固定→升级 + 二级保留」。
    const items = buildCanvasMenuItems(makeCtx({ pinnedTools: ['imageBoxNode'] }));
    const keys = keyed(items).map((i) => i.key ?? '');
    // 一级出现 pinned-imageBoxNode
    expect(keys).toContain('pinned-imageBoxNode');
    // 「小工具」子菜单（items）里仍含 imageBoxNode（承载取消图钉）；
    // tools 下是分类块（tools-<cat>），节点在其内层 items —— 递归收集。
    const tools = keyed(items).find((i) => i.key === 'tools') as
      | { key?: string; items?: Array<{ key?: string; items?: Array<{ key?: string }> }> }
      | undefined;
    expect(tools).toBeTruthy();
    const allSubKeys = (tools?.items ?? []).flatMap((cat) => (cat.items ?? []).map((s) => s.key));
    expect(allSubKeys).toContain('imageBoxNode');
  });

  it('无 pinnedTools 时一级不出现 pinned- 项', () => {
    const keys = keyed(buildCanvasMenuItems(makeCtx())).map((i) => i.key ?? '');
    expect(keys.some((k) => k.startsWith('pinned-'))).toBe(false);
  });
});

describe('buildNodeMenuItems（单选节点右键）', () => {
  it('图片类节点（promptNode）有「复制图片」', () => {
    const items = buildNodeMenuItems(
      makeCtx({ nodeById: () => ({ type: 'promptNode' }) as never }),
      'node-id',
    );
    const ls = labels(items);
    expect(ls).toContain('复制');
    expect(ls).toContain('复制图片');
    expect(ls).toContain('删除');
  });

  it('imageNode 也有「复制图片」', () => {
    const ls = labels(
      buildNodeMenuItems(makeCtx({ nodeById: () => ({ type: 'imageNode' }) as never }), 'node-id'),
    );
    expect(ls).toContain('复制图片');
  });

  it('group 节点有「取消编组」，普通节点没有', () => {
    const groupLs = labels(
      buildNodeMenuItems(makeCtx({ nodeById: () => ({ type: 'group' }) as never }), 'node-id'),
    );
    expect(groupLs).toContain('取消编组');
    const plainLs = labels(
      buildNodeMenuItems(makeCtx({ nodeById: () => ({ type: 'textNode' }) as never }), 'node-id'),
    );
    expect(plainLs).not.toContain('复制图片');
    expect(plainLs).not.toContain('取消编组');
  });

  it('nodeById 查不到节点时返回空菜单', () => {
    expect(buildNodeMenuItems(makeCtx({ nodeById: () => undefined }), 'missing')).toEqual([]);
  });
});

describe('buildSelectionMenuItems（多选右键）', () => {
  it('选中 <2 无「编组」，但保留 复制/删除', () => {
    const items = buildSelectionMenuItems(makeCtx({ selectedCount: () => 1 }));
    const ls = labels(items);
    expect(ls).not.toContain('编组');
    expect(ls).toContain('复制');
    expect(ls).toContain('删除');
  });

  it('选中 ≥2 有「编组」', () => {
    const ls = labels(buildSelectionMenuItems(makeCtx({ selectedCount: () => 3 })));
    expect(ls).toContain('编组');
  });
});

describe('menuForState（分发）', () => {
  const base = makeCtx({ nodeById: () => makeNode('promptNode'), selectedCount: () => 2 });

  it('type=node → 单选菜单（复制图片）', () => {
    const ls = labels(menuForState({ x: 0, y: 0, type: 'node', nodeId: 'n1' }, base));
    expect(ls).toContain('复制图片');
  });

  it('type=selection → 多选菜单（编组）', () => {
    const ls = labels(menuForState({ x: 0, y: 0, type: 'selection' }, base));
    expect(ls).toContain('编组');
  });

  it('其他 type → 空白菜单（文本）', () => {
    const ls = labels(menuForState({ type: 'canvas', x: 0, y: 0 }, base));
    expect(ls).toContain('文本');
  });
});
