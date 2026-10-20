/**
 * React 合成事件替身（`onPaste` / `onDrop` / `onDragStart` / 右键菜单等）。
 *
 * 【为什么这里允许"一次双转"】React 的 `SyntheticEvent` 只能由 React 自己派发，
 * 测试里无法 `new` 出来；而被测 hook 通常只读少数成员（`clipboardData.items` /
 * `dataTransfer` / `clientX,clientY` / `preventDefault`）。这是**能力缺口**：
 * 替身不是完整的 `React.ClipboardEvent`（缺 `nativeEvent` / `persist` / `isDefaultPrevented` …），
 * 单步互转在类型上不成立。
 *
 * 【与旧写法的区别】此前每个测试文件各写一次 `{…} as unknown as React.XxxEvent`
 * （20+ 处，形状还各不相同、改一处漏一处）。现在统一到本文件，调用点只描述"我要控什么"。
 * 与 `tests/helpers/dom.ts` 同属「jsdom / React 能力缺口」这一类例外（plan 150 §11.1 簇 B/D）。
 */
import { vi } from 'vitest';
import type {
  ClipboardEvent as ReactClipboardEvent,
  DragEvent as ReactDragEvent,
  MouseEvent as ReactMouseEvent,
} from 'react';

/** 事件替身里被测真正读到的公共成员（缺省给安全实现）。 */
export interface FakeEventInit {
  target?: EventTarget | null;
  preventDefault?: () => void;
  stopPropagation?: () => void;
}

function base(init: FakeEventInit) {
  return {
    target: init.target ?? document.createElement('div'),
    // 缺省即 spy：测试几乎都要断言 preventDefault/stopPropagation 是否被调用
    preventDefault: init.preventDefault ?? vi.fn(),
    stopPropagation: init.stopPropagation ?? vi.fn(),
    defaultPrevented: false,
  };
}

/**
 * 粘贴事件替身。`clipboardData` 可给**部分形状**（只含 `items` / `files` / `getData` …），
 * 因为被测代码只会访问它真正需要的字段。
 */
export function fakeClipboardEvent(
  init: FakeEventInit & { clipboardData?: unknown } = {},
): ReactClipboardEvent {
  return {
    ...base(init),
    clipboardData: init.clipboardData ?? {},
  } as unknown as ReactClipboardEvent;
}

/** 拖拽事件替身（`dataTransfer` 同样可给部分形状）。 */
export function fakeDragEvent(
  init: FakeEventInit & { dataTransfer?: unknown; clientX?: number; clientY?: number } = {},
): ReactDragEvent {
  return {
    ...base(init),
    dataTransfer: init.dataTransfer ?? {},
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
  } as unknown as ReactDragEvent;
}

/** 鼠标事件替身（右键菜单 / 点击）。 */
export function fakeMouseEvent(
  init: FakeEventInit & { clientX?: number; clientY?: number; shiftKey?: boolean } = {},
): ReactMouseEvent {
  return {
    ...base(init),
    clientX: init.clientX ?? 5,
    clientY: init.clientY ?? 6,
    shiftKey: init.shiftKey ?? false,
  } as unknown as ReactMouseEvent;
}
