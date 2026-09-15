// @vitest-environment jsdom
/**
 * 行为锁：自研弹层原语（docs/135 §六「每个弹层原语至少 1 条」）。
 *
 * 【为什么必须锁】自研弹层最容易被"简化"掉的三件事，恰好是用户体验的三条底线：
 *   · Escape 关不掉（用户被困在层里）；
 *   · 点外面关不掉（层挡住整个编辑器）；
 *   · 关闭后焦点蒸发（键盘用户回不到触发器）。
 * 这三条都不是"代码写没写"，而是**行为**——所以这里用 testing-library 点/按键，
 * 断言 DOM 结果，而不是断言源码里出现了什么词。
 *
 * 【jsdom 测不了什么（诚实边界）】布局与手势栈在 jsdom 里不成立：
 *   `getBoundingClientRect()` 恒为 0、没有合成层、没有浏览器手势栈。
 *   所以"定位准不准 / 拖动面板后是否归位 / 命令式动作（`input.click()`）会不会被吞"
 *   一律**不在这里断言**（那是假覆盖）—— 它们进轮次文件的手工实测清单。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../src/components/videoEditor/ui/ui/popover.tsx';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../src/components/videoEditor/ui/ui/tooltip.tsx';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '../../src/components/videoEditor/ui/ui/context-menu.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../src/components/videoEditor/ui/ui/dropdown-menu.tsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../src/components/videoEditor/ui/ui/select.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from '../../src/components/videoEditor/ui/ui/dialog.tsx';

function renderPopover() {
  return render(
    <Popover>
      <PopoverTrigger asChild>
        <button type="button">打开</button>
      </PopoverTrigger>
      <PopoverContent>层内容</PopoverContent>
    </Popover>,
  );
}

describe('Popover（自研）', () => {
  it('点触发器开 / 再点关（切换，不是只开不关）', () => {
    renderPopover();
    const trigger = screen.getByRole('button', { name: '打开' });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(trigger);
    expect(screen.getByRole('dialog').textContent).toContain('层内容');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(trigger);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Escape 关闭，且焦点归还触发器', () => {
    renderPopover();
    const trigger = screen.getByRole('button', { name: '打开' });

    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('点层外的元素关闭，且不把焦点抢回触发器', () => {
    render(
      <div>
        <button type="button">外面</button>
        <Popover>
          <PopoverTrigger asChild>
            <button type="button">打开</button>
          </PopoverTrigger>
          <PopoverContent>层内容</PopoverContent>
        </Popover>
      </div>,
    );

    fireEvent.click(screen.getByRole('button', { name: '打开' }));
    expect(screen.getByRole('dialog')).toBeTruthy();

    const outside = screen.getByRole('button', { name: '外面' });
    fireEvent.pointerDown(outside);
    outside.focus();

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(outside);
  });

  it('点层内不关闭（层内是用户的操作面，不是"外面"）', () => {
    renderPopover();
    fireEvent.click(screen.getByRole('button', { name: '打开' }));

    fireEvent.pointerDown(screen.getByRole('dialog'));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('层渲染进层根（编辑器内是 #ve-layer-root；无层根时回落 document.body）', () => {
    const root = document.createElement('div');
    root.id = 've-layer-root';
    document.body.appendChild(root);

    try {
      renderPopover();
      fireEvent.click(screen.getByRole('button', { name: '打开' }));
      expect(root.contains(screen.getByRole('dialog'))).toBe(true);
    } finally {
      root.remove();
    }
  });
});

afterEach(() => {
  vi.useRealTimers();
});

function renderTooltip(delayDuration: number) {
  return render(
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button">悬停我</button>
        </TooltipTrigger>
        <TooltipContent>提示内容</TooltipContent>
      </Tooltip>
    </TooltipProvider>,
  );
}

describe('Tooltip（自研）', () => {
  it('悬停要等 delayDuration 才显示（扫过不该弹）；离开即关闭', () => {
    vi.useFakeTimers();
    renderTooltip(300);
    const trigger = screen.getByRole('button', { name: '悬停我' });

    fireEvent.pointerEnter(trigger);
    expect(screen.queryByRole('tooltip')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.getByRole('tooltip').textContent).toContain('提示内容');
    expect(trigger.getAttribute('aria-describedby')).toBeTruthy();

    fireEvent.pointerLeave(trigger);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('延迟未到就离开 → 不能弹出（定时器必须被取消）', () => {
    vi.useFakeTimers();
    renderTooltip(300);
    const trigger = screen.getByRole('button', { name: '悬停我' });

    fireEvent.pointerEnter(trigger);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    fireEvent.pointerLeave(trigger);
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('键盘聚焦也显示（键盘用户不能只有鼠标才有提示）', () => {
    vi.useFakeTimers();
    renderTooltip(0);
    const trigger = screen.getByRole('button', { name: '悬停我' });

    fireEvent.focus(trigger);
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(screen.getByRole('tooltip')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('气泡本体不吃指针事件（否则"悬停有提示、点不动按钮"）', () => {
    vi.useFakeTimers();
    renderTooltip(0);
    fireEvent.focus(screen.getByRole('button', { name: '悬停我' }));
    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(screen.getByRole('tooltip').className).toContain('pointer-events-none');
  });
});

describe('DropdownMenu（自研 · 与 ContextMenu 共用同一份列表内核）', () => {
  function renderMenu(onSelect: () => void) {
    return render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button">菜单</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={onSelect}>第一项</DropdownMenuItem>
          <DropdownMenuItem disabled>第二项（禁用）</DropdownMenuItem>
          <DropdownMenuItem>第三项</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
  }

  it('按下触发器展开；点条目触发回调并收起', () => {
    const onSelect = vi.fn();
    renderMenu(onSelect);
    const trigger = screen.getByRole('button', { name: '菜单' });

    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.pointerDown(trigger, { button: 0 });
    expect(screen.getByRole('menu')).toBeTruthy();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(screen.getByText('第一项'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('键盘：↓ 高亮第一项 → Enter 激活（禁用项要被跳过）', () => {
    const onSelect = vi.fn();
    renderMenu(onSelect);

    fireEvent.keyDown(screen.getByRole('button', { name: '菜单' }), { key: 'ArrowDown' });
    const menu = screen.getByRole('menu');

    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(screen.getByText('第一项').getAttribute('data-highlighted')).not.toBeNull();

    /* 再按一次应落到**第三项**（第二项禁用，不可成为高亮目标）。 */
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(screen.getByText('第三项').getAttribute('data-highlighted')).not.toBeNull();

    fireEvent.keyDown(menu, { key: 'Enter' });
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('Escape 收起整棵', () => {
    renderMenu(vi.fn());
    fireEvent.pointerDown(screen.getByRole('button', { name: '菜单' }), { button: 0 });
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('点击菜单外收起', () => {
    renderMenu(vi.fn());
    fireEvent.pointerDown(screen.getByRole('button', { name: '菜单' }), { button: 0 });
    expect(screen.getByRole('menu')).toBeTruthy();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('ContextMenu（自研 · 右键坐标作锚点）', () => {
  it('右键展开（锚点是鼠标点），点条目收起', () => {
    render(
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div data-testid="area">区域</div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>剪切</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>,
    );

    const area = screen.getByTestId('area');
    expect(area.getAttribute('data-open')).toBeNull();

    fireEvent.contextMenu(area, { clientX: 40, clientY: 60 });
    expect(screen.getByRole('menu')).toBeTruthy();
    expect(area.getAttribute('data-open')).toBe('true');

    fireEvent.click(screen.getByText('剪切'));
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('Select（自研）', () => {
  function renderSelect(onValueChange: (value: string) => void) {
    return render(
      <Select value="b" onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue placeholder="请选择" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">甲</SelectItem>
          <SelectItem value="b">乙</SelectItem>
          <SelectItem value="c">丙</SelectItem>
        </SelectContent>
      </Select>,
    );
  }

  it('关闭时也显示当前值的文本（不是占位符）', () => {
    renderSelect(vi.fn());
    expect(screen.getByRole('combobox').textContent).toContain('乙');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('展开后点选项 → 回调 + 收起 + 焦点回到触发器', () => {
    const onValueChange = vi.fn();
    renderSelect(onValueChange);
    const trigger = screen.getByRole('combobox');

    fireEvent.click(trigger);
    const listbox = screen.getByRole('listbox');
    expect(listbox.querySelectorAll('[role="option"]').length).toBe(3);

    fireEvent.click(screen.getByText('丙'));
    expect(onValueChange).toHaveBeenCalledWith('c');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('键盘：↓ 定位到当前值 → Enter 选中', () => {
    const onValueChange = vi.fn();
    renderSelect(onValueChange);

    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' });
    const listbox = screen.getByRole('listbox');

    /* 展开即定位到**当前值**（乙），而不是从头开始。 */
    const options = listbox.querySelectorAll('[role="option"]');
    expect(options[1]?.getAttribute('data-highlighted')).not.toBeNull();

    fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    fireEvent.keyDown(listbox, { key: 'Enter' });
    expect(onValueChange).toHaveBeenCalledWith('c');
  });
});

describe('Dialog（自研）', () => {
  function renderDialog() {
    return render(
      <Dialog>
        <DialogTrigger asChild>
          <button type="button">打开对话框</button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>标题在此</DialogTitle>
          <DialogDescription>说明在此</DialogDescription>
          <DialogFooter>
            <button type="button">取消</button>
            <button type="button">确认</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );
  }

  it('触发器展开；标题/说明通过 aria 关联（读屏靠这条链）', () => {
    renderDialog();
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '打开对话框' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');

    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)?.textContent).toBe('标题在此');

    const describedBy = dialog.getAttribute('aria-describedby');
    expect(document.getElementById(describedBy!)?.textContent).toBe('说明在此');
  });

  it('打开即把焦点收进对话框（模态的可访问性底线）', () => {
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: '打开对话框' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('焦点陷阱：末尾按 Tab 折回第一个可聚焦元素，不逃到背后的界面', () => {
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: '打开对话框' }));
    const dialog = screen.getByRole('dialog');

    const focusables = dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled])',
    );
    const last = focusables[focusables.length - 1]!;
    const first = focusables[0]!;
    last.focus();

    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
  });

  it('Escape 关闭；点遮罩关闭', () => {
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: '打开对话框' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '打开对话框' }));
    const dialog = screen.getByRole('dialog');
    /* 遮罩是对话框的**前一个兄弟节点**（同一层根里先画遮罩、再画内容）。 */
    const overlay = dialog.previousElementSibling as HTMLElement;
    expect(overlay).toBeTruthy();
    fireEvent.pointerDown(overlay);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
