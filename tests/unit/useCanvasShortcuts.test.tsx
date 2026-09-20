import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'react';
import { render, act } from '@testing-library/react';
import { useCanvasShortcuts } from '../../src/hooks/useCanvasShortcuts.ts';
import { useFullscreenEditorKeys } from '../../src/components/base/core/interaction/modalLayer.ts';

/**
 * 这些回归测试锁定 useCanvasShortcuts 的「守卫」行为，
 * 防止重构（如 TASK-047 去硬编码化）时误删：
 *   - 选中文本时跳过无修饰快速添加键（Q/W/E）
 *   - 选中文本时不影响带修饰的系统快捷键（Ctrl+Z 等）
 *   - 输入框内的按键一律跳过
 */

// 挂载 hook 的测试组件
function Harness({ handlers }: any) {
  useCanvasShortcuts(handlers);
  return null;
}

// 登记一个全屏模态层（模拟编辑器打开 → 画布应整体让位）
function ModalHarness({ enabled }: any) {
  useFullscreenEditorKeys({ enabled });
  return null;
}

function fireKeyDown(init: any) {
  const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  act(() => {
    window.dispatchEvent(e);
  });
  return e;
}

// jsdom 的 Selection 无法直接构造；hook 只调用 toString()，故用最小替身
function stubSelection(text: string): Selection {
  return { toString: () => text } as unknown as Selection;
}

// 可控的 window.getSelection（保留 vi.fn 以便被 restoreAllMocks 统一回收）
function setSelectionText(text: string) {
  window.getSelection = vi.fn(() => stubSelection(text));
}

beforeEach(() => {
  window.getSelection = vi.fn(() => stubSelection(''));
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useCanvasShortcuts 守卫（防回退）', () => {
  it('无选中文本时按 Q 应触发 onAdd(textGenerateNode)', () => {
    const onAdd = vi.fn();
    render(<Harness handlers={{ onAdd }} />);
    setSelectionText('');
    fireKeyDown({ key: 'q' });
    expect(onAdd).toHaveBeenCalledWith('textGenerateNode');
  });

  it('【回归点】选中文本时按 Q 不应触发 onAdd（守卫必须拦截）', () => {
    const onAdd = vi.fn();
    render(<Harness handlers={{ onAdd }} />);
    setSelectionText('hello');
    fireKeyDown({ key: 'q' });
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('【回归点】选中文本时按 W/E 同样不应触发快速添加', () => {
    const onAdd = vi.fn();
    render(<Harness handlers={{ onAdd }} />);
    setSelectionText('selected');
    fireKeyDown({ key: 'w' });
    fireKeyDown({ key: 'e' });
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('选中文本时 Ctrl+Z 仍应触发 onUndo（守卫只挡无修饰键）', () => {
    const onUndo = vi.fn();
    const onAdd = vi.fn();
    render(<Harness handlers={{ onUndo, onAdd }} />);
    setSelectionText('selected');
    fireKeyDown({ key: 'z', ctrlKey: true });
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('选中文本时 Ctrl+A 应被守卫跳过（不触发 onSelectAll）', () => {
    const onSelectAll = vi.fn();
    render(<Harness handlers={{ onSelectAll }} />);
    setSelectionText('selected');
    fireKeyDown({ key: 'a', ctrlKey: true });
    expect(onSelectAll).not.toHaveBeenCalled();
  });

  it('输入框内的无修饰 Q 不应触发 onAdd', () => {
    const onAdd = vi.fn();
    render(<Harness handlers={{ onAdd }} />);
    setSelectionText('');
    const input = document.createElement('input');
    document.body.appendChild(input);
    const e = new KeyboardEvent('keydown', { key: 'q', bubbles: true, cancelable: true });
    Object.defineProperty(e, 'target', { value: input });
    act(() => {
      window.dispatchEvent(e);
    });
    expect(onAdd).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('Ctrl+Z 撤销应触发 onUndo', () => {
    const onUndo = vi.fn();
    render(<Harness handlers={{ onUndo }} />);
    setSelectionText('');
    fireKeyDown({ key: 'z', ctrlKey: true });
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+G 编组应触发 onGroup（任意时刻，不因选中文本跳过）', () => {
    const onGroup = vi.fn();
    render(<Harness handlers={{ onGroup }} />);
    setSelectionText('selected');
    fireKeyDown({ key: 'g', ctrlKey: true });
    expect(onGroup).toHaveBeenCalledTimes(1);
  });

  it('【回归点】画布被压制（全屏层打开）时 Ctrl+Z 整体让位，关闭后恢复', () => {
    const onUndo = vi.fn();
    // 让位判据 = modalLayer.isCanvasSuppressed()（卡 9：激活位判据唯一真源）
    const { unmount } = render(
      <>
        <Harness handlers={{ onUndo }} />
        <ModalHarness enabled={true} />
      </>,
    );
    setSelectionText('');
    fireKeyDown({ key: 'z', ctrlKey: true });
    expect(onUndo).not.toHaveBeenCalled();

    // 关闭全屏层 → 快捷键恢复（行为逐条保持）
    unmount();
    render(<Harness handlers={{ onUndo }} />);
    fireKeyDown({ key: 'z', ctrlKey: true });
    expect(onUndo).toHaveBeenCalledTimes(1);
  });
});

describe('useCanvasShortcuts — 订阅生命周期不随回调身份变化（TD-04-43）', () => {
  it('回调身份每次渲染都变时，不触发「解绑 + 重绑」window keydown', () => {
    // 契约：快捷键订阅的生命周期**不该由"回调身份"决定** —— 回调一律走 ref 读最新。
    // 反证：把 effect deps 改回那 9 个回调（旧实现）⇒ 每次 rerender 都会 remove+add ⇒ 本断言红。
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const keydownAdds = () => add.mock.calls.filter((c) => c[0] === 'keydown').length;
    const keydownRemoves = () => remove.mock.calls.filter((c) => c[0] === 'keydown').length;

    const { rerender } = render(<Harness handlers={{ onAdd: () => {} }} />);
    const addsAfterMount = keydownAdds();
    const removesAfterMount = keydownRemoves();

    rerender(<Harness handlers={{ onAdd: () => {} }} />); // 新函数身份
    rerender(<Harness handlers={{ onAdd: () => {} }} />);

    expect(keydownAdds()).toBe(addsAfterMount);
    expect(keydownRemoves()).toBe(removesAfterMount);
  });

  it('回调身份变化后，按键仍调用**最新**的那一个（语义等价，不能读旧闭包）', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Harness handlers={{ onUndo: first }} />);
    rerender(<Harness handlers={{ onUndo: second }} />);
    fireKeyDown({ key: 'z', ctrlKey: true });
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });
});
