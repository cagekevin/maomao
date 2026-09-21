// @vitest-environment jsdom
/**
 * 面板宽度「拖拽调宽」行为测试 —— `usePanelResize` 唯一实现 + 左侧面板「磁条」。
 *
 * 【被测能力】① 手柄按下后跟手改宽；② 越界被钳到区间；③ 松手后不再跟手（监听已卸载）。
 * 【为什么这么断（不是断实现细节）】全部走**真实 DOM 事件**（mousedown → document mousemove → mouseup），
 * 断言"产生了什么宽度"，不看内部变量。把 hook 的增量方向、clamp、或 mouseup 清理任一处改坏 → 立刻红。
 * 【零炸面】左面板子面板全部打桩（本测试只关心外壳的宽度行为）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, cleanup, screen } from '@testing-library/react';

vi.mock('../../src/components/task/TaskCenter.tsx', () => ({ default: () => null }));
vi.mock('../../src/components/generate/GeneratedView.tsx', () => ({ default: () => null }));
vi.mock('../../src/components/resource/ResourceLibrary.tsx', () => ({ default: () => null }));
vi.mock('../../src/components/prompt/PromptHub.tsx', () => ({ default: () => null }));
// store 属「会长大」类模块 ⇒ 从真模块派生（TD-17-15）
vi.mock('../../src/components/base/store/taskStore.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  usePanel: () => ({ expanded: true, activeTab: 'tasks', pinned: false }),
  useTaskBadge: () => ({ running: 0, failed: 0 }),
  setPanel: () => {},
  getPanel: () => ({ pinned: false }),
  togglePin: () => {},
}));

import { usePanelResize } from '../../src/hooks/usePanelResize.ts';
import LeftPanel from '../../src/components/base/panels/LeftPanel.tsx';

/** 最小载体：把 hook 挂到一个手柄 div 上，记录每次 onChange 的入参。 */
function Harness({ anchor, onWidth }: { anchor: 'left' | 'right'; onWidth: (w: number) => void }) {
  const { handleProps } = usePanelResize({
    width: 330,
    onChange: onWidth,
    anchor,
    min: 320,
    max: 900,
  });
  return <div data-testid="grip" {...handleProps} />;
}

beforeEach(() => cleanup());

describe('usePanelResize — 拖拽调宽原语', () => {
  it('anchor=right：往右拖变宽；越界钳到 max；松手后不再跟手', () => {
    const seen: number[] = [];
    render(<Harness anchor="right" onWidth={(w) => seen.push(w)} />);
    const grip = screen.getByTestId('grip');

    fireEvent.mouseDown(grip, { clientX: 340 });
    fireEvent.mouseMove(document, { clientX: 440 }); // +100 ⇒ 330 + 100
    expect(seen.at(-1)).toBe(430);

    fireEvent.mouseMove(document, { clientX: 3000 }); // 越界 ⇒ 钳到上限
    expect(seen.at(-1)).toBe(900);

    fireEvent.mouseUp(document);
    const after = seen.length;
    fireEvent.mouseMove(document, { clientX: 100 }); // 松手后：监听已卸载
    expect(seen.length).toBe(after);
  });

  it('anchor=left：往左拖变宽（方向相反，同一份原语）', () => {
    const seen: number[] = [];
    render(<Harness anchor="left" onWidth={(w) => seen.push(w)} />);

    fireEvent.mouseDown(screen.getByTestId('grip'), { clientX: 600 });
    fireEvent.mouseMove(document, { clientX: 500 }); // -100 ⇒ 330 + 100
    expect(seen.at(-1)).toBe(430);

    fireEvent.mouseMove(document, { clientX: 0 }); // 越界 ⇒ 钳到上限
    expect(seen.at(-1)).toBe(900);
    fireEvent.mouseUp(document);
  });
});

describe('LeftPanel — 右缘「磁条」', () => {
  it('拖右侧手柄 → 面板整体变宽（内联 width 跟随，默认仍是 330）', () => {
    render(<LeftPanel />);
    const grip = screen.getByTitle('拖动调整面板宽度');
    const panel = grip.parentElement as HTMLElement;
    expect(panel.style.width).toBe('330px');

    fireEvent.mouseDown(grip, { clientX: 340 });
    fireEvent.mouseMove(document, { clientX: 460 }); // +120
    expect(panel.style.width).toBe('450px');

    // 越界 ⇒ 钳到上限 900（区间归本面板所有）
    fireEvent.mouseMove(document, { clientX: 5000 });
    expect(panel.style.width).toBe('900px');
    fireEvent.mouseUp(document);
  });
});
