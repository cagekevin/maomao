/**
 * 【TD-04-46】App 每帧路径上的**常驻面板**必须 `memo`，且 memo 结构上有效。
 *
 * 背景：App 持 `useNodesState` 的 nodes（`App.tsx:244`）⇒ 拖拽每帧 `setNodes` ⇒ App 每帧重渲
 * ⇒ **未 memo 的直接子组件每帧陪跑**。`LeftPanel` 与 `AgentPanel` 是 App 里仅有的两块
 * 「常驻挂载 + 此前未 memo」的面板（其余常驻件 TopNav / CanvasToolbar / ContextMenu /
 * ToastContainer / ConfirmContainer 均已 memo）。
 *
 * 【为什么用行为断言，而不是查源码文本或断言 `$$typeof`】判据是"宿主重渲时它到底重不重渲"——
 * 所以把面板放进一个**会重渲的宿主**里，数它子树的渲染次数：memo 生效则恒为 1。
 * 反证（探针）：去掉 `memo(LeftPanel)` ⇒ 计数变 2 ⇒ 本断言红。
 * （`AgentPanel` 的同款断言挂在 `AgentPanel.test.tsx`，复用那边已有的重型 mock 设施。）
 */
import 'react';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

// 子面板计数桩：LeftPanel 按 activeTab 只渲染其中一个（下方固定为 'tasks'）
const hits = vi.hoisted(() => ({ taskCenter: 0 }));
vi.mock('../../src/components/task/TaskCenter.tsx', () => ({
  default: () => {
    hits.taskCenter++;
    return null;
  },
}));
vi.mock('../../src/components/generate/GeneratedView.tsx', () => ({ default: () => null }));
vi.mock('../../src/components/resource/ResourceLibrary.tsx', () => ({ default: () => null }));
vi.mock('../../src/components/prompt/PromptHub.tsx', () => ({ default: () => null }));
// store 属「会长大」类模块 ⇒ 必须从真模块派生（TD-17-15，判据见 mockPartialSpread.test.ts）
vi.mock('../../src/components/base/store/taskStore.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  usePanel: () => ({ expanded: true, activeTab: 'tasks', pinned: false }),
  useTaskBadge: () => ({ running: 0, failed: 0 }),
  setPanel: () => {},
  getPanel: () => ({ pinned: false }),
  togglePin: () => {},
}));

import LeftPanel from '../../src/components/base/panels/LeftPanel.tsx';

/** 会重渲的宿主：模拟「App 因拖拽每帧重渲」——面板元素每帧都是新的，但 props 恒为 `{}`。 */
function Host() {
  const [, force] = React.useState(0);
  return (
    <>
      <button data-testid="bump" onClick={() => force((n) => n + 1)}>
        bump
      </button>
      <LeftPanel />
    </>
  );
}

describe('LeftPanel · memo 结构有效性（TD-04-46）', () => {
  it('宿主重渲时面板与其子树**不**重渲（零 prop ⇒ 浅比较恒相等）', () => {
    const { getByTestId } = render(<Host />);
    expect(hits.taskCenter, '首次渲染应渲染一次当前 tab 的子面板').toBe(1);

    fireEvent.click(getByTestId('bump'));
    expect(hits.taskCenter, '宿主重渲后又渲了一次子面板 ⇒ LeftPanel 未 memo（拖拽每帧陪跑）').toBe(
      1,
    );

    fireEvent.click(getByTestId('bump'));
    expect(hits.taskCenter, '宿主重渲后又渲了一次子面板 ⇒ LeftPanel 未 memo（拖拽每帧陪跑）').toBe(
      1,
    );
  });
});
