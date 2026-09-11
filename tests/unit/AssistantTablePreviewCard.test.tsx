/**
 * AssistantTablePreviewCard —— F6 防回潮测试（TD-11-11 F6）。
 *
 * 【守护的债】原卡片接口 `rows: Array<Record<label,string>>` 以列 label 为 key，
 * 当「两列同名」时后者覆盖前者 → 静默丢值（用户看到少一列、值被吞）。
 * 本轮（2026-09-11）把卡片接口改为位置式 `rows: string[][]`（与 columns 等长对齐），
 * 渲染按列序索引 `r[ci]`，从根上消除同名列折叠。
 *
 * 【本测试断言】两列同名、同行两格取不同值 → 渲染出两个独立 <td>，值均保留。
 * 若有人把 rows 改回 `Record<label,string>` 或渲染改回按列名取，此用例必红。
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import AssistantTablePreviewCard from '../../src/components/agent/assistantTable/AssistantTablePreviewCard.tsx';

const noop = () => {};

const baseProps = {
  sending: false,
  onConfirm: noop,
  onCancel: noop,
  targetTabName: '表1',
  targetTabs: [{ id: 't1', name: '表1' }],
  onSelectTarget: noop,
  onNewTarget: noop,
  previewHeight: null as number | null,
  onGripPointerDown: noop,
};

describe('AssistantTablePreviewCard — F6 同名列不丢值', () => {
  it('两列同名时，位置式 rows 保留两格独立值（不按列名 keyed 折叠）', () => {
    const { container } = render(
      <AssistantTablePreviewCard
        {...baseProps}
        kind="table"
        globalStyle=""
        columns={['名称', '名称']} // 同名列
        rows={[['甲值', '乙值']]} // 两格不同值
        rowIndex={null}
        opKind="replace"
        appendedCount={1}
      />,
    );
    const tds = container.querySelectorAll('tbody td');
    expect(tds).toHaveLength(2);
    expect(tds[0].textContent).toBe('甲值');
    expect(tds[1].textContent).toBe('乙值');
  });

  it('多行 + 同名列，逐行逐格位置式索引均不覆盖', () => {
    const { container } = render(
      <AssistantTablePreviewCard
        {...baseProps}
        kind="table"
        globalStyle=""
        columns={['列', '列', '列']} // 三列同名
        rows={[
          ['r0c0', 'r0c1', 'r0c2'],
          ['r1c0', 'r1c1', 'r1c2'],
        ]}
        rowIndex={null}
        opKind="append"
        appendedCount={2}
      />,
    );
    const tds = container.querySelectorAll('tbody td');
    expect(tds).toHaveLength(6);
    // 首行三格互不覆盖
    expect(tds[0].textContent).toBe('r0c0');
    expect(tds[1].textContent).toBe('r0c1');
    expect(tds[2].textContent).toBe('r0c2');
    // 次行独立
    expect(tds[3].textContent).toBe('r1c0');
    expect(tds[4].textContent).toBe('r1c1');
    expect(tds[5].textContent).toBe('r1c2');
  });
});
