// @vitest-environment jsdom
/**
 * Director3DNode 全景图显示优先级（TD-04-48 接上后的防回潮断言）。
 *
 * 背景：该节点的「输入全景图 URL」`useMemo` 长期**返回值无人接收**（写了等于没写），
 * 上游连线图片从未生效。TD-04-48 接上后，优先级 = **上游输入 > 已保存缩略图（data.assetUrl）**。
 * 本文件锁住三条：
 *  ① 有上游图片 ⇒ 预览用上游图片；
 *  ② 无上游 ⇒ 回退到已保存缩略图（**原有行为不得变**）；
 *  ③ 两者都无 ⇒ 显示占位（不渲染 img）。
 */
import 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { mocks } from './_nodeMocks.mjs';

vi.mock('@xyflow/react', () => mocks.xyflow);
vi.mock('../../src/components/canvas/parts/NodeShell.tsx', () => ({ default: mocks.NodeShell }));
vi.mock('../../src/hooks/useConnectedInputs.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useConnectedInputs: mocks.useConnectedInputs,
}));
vi.mock('../../src/hooks/useNodeRename.ts', () => ({ useNodeRename: () => () => {} }));
vi.mock('../../src/hooks/useNodeData.ts', () => ({ patchNodeDataById: () => {} }));
vi.mock('../../src/components/base/utils/media/assetUrl.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useRenderAssetResolver: () => (u: string) => u, // 直通，便于断言原始 URL
}));
vi.mock('../../src/components/canvas/structure/CanvasEdgesContext.tsx', () => ({
  useCanvasEdges: () => null,
}));
vi.mock('../../src/components/director3d/Director3DOverlay.tsx', () => ({
  Director3DOverlay: () => null,
}));
vi.mock('../../src/components/base/api/index.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  toAbsoluteFileUrl: mocks.toAbsoluteFileUrl,
  saveInlineToLocal: mocks.saveInlineToLocal,
  uploadFileToLocal: mocks.uploadFileToLocal,
}));
vi.mock('../../src/components/base/core/event/toastStore.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  toastWarning: () => {},
}));
vi.mock('../../src/components/base/core/log/logger.ts', () => ({
  logger: { warn: () => {}, error: () => {}, info: () => {}, debug: () => {} },
}));
vi.mock('../../src/components/canvas/structure/deriveNodes.ts', () => ({
  buildSpawnNodes: () => [],
  spawnAndCommit: () => {},
}));
vi.mock('../../src/components/base/core/idGen.ts', () => ({ generateId: () => 'test-id' }));

import Director3DNode from '../../src/components/canvas/nodes/Director3DNode.tsx';

beforeEach(() => {
  mocks.resetNodeMockState();
});

const setup = (data: Record<string, unknown> = {}) =>
  render(<Director3DNode id="d1" data={data} selected={false} />);

describe('Director3DNode — 全景图显示优先级（TD-04-48）', () => {
  it('有上游连线图片 ⇒ 预览用上游图片（上游优先）', () => {
    // 反证：把 displayUrl 改回 assetUrl（即回到"悬空 useMemo"的状态）⇒ 本断言红。
    mocks.setConnectedInputs({ images: [{ id: 'u1', url: '/files/upstream.png' }], texts: [] });
    const { container } = setup({ assetUrl: '/files/saved.png' });
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/files/upstream.png');
  });

  it('无上游 ⇒ 回退到已保存缩略图（原有行为不变）', () => {
    mocks.setConnectedInputs({ images: [], texts: [] });
    const { container } = setup({ assetUrl: '/files/saved.png' });
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/files/saved.png');
  });

  it('上游与已保存都没有 ⇒ 显示占位（不渲染 img）', () => {
    mocks.setConnectedInputs({ images: [], texts: [] });
    const { container } = setup({});
    expect(container.querySelector('img')).toBeNull();
  });
});
