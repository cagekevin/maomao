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
 *   由上层经 rowToObj/rowToText 序列化注入；AI 返回经 buildPreviewResult 统一推导
 *   （预览=确认的唯一数据源，替代旧 jsonToSb / mergeRowFromObj / buildPreviewModel）。
 */
import { generateId } from '@/components/base/core/idGen.ts';

/** 单元格值：数据层固定字符串；编辑态由 UI 层持有 */
export type CellValue = string;

/** 一列：id 稳定唯一，label 即显示列名（粘贴首行 / AI 设计），顺序即显示顺序 */
export interface TableColumn {
  id: string;
  label: string;
  /** 手动锁定列宽（px）：用户拖拽落点写回此处并持久化到会话记忆；未设时由 UI 按内容估算。 */
  width?: number;
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

/** 行对象里的可选「行号定位」保留键（1 起，非列名）。
 *  用于改单行时前端精准 patch 到对应行（即使内容全改也能对上），解析层必须把它当元数据、不当列。 */
export const ROW_INDEX_KEY = '_rowIndex';

/**
 * 从某行对象提取行号（1 起）：`{ "_rowIndex": 2, ... }` → 1（0-based index）。无/非法返回 null。
 * 该键是定位元数据、不是表格列，调用方拿到后应避免让 `_rowIndex` 进入列结构/单元格值。
 */
export function extractRowIndex(row: unknown): number | null {
  if (!row || typeof row !== 'object') return null;
  const v = (row as Record<string, unknown>)[ROW_INDEX_KEY];
  if (v === undefined || v === null) return null;
  const n = Number.parseInt(String(v), 10);
  if (!Number.isInteger(n) || n < 1) return null;
  return n - 1; // 1 起 → 0-based
}

/** 空行判定（B-006 单一实现，parsePasted / buildPreviewResult 共用）：所有单元格 trim 后均为空串 → 空行 */
export function rowHasText(values: Record<string, unknown>): boolean {
  for (const v of Object.values(values)) {
    if (String(v ?? '').trim() !== '') return true;
  }
  return false;
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
      const width =
        typeof col.width === 'number' && Number.isFinite(col.width) ? col.width : undefined;
      columns.push({
        id: String(col.id ?? '') || generateId('col'),
        label,
        ...(width !== undefined ? { width } : {}),
      });
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
    for (let ci = 0; ci < columns.length; ci++) {
      values[columns[ci].id] = String(cells[ci] ?? '').trim();
    }
    if (!rowHasText(values)) continue; // 跳过全空数据行（B-006 统一实现）
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

/**
 * 单列「表头 + 该列最长内容」的舒适估算宽度（px）。仅用于未手动锁定列宽时的首帧/结构变化估算，
 * 非实时 DOM 测量（中文按 2 字宽）。clamp 在 90~240，避免极窄/极宽。纯函数无副作用，便于单测。
 */
export function estimateColumnWidth(label: string, rows: TableRow[], colId: string): number {
  const per = 13; // 每字约 px（12px 字号）
  const pad = 24; // 左右内边距 + 富余
  const min = 90;
  const max = 240;
  // 表头与内容统一按「中文 2 字宽 / 其它 1 字宽」计长（避免中文表头被低估、列偏窄）
  const charW = (s: string): number => {
    let n = 0;
    for (const ch of s) n += ch.charCodeAt(0) > 255 ? 2 : 1;
    return n;
  };
  let longest = charW(label);
  for (const row of rows) {
    const v = row.values[colId] ?? '';
    if (!v) continue;
    const len = charW(v);
    if (len > longest) longest = len;
  }
  return Math.max(min, Math.min(max, Math.round(longest * per + pad)));
}

/** 写某列手动宽度（不可变、幂等；width 非法忽略）。用于拖拽落点一次性写回（持久化到会话记忆）。 */
export function setColumnWidth(sb: AssistantTable, colId: string, width: number): AssistantTable {
  const idx = sb.columns.findIndex((c) => c.id === colId);
  if (idx < 0) return sb; // 未知列忽略
  const w = Math.round(width);
  if (!Number.isFinite(w)) return sb;
  const col = sb.columns[idx];
  if ((col.width ?? null) === w) return sb; // 相同幂等
  return { ...sb, columns: sb.columns.map((c, i) => (i === idx ? { ...c, width: w } : c)) };
}

/**
 * 追加一列到末尾（label 缺省用占位名「新列N」）。已有行补该列空键，保证列键对齐、渲染不缺键。
 * 复用 insertColumnAfter（colId 缺省 = 追加到末尾），单一实现不漂移。
 */
export function addColumn(sb: AssistantTable, label?: string): AssistantTable {
  return insertColumnAfter(sb, undefined, label);
}

/**
 * 在指定列**后**插入一列（label 缺省用占位名「新列N」）；colId 不存在或缺省 → 追加到末尾（幂等回退）。
 * 与 addColumn 的区别：可插任意位置（不止末尾），供表头「+」在任意列后加列（2026-09-06 用户裁定：
 * 添加列不再固定只能加末尾）。已有行补该列空键，保证列键对齐、渲染不缺键。不可变（原表不动）。
 */
export function insertColumnAfter(
  sb: AssistantTable,
  colId?: string,
  label?: string,
): AssistantTable {
  const l = String(label ?? '').trim();
  const name = l || `新列${sb.columns.length + 1}`;
  const col: TableColumn = { id: generateId('col'), label: name };
  const idx = colId ? sb.columns.findIndex((c) => c.id === colId) : -1;
  const at = idx >= 0 ? idx + 1 : sb.columns.length;
  const columns = [...sb.columns.slice(0, at), col, ...sb.columns.slice(at)];
  const rows = sb.rows.map((r) => ({ ...r, values: { ...r.values, [col.id]: '' } }));
  return { ...sb, columns, rows };
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

/**
 * 从 assistant 消息文本里尝试解析「表格 JSON」。
 * 语义：文本含 JSON 对象且有 `rows` 数组 → 视为表格 JSON（整表或单行均可）。
 * @returns 解析成功返回 { json }；否则返回 null（透传调用方判断是普通回复）。
 * 说明：只做探测，不判定意图（update/append/replace）——由 buildPreviewResult 按选中态统一判定。
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

/** 预览卡显示模型：由 TablePreviewResult（resultCols/resultRows/opKind）派生，仅做形状格式，不重推数据（预览=确认） */
export interface AssistantTablePreview {
  kind: 'table';
  globalStyle: string;
  columns: string[];
  rows: Array<Record<string, string>>;
  /** 单行时为行号（1 起），整表为 null */
  rowIndex: number | null;
  /** 操作类别（update/append/replace），供预览卡文案（1.5 契约 C5 后由 result 派生） */
  opKind?: 'update' | 'append' | 'replace';
  updatedCount?: number;
  appendedCount?: number;
}

/** buildPreviewResult 产出：操作后最终表格（预览=确认的唯一数据源） */
export interface TablePreviewResult {
  opKind: 'update' | 'append' | 'replace';
  resultCols: TableColumn[];
  resultRows: TableRow[];
  /** update 场景：实际被更新的行数 */
  updatedCount: number;
  /** update 且 AI 行多于选中行时，追加到末尾的行数（append 场景=追加行数） */
  appendedCount: number;
}

/** 列名归一：trim + 折叠多余空白，供「AI 键名 ↔ 现有列」模糊匹配（A-005，C3） */
function normalizeLabel(label: string): string {
  return String(label ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * 统一「AI JSON → 操作后最终表格」推导（预览卡与确认写回共用，替代旧 jsonToSb / mergeRowFromObj / buildPreviewModel）。
 *
 * 意图判定（对齐 spec/AI-ASSISTANT-TABLE-IMPLEMENTATION.md §1.5.2 C2）：
 *  - 当前表无列 → replace：按 AI 返回建表（列 id 新建；全空行丢弃——C4）。
 *  - 逐行定目标：AI 行带合法 _rowIndex → 按行号定位（未选中也能改指定行，TABLE_RULES「把第 3 行改成 X」场景）；
 *    无 _rowIndex 时第 i 个 AI 行 → 第 i 个选中行（按表格顺序）。
 *  - 无任何目标（未选中且无 _rowIndex）→ append：AI 行原样追加末尾（现有列 id/width 全部保留）。
 *  - 有目标 → update：命中行只覆盖提及列、未提及保留原值；未命中目标的 AI 行追加末尾（M>N）。
 *  - 列合并（C3）：AI 键名 trim+折叠空白归一后命中现有列 → 沿用原列 id/width；未命中 → 新列追加末尾。
 *  - 值一律 trim；_rowIndex 是定位元数据，绝不当列；入参 sb 不 mutate。
 * 纯函数无副作用，便于单测。
 */
export function buildPreviewResult(
  sb: AssistantTable,
  json: AssistantTableJson,
  selectedRowIds: string[] = [],
): TablePreviewResult {
  const current =
    sb && Array.isArray(sb.columns) && Array.isArray(sb.rows) ? sb : emptyAssistantTable();
  const rawRows = Array.isArray(json?.rows) ? json.rows : [];

  // 收集 AI 全部键（按出现顺序去重）；_rowIndex 是定位元数据不当列
  const keys: string[] = [];
  for (const raw of rawRows) {
    if (!raw || typeof raw !== 'object') continue;
    for (const k of Object.keys(raw as Record<string, unknown>)) {
      if (k === ROW_INDEX_KEY || k.trim() === '') continue;
      if (!keys.includes(k)) keys.push(k);
    }
  }

  // ── replace：当前表无列 → 按 AI 建表（建表丢全空行，C4）──
  if (current.columns.length === 0) {
    const resultCols: TableColumn[] = keys.map((label) => ({ id: generateId('col'), label }));
    const resultRows: TableRow[] = [];
    for (const raw of rawRows) {
      if (!raw || typeof raw !== 'object') continue;
      const obj = raw as Record<string, unknown>;
      const values: Record<string, string> = {};
      for (const col of resultCols) values[col.id] = String(obj[col.label] ?? '').trim();
      if (!rowHasText(values)) continue;
      resultRows.push({ id: generateId('row'), values });
    }
    return {
      opKind: 'replace',
      resultCols,
      resultRows,
      updatedCount: 0,
      appendedCount: resultRows.length,
    };
  }

  // ── 非空表：列 = 现有列（保 id/width）+ 未命中键的新列（追加末尾，C3）──
  const labelToCol = new Map<string, TableColumn>();
  for (const c of current.columns) labelToCol.set(normalizeLabel(c.label), c);
  const resultCols = [...current.columns];
  for (const k of keys) {
    if (!labelToCol.has(normalizeLabel(k))) {
      const col: TableColumn = { id: generateId('col'), label: k };
      labelToCol.set(normalizeLabel(k), col);
      resultCols.push(col);
    }
  }
  /** 取某 AI 行中某列的值：先按列 label 精确取，再按归一化兜底（A-005）；未提及返回 undefined（保留原值） */
  const colValue = (obj: Record<string, unknown>, col: TableColumn): string | undefined => {
    if (col.label in obj) return String(obj[col.label] ?? '').trim();
    const norm = normalizeLabel(col.label);
    for (const k of Object.keys(obj))
      if (normalizeLabel(k) === norm) return String(obj[k] ?? '').trim();
    return undefined;
  };
  /** 按当前列结构把 AI 行物化成新 TableRow（未提及列补空串） */
  const materialize = (obj: Record<string, unknown>): TableRow => {
    const values: Record<string, string> = {};
    for (const col of resultCols) {
      const v = colValue(obj, col);
      values[col.id] = v !== undefined ? v : '';
    }
    return { id: generateId('row'), values };
  };

  // ── 逐行定目标：_rowIndex（1 起）优先按行号；无则第 i 个 AI 行 → 第 i 个选中行；再无 → 追加 ──
  const selIds = (selectedRowIds || []).filter((id) => current.rows.some((r) => r.id === id));
  const selectedRows = selIds.map((id) => current.rows.find((r) => r.id === id)!);
  const targets: Array<number | null> = rawRows.map((raw, i) => {
    if (raw && typeof raw === 'object') {
      const byIdx = extractRowIndex(raw);
      if (byIdx !== null && byIdx >= 0 && byIdx < current.rows.length) return byIdx;
    }
    const sel = selectedRows[i];
    return sel ? current.rows.indexOf(sel) : null;
  });

  // ── append：无任何目标（未选中且无 _rowIndex）→ AI 行原样追加末尾 ──
  if (!targets.some((t) => t !== null)) {
    const added = rawRows
      .filter((raw): raw is Record<string, unknown> => !!raw && typeof raw === 'object')
      .map((raw) => materialize(raw));
    return {
      opKind: 'append',
      resultCols,
      resultRows: [...current.rows, ...added],
      updatedCount: 0,
      appendedCount: added.length,
    };
  }

  // ── update：命中目标的行按 AI 覆盖提及列，未提及列保留原值；未命中目标的 AI 行追加末尾 ──
  const nextRows = current.rows.map((r) => ({ id: r.id, values: { ...r.values } }));
  let updatedCount = 0;
  let appendedCount = 0;
  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    if (!raw || typeof raw !== 'object') continue;
    const ti = targets[i];
    if (ti !== null) {
      const obj = raw as Record<string, unknown>;
      for (const col of resultCols) {
        const v = colValue(obj, col);
        if (v !== undefined) nextRows[ti].values[col.id] = v; // 只覆盖提及列，未提及保留原值
      }
      updatedCount++;
    } else {
      nextRows.push(materialize(raw as Record<string, unknown>));
      appendedCount++;
    }
  }
  return { opKind: 'update', resultCols, resultRows: nextRows, updatedCount, appendedCount };
}
