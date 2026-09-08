import { describe, it, expect } from 'vitest';
import {
  validateTabs,
  validateWorkspace,
} from '../../src/components/agent/assistantTable/tableInvariants.ts';
import type { Violation } from '../../src/components/agent/assistantTable/tableInvariants.ts';
import {
  parsePasted,
  emptyAssistantTabs,
  addTab,
  copyTab,
  deleteColumn,
  addColumn,
} from '../../src/components/agent/assistantTable/assistantTable.ts';
import type {
  AssistantTableTabs,
  TableColumn,
  TableRow,
  TableTab,
} from '../../src/components/agent/assistantTable/assistantTable.ts';
import type { TableWorkspaceState } from '../../src/components/agent/assistantTable/tableWorkspaceState.ts';

const errors = (v: Violation[]) => v.filter((x) => x.level === 'error');
const onlyErrors = (tabs: AssistantTableTabs) => errors(validateTabs(tabs));

/** 造一张合法表（含 1 行真实数据，保证 L1 cells 长度对齐），包成单 tab 集合 */
function validTabs(): AssistantTableTabs {
  const sb = parsePasted('景别\t画面\n中景\t原画面')!;
  const tab: TableTab = {
    id: 'A',
    name: '表A',
    columns: sb.columns,
    rows: sb.rows,
    globalStyle: '',
  };
  return { tabs: [tab], activeTabId: 'A' };
}

describe('validateTabs 不变量校验（spec §七.L4）', () => {
  it('健康表：无任何 error/warn（空 */合并），所有粗取基底合法', () => {
    const tabs = validTabs();
    expect(validateTabs(tabs)).toEqual([]);
  });

  it('恒 ≥1 tab（S6）；emptyAssistantTabs/addTab 产物均健康', () => {
    expect(validateTabs(emptyAssistantTabs()).filter((v) => v.level === 'error')).toEqual([]);
    const two = addTab(validTabs(), '表B');
    expect(onlyErrors(two)).toEqual([]);
  });

  it('copyTab 后 L1 约束成立（历史 copyTab 空表事故的回归护栏）', () => {
    const tabs = validTabs();
    const copied = copyTab(tabs, 'A');
    expect(onlyErrors(copied)).toEqual([]); // 列 id 新生成 + cells 按下标复制，绝不能渲染空表
  });

  it('deleteColumn 走 updateTab 套用后仍健康（L1 长度对齐不破坏）', () => {
    const tabs = validTabs();
    const t = tabs.tabs[0];
    // 在活动表的列上删「画面」列 → 行该下标的格子随 deleteColumn 清理
    const delCol = deleteColumn({ columns: t.columns, rows: t.rows }, t.columns[1].id);
    const next: AssistantTableTabs = {
      ...tabs,
      tabs: [{ ...t, columns: delCol.columns, rows: delCol.rows }],
    };
    expect(onlyErrors(next)).toEqual([]);
  });

  it('错误注入·L1 缺 cells 与 L1 多 cells：都报 error（证明校验真能抓长度不齐/静默膨胀）', () => {
    // 缺 cells：cells 长度 0 ≠ 列数 2
    const t = validTabs().tabs[0];
    const missing: TableRow = { id: t.rows[0].id, cells: [] }; // 长度 0 ≠ 2 列
    const tabsMissing: AssistantTableTabs = { ...validTabs(), tabs: [{ ...t, rows: [missing] }] };
    expect(onlyErrors(tabsMissing).some((v) => v.code === 'L1')).toBe(true);

    // 多 cells：cells 长度 3 ≠ 列数 2
    const extra: TableRow = { id: t.rows[0].id, cells: ['x', 'y', 'z'] };
    const tabsExtra: AssistantTableTabs = { ...validTabs(), tabs: [{ ...t, rows: [extra] }] };
    expect(onlyErrors(tabsExtra).some((v) => v.code === 'L1')).toBe(true);
  });

  it('错误注入·I2/I3 列或行 id 重复：报 error', () => {
    const t = validTabs().tabs[0];
    const dupCols: TableColumn[] = [t.columns[0], { ...t.columns[1], id: t.columns[0].id }];
    const c: AssistantTableTabs = { ...validTabs(), tabs: [{ ...t, columns: dupCols }] };
    expect(onlyErrors(c).some((v) => v.code === 'I2')).toBe(true);

    const dupRows: TableRow[] = [t.rows[0], { ...t.rows[0] }]; // 拷贝整行（同 id）
    const r: AssistantTableTabs = { ...validTabs(), tabs: [{ ...t, rows: dupRows }] };
    expect(onlyErrors(r).some((v) => v.code === 'I3')).toBe(true);
  });

  it('错误注入·I1 tab id 重复 / I5 activeTabId 悬空：报 error', () => {
    const dup: AssistantTableTabs = {
      tabs: [validTabs().tabs[0], { ...validTabs().tabs[0], columns: [], rows: [] }],
      activeTabId: 'A',
    };
    expect(onlyErrors(dup).some((v) => v.code === 'I1')).toBe(true);

    const dangling: AssistantTableTabs = { ...validTabs(), activeTabId: 'nope' };
    expect(onlyErrors(dangling).some((v) => v.code === 'I5')).toBe(true);
  });

  it('错误注入·S1 空列名：报 error', () => {
    const t = validTabs().tabs[0];
    const badCol: AssistantTableTabs = {
      ...validTabs(),
      tabs: [{ ...t, columns: [{ ...t.columns[0], label: '  ' }] }],
    };
    expect(onlyErrors(badCol).some((v) => v.code === 'S1')).toBe(true);
  });

  it('警告级·S2 同名列 / I6 跨表复用列:id：报 warn 不报 error', () => {
    // S2：两列归一后同名
    const t = validTabs().tabs[0];
    const dupLabel: AssistantTableTabs = {
      ...validTabs(),
      tabs: [
        {
          ...t,
          columns: [
            { ...t.columns[0], label: '景别' },
            { ...t.columns[1], label: '  景别  ' }, // 归一（trim）后与「景别」同名
          ],
        },
      ],
    };
    const w = validateTabs(dupLabel);
    expect(w.some((v) => v.level === 'warn' && v.code === 'S2')).toBe(true);
    expect(errors(w)).toEqual([]);

    // I6：两表复用同一 col id（表B 声明与表A 相同的 col id，行 cells 也自洽 → 只报 I6 warn、无 L1/无 I1 error）
    const base = validTabs();
    const sharedCol = base.tabs[0].columns[0].id; // 取 base 真实列 id（避免跨 validTabs 两套随机 id）
    const reuseTab: TableTab = {
      id: 'B',
      name: '表B',
      columns: [{ id: sharedCol, label: '列' }],
      rows: [{ id: 'rb1', cells: ['跨表复用'] }],
      globalStyle: '',
    };
    const reused: AssistantTableTabs = { ...base, tabs: [...base.tabs, reuseTab] };
    const v = validateTabs(reused);
    expect(v.some((x) => x.level === 'warn' && x.code === 'I6')).toBe(true);
    expect(errors(v)).toEqual([]);
  });

  it('tabs 结构缺失：报 S6 error 不崩', () => {
    expect(validateTabs(null as unknown as AssistantTableTabs)[0].code).toBe('S6');
  });
});

describe('validateWorkspace 运行态校验（W/P 类）', () => {
  function ws(partial: Partial<TableWorkspaceState>): TableWorkspaceState {
    return {
      open: false,
      width: 600,
      selectedRowIds: [],
      preview: null,
      handledMessageId: null,
      previewHeight: null,
      clipboard: null,
      range: null,
      focusedCell: null,
      editingCell: null,
      ...partial,
    };
  }

  it('正常态：无违规', () => {
    const tabs = validTabs();
    const rowId = tabs.tabs[0].rows[0].id;
    const colId = tabs.tabs[0].columns[0].id;
    expect(validateWorkspace(ws({ selectedRowIds: [rowId] }), tabs)).toEqual([]);
    expect(validateWorkspace(ws({ focusedCell: { rowId, colId } }), tabs)).toEqual([]);
  });

  it('W1 幽灵选中行：warn', () => {
    const tabs = validTabs();
    const v = validateWorkspace(ws({ selectedRowIds: ['ghost-row'] }), tabs);
    expect(v.some((x) => x.level === 'warn' && x.code === 'W1')).toBe(true);
  });

  it('W4 单格指向不存在行/列：warn', () => {
    const tabs = validTabs();
    const v = validateWorkspace(ws({ focusedCell: { rowId: 'x', colId: 'y' } }), tabs);
    expect(v.some((x) => x.code === 'W4')).toBe(true);
  });

  it('W2 行选与单格并存：warn', () => {
    const tabs = validTabs();
    const t = tabs.tabs[0];
    const v = validateWorkspace(
      ws({
        selectedRowIds: [t.rows[0].id],
        focusedCell: { rowId: t.rows[0].id, colId: t.columns[0].id },
      }),
      tabs,
    );
    expect(v.some((x) => x.code === 'W2')).toBe(true);
  });

  it('P1 preview 目标 tab 悬空：error（确认会写悬空→假成功的根）', () => {
    const tabs = validTabs();
    const t = tabs.tabs[0];
    const v = validateWorkspace(
      ws({
        preview: {
          json: { rows: [] },
          messageId: 'm1',
          selectedRowIds: [],
          targetTabId: 'ghost-tab',
          resultRows: t.rows,
          resultCols: t.columns,
          opKind: 'append',
          updatedCount: 0,
          appendedCount: 0,
          changedRowIds: [],
        },
      }),
      tabs,
    );
    expect(v.some((x) => x.level === 'error' && x.code === 'P1')).toBe(true);
  });

  it('P3 changedRowIds 越界：warn', () => {
    const tabs = validTabs();
    const t = tabs.tabs[0];
    const v = validateWorkspace(
      ws({
        preview: {
          json: { rows: [] },
          messageId: 'm1',
          selectedRowIds: [],
          targetTabId: 'A',
          resultRows: t.rows,
          resultCols: t.columns,
          opKind: 'update',
          updatedCount: 1,
          appendedCount: 0,
          changedRowIds: ['not-in-result'],
        },
      }),
      tabs,
    );
    expect(v.some((x) => x.code === 'P3')).toBe(true);
  });
});

describe('validateTabs 接入真实变更链路（通用断言落地）', () => {
  it('addColumn 后行补空串，L1 长度对齐保持（缺格会被校验抓）', () => {
    const t = validTabs().tabs[0];
    const next = addColumn({ columns: t.columns, rows: t.rows }, '新列');
    expect(
      validateTabs({ tabs: [{ ...t, columns: next.columns, rows: next.rows }], activeTabId: 'A' }),
    ).toEqual([]);
  });
});
