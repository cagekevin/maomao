/**
 * 入轨的**回归测试** —— 缺陷：在画布上点选**一次**素材节点，轨上出现**两条**。
 *
 * ── 缺陷根因（复现的关键，别删这段）──
 * 「哪些是新选中的」曾经由**两个真源**判断：
 *   · `selectedSig`：`useStore` 在**渲染期**求值的快照；
 *   · `flow.getNodes()`：effect 里的**实时**读。
 * 两者在一次提交内可以不一致（快照落后于 store）。又因为 effect 的依赖里有 `enqueue`，
 * 而它依赖每次渲染都新建的 `store` 对象 ⇒ **effect 每次渲染都跑**，于是
 * 「上次没处理过 n1」成立了两次 → **同一次点选入轨两遍**。
 *
 * 本测试就按这个时序构造：第 1 次提交让**快照为空**而 `getNodes()` 已看到选中，
 * 第 2 次提交快照才追上 —— 正是真机上发生的事。
 *
 * 修法（`docs/120` C11.4「点选一次 = 入轨一次」）：**只有一个真源**（签名之间的差），
 * 节点详情只按签名里声明过的 id 去取用。
 */
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  /** `useStore` 看到的 nodes（模拟「渲染期快照」——可以被故意留后一帧）。 */
  snapshotNodes: [] as CanvasNode[],
  /** `flow.getNodes()` 看到的 nodes（模拟——实时）。 */
  liveNodes: [] as CanvasNode[],
  applyTracks: vi.fn<(fn: (tracks: unknown[]) => unknown[]) => void>(),
  showToast: vi.fn(),
}));

/**
 * 画布节点夹具：用**真实的** `data` 形态（`nodeMedia.getNodeMedia` 认 `assetType` + `assetUrl`）——
 * 选中派生与签名解析都走真实现，只有「画布 store」本身被打桩（那是 React Flow 的活）。
 */
interface CanvasNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  selected?: boolean;
}

function assetNode(id: string, selected: boolean): CanvasNode {
  return {
    id,
    type: 'assetNode',
    position: { x: 0, y: 0 },
    data: { assetType: 'video', assetUrl: `u-${id}`, label: `素材${id}` },
    selected,
  };
}

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({
    getNodes: () => h.liveNodes,
    setNodes: () => undefined,
    getEdges: () => [],
    setEdges: () => undefined,
    screenToFlowPosition: (p: unknown) => p,
  }),
  useStore: (selector: (s: { nodes: unknown[] }) => unknown) =>
    selector({ nodes: h.snapshotNodes }),
}));

vi.mock('../../../src/components/base/canvas/deriveNodes.ts', () => ({
  spawnAndCommit: () => [],
}));

vi.mock('../../../src/components/base/canvas/CanvasEdgesContext.tsx', () => ({
  useCanvasEdges: () => null,
}));

vi.mock('../../../src/components/base/utils/videoEngine.ts', () => ({
  uploadResult: async () => ({ url: 'uploaded' }),
}));

vi.mock('../../../src/components/base/core/toastStore.ts', () => ({
  showToast: h.showToast,
}));

vi.mock('../../../src/components/videoEditor/hooks/useEditorSources.ts', () => ({
  useEditorSources: () => ({ byClipId: new Map(), ready: true }),
  loadEditorSource: async () => ({
    blob: null,
    source: { resolved: { status: 'ok', url: 'u' }, duration: 5, profile: undefined },
  }),
  readSourceBlob: async () => new Blob(),
}));

const PROJECT = {
  schemaVersion: 1,
  fps: 30,
  playhead: 0,
  tracks: [
    {
      id: 'v1',
      name: '视频',
      kind: 'video',
      overlay: false,
      locked: false,
      hidden: false,
      muted: false,
      clips: [],
    },
  ],
  settings: { width: 1280, height: 720 },
  ui: { dockHeight: 280 },
};

// 关键：每次调用返回**新对象**（与真实的 `useEditorProject` 一致）——
// 正是它让 `enqueue` 每次渲染换身份、effect 每次渲染都跑。
vi.mock('../../../src/components/videoEditor/panels/dock/useEditorProject.ts', () => ({
  useEditorProject: () => ({
    status: 'ready' as const,
    project: PROJECT,
    reason: undefined,
    conflict: false,
    canUndo: false,
    canRedo: false,
    applyTracks: h.applyTracks,
    applyProjectPatch: () => undefined,
    undo: () => undefined,
    redo: () => undefined,
    reload: () => undefined,
  }),
}));

import VideoEditorDock from '../../../src/components/videoEditor/panels/dock/VideoEditorDock.tsx';

beforeEach(() => {
  h.snapshotNodes = [];
  h.liveNodes = [];
  h.applyTracks.mockReset();
  h.showToast.mockReset();
});

describe('C11.4 点选一次 = 入轨一次', () => {
  it('渲染快照落后于 store 时也不得重复入轨（点一次只出一条）', async () => {
    const view = render(<VideoEditorDock open projectId="p1" onClose={() => undefined} />);

    // 第 1 次提交：store 里节点已是选中态，但 `useStore` 的快照还空着（真机上的落后一帧）
    h.liveNodes = [assetNode('n1', true)];
    view.rerender(<VideoEditorDock open projectId="p1" onClose={() => undefined} />);

    // 第 2 次提交：快照追上
    h.snapshotNodes = [assetNode('n1', true)];
    h.liveNodes = [assetNode('n1', true)];
    view.rerender(<VideoEditorDock open projectId="p1" onClose={() => undefined} />);

    await waitFor(() => expect(h.applyTracks).toHaveBeenCalled());
    // 给「多余的第二次」留出足够时间暴露（若被重复入轨，这里会变 2）
    await new Promise((r) => setTimeout(r, 30));

    expect(h.applyTracks).toHaveBeenCalledTimes(1);

    // 只加了一条片段（不是两条）
    const updater = h.applyTracks.mock.calls[0][0] as (t: unknown[]) => unknown[];
    const next = updater([
      {
        id: 'v1',
        name: '视频',
        kind: 'video',
        overlay: false,
        locked: false,
        hidden: false,
        muted: false,
        clips: [],
      },
    ]);
    const tracks = next as { clips: { nodeId?: string; kind: string }[] }[];
    expect(tracks[0].clips).toHaveLength(1);
    expect(tracks[0].clips[0].nodeId).toBe('n1');
  });

  it('取消选中后再点它 = 再得一条（C11.4 的另一半：「同一素材用两次」）', async () => {
    const view = render(<VideoEditorDock open projectId="p1" onClose={() => undefined} />);

    h.snapshotNodes = [assetNode('n1', true)];
    h.liveNodes = [assetNode('n1', true)];
    view.rerender(<VideoEditorDock open projectId="p1" onClose={() => undefined} />);
    await waitFor(() => expect(h.applyTracks).toHaveBeenCalledTimes(1));

    // 取消选中
    h.snapshotNodes = [];
    h.liveNodes = [assetNode('n1', false)];
    view.rerender(<VideoEditorDock open projectId="p1" onClose={() => undefined} />);
    await new Promise((r) => setTimeout(r, 10));

    // 再点它
    h.snapshotNodes = [assetNode('n1', true)];
    h.liveNodes = [assetNode('n1', true)];
    view.rerender(<VideoEditorDock open projectId="p1" onClose={() => undefined} />);
    await waitFor(() => expect(h.applyTracks).toHaveBeenCalledTimes(2));
  });

  it('折叠态点选不产生任何动作（C11.5 激活门）', async () => {
    const view = render(<VideoEditorDock open={false} projectId="p1" onClose={() => undefined} />);
    h.snapshotNodes = [assetNode('n1', true)];
    h.liveNodes = [assetNode('n1', true)];
    view.rerender(<VideoEditorDock open={false} projectId="p1" onClose={() => undefined} />);
    await new Promise((r) => setTimeout(r, 30));
    expect(h.applyTracks).not.toHaveBeenCalled();
  });
});
