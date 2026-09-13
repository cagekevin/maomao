// @vitest-environment jsdom
/**
 * 下拉窄原语（TD-19-1）：`DropdownPanel` 的定位开关 + `DropdownRow` 的点选协议。
 *
 * 【为什么补测试】抽取前 `Select`/`ModelSelect` **均无专属测试**；抽取里唯一带**逻辑**的部分
 * 就是「上弹/下弹」三元与「按下即选（onMouseDown + preventDefault）」→ 钉住这两点，
 * 其余 chrome 是纯类名（已逐字搬迁，见抽取提交）。
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DropdownPanel from '../../src/components/base/ui/DropdownPanel.tsx';
import DropdownRow from '../../src/components/base/ui/DropdownRow.tsx';

/** 取面板节点（面板无 role/testid，故用测试内子节点的父节点） */
function panelOf(text: string): HTMLElement {
  const child = screen.getByText(text);
  return child.parentElement as HTMLElement;
}

describe('DropdownPanel（面板定位 + chrome 单一真源）', () => {
  it('popupTo=down（默认）→ top-full；popupTo=up → bottom-full', () => {
    const { rerender } = render(
      <DropdownPanel widthClass="w-40">
        <span>内容</span>
      </DropdownPanel>,
    );
    expect(panelOf('内容').className).toContain('top-full');

    rerender(
      <DropdownPanel popupTo="up" widthClass="w-40">
        <span>内容</span>
      </DropdownPanel>,
    );
    expect(panelOf('内容').className).toContain('bottom-full');
  });

  it('宽度令牌来自 prop，其余 chrome 由原语固定（不外提）', () => {
    render(
      <DropdownPanel widthClass="min-w-[17rem] w-max max-w-[29rem]">
        <span>X</span>
      </DropdownPanel>,
    );
    const cls = panelOf('X').className;
    expect(cls).toContain('min-w-[17rem]');
    expect(cls).toContain('bg-surface-1');
    expect(cls).toContain('nowheel nopan nodrag');
  });
});

describe('DropdownRow（行 chrome + 点选协议单一真源）', () => {
  it('选中态决定高亮类；onMouseDown 即触发 onSelect', () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      <DropdownRow selected onSelect={onSelect}>
        行
      </DropdownRow>,
    );
    const row = screen.getByRole('button');
    expect(row.className).toContain('bg-surface-hover-strong text-white');
    fireEvent.mouseDown(row);
    expect(onSelect).toHaveBeenCalledTimes(1);

    rerender(
      <DropdownRow selected={false} onSelect={onSelect}>
        行
      </DropdownRow>,
    );
    expect(screen.getByRole('button').className).toContain('hover:bg-surface-hover');
  });
});
