/**
 * ResourceStrip 单测（docs/plan/151 §8.3 3-8）。
 *
 * 【为什么先补基础渲染再挂拖拽】该组件此前**零单测**（§11.6-5 实测确认），而第 3 步要在它上面
 * 加 DnD 交互 —— 在裸奔的组件上加交互等于没有回归网。故先锁「渲染 N 张 / onInsert 载荷 /
 * onDisconnect / readOnly 不渲染插入按钮」，再锁「onReorder 存在性决定是否挂 DnD」。
 *
 * 断言原则：只断**行为与载荷**，不断样式字符串（样式改动不该让测试红）。
 */
import 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// LazyImage 会走真实图片加载逻辑（jsdom 无 Image 实现），mock 成纯 div 只保留可断言的属性。
vi.mock('../../src/components/base/ui/display/LazyImage.tsx', () => ({
  default: ({ src, alt }: { src?: string; alt?: string }) => (
    <div data-testid="lazy" data-src={src} title={alt} />
  ),
}));

import ResourceStrip from '../../src/components/canvas/shell/ResourceStrip.tsx';

const IMAGES = [
  { id: 'img-1', label: '猫', url: '/files/a.png' },
  { id: 'img-2', label: '狗', url: '/files/b.png' },
];

describe('ResourceStrip — 基础渲染（3-8）', () => {
  it('渲染 N 张缩略图 + N 个 @插入按钮', () => {
    render(<ResourceStrip images={IMAGES} onInsert={() => {}} />);
    expect(screen.getAllByTestId('lazy')).toHaveLength(2);
    expect(screen.getByTitle('点击插入 @猫')).toBeTruthy();
    expect(screen.getByTitle('点击插入 @狗')).toBeTruthy();
  });

  it('无图无文本 → 渲染 null（不产生空容器）', () => {
    const { container } = render(<ResourceStrip images={[]} texts={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('onInsert 载荷 = { id, label, url, kind: "image" }（芯片所需完整信息）', () => {
    const onInsert = vi.fn();
    render(<ResourceStrip images={IMAGES} onInsert={onInsert} />);
    fireEvent.click(screen.getByTitle('点击插入 @猫'));
    expect(onInsert).toHaveBeenCalledWith({
      id: 'img-1',
      label: '猫',
      url: '/files/a.png',
      kind: 'image',
    });
  });

  it('无 id 的图 → onInsert 的 id 走 imageKeyOf 退化键（不是下标）', () => {
    const onInsert = vi.fn();
    render(<ResourceStrip images={[{ url: '/files/x.png', label: '无id' }]} onInsert={onInsert} />);
    fireEvent.click(screen.getByTitle('点击插入 @无id'));
    const payload = onInsert.mock.calls[0]?.[0] as { id?: string } | undefined;
    // 退化键形如 img_<hash>，绝不等于下标 'img-0'
    expect(payload?.id?.startsWith('img_')).toBe(true);
    expect(payload?.id).not.toBe('img-0');
  });

  it('带 sourceNodeId 的图 → 显示断开按钮，点击回调该 sourceNodeId', () => {
    const onDisconnect = vi.fn();
    render(
      <ResourceStrip
        images={[{ ...IMAGES[0], sourceNodeId: 'src-node-1' }]}
        onInsert={() => {}}
        onDisconnect={onDisconnect}
      />,
    );
    const btn = screen.getByTitle('断开连线');
    fireEvent.click(btn);
    expect(onDisconnect).toHaveBeenCalledWith('src-node-1');
  });

  it('无 sourceNodeId 的图（data.images 塞进来的）→ 不显示断开按钮', () => {
    render(<ResourceStrip images={[IMAGES[0] as (typeof IMAGES)[number]]} onInsert={() => {}} />);
    expect(screen.queryByTitle('断开连线')).toBeNull();
  });

  it('readOnly → 不渲染 @插入按钮（只展示缩略图）', () => {
    render(<ResourceStrip images={IMAGES} readOnly />);
    expect(screen.queryByTitle('点击插入 @猫')).toBeNull();
    expect(screen.getAllByTestId('lazy')).toHaveLength(2);
  });

  it('文本素材 → 胶囊标签，点击插入 kind:"text"', () => {
    const onInsert = vi.fn();
    render(
      <ResourceStrip images={[]} texts={[{ id: 't-1', label: '参考文本' }]} onInsert={onInsert} />,
    );
    fireEvent.click(screen.getByText(/参考文本/));
    expect(onInsert).toHaveBeenCalledWith({ id: 't-1', label: '参考文本', kind: 'text' });
  });
});

describe('ResourceStrip — 拖拽换序（3-3）', () => {
  it('未传 onReorder → 缩略图**不可拖**（其余 5 个调用点行为逐字不变）', () => {
    render(<ResourceStrip images={IMAGES} onInsert={() => {}} />);
    const cells = screen.getAllByTestId('lazy').map((el) => el.parentElement);
    for (const cell of cells) expect(cell?.getAttribute('draggable')).toBeNull();
  });

  it('传 onReorder → 挂 draggable，拖放回调 (from, to)', () => {
    const onReorder = vi.fn();
    render(<ResourceStrip images={IMAGES} onInsert={() => {}} onReorder={onReorder} />);
    const cells = screen.getAllByTestId('lazy').map((el) => el.parentElement);
    const first = cells[0];
    const second = cells[1];
    expect(first?.getAttribute('draggable')).toBe('true');
    expect(second?.getAttribute('draggable')).toBe('true');

    fireEvent.dragStart(first as Element, { dataTransfer: { effectAllowed: '', dropEffect: '' } });
    fireEvent.dragEnter(second as Element, { dataTransfer: { effectAllowed: '', dropEffect: '' } });
    fireEvent.drop(second as Element, { dataTransfer: { effectAllowed: '', dropEffect: '' } });
    expect(onReorder).toHaveBeenCalledWith(0, 1);
  });

  it('拖到自己身上（from === to）→ 不回调（无变化不写盘）', () => {
    const onReorder = vi.fn();
    render(<ResourceStrip images={IMAGES} onInsert={() => {}} onReorder={onReorder} />);
    const first = screen.getAllByTestId('lazy')[0]?.parentElement as Element;
    fireEvent.dragStart(first, { dataTransfer: { effectAllowed: '', dropEffect: '' } });
    fireEvent.drop(first, { dataTransfer: { effectAllowed: '', dropEffect: '' } });
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('readOnly + onReorder → 仍不挂拖拽（只读视图不可改顺序）', () => {
    render(<ResourceStrip images={IMAGES} readOnly onReorder={() => {}} />);
    const cells = screen.getAllByTestId('lazy').map((el) => el.parentElement);
    for (const cell of cells) expect(cell?.getAttribute('draggable')).toBeNull();
  });
});
