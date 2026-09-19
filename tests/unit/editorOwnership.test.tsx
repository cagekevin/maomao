// @vitest-environment jsdom
/**
 * 编辑器「归属判据」对账测试 —— **编辑器内的交互一律归编辑器**（ADR-0029 · 用户裁定 2026-09-18）。
 *
 * 【本文件钉住什么】一条判据、两个事件类，同一个不变式：**同一交互事件只允许一个所有者**。
 *  · **粘贴**（本文件 §一）：编辑区（contenteditable / INPUT / TEXTAREA）内 → A 闸（`useGlobalPaste`）
 *    不放行，且事件在编辑区内**不再冒泡到 window**（`PromptInput.handlePaste` 的 `stopPropagation`）；
 *    编辑区外（画布）→ 照常放行。
 *  · **键盘**（§二）：画布内组件的 window 键盘监听（唯一入口 `useCanvasKeydown`）在接管前必须问
 *    「事件发生在谁的地盘」，编辑区内一律让位；画布上照常。
 *
 * 【为什么两段同文件】同一条判据的测试应尽量同文件 —— 本仓 jsdom **每个测试文件各建一次环境**，
 * 拆两个文件 = 白付一次环境成本（2026-09-18 实测：拆开时环境开销翻倍）。
 *
 * 【改前的两个真 bug（本文件即其回归锚点）】
 *  1. A 闸对 contenteditable 内"按载荷放行"（图片 / 节点组 JSON 交给画布建节点），而编辑区自己也插文字
 *     ⇒ 输入框聚焦时粘贴"复制的节点"**既建节点又落文字**；
 *  2. `useCanvasKeydown` 无守卫 ⇒ 消费者自写，而 `VideoProcessNode` 那份漏了 contenteditable
 *     ⇒ 输入框里按 Delete/Backspace **既删文字又删视频片段**。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { useGlobalPaste } from '../../src/hooks/useAssetDropPaste.ts';
import { useCanvasKeydown } from '../../src/components/canvas/topology/canvasHotkeys.ts';
import PromptInput from '../../src/components/canvas/shell/PromptInput.tsx';

const GROUP_JSON = JSON.stringify({ type: 'mutiwindow-nodes', nodes: [] });

/** 最小剪贴板桩：被测代码只读 `items` 与 `getData('text/plain')`（jsdom 无 DataTransfer 实现）。 */
const clipboardStub = (opts: { text?: string; image?: boolean } = {}) => ({
  items: opts.image ? [{ kind: 'file', type: 'image/png' }] : [],
  getData: (t: string) => (t === 'text/plain' ? (opts.text ?? '') : ''),
});

/** 只挂 A 闸的宿主：画布区 + 编辑区（contenteditable）+ input / textarea。 */
function PasteHarness({ spy }: { spy: (e: ClipboardEvent) => void }) {
  useGlobalPaste(spy);
  return (
    <div>
      <div data-testid="canvas">画布</div>
      <input data-testid="input" />
      <textarea data-testid="textarea" />
      <div data-testid="editor" contentEditable suppressContentEditableWarning>
        <span data-testid="editor-inner">编辑区</span>
      </div>
    </div>
  );
}

/** 只挂画布键盘入口的宿主：同上一套目标。 */
function KeydownHarness({ spy }: { spy: (e: KeyboardEvent) => void }) {
  useCanvasKeydown(spy);
  return (
    <div>
      <div data-testid="canvas" tabIndex={-1}>
        画布
      </div>
      <input data-testid="input" />
      <textarea data-testid="textarea" />
      <div data-testid="editor" contentEditable suppressContentEditableWarning>
        <span data-testid="editor-inner">编辑区</span>
      </div>
    </div>
  );
}

beforeEach(() => cleanup());
afterEach(() => cleanup());

// ════════════════════════════════════════════════════════════════
// 一 · 粘贴：编辑器内的粘贴不归画布（TD-04-34）
// ════════════════════════════════════════════════════════════════
describe('粘贴归属：编辑器内的粘贴不归画布（TD-04-34）', () => {
  it('【先红锚点】A 闸：contenteditable 内粘贴「节点组 JSON」不放行（改前按载荷放行 → 红）', () => {
    const spy = vi.fn();
    const { getByTestId } = render(<PasteHarness spy={spy} />);

    fireEvent.paste(getByTestId('editor'), { clipboardData: clipboardStub({ text: GROUP_JSON }) });

    expect(spy).not.toHaveBeenCalled();
  });

  it('A 闸：contenteditable 内粘贴「图片」同样不放行（改前按载荷放行 → 红）', () => {
    const spy = vi.fn();
    const { getByTestId } = render(<PasteHarness spy={spy} />);

    fireEvent.paste(getByTestId('editor-inner'), { clipboardData: clipboardStub({ image: true }) });

    expect(spy).not.toHaveBeenCalled();
  });

  it('A 闸：input / textarea 内粘贴「节点组 JSON」同样不放行（787ca25 的按载荷放行已撤销 → 红）', () => {
    const spy = vi.fn();
    const { getByTestId } = render(<PasteHarness spy={spy} />);

    fireEvent.paste(getByTestId('input'), { clipboardData: clipboardStub({ text: GROUP_JSON }) });
    fireEvent.paste(getByTestId('textarea'), {
      clipboardData: clipboardStub({ text: GROUP_JSON }),
    });

    expect(spy).not.toHaveBeenCalled();
  });

  it('A 闸：编辑区外（画布）粘贴照常放行 —— 能力未受影响', () => {
    const spy = vi.fn();
    const { getByTestId } = render(<PasteHarness spy={spy} />);

    fireEvent.paste(getByTestId('canvas'), { clipboardData: clipboardStub({ text: GROUP_JSON }) });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('PromptInput：编辑区内粘贴在编辑器终结，**不再冒泡到 window**（画布监听收不到）', () => {
    const { container } = render(
      <PromptInput
        value=""
        onChange={() => {}}
        refImages={[]}
        refTexts={[]}
        placeholder="描述..."
        richText
      />,
    );
    const editor = container.querySelector('[contenteditable="true"]')!;
    expect(editor).toBeTruthy();

    const windowSpy = vi.fn();
    window.addEventListener('paste', windowSpy);
    try {
      fireEvent.paste(editor, { clipboardData: clipboardStub({ text: GROUP_JSON }) });
    } finally {
      window.removeEventListener('paste', windowSpy);
    }

    // 改前：handlePaste 只 preventDefault ⇒ 事件继续冒泡到 window（画布全局处理器收到）→ 红
    expect(windowSpy).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════
// 二 · 键盘：编辑器内的按键不归画布（同一条判据 · ADR-0029）
// ════════════════════════════════════════════════════════════════
describe('键盘归属：编辑器内的按键不归画布（ADR-0029）', () => {
  it('【先红锚点】contenteditable 内按 Delete 不让位给画布（改前无守卫 → 红）', () => {
    const spy = vi.fn();
    const { getByTestId } = render(<KeydownHarness spy={spy} />);

    fireEvent.keyDown(getByTestId('editor'), { key: 'Delete' });

    expect(spy).not.toHaveBeenCalled();
  });

  it('contenteditable 的子元素上按 Backspace 同样让位（事件目标可能是内部节点）', () => {
    const spy = vi.fn();
    const { getByTestId } = render(<KeydownHarness spy={spy} />);

    fireEvent.keyDown(getByTestId('editor-inner'), { key: 'Backspace' });

    expect(spy).not.toHaveBeenCalled();
  });

  it('input / textarea 内按 Delete 让位（旧的自写守卫已覆盖这两类，防回退）', () => {
    const spy = vi.fn();
    const { getByTestId } = render(<KeydownHarness spy={spy} />);

    fireEvent.keyDown(getByTestId('input'), { key: 'Delete' });
    fireEvent.keyDown(getByTestId('textarea'), { key: 'Delete' });

    expect(spy).not.toHaveBeenCalled();
  });

  it('画布上按 Delete 照常触发 —— 能力未受影响', () => {
    const spy = vi.fn();
    const { getByTestId } = render(<KeydownHarness spy={spy} />);

    fireEvent.keyDown(getByTestId('canvas'), { key: 'Delete' });

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
