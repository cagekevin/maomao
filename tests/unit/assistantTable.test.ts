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
  rowToObj,
  rowToText,
  sbToJson,
  jsonToSb,
  mergeRowFromObj,
  tryParseAssistantTableJson,
  buildPreviewModel,
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

  it('sbToJson / jsonToSb roundtrip：顶层 globalStyle + 行数组，数据不丢；globalStyle 空不写该键', () => {
    const sb = parsePasted('列A\t列B\nx\ty');
    const json = sbToJson(sb!, '写实电影感');
    expect(json.globalStyle).toBe('写实电影感');
    expect(json.rows).toEqual([{ 列A: 'x', 列B: 'y' }]);
    const { globalStyle, sb: back } = jsonToSb(json);
    expect(globalStyle).toBe('写实电影感');
    expect(back.columns.map((c) => c.label)).toEqual(['列A', '列B']);
    expect(back.rows[0].values[back.columns[0].id]).toBe('x');
    const noStyle = sbToJson(sb!, '');
    expect(Object.prototype.hasOwnProperty.call(noStyle, 'globalStyle')).toBe(false);
  });

  it('mergeRowFromObj：只覆盖该行已有列，未知列不新增；无改动幂等', () => {
    const sb = parsePasted('景别\t画面\n中景\t原画面');
    const rid = sb!.rows[0].id;
    const next = mergeRowFromObj(sb!, rid, { 画面: '新画面', 不存在: '忽略' });
    expect(next.rows[0].values[sb!.columns[1].id]).toBe('新画面');
    expect(next.columns).toHaveLength(2); // 不新增列
    // 无改动 → 原引用
    const unchanged = mergeRowFromObj(sb!, rid, { 画面: '原画面' });
    expect(unchanged).toBe(sb);
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

  it('buildPreviewModel：单行 → 还原成完整行（AI 给到的新值 + 未给沿用当前值），带 rowIndex', () => {
    const sb = parsePasted('景别\t画面\t对白\n中景\t原画面\t原对白');
    const rid = sb!.rows[0].id;
    // AI 只返回画面列新值，其余沿用当前值
    const p = buildPreviewModel(sb!, { rows: [{ 画面: '新画面' }] }, rid);
    expect(p.kind).toBe('table');
    expect(p.rowIndex).toBe(1);
    expect(p.rows).toEqual([{ 景别: '中景', 画面: '新画面', 对白: '原对白' }]);
  });

  it('buildPreviewModel：整表 → 列与行还原，rowIndex=null', () => {
    const p = buildPreviewModel(
      emptyAssistantTable(),
      { globalStyle: '写实', rows: [{ A: '1', B: '2' }] },
      null,
    );
    expect(p.kind).toBe('table');
    expect(p.globalStyle).toBe('写实');
    expect(p.columns).toEqual(['A', 'B']);
    expect(p.rows).toEqual([{ A: '1', B: '2' }]);
    expect(p.rowIndex).toBeNull();
  });
});
