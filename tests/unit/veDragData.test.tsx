// @vitest-environment jsdom
/**
 * 回归锁：时间轴拖拽载荷判据的正确性。
 *
 * ════════════════════════════════════════════════════════════════
 * 契约（`engine/lib/drag-data.ts`）：
 *   · `hasDragData` **只回答「本次拖拽是否携带内部载荷」** —— 只看 `dataTransfer.types`。
 *   · 模块内**不存在**任何跨拖拽状态（原 `lastDragData` 已删）。
 * ════════════════════════════════════════════════════════════════
 * 本用例的原型是一次真实缺陷：内部拖拽的残留（`lastDragData !== null`）会让
 * `<MediaView>` 的外部文件拖入判定 `containsFiles = !hasDragData(...) && types.includes('Files')`
 * 恒为 false → `handleDrop` 静默 return → 外部文件一个都拖不进来。
 * 故此处**锁死「内部拖拽事件不得污染另一次外部拖拽」**这一不变量。
 */
import { describe, expect, it } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import {
  hasDragData,
  getDragData,
  setDragData,
} from '../../src/components/videoEditor/engine/lib/drag-data';
import { useFileUpload } from '../../src/components/videoEditor/hooks-cutia/use-file-upload';

/** 一次「外部文件拖入」：`dataTransfer.types` 只有 'Files'（不含内部 MIME）。 */
function externalFileDrag(fileName = 'b.png') {
  return {
    types: ['Files'],
    files: [new File(['x'], fileName, { type: 'image/png' })],
    getData: () => '',
  } as unknown as DataTransfer;
}

/** 一次「内部素材拖拽」：`dataTransfer` 自带内部 MIME + 载荷。 */
function internalMediaDrag() {
  const store = new Map<string, string>();
  return {
    types: ['application/x-timeline-drag', 'text/plain'],
    files: [],
    setData: (k: string, v: string) => store.set(k, v),
    getData: (k: string) => store.get(k) ?? '',
  } as unknown as DataTransfer;
}

function Harness({ onFiles }: { onFiles: (f: FileList) => void }) {
  const { dragProps } = useFileUpload({ multiple: true, onFilesSelected: onFiles });
  return <div data-testid="dropzone" {...dragProps} />;
}

describe('drag-data 契约', () => {
  it('hasDragData：内部拖拽 → true；外部文件拖拽 → false', () => {
    expect(hasDragData({ dataTransfer: internalMediaDrag() })).toBe(true);
    expect(hasDragData({ dataTransfer: externalFileDrag() })).toBe(false);
  });

  it('getDragData：能从 dataTransfer 读回本次载荷；非内部拖拽 → null', () => {
    const dt = internalMediaDrag();
    setDragData({
      dataTransfer: dt,
      dragData: { id: 'a1', type: 'media', mediaType: 'image', name: 'a.png' },
    });
    expect(getDragData({ dataTransfer: dt })).toEqual({
      id: 'a1',
      type: 'media',
      mediaType: 'image',
      name: 'a.png',
    });
    expect(getDragData({ dataTransfer: externalFileDrag() })).toBeNull();
  });

  it('getDragData：不回落 text/plain（外部拖入的 JSON 文本不得被当内部载荷）', () => {
    const dt = {
      types: ['text/plain'],
      getData: (k: string) =>
        k === 'text/plain'
          ? JSON.stringify({ id: 'x', type: 'media', mediaType: 'image', name: 'x.png' })
          : '',
    } as unknown as DataTransfer;
    expect(hasDragData({ dataTransfer: dt })).toBe(false);
    expect(getDragData({ dataTransfer: dt })).toBeNull();
  });

  it('★不变量：一次内部拖拽不得影响另一次外部文件拖入的判定', () => {
    // ① 用户把素材从面板拖到时间轴（写本次拖拽的 dataTransfer）
    setDragData({
      dataTransfer: internalMediaDrag(),
      dragData: {
        id: 'a1',
        type: 'media',
        mediaType: 'image',
        name: 'a.png',
      },
    });

    // ② 随后外部文件拖入面板 —— 必须仍然被识别为「外部文件」
    expect(hasDragData({ dataTransfer: externalFileDrag() })).toBe(false);
  });

  it('★回归：连续两次外部文件拖入，两次都送达（「导入第 2 个」不再失效）', () => {
    const seen: number[] = [];
    const { getByTestId } = render(<Harness onFiles={(f) => seen.push(f.length)} />);
    const zone = getByTestId('dropzone');

    // 中间插入一次内部拖拽（真实工作流：导完第一个就把它拖到时间轴）
    setDragData({
      dataTransfer: internalMediaDrag(),
      dragData: {
        id: 'a1',
        type: 'media',
        mediaType: 'image',
        name: 'a.png',
      },
    });

    fireEvent.drop(zone, { dataTransfer: externalFileDrag('b.png') });
    fireEvent.drop(zone, { dataTransfer: externalFileDrag('c.png') });

    expect(seen).toEqual([1, 1]);
  });
});
