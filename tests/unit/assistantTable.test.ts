import { describe, it, expect } from 'vitest';
import {
  emptyAssistantTable,
  normalizeAssistantTable,
  parsePasted,
  addRow,
  deleteRow,
  moveRow,
  duplicateRow,
  setCell,
  renameColumn,
  addColumn,
  insertColumnAfter,
  deleteColumn,
  rowToObj,
  rowToText,
  rowHasText,
  buildPreviewResult,
  tryParseAssistantTableJson,
  extractRowIndex,
  ROW_INDEX_KEY,
  estimateColumnWidth,
  setColumnWidth,
} from '../../src/components/agent/assistantTable/assistantTable.ts';
import type { AssistantTable } from '../../src/components/agent/assistantTable/assistantTable.ts';

describe('AI 助手表格模型（assistantTable 纯函数）', () => {
  it('parsePasted(TSV)：首行为表头，其余为数据行；全空数据行跳过', () => {
    const sb = parsePasted('景别\t画面描述\n中景\t人物走入\n全景\t远山\n');
    expect(sb).not.toBeNull();
    expect(sb!.columns.map((c) => c.label)).toEqual(['景别', '画面描述']);
    expect(sb!.rows).toHaveLength(2);
    expect(sb!.rows[0].values[sb!.columns[1].id]).toBe('人物走入');
  });

  it('parsePasted：空/无表头返回 null（不落半成品）', () => {
    expect(parsePasted('')).toBeNull();
    expect(parsePasted('\n\n')).toBeNull();
    expect(parsePasted('\t\t')).toBeNull();
  });

  it('parsePasted(HTML table)：保留 Tab 不被压平，多格多行还原正确', () => {
    const htm =
      '<table><tr><th>A</th><th>B</th></tr><tr><td>a1</td><td>b1</td></tr><tr><td>a2</td><td>b2</td></tr></table>';
    const sb = parsePasted('', htm);
    expect(sb!.columns.map((c) => c.label)).toEqual(['A', 'B']);
    expect(sb!.rows).toHaveLength(2);
    expect(sb!.rows[0].values[sb!.columns[0].id]).toBe('a1');
    expect(sb!.rows[1].values[sb!.columns[1].id]).toBe('b2');
  });

  it('rowToObj：按 columns 顺序输出 {列名:值}，空单元格为空串', () => {
    const sb = parsePasted('景别\t画面\n中景\t人');
    const obj = rowToObj(sb!, sb!.rows[0]);
    expect(obj).toEqual({ 景别: '中景', 画面: '人' });
  });

  it('rowHasText：全空行 false，任一非空 true（B-006 单一实现）', () => {
    expect(rowHasText({ a: '', b: '  ' })).toBe(false);
    expect(rowHasText({ a: '', b: 'x' })).toBe(true);
    expect(rowHasText({})).toBe(false);
  });

  it('mergeRowFromObj 旧语义已迁入 buildPreviewResult：update 只覆盖提及列、未提及保留原值', () => {
    const sb = parsePasted('景别\t画面\n中景\t原画面')!;
    const rid = sb.rows[0].id;
    const r = buildPreviewResult(sb, { rows: [{ 画面: '新画面', 不存在: '忽略' }] }, [rid]);
    expect(r.opKind).toBe('update');
    // 未提及列（景别）保留原值；提及列（画面）更新；未知键不再静默忽略——作为新列追加（A-005）
    expect(r.resultRows[0].values[sb.columns[0].id]).toBe('中景');
    expect(r.resultRows[0].values[sb.columns[1].id]).toBe('新画面');
    expect(r.resultCols.map((c) => c.label)).toEqual(['景别', '画面', '不存在']);
  });

  it('addRow / deleteRow / moveRow / duplicateRow：不可变 + 行 id 稳定', () => {
    const sb = parsePasted('景别\t画面\nA\ta\nB\tb\nC\tc');
    const orig = sb!;
    const ids = orig.rows.map((r) => r.id);
    // addRow 返回新数组，原表不动
    const withAdded = addRow(orig);
    expect(withAdded).not.toBe(orig);
    expect(withAdded.rows).toHaveLength(4);
    expect(orig.rows).toHaveLength(3);
    // deleteRow / moveRow / duplicateRow 原表引用不动
    expect(deleteRow(orig, ids[1]).rows.map((r) => r.id)).toEqual([ids[0], ids[2]]);
    expect(moveRow(orig, ids[2], 'up').rows[1].id).toBe(ids[2]);
    expect(moveRow(orig, ids[0], 'up')).toBe(orig); // 首行上移越界 → 原引用
    const dup = duplicateRow(orig, ids[1]);
    expect(dup.rows).toHaveLength(4);
    expect(dup.rows[2].id).not.toBe(ids[1]);
    expect(dup.rows[2].values).toEqual(orig.rows[1].values);
  });

  it('renameColumn：改列名不影响行数据；空/相同/未知列幂等', () => {
    const sb = parsePasted('景别\t画面\n中景\t人');
    const colId = sb!.columns[0].id;
    const next = renameColumn(sb!, colId, '景别类型');
    expect(next.columns[0].label).toBe('景别类型');
    // 行 values 以 col.id 为键 → 改名后行数据不变
    expect(next.rows[0].values[colId]).toBe('中景');
    // 幂等
    expect(renameColumn(sb!, colId, '景别')).toBe(sb);
    expect(renameColumn(sb!, colId, '   ')).toBe(sb);
    expect(renameColumn(sb!, 'nope', 'x')).toBe(sb);
  });

  it('setCell：不可变、值相同幂等、未知列/行忽略', () => {
    const sb = parsePasted('列A\nx');
    const rid = sb!.rows[0].id;
    const next = setCell(sb!, rid, sb!.columns[0].id, 'y');
    expect(next.rows[0].values[sb!.columns[0].id]).toBe('y');
    expect(sb!.rows[0].values[sb!.columns[0].id]).toBe('x'); // 原表不动
    expect(setCell(sb!, rid, sb!.columns[0].id, 'x')).toBe(sb); // 同值幂等
    expect(setCell(sb!, rid, 'no-such-col', 'z')).toBe(sb); // 未知列忽略
  });

  it('normalizeAssistantTable：宽松/脏数据归一成精确形状，缺省回空表', () => {
    const n1 = normalizeAssistantTable(null);
    expect(n1.columns).toEqual([]);
    expect(n1.rows).toEqual([]);
    const n2 = normalizeAssistantTable({
      columns: [{ label: 'A' }, { label: '' }, 'junk'],
      rows: [{ values: { x: '1' } }],
    });
    expect(n2.columns.map((c) => c.label)).toEqual(['A']);
    expect(n2.columns[0].id).toBeTruthy();
    expect(n2.rows).toHaveLength(1);
    expect(n2.rows[0].id).toBeTruthy();
  });

  it('tryParseAssistantTableJson：JSON 含 rows 命中；普通回复/无 rows 返回 null', () => {
    expect(tryParseAssistantTableJson('{"globalStyle":"g","rows":[{"A":"1"}]}')).not.toBeNull();
    expect(tryParseAssistantTableJson('```json\n{"rows":[{"A":"1"}]}\n```')).not.toBeNull();
    expect(tryParseAssistantTableJson('帮我画一只猫')).toBeNull();
    expect(tryParseAssistantTableJson('{"a":1}')).toBeNull();
  });

  it('rowToText：只输出非空列，每列「列名：值」', () => {
    const sb = parsePasted('景别\t画面\n中景\t');
    const t = rowToText(sb!, sb!.rows[0]);
    expect(t).toContain('景别：中景');
    expect(t).not.toContain('画面：');
  });

  it('兼容类型导出：AssistantTable 可用', () => {
    const _t: AssistantTable = emptyAssistantTable();
    expect(_t).toBeTruthy();
  });

  it('buildPreviewResult：replace（当前表无列）→ 按 AI 建表，丢全空行，_rowIndex 不当列', () => {
    const r = buildPreviewResult(emptyAssistantTable(), {
      globalStyle: '写实',
      rows: [
        { [ROW_INDEX_KEY]: 2, 列A: 'a1', 列B: 'b1' },
        { 列A: 'a2', 列B: 'b2' },
        { 列A: '', 列B: '  ' },
      ],
    });
    expect(r.opKind).toBe('replace');
    expect(r.resultCols.map((c) => c.label)).toEqual(['列A', '列B']); // _rowIndex 不当列
    expect(r.resultRows).toHaveLength(2); // 全空行丢弃
    expect(r.resultRows[0].values[r.resultCols[0].id]).toBe('a1');
  });

  it('buildPreviewResult：append（未选中行）→ AI 行原样追加末尾，现有列 id/width 保留', () => {
    const sb = parsePasted('景别\t画面\n中景\t原画面')!;
    const col0 = sb.columns[0];
    const withWidth = { ...sb, columns: [{ ...col0, width: 180 }, sb.columns[1]] };
    const r = buildPreviewResult(withWidth, { rows: [{ 景别: '特写', 画面: '新画面' }] });
    expect(r.opKind).toBe('append');
    expect(r.resultCols[0].id).toBe(col0.id); // 列 id 保留
    expect(r.resultCols[0].width).toBe(180); // 列宽保留
    expect(r.resultRows).toHaveLength(2); // 原 1 行 + 追加 1 行
    expect(r.resultRows[1].values[col0.id]).toBe('特写');
    expect(r.resultRows[0].values[col0.id]).toBe('中景'); // 原行不动
  });

  it('buildPreviewResult：update（选中 N 行 + AI 回 N 行）→ 第 i 个 AI 行填第 i 个选中行，未选中行不动', () => {
    const sb = parsePasted('景别\t画面\n中景\t原1\n特写\t原2\n全景\t原3')!;
    const r1 = sb.rows[0].id;
    const r3 = sb.rows[2].id;
    // 选中第 1、3 行，AI 回两行 → 分别更新
    const r = buildPreviewResult(sb, { rows: [{ 画面: '新1' }, { 画面: '新3' }] }, [r1, r3]);
    expect(r.opKind).toBe('update');
    expect(r.updatedCount).toBe(2);
    expect(r.resultRows).toHaveLength(3);
    expect(r.resultRows[0].values[sb.columns[1].id]).toBe('新1');
    expect(r.resultRows[1].values[sb.columns[1].id]).toBe('原2'); // 未选中行不动
    expect(r.resultRows[2].values[sb.columns[1].id]).toBe('新3');
    expect(r.resultRows[0].id).toBe(r1); // 行 id 稳定
    expect(r.resultRows[2].id).toBe(r3);
  });

  it('buildPreviewResult：update M>N → 前 N 行更新，多余行追加末尾', () => {
    const sb = parsePasted('景别\t画面\n中景\t原1\n特写\t原2')!;
    const r1 = sb.rows[0].id;
    const r = buildPreviewResult(
      sb,
      { rows: [{ 画面: '改1' }, { 画面: '新追加1' }, { 画面: '新追加2' }] },
      [r1],
    );
    expect(r.opKind).toBe('update');
    expect(r.updatedCount).toBe(1);
    expect(r.appendedCount).toBe(2);
    expect(r.resultRows).toHaveLength(4);
    expect(r.resultRows[0].values[sb.columns[1].id]).toBe('改1');
    expect(r.resultRows[2].values[sb.columns[1].id]).toBe('新追加1'); // 追加到末尾
    expect(r.resultRows[3].values[sb.columns[1].id]).toBe('新追加2');
  });

  it('buildPreviewResult：update 带 _rowIndex → 优先按行号定位（无视选中顺序）', () => {
    const sb = parsePasted('景别\t画面\n中景\t原1\n特写\t原2\n全景\t原3')!;
    // 选中第 1 行，但 AI 用 _rowIndex:3 指第 3 行 → 改的是第 3 行
    const r = buildPreviewResult(sb, { rows: [{ [ROW_INDEX_KEY]: 3, 画面: '已更新' }] }, [
      sb.rows[0].id,
    ]);
    expect(r.opKind).toBe('update');
    expect(r.resultRows[2].values[sb.columns[1].id]).toBe('已更新');
    expect(r.resultRows[0].values[sb.columns[1].id]).toBe('原1'); // 选中行没被 AI 覆盖
  });

  it('buildPreviewResult：选中空行 + AI 续写 → 内容填进该空行（验收 1）', () => {
    const sb = parsePasted('景别\t画面\n中景\t原画面')!;
    const emptyRow = addRow(sb).rows[1]; // 全空行
    const withEmpty = { ...sb, rows: [...sb.rows, emptyRow] };
    const r = buildPreviewResult(withEmpty, { rows: [{ 景别: '特写', 画面: '续写内容' }] }, [
      emptyRow.id,
    ]);
    expect(r.opKind).toBe('update');
    expect(r.resultRows[1].values[sb.columns[0].id]).toBe('特写');
    expect(r.resultRows[1].values[sb.columns[1].id]).toBe('续写内容');
    expect(r.resultRows).toHaveLength(2);
  });

  it('buildPreviewResult：update 未提及列保留原值；AI 新列名追加为新列（验收 4）', () => {
    const sb = parsePasted('景别\t画面\n中景\t原画面')!;
    const rid = sb.rows[0].id;
    const r = buildPreviewResult(sb, { rows: [{ 画面: '新画面', 备注: '新列值' }] }, [rid]);
    expect(r.opKind).toBe('update');
    expect(r.resultCols.map((c) => c.label)).toEqual(['景别', '画面', '备注']);
    expect(r.resultRows[0].values[sb.columns[0].id]).toBe('中景'); // 未提及列保留
    expect(r.resultRows[0].values[r.resultCols[2].id]).toBe('新列值'); // 新列值
  });

  it('buildPreviewResult：列名空白归一模糊匹配（trim/折叠空白），命中现有列不新增（A-005）', () => {
    const sb = parsePasted('景别\t画面\n中景\t原画面')!;
    const rid = sb.rows[0].id;
    // AI 返回带空格/多余空白的列名 → 归一后命中现有列「画面」
    const r = buildPreviewResult(sb, { rows: [{ ' 画面 ': '新画面' }] }, [rid]);
    expect(r.opKind).toBe('update');
    expect(r.resultCols.map((c) => c.label)).toEqual(['景别', '画面']); // 不新增列
    expect(r.resultRows[0].values[sb.columns[1].id]).toBe('新画面');
  });

  it('addColumn：追加列并给每行补空键；原表不动', () => {
    const sb = parsePasted('列A\t列B\nx\ty')!;
    const colCount = sb.columns.length;
    const next = addColumn(sb);
    expect(next).not.toBe(sb);
    expect(next.columns).toHaveLength(colCount + 1);
    expect(next.columns[colCount].label).toMatch(/^新列/); // 缺省占位名
    expect(next.rows[0].values[next.columns[colCount].id]).toBe(''); // 补空键
    expect(sb.columns).toHaveLength(colCount); // 原表不动
    // 显式命名
    const named = addColumn(sb, '备注');
    expect(named.columns[colCount].label).toBe('备注');
  });

  it('deleteColumn：删除列并清理所有行该列键；未知列幂等', () => {
    const sb = parsePasted('列A\t列B\t列C\nx\ty\tz')!;
    const colB = sb.columns[1].id;
    const next = deleteColumn(sb, colB);
    expect(next).not.toBe(sb);
    expect(next.columns.map((c) => c.label)).toEqual(['列A', '列C']);
    expect(next.rows[0].values).not.toHaveProperty(colB); // 行键被清理
    expect(next.rows[0].values[sb.columns[0].id]).toBe('x'); // 其它列数据保留
    expect(deleteColumn(sb, 'no-such-col')).toBe(sb); // 未知列幂等
  });

  it('insertColumnAfter：可在任意列后插入（不止末尾），补空键；未知/缺省 colId 回退追加末尾', () => {
    const sb = parsePasted('列A\t列B\t列C\nx\ty\tz')!;
    const colA = sb.columns[0].id; // 在第 1 列后插 → 新列排第 2
    const next = insertColumnAfter(sb, colA);
    expect(next).not.toBe(sb);
    expect(next.columns).toHaveLength(4);
    expect(next.columns.map((c) => c.label)).toEqual([
      '列A',
      expect.stringMatching(/^新列/),
      '列B',
      '列C',
    ]);
    expect(next.rows[0].values[next.columns[1].id]).toBe(''); // 补空键
    expect(next.rows[0].values[next.columns[2].id]).toBe('y'); // 原数据保序
    // 缺省 colId → 追加末尾（与 addColumn 同语义）
    const appended = insertColumnAfter(sb);
    expect(appended.columns.map((c) => c.label)).toEqual([
      '列A',
      '列B',
      '列C',
      expect.stringMatching(/^新列/),
    ]);
    // 未知 colId → 幂等追加末尾，不抛
    const unknown = insertColumnAfter(sb, 'no-such-col', '备注');
    expect(unknown.columns.at(-1)?.label).toBe('备注');
    // addColumn 与 insertColumnAfter(缺省) 行为一致（单一实现）
    expect(addColumn(sb).columns.map((c) => c.label)).toEqual(
      insertColumnAfter(sb).columns.map((c) => c.label),
    );
  });

  it('extractRowIndex：读 _rowIndex（1 起）→ 0-based；无/非法返回 null', () => {
    expect(extractRowIndex({ [ROW_INDEX_KEY]: 3, 列A: 'x' })).toBe(2);
    expect(extractRowIndex({ [ROW_INDEX_KEY]: '2' })).toBe(1);
    expect(extractRowIndex({ 列A: 'x' })).toBeNull(); // 无 _rowIndex
    expect(extractRowIndex({ [ROW_INDEX_KEY]: 0 })).toBeNull(); // <1 非法
    expect(extractRowIndex(null)).toBeNull();
  });

  it('estimateColumnWidth：中文按 2 字宽计长，clamp 在 90~240，表头长度计入', () => {
    const rows = [{ id: 'r1', values: { c1: '短' } }];
    const w = estimateColumnWidth('列', rows, 'c1');
    expect(w).toBeGreaterThanOrEqual(90);
    expect(w).toBeLessThanOrEqual(240);
    // 表头 4 个中文（=8 字宽）→ 最长 8；8*13+24=128
    expect(estimateColumnWidth('列列列列', rows, 'c1')).toBe(
      Math.max(90, Math.min(240, 8 * 13 + 24)),
    );
    // 超长内容触发上限 240
    const long = '内容'.repeat(50);
    expect(estimateColumnWidth('列', [{ id: 'r', values: { c1: long } }], 'c1')).toBe(240);
  });

  it('setColumnWidth：不可变、写入 width、相同幂等、未知列忽略，行数据不动', () => {
    const sb = parsePasted('列A\nx')!;
    const cid = sb.columns[0].id;
    const next = setColumnWidth(sb, cid, 200);
    expect(next).not.toBe(sb);
    expect(next.columns[0].width).toBe(200);
    expect(setColumnWidth(next, cid, 200)).toBe(next); // 同值幂等（对已设列的再次相同写入）
    expect(setColumnWidth(sb, 'nope', 200)).toBe(sb); // 未知列忽略
    expect(next.rows[0].values[cid]).toBe('x'); // 行数据不动
  });

  it('normalizeAssistantTable：保留列 width 字段（拖拽持久化可回读），未设列不含 width 键', () => {
    const n = normalizeAssistantTable({
      columns: [{ id: 'c1', label: 'A', width: 180 }, { label: 'B' }],
      rows: [{ id: 'r1', values: { c1: '1' } }],
    });
    expect(n.columns[0].width).toBe(180);
    expect(n.columns[1].width).toBeUndefined();
  });
});
