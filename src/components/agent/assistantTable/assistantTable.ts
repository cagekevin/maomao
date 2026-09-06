/**
 * AI 助手表格 —— 纯函数模型层（100% 无副作用，无 React/state）。
 *
 * 职责：表格的【数据结构 + 归一化 + 解析 + 行↔JSON 双向映射】。
 * 这是"AI 助手左栏表格工作区"的数据底座，只处理通用表格，不限定任何业务语义
 * （不分镜/不故事/不产品页——列/行完全由粘贴或 AI 按需求设计）。
 *
 * 铁律（对齐 scriptBoxPrompts 的纯函数层）：
 *  - 本文件 IMPORT 无任何 React / store / 事件 / 存储，便于单元测试。
 *  - 所有"增删改行/列"返回【新对象/新数组】，绝不 mutate 入参 sb。
 *  - id 生成唯一走 generateId（集中 ID 工具），禁 Date.now()/index 当行键。
 *
 * 数据形态（与 mockup `ROWS`/`OPS` 及会话记忆 assistantTable 字段一致）：
 *   AssistantTable = { columns: TableColumn[], rows: TableRow[] }
 *   单元格值以「列 id → 文本」映射存 row.values[columnId]（列增删不毁行）。
 *   globalStyle 不在本表存（复用会话 memory.global_contract.unified_style_prompt），
 *   由上层经 sbToJson 入参注入 / jsonToSb 返回值带出。
 */
import { generateId } from '@/components/base/core/idGen.ts';

/** 单元格值：数据层固定字符串；编辑态由 UI 层持有 */
export type CellValue = string;

/** 一列：id 稳定唯一，label 即显示列名（粘贴首行 / AI 设计），顺序即显示顺序 */
export interface TableColumn {
  id: string;
  label: string;
}

/** 一行：id 稳定唯一；各列值以 [columnId]: text 映射 */
export interface TableRow {
  id: string;
  values: Record<string, CellValue>;
}

/** AI 助手表格模型（会话记忆内聚字段，单一数据源） */
export interface AssistantTable {
  columns: TableColumn[];
  rows: TableRow[];
}

/** 反序列化用的宽松形态（供 normalizeAssistantTable 归一，兼容历史/脏数据） */
export interface RawAssistantTable {
  columns?: unknown[];
  rows?: unknown[];
  [key: string]: unknown;
}

/** AI 生成整表 / 改单行的统一精简 JSON（对齐剧本盒「顶层 globalStyle + 行数组」形态，但不限定分镜） */
export interface AssistantTableJson {
  globalStyle?: string;
  rows: Array<Record<string, unknown>>; // 每行：{ 列名: 值 }
}

/** 空表（无列无行） */
export function emptyAssistantTable(): AssistantTable {
  return { columns: [], rows: [] };
}

/**
 * 归一化宽松/历史数据 → 精确 AssistantTable。
 * columns 归一为 [{id,label}]（无 id 补 uid）；rows 归一为 [{id,values:{colId:text}}]（无 id 补 uid、
 * values 收敛为 string map、忽略未声明的额外字段）；缺省/非法返回空表。
 */
export function normalizeAssistantTable(raw: unknown): AssistantTable {
  if (!raw || typeof raw !== 'object') return emptyAssistantTable();
  const r = raw as RawAssistantTable;
  // 列归一：label 取字符串（非空），id 缺失补 uid
  const columns: TableColumn[] = [];
  if (Array.isArray(r.columns)) {
    for (const c of r.columns as unknown[]) {
      if (!c || typeof c !== 'object') continue;
      const col = c as Record<string, unknown>;
      const label = String(col.label ?? '').trim();
      if (!label) continue;
      columns.push({ id: String(col.id ?? '') || generateId('col'), label });
    }
  }
  const ids = new Set(columns.map((c) => c.id));
  // 行归一：values 只保留已声明列的字符串值；extra 忽略
  const rows: TableRow[] = [];
  if (Array.isArray(r.rows)) {
    for (const row of r.rows as unknown[]) {
      if (!row || typeof row !== 'object') continue;
      const rw = row as Record<string, unknown>;
      const rowId = String(rw.id ?? '') || generateId('row');
      const values: Record<string, string> = {};
      const v =
        rw.values && typeof rw.values === 'object' ? (rw.values as Record<string, unknown>) : {};
      for (const col of columns) {
        const cell = v[col.id];
        values[col.id] = typeof cell === 'string' ? cell : '';
      }
      rows.push({ id: rowId, values });
    }
    void ids;
  }
  return { columns, rows };
}

/**
 * 剪贴板粘贴解析 → 首行作表头。
 * @param rawText 纯文本（优先按 TSV(`\t`) 切割；含制表符时即表格粘贴）
 * @param htmlText 可选剪贴板 HTML（含 <table> 时优先按 HTML 表解析）
 * @returns 解析出的表；空/无表头返回 null（调用方据此不落半成品）
 * ⚠️ 禁止复用 clipboard.sanitizePastedText（它会把 \t 压成空格）。
 */
export function parsePasted(rawText: string, htmlText?: string): AssistantTable | null {
  const htm = typeof htmlText === 'string' && htmlText ? htmlText.trim() : '';
  let grid: string[][];
  if (htm && /<table[\s>]/i.test(htm)) {
    grid = parseHtmlTable(htm);
  } else {
    grid = parseTsvRows(rawText);
  }
  if (!grid.length) return null;
  // 首行 = 列名（去空）；空表头返回 null
  const header = (grid[0] || []).map((c) => String(c ?? '').trim()).filter((c) => c !== '');
  if (!header.length) return null;
  const columns = header.map((label) => ({ id: generateId('col'), label }));
  const rows: TableRow[] = [];
  for (let i = 1; i < grid.length; i++) {
    const cells = grid[i];
    const values: Record<string, string> = {};
    let hasText = false;
    for (let ci = 0; ci < columns.length; ci++) {
      const cell = String(cells[ci] ?? '').trim();
      values[columns[ci].id] = cell;
      if (cell) hasText = true;
    }
    if (!hasText) continue; // 跳过全空数据行
    rows.push({ id: generateId('row'), values });
  }
  return { columns, rows };
}

/** TSV 文本 → 二维字符串网格（\n 分行，\t 分格，\r 去掉） */
function parseTsvRows(text: string): string[][] {
  if (typeof text !== 'string') return [];
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => line.split('\t'));
}

/** HTML <table> → 二维字符串网格（取 <tr> 为行、<th>/<td> 为格；剥标签保留文本） */
function parseHtmlTable(html: string): string[][] {
  const rows: string[][] = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let tr;
  while ((tr = trRe.exec(html)) !== null) {
    const row: string[] = [];
    const cellRe = /<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>/gi;
    let td;
    while ((td = cellRe.exec(tr[1])) !== null) {
      row.push(stripTags(td[1]));
    }
    if (row.length) rows.push(row);
  }
  return rows;
}

/** 剥离 HTML 标签、解码常见实体，返回纯文本 */
function stripTags(html: string): string {
  return String(html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .trim();
}

/** 新增一行（空值，列对齐 columns） */
export function addRow(sb: AssistantTable): AssistantTable {
  const values: Record<string, string> = {};
  for (const col of sb.columns) values[col.id] = '';
  return { ...sb, rows: [...sb.rows, { id: generateId('row'), values }] };
}

/** 删除一行；不存在返回原表（幂等） */
export function deleteRow(sb: AssistantTable, rowId: string): AssistantTable {
  if (!sb.rows.some((r) => r.id === rowId)) return sb;
  return { ...sb, rows: sb.rows.filter((r) => r.id !== rowId) };
}

/** 上移/下移一行（越界无操作，返回新数组，行 id 稳定不重生成） */
export function moveRow(sb: AssistantTable, rowId: string, dir: 'up' | 'down'): AssistantTable {
  const idx = sb.rows.findIndex((r) => r.id === rowId);
  if (idx < 0) return sb;
  const target = dir === 'up' ? idx - 1 : idx + 1;
  if (target < 0 || target >= sb.rows.length) return sb;
  const rows = sb.rows.slice();
  const [moved] = rows.splice(idx, 1);
  rows.splice(target, 0, moved);
  return { ...sb, rows };
}

/** 复制一行（新 id，插到该行之后；不存在返回原表） */
export function duplicateRow(sb: AssistantTable, rowId: string): AssistantTable {
  const idx = sb.rows.findIndex((r) => r.id === rowId);
  if (idx < 0) return sb;
  const src = sb.rows[idx];
  const copy: TableRow = { id: generateId('row'), values: { ...src.values } };
  const rows = sb.rows.slice();
  rows.splice(idx + 1, 0, copy);
  return { ...sb, rows };
}

/** 写单个单元格（不可变；值相同返回原表避免空 commit） */
export function setCell(
  sb: AssistantTable,
  rowId: string,
  colId: string,
  text: string,
): AssistantTable {
  const idx = sb.rows.findIndex((r) => r.id === rowId);
  if (idx < 0) return sb; // 行不存在，幂等
  if (!sb.columns.some((c) => c.id === colId)) return sb; // 未知列忽略
  const row = sb.rows[idx];
  const value = String(text ?? '');
  if (((row.values[colId] ?? '') as string) === value) return sb; // 原值相同（含 undefined===''）→ 幂等
  const values = { ...row.values, [colId]: value };
  return { ...sb, rows: sb.rows.map((r, i) => (i === idx ? { ...r, values } : r)) };
}

/** 改列名（不可变；行 values 以 col.id 为键，改 label 不影响行数据）。label 空/相同返回原表（幂等）。 */
export function renameColumn(sb: AssistantTable, colId: string, label: string): AssistantTable {
  const idx = sb.columns.findIndex((c) => c.id === colId);
  if (idx < 0) return sb; // 未知列忽略
  const trimmed = String(label ?? '').trim();
  if (!trimmed) return sb;
  const col = sb.columns[idx];
  if (col.label === trimmed) return sb; // 相同幂等
  return { ...sb, columns: sb.columns.map((c, i) => (i === idx ? { ...c, label: trimmed } : c)) };
}

/** 追加一列到末尾（label 缺省用占位名「新列N」）。已有行补该列空键，保证列键对齐、渲染不缺键。 */
export function addColumn(sb: AssistantTable, label?: string): AssistantTable {
  const l = String(label ?? '').trim();
  const name = l || `新列${sb.columns.length + 1}`;
  const col: TableColumn = { id: generateId('col'), label: name };
  const rows = sb.rows.map((r) => ({ ...r, values: { ...r.values, [col.id]: '' } }));
  return { ...sb, columns: [...sb.columns, col], rows };
}

/** 删除一列（不可变；同时清理所有行里该列的键，不留孤儿数据）。列不存在返回原表（幂等）。 */
export function deleteColumn(sb: AssistantTable, colId: string): AssistantTable {
  if (!sb.columns.some((c) => c.id === colId)) return sb;
  const columns = sb.columns.filter((c) => c.id !== colId);
  const rows = sb.rows.map((r) => {
    if (!(colId in r.values)) return r;
    const values = { ...r.values };
    delete values[colId];
    return { ...r, values };
  });
  return { ...sb, columns, rows };
}

/** 行 → { 列名: 值 }（按 columns 顺序；发给 AI / 序列化都用它，保证每值带列名） */
export function rowToObj(sb: AssistantTable, row: TableRow): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const col of sb.columns) obj[col.label] = row.values[col.id] ?? '';
  return obj;
}

/** 行 → 一段可读文本（每列一行「列名：值」），供「发送到画布」/ 上下文拼装 */
export function rowToText(sb: AssistantTable, row: TableRow): string {
  const parts: string[] = [];
  for (const col of sb.columns) {
    const v = row.values[col.id] ?? '';
    if (v) parts.push(`${col.label}：${v}`);
  }
  return parts.join('\n');
}

/** 表 → 精简 JSON（顶层 globalStyle + 行数组，每行带列名）。globalStyle 由调用方按需求注入（可分镜/产品页/任意用途）。 */
export function sbToJson(sb: AssistantTable, globalStyle: string): AssistantTableJson {
  return {
    ...(globalStyle ? { globalStyle } : {}),
    rows: sb.rows.map((r) => rowToObj(sb, r)),
  };
}

/**
 * 精简 JSON → 表。
 * 列名取 rows[0] 的键（AI 设计的列）；逐行值写回；globalStyle 单独返回。
 * 空 rows 返回空表（调用方按需决定是否落表）。
 */
export function jsonToSb(json: AssistantTableJson): { globalStyle: string; sb: AssistantTable } {
  const rows = Array.isArray(json?.rows) ? json.rows : [];
  const keys =
    json && rows[0] && typeof rows[0] === 'object'
      ? Object.keys(rows[0] as Record<string, unknown>)
      : [];
  const columns = keys
    .filter((k) => k.trim() !== '')
    .map((label) => ({ id: generateId('col'), label }));
  const sb: AssistantTable = { columns, rows: [] };
  for (const raw of rows) {
    if (!raw || typeof raw !== 'object') continue;
    const values: Record<string, string> = {};
    let hasText = false;
    for (const col of columns) {
      const cell = String((raw as Record<string, unknown>)[col.label] ?? '').trim();
      values[col.id] = cell;
      if (cell) hasText = true;
    }
    if (!hasText) continue;
    sb.rows.push({ id: generateId('row'), values });
  }
  return { globalStyle: String(json?.globalStyle ?? '').trim(), sb };
}

/**
 * 改单行写回：把「{ 列名: 值 }」合并进指定行（只覆盖该行已有列中的值，
 * 未知列名忽略、不会新增列）。用于「AI 返回该行 JSON → 确认 → 写回原行」。
 */
export function mergeRowFromObj(
  sb: AssistantTable,
  rowId: string,
  obj: Record<string, unknown>,
): AssistantTable {
  const idx = sb.rows.findIndex((r) => r.id === rowId);
  if (idx < 0) return sb;
  const row = sb.rows[idx];
  const next = { ...row.values };
  let changed = false;
  for (const col of sb.columns) {
    if (!(col.label in (obj || {}))) continue;
    const v = String(obj[col.label] ?? '').trim();
    if ((next[col.id] ?? '') !== v) {
      next[col.id] = v;
      changed = true;
    }
  }
  if (!changed) return sb; // 无实际改动（幂等）
  return { ...sb, rows: sb.rows.map((r, i) => (i === idx ? { ...r, values: next } : r)) };
}

/**
 * 从 assistant 消息文本里尝试解析「表格 JSON」。
 * 语义：文本含 JSON 对象且有 `rows` 数组 → 视为表格 JSON（整表或单行均可）。
 * @returns 解析成功返回 { json }；否则返回 null（透传调用方判断是普通回复）。
 * 说明：只做探测，不判定整表/单行——由调用方按场景决定（有 selectedRowId 且单行 → 写回该行）。
 */
export function tryParseAssistantTableJson(text: unknown): { json: AssistantTableJson } | null {
  if (typeof text !== 'string') return null;
  // 对齐剧本盒 scriptBoxEngine.parseJsonText 的提取：剥 ```json 围栏、只取首个 {...} 到最后一个 }，
  // 再严格 JSON.parse——前台自然语言包裹 / 围栏残留 / 尾部杂字都能救回，解析成功率更高。
  let s = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  const f = s.indexOf('{');
  const p = s.lastIndexOf('}');
  if (f >= 0 && p > f) s = s.slice(f, p + 1);
  let obj: unknown;
  try {
    obj = JSON.parse(s);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;
  const rows = (obj as Record<string, unknown>).rows;
  if (!Array.isArray(rows)) return null;
  return { json: obj as AssistantTableJson };
}

/**
 * 解析 AI 返回 + 对当前表生成「预览模型」——只显示 AI 这次发来的「新内容」，供左表/右卡左右对比。
 *  - 整表（json 多行）：列 + 各行（AI 设计的列/行）。
 *  - 单行（有选中行且 json 仅 1 行）：把该行还原成「完整行」（AI 给到的列用新值，未给的沿用当前值），
 *    供与左表该行直接对比；rowIndex 标注是第几行。
 * 刻意不做"旧→新"内联 diff——用户左表即旧态、右卡即新态，天然可对比（方案/用户裁定，勿回退）。
 * 纯函数无副作用，UI 据此渲染预览卡，确认才写回。
 */
export interface AssistantTablePreview {
  kind: 'table';
  globalStyle: string;
  columns: string[];
  rows: Array<Record<string, string>>;
  /** 单行时为行号（1 起），整表为 null */
  rowIndex: number | null;
}

export function buildPreviewModel(
  sb: AssistantTable,
  json: AssistantTableJson,
  rowId?: string | null,
): AssistantTablePreview {
  const globalStyle = String(json?.globalStyle ?? '').trim();
  const rows = Array.isArray(json?.rows) ? json.rows : [];
  const hitRow = rowId ? sb.rows.find((r) => r.id === rowId) : null;
  // 单行：命中选中行且 AI 只返回 1 行 → 还原成「完整行」（AI 没给的列沿用当前值）
  if (hitRow && rows.length === 1 && rows[0] && typeof rows[0] === 'object') {
    const obj = rows[0] as Record<string, unknown>;
    const columns = sb.columns.map((c) => c.label);
    const rec: Record<string, string> = {};
    for (const col of sb.columns) {
      rec[col.label] =
        col.label in obj ? String(obj[col.label] ?? '').trim() : (hitRow.values[col.id] ?? '');
    }
    return {
      kind: 'table',
      globalStyle,
      columns,
      rows: [rec],
      rowIndex: sb.rows.indexOf(hitRow) + 1,
    };
  }
  // 整表：列 = AI 返回首行键，行 = AI 返回各列值
  const keys =
    rows.length && rows[0] && typeof rows[0] === 'object'
      ? Object.keys(rows[0] as Record<string, unknown>)
      : [];
  const columns = keys.map((k) => k.trim()).filter(Boolean);
  const tableRows = rows
    .map((r) => {
      if (!r || typeof r !== 'object') return null;
      const rec: Record<string, string> = {};
      for (const c of columns) rec[c] = String((r as Record<string, unknown>)[c] ?? '').trim();
      return Object.keys(rec).length ? rec : null;
    })
    .filter((r): r is Record<string, string> => r !== null);
  return { kind: 'table', globalStyle, columns, rows: tableRows, rowIndex: null };
}
