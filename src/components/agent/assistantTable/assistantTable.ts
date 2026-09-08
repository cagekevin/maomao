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
 *  - id 生成唯一走 tableIds.ts（newTabId/newColId/newRowId，前缀 atab/acol/arow；2026-09-08 收口），
 *    禁 Date.now()/index 当行键、禁散落 generateId('col'|'row'|'tab')。
 *  - 入参命名 `sb` 沿袭 scriptBox 时代（sb≈storyboard 表/脚本盒）；2026-09-06 决策：
 *    改名 sb→table 风险>收益（导出函数名已固定、测试即护栏），暂不改，读代码把 sb 当 table 即可。
 *
 * 数据形态（与 mockup `ROWS`/`OPS` 及会话记忆 assistantTable 字段一致）：
 *   AssistantTable = { columns: TableColumn[], rows: TableRow[] }
 *   单元格值以「列 id → 文本」映射存 row.values[columnId]（列增删不毁行）。
 *   globalStyle 不在本表存（复用会话 memory.global_contract.unified_style_prompt），
 *   由上层经 rowToObj/rowToText 序列化注入；AI 返回经 buildPreviewResult 统一推导
 *   （预览=确认的唯一数据源，替代旧 jsonToSb / mergeRowFromObj / buildPreviewModel）。
 */
import { newTabId, newColId, newRowId } from './tableIds.ts';

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
        id: String(col.id ?? '') || newColId(),
        label,
        ...(width !== undefined ? { width } : {}),
      });
    }
  }
  // 行归一：values 只保留已声明列的字符串值；extra 忽略
  const rows: TableRow[] = [];
  if (Array.isArray(r.rows)) {
    for (const row of r.rows as unknown[]) {
      if (!row || typeof row !== 'object') continue;
      const rw = row as Record<string, unknown>;
      const rowId = String(rw.id ?? '') || newRowId();
      const values: Record<string, string> = {};
      const v =
        rw.values && typeof rw.values === 'object' ? (rw.values as Record<string, unknown>) : {};
      for (const col of columns) {
        const cell = v[col.id];
        values[col.id] = typeof cell === 'string' ? cell : '';
      }
      rows.push({ id: rowId, values });
    }
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
  const columns = header.map((label) => ({ id: newColId(), label }));
  const rows: TableRow[] = [];
  for (let i = 1; i < grid.length; i++) {
    const cells = grid[i];
    const values: Record<string, string> = {};
    for (let ci = 0; ci < columns.length; ci++) {
      values[columns[ci].id] = String(cells[ci] ?? '').trim();
    }
    if (!rowHasText(values)) continue; // 跳过全空数据行（B-006 统一实现）
    rows.push({ id: newRowId(), values });
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
  return { ...sb, rows: [...sb.rows, { id: newRowId(), values }] };
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
  const copy: TableRow = { id: newRowId(), values: { ...src.values } };
  const rows = sb.rows.slice();
  rows.splice(idx + 1, 0, copy);
  return { ...sb, rows };
}

/** 在指定行之后插入一个空行（列对齐 columns；rowId 不存在或缺省 → 追加末尾）。行尾 ⋯「插入空行（下方）」用 */
export function insertRowAfter(sb: AssistantTable, rowId?: string): AssistantTable {
  const values: Record<string, string> = {};
  for (const col of sb.columns) values[col.id] = '';
  const row: TableRow = { id: newRowId(), values };
  const rows = sb.rows.slice();
  const idx = rowId ? rows.findIndex((r) => r.id === rowId) : -1;
  if (idx >= 0) rows.splice(idx + 1, 0, row);
  else rows.push(row);
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
  const col: TableColumn = { id: newColId(), label: name };
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

/**
 * 行 → 一段可读文本（每列一行「列名：值」），供「发送到画布」/ 上下文拼装。
 * @param globalStyle 可选；传入则作为前缀（全局样式）拼到行内容之前，形如「全局样式\n\n列名：值…」。
 *   仅「发送到画布」路径传它；AI 上下文拼装由调用方单独注入 globalStyle，传空即可避免重复。
 * @param tableName 可选；传入则文本首行加「表名：{tableName}」（spec 3.7，仅落画布路径传；
 *   AI 注入路径不传，避免污染模型上下文）。多表期用表名区分来源。
 */
export function rowToText(
  sb: AssistantTable,
  row: TableRow,
  globalStyle?: string,
  tableName?: string,
): string {
  const parts: string[] = [];
  const head: string[] = [];
  if (tableName && String(tableName).trim()) head.push(`表名：${String(tableName).trim()}`);
  for (const col of sb.columns) {
    const v = row.values[col.id] ?? '';
    if (v) parts.push(`${col.label}：${v}`);
  }
  const body = parts.join('\n');
  const gs = globalStyle && globalStyle.trim() ? globalStyle.trim() : '';
  const seg = gs ? `${gs}\n\n${body}` : body;
  const h = head.join('\n');
  return h ? `${h}\n${seg}`.replace(/\n+$/g, '') : seg;
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

/**
 * 剥离「表格 JSON 块」、只留前后自然语言（供表格消息在对话流里显示 JSON 之外的话）。
 *
 * 【为什么需要它】表格消息的完整回复（含 JSON 前后的自然语言）一直存在 message.content，
 *   但对话流把整条正文隐藏以不跟左侧表格预览重复。本函数把 JSON 那段扣掉、保留前后文字，
 *   让"AI 除了 JSON 还说了什么"能被看到。
 *
 * 【最简单的做法 · 不追求精确】复刻 tryParseAssistantTableJson 的同款粗截取：
 *   取「第一个 `{` 到最后一个 `}`」当表格 JSON 段并删除（连带剥掉可能带的 ```json/``` 围栏）。
 *   剥离错误/残留 JSON 无妨——本函数只是"尽量留自然语言"的展示层辅助，不做结构判定。
 *
 * @returns 剥离后的剩余文本（trim）；未命中任何 `{...}` 时原样返回。
 */
export function stripAssistantTableJson(text: unknown): string {
  if (typeof text !== 'string') return String(text ?? '');
  let s = text;
  // 围栏直接剥掉（可能包在 JSON 前后或本无围栏）
  s = s.replace(/```json/gi, '').replace(/```/g, '');
  const f = s.indexOf('{');
  const p = s.lastIndexOf('}');
  // 没有成对花括号 → 非表格 JSON，原样返回
  if (f < 0 || p <= f) return text;
  const before = s.slice(0, f).trim();
  const after = s.slice(p + 1).trim();
  return [before, after].filter(Boolean).join('\n');
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
  /** 「确认后会写回变化」的行在 rows 里的 0 基下标（折叠时展开、其余折叠）。空/缺省=不做折叠（全展开） */
  changedIndexes?: number[];
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
  /**
   * 「确认后会因本次写回而变化」的行 id（在 resultRows 内）。
   * 语义：预览卡据此把变化行完整展开、未变化行折叠。
   *  - update：被 AI 覆盖的目标行 + 未命中目标而追加的新行；
   *  - append：末尾追加的新行；原现有行不在内；
   *  - replace（空表建表）：全为新建行 → 全部在内（卡端因无「未变行」不启用折叠）。
   */
  changedRowIds: string[];
}

/** 列名归一：trim + 折叠多余空白，供「AI 键名 ↔ 现有列」模糊匹配（A-005，C3）。
 * 导出供 tableInvariants.ts 复用做「同名列」判定（S2，同一套归一口径，禁止裸 ===）。 */
export function normalizeLabel(label: string): string {
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
    const resultCols: TableColumn[] = keys.map((label) => ({ id: newColId(), label }));
    const resultRows: TableRow[] = [];
    for (const raw of rawRows) {
      if (!raw || typeof raw !== 'object') continue;
      const obj = raw as Record<string, unknown>;
      const values: Record<string, string> = {};
      for (const col of resultCols) values[col.id] = String(obj[col.label] ?? '').trim();
      if (!rowHasText(values)) continue;
      resultRows.push({ id: newRowId(), values });
    }
    return {
      opKind: 'replace',
      resultCols,
      resultRows,
      updatedCount: 0,
      appendedCount: resultRows.length,
      // 空表建表：整表都是新建行 → 全部标记 changed（无「未变行」可折叠，卡端据此不折叠）
      changedRowIds: resultRows.map((r) => r.id),
    };
  }

  // ── 非空表：列 = 现有列（保 id/width）+ 未命中键的新列（追加末尾，C3）──
  const labelToCol = new Map<string, TableColumn>();
  for (const c of current.columns) labelToCol.set(normalizeLabel(c.label), c);
  const resultCols = [...current.columns];
  for (const k of keys) {
    if (!labelToCol.has(normalizeLabel(k))) {
      const col: TableColumn = { id: newColId(), label: k };
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
    return { id: newRowId(), values };
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
      // 追加：仅末尾新增行是「写回变化」，原有行不在内
      changedRowIds: added.map((r) => r.id),
    };
  }

  // ── update：命中目标的行按 AI 覆盖提及列，未提及列保留原值；未命中目标的 AI 行追加末尾 ──
  const nextRows = current.rows.map((r) => ({ id: r.id, values: { ...r.values } }));
  const changed = new Set<string>();
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
      changed.add(nextRows[ti].id); // 被 AI 覆盖的目标行 = 写回变化
      updatedCount++;
    } else {
      const added = materialize(raw as Record<string, unknown>);
      nextRows.push(added);
      changed.add(added.id); // 未命中目标而追加的新行 = 写回变化
      appendedCount++;
    }
  }
  return {
    opKind: 'update',
    resultCols,
    resultRows: nextRows,
    updatedCount,
    appendedCount,
    changedRowIds: [...changed],
  };
}

/* ════════════════════════════════════════════════════════════════
 * 多标签页（一对话多表）—— tab 数据模型 + 纯函数层（spec/AI-ASSISTANT-TABLE-TABS.md §1）
 * ════════════════════════════════════════════════════════════════
 * 真源 = 会话记忆 memory.assistantTables = AssistantTableTabs；memory.assistantTable 只读兼容（老数据水合）。
 * globalStyle【本轮隔离决策】每 tab 独立（不再走 global_contract）。
 * 行/列既有纯函数签名不动，统一由 updateTab(tabs, tabId, fn) 套用到当前 tab 的表上。
 */

/** 一个标签页 = 一张独立的、隔离的表 */
export interface TableTab {
  id: string;
  name: string;
  columns: TableColumn[];
  rows: TableRow[];
  globalStyle: string; // 【本轮隔离决策】本表独立，不进 global_contract
}

/** 一个对话的多标签页集合（会话记忆内聚字段，单一数据源） */
export interface AssistantTableTabs {
  tabs: TableTab[];
  activeTabId: string;
}

/** 反序列化宽松形态（供 normalizeAssistantTabs 归一，兼容历史/脏数据） */
export interface RawAssistantTableTabs {
  tabs?: unknown[];
  activeTabId?: unknown;
  [key: string]: unknown;
}

/** 空 tab 集合 = 恒 ≥1 空表（不做「零 tab」态，防空指针分支） */
export function emptyAssistantTabs(): AssistantTableTabs {
  const tab: TableTab = {
    id: newTabId(),
    name: '标签页1',
    columns: [],
    rows: [],
    globalStyle: '',
  };
  return { tabs: [tab], activeTabId: tab.id };
}

/** 单个 tab 归一（id/name/globalStyle 补缺省；表格 columns/rows 复用 normalizeAssistantTable） */
function normalizeTab(raw: unknown, index: number): TableTab | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  const table = normalizeAssistantTable(t);
  return {
    id: String(t.id ?? '') || newTabId(),
    name: String(t.name ?? '').trim() || `标签页${index + 1}`,
    columns: table.columns,
    rows: table.rows,
    globalStyle: typeof t.globalStyle === 'string' ? t.globalStyle.trim() : '',
  };
}

/**
 * 归一多标签页集合（spec §1.2）：
 *  ① raw.assistantTables 存在且合法 → 直接归一（补 id/name/globalStyle 缺省）；
 *  ② 否则老数据 assistantTable 有列/行 → 升为单 tab「表1」，globalStyle 一次性从 legacy.globalStyle 水合；
 *  ③ 都没有 → emptyAssistantTabs()。
 *  activeTabId 缺失/指向不存在 tab → 回退第一个 tab。
 * @param raw        memory.assistantTables 原始值
 * @param legacy     老数据水合源 { assistantTable, globalStyle }（来自 memory.assistantTable / global_contract）
 */
export function normalizeAssistantTabs(
  raw: unknown,
  legacy?: { assistantTable?: unknown; globalStyle?: string },
): AssistantTableTabs {
  if (raw && typeof raw === 'object') {
    const r = raw as RawAssistantTableTabs;
    if (Array.isArray(r.tabs) && r.tabs.length > 0) {
      const tabs = r.tabs
        .map(normalizeTab as (t: unknown, i: number) => TableTab | null)
        .filter((t): t is TableTab => t !== null);
      if (tabs.length > 0) {
        let active = String(r.activeTabId ?? '');
        if (!tabs.some((t) => t.id === active)) active = tabs[0].id;
        return { tabs, activeTabId: active };
      }
    }
  }
  // 老数据水合：memory.assistantTable 有列/行 → 升为单 tab（globalStyle 从 legacy 水合，老数据不丢风格）
  const legacyTable = normalizeAssistantTable(legacy?.assistantTable ?? null);
  if (legacyTable.columns.length > 0 || legacyTable.rows.length > 0) {
    const tab: TableTab = {
      id: newTabId(),
      name: '标签页1',
      columns: legacyTable.columns,
      rows: legacyTable.rows,
      globalStyle: String(legacy?.globalStyle ?? '').trim(),
    };
    return { tabs: [tab], activeTabId: tab.id };
  }
  return emptyAssistantTabs();
}

/** 取某 tab；不存在返回 null（幂等） */
export function getTab(tabs: AssistantTableTabs, tabId: string): TableTab | null {
  if (!tabs || !Array.isArray(tabs.tabs)) return null;
  return tabs.tabs.find((t) => t.id === tabId) ?? null;
}

/** 取当前活动 tab；无/异常回退第一个；再空 → null */
export function getActiveTab(tabs: AssistantTableTabs): TableTab | null {
  if (!tabs || !Array.isArray(tabs.tabs) || tabs.tabs.length === 0) return null;
  return getTab(tabs, tabs.activeTabId) ?? tabs.tabs[0];
}

/**
 * 把 fn 套用到某 tab 的表上并返回新 tabs（列/行纯函数统一经过这里，签名不动）。
 * fn 返回新 { columns, rows }；tab 的 id/name/globalStyle 保留。
 */
export function updateTab(
  tabs: AssistantTableTabs,
  tabId: string,
  fn: (sb: AssistantTable) => AssistantTable,
): AssistantTableTabs {
  if (!tabs || !Array.isArray(tabs.tabs)) return tabs;
  return {
    ...tabs,
    tabs: tabs.tabs.map((t) => {
      if (t.id !== tabId) return t;
      const next = fn({ columns: t.columns, rows: t.rows });
      return { ...t, columns: next.columns, rows: next.rows };
    }),
  };
}

/** 整表替换某 tab（预览确认写回用；保留了 tab id/name/globalStyle） */
export function setTabTable(
  tabs: AssistantTableTabs,
  tabId: string,
  sb: { columns: TableColumn[]; rows: TableRow[] },
): AssistantTableTabs {
  return updateTab(tabs, tabId, () => ({ columns: sb.columns, rows: sb.rows }));
}

/** 写某 tab 的 globalStyle（隔离决策：本表独立，不进 global_contract） */
export function setTabGlobalStyle(
  tabs: AssistantTableTabs,
  tabId: string,
  style: string,
): AssistantTableTabs {
  const gs = String(style ?? '').trim();
  return {
    ...tabs,
    tabs: tabs.tabs.map((t) => (t.id === tabId ? { ...t, globalStyle: gs } : t)),
  };
}

/** 设置活动 tab；tabId 不存在回退第一个（保持恒有活动 tab） */
export function setActiveTabId(tabs: AssistantTableTabs, tabId: string): AssistantTableTabs {
  if (!tabs || !Array.isArray(tabs.tabs) || tabs.tabs.length === 0) return tabs;
  const active = tabs.tabs.some((t) => t.id === tabId) ? tabId : tabs.tabs[0].id;
  return { ...tabs, activeTabId: active };
}

/** 追加一个新空 tab（name 缺省「表N」，N = 当前数+1），返回新 tabs（不自动切 active，调用方按需 setActiveTabId） */
export function addTab(tabs: AssistantTableTabs, name?: string): AssistantTableTabs {
  const tab: TableTab = {
    id: newTabId(),
    name: String(name ?? '').trim() || `标签页${tabs.tabs.length + 1}`,
    columns: [],
    rows: [],
    globalStyle: '',
  };
  return { ...tabs, tabs: [...tabs.tabs, tab] };
}

/** 重命名 tab（空名/相同幂等返回原 tabs） */
export function renameTab(
  tabs: AssistantTableTabs,
  tabId: string,
  name: string,
): AssistantTableTabs {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return tabs;
  return {
    ...tabs,
    tabs: tabs.tabs.map((t) =>
      t.id === tabId && t.name !== trimmed ? { ...t, name: trimmed } : t,
    ),
  };
}

/**
 * 移除某 tab。最后一个 tab 不允许移除（UI 禁用；此处防御：仅剩 1 个时不删，保持恒 ≥1）。
 * 若删的是 active，active 回退到同位置的下一个（末尾则回退到新的最后一个）。
 */
export function removeTab(tabs: AssistantTableTabs, tabId: string): AssistantTableTabs {
  if (!tabs || !Array.isArray(tabs.tabs)) return tabs;
  if (tabs.tabs.length <= 1) return tabs; // 恒 ≥1 空表，防「零 tab」分支
  const idx = tabs.tabs.findIndex((t) => t.id === tabId);
  if (idx < 0) return tabs;
  const next = tabs.tabs.filter((t) => t.id !== tabId);
  let active = tabs.activeTabId;
  if (active === tabId || !next.some((t) => t.id === active)) {
    const fallbackIdx = Math.min(idx, next.length - 1);
    active = next[fallbackIdx].id;
  }
  return { tabs: next, activeTabId: active };
}

/** 复制某 tab 为新表（新 id/新空间；原名「表X 副本」或自动 `表N`；不自动切 active） */
export function copyTab(tabs: AssistantTableTabs, tabId: string): AssistantTableTabs {
  const src = getTab(tabs, tabId);
  if (!src) return tabs;
  // 副本要有独立的列 id 空间（不与源表共用，避免跨表粘贴/合并时串味）；
  // 但行的 values 是以 colId 为 key 的，必须按同一份映射同步换 key ——
  // 否则「新列 id + 旧 key」对不上，副本渲染出来是一张空表（历史 bug，2026-09-08 修）。
  const idMap = new Map<string, string>();
  const columns: TableColumn[] = src.columns.map((c) => {
    const nextId = newColId();
    idMap.set(c.id, nextId);
    return { ...c, id: nextId };
  });
  // 按 columns 顺序重建 values（未声明列的孤儿 key 随归一语义丢弃）
  const rows: TableRow[] = src.rows.map((r) => {
    const values: Record<string, CellValue> = {};
    for (const c of src.columns) {
      const to = idMap.get(c.id);
      if (to) values[to] = r.values?.[c.id] ?? '';
    }
    return { id: newRowId(), values };
  });
  const tab: TableTab = {
    id: newTabId(),
    name: `标签页${tabs.tabs.length + 1}`,
    columns,
    rows,
    globalStyle: src.globalStyle,
  };
  return { ...tabs, tabs: [...tabs.tabs, tab] };
}

/** 移动 tab 位置（拖拽排序；fromIdx/toIdx 越界/clamp；返回新 tabs） */
export function moveTab(
  tabs: AssistantTableTabs,
  fromIdx: number,
  toIdx: number,
): AssistantTableTabs {
  if (!tabs || !Array.isArray(tabs.tabs)) return tabs;
  const arr = tabs.tabs.slice();
  if (fromIdx < 0 || fromIdx >= arr.length) return tabs;
  const [moved] = arr.splice(fromIdx, 1);
  const target = Math.max(0, Math.min(toIdx, arr.length));
  arr.splice(target, 0, moved);
  return { ...tabs, tabs: arr };
}

/* ═ 批量 / 选区 / 跨表纯函数（spec §3.6）═ */

/**
 * 单元格矩形选区（spec 3.6）：**起点 + 终点用 rowId/colId 锚定**，不用 index ——
 * 增删行/列后 index 会串位（A-005 类静默错值），id 锚定则选区始终跟着原单元格。
 */
export interface CellRange {
  r0: string;
  c0: string;
  r1: string;
  c1: string;
}

/** 选区 → 二维 cells（按表内行列顺序归一化成矩形；任一锚点失效返回 []） */
export function rangeToCells(sb: AssistantTable, range: CellRange): string[][] {
  if (!sb || !range) return [];
  const idx = (arr: Array<{ id: string }>, id: string) => arr.findIndex((x) => x.id === id);
  const a = idx(sb.rows, range.r0);
  const b = idx(sb.rows, range.r1);
  const c = idx(sb.columns, range.c0);
  const d = idx(sb.columns, range.c1);
  if (a < 0 || b < 0 || c < 0 || d < 0) return [];
  const [r0, r1] = [Math.min(a, b), Math.max(a, b)];
  const [c0, c1] = [Math.min(c, d), Math.max(c, d)];
  const out: string[][] = [];
  for (let i = r0; i <= r1; i++) {
    const line: string[] = [];
    for (let j = c0; j <= c1; j++) line.push(String(sb.rows[i].values?.[sb.columns[j].id] ?? ''));
    out.push(line);
  }
  return out;
}

/** 选区 → TSV（制表符分隔，可直接粘进 Excel/Sheets；spec §5 要求新增） */
export function rangeToTsv(sb: AssistantTable, range: CellRange): string {
  return rangeToCells(sb, range)
    .map((line) => line.join('\t'))
    .join('\n');
}

/**
 * 把二维 cells 从锚点格起按矩形铺开写入（spec 3.6）。
 * ⚠️ 越界**只裁剪、绝不静默扩列/加行**：超出列数/行数的内容丢弃（复制时已 toast 提示），
 * 避免"粘一下表结构被撑变形"。返回新表；锚点失效返回原表。
 */
export function pasteCells(
  sb: AssistantTable,
  anchor: { rowId: string; colId: string },
  cells: string[][],
): AssistantTable {
  if (!sb || !cells.length || !cells[0].length) return sb;
  const r0 = sb.rows.findIndex((r) => r.id === anchor.rowId);
  const c0 = sb.columns.findIndex((c) => c.id === anchor.colId);
  if (r0 < 0 || c0 < 0) return sb;
  const rows = sb.rows.map((r) => ({ ...r, values: { ...r.values } }));
  for (let i = 0; i < cells.length; i++) {
    const ri = r0 + i;
    if (ri >= rows.length) break;
    for (let j = 0; j < cells[i].length; j++) {
      const ci = c0 + j;
      if (ci >= sb.columns.length) break;
      rows[ri].values[sb.columns[ci].id] = String(cells[i][j] ?? '');
    }
  }
  return { ...sb, rows };
}

/**
 * 批量删除多行（rowIds 中不存在的 id 忽略；返回新表）。
 * 用于行尾 ⋯「删除选中行」/ Delete/Backspace。
 */
export function deleteRows(sb: AssistantTable, rowIds: string[]): AssistantTable {
  const set = new Set(rowIds || []);
  if (!set.size) return sb;
  return { ...sb, rows: sb.rows.filter((r) => !set.has(r.id)) };
}

/**
 * 提取多行副本（供内部剪贴板「复制行」；深拷贝 values）。
 * 只返回选中行的数据（不含引用），粘贴时按列名归一重塑。
 */
export function copyRows(sb: AssistantTable, rowIds: string[]): TableRow[] {
  const set = new Set(rowIds || []);
  return sb.rows
    .filter((r) => set.has(r.id))
    .map((r) => ({ id: newRowId(), values: { ...r.values } }));
}

/**
 * 粘贴行到 sb：在 anchorRowId 之后插入 copied 行；无 anchor → 追加末尾。
 * 列按名归一命中（复用 buildPreviewResult 的 normalizeLabel 语义），未命中列放空值、绝不丢值（防 A-005 回潮）。
 * copied 行的 values 以「源列 label→文本」存；本函数按目标表列结构重塑。
 */
export function pasteRows(
  sb: AssistantTable,
  copied: TableRow[],
  anchorRowId?: string,
): AssistantTable {
  if (!Array.isArray(copied) || copied.length === 0) return sb;
  // 先把 copied 转成「目标列 label → 文本」（源 values 的键是源列 id，需带回源列名；这里约定 copyRows 之后
  // 由调用方在目标上下文对齐——为稳妥，本函数从 copied 行内嵌的 label 映射还原，见 buildPreviewResult 归一）。
  const labelToCol = new Map<string, TableColumn>();
  for (const c of sb.columns) labelToCol.set(normalizeLabel(c.label), c);
  const restructured = copied.map((r) => {
    const rawMap: Record<string, string> = {};
    for (const [k, v] of Object.entries(r.values ?? {})) rawMap[k] = v ?? '';
    const values: Record<string, string> = {};
    for (const col of sb.columns) {
      // 键可能是源列 id 或源列 label；先后按 label 精确、再按归一兜底
      const hit = rawMap[col.label] ?? rawMap[col.id];
      const norm = normalizeLabel(col.label);
      let v = hit;
      if (v === undefined) {
        for (const [k, val] of Object.entries(rawMap)) {
          if (normalizeLabel(k) === norm) {
            v = val;
            break;
          }
        }
      }
      values[col.id] = v !== undefined ? String(v) : '';
    }
    return { id: newRowId(), values };
  });
  const rows = sb.rows.slice();
  const anchorIdx = anchorRowId ? rows.findIndex((r) => r.id === anchorRowId) : -1;
  if (anchorIdx >= 0) rows.splice(anchorIdx + 1, 0, ...restructured);
  else rows.push(...restructured);
  return { ...sb, rows };
}

/**
 * 跨表复制：把 srcTab 的若干行复制到 destTab 末尾（列按名归一命中，未命中列留空）。
 * 复用 buildPreviewResult 的归一匹配思路；destTab 无列时按 src 列重建（新建表场景）。
 * ROI 判定用 updateTab。
 */
export function copyRowsToTab(
  tabs: AssistantTableTabs,
  srcTabId: string,
  destTabId: string,
  rowIds: string[],
): AssistantTableTabs {
  const src = getTab(tabs, srcTabId);
  const dst = getTab(tabs, destTabId);
  if (!src || !dst) return tabs;
  const set = new Set(rowIds);
  // 目标列 = 现有列 + src 里命中不到目标列的列（跨表归一：src 列 label 未在 dst 出现 → 追加）
  const labelToCol = new Map<string, TableColumn>();
  for (const c of dst.columns) labelToCol.set(normalizeLabel(c.label), c);
  const resultCols = [...dst.columns];
  for (const c of src.columns) {
    if (!labelToCol.has(normalizeLabel(c.label))) {
      const col: TableColumn = { id: newColId(), label: c.label };
      labelToCol.set(normalizeLabel(c.label), col);
      resultCols.push(col);
    }
  }
  // src 中被选行 → label→text 值映射（跨表复制以列 label 为归一键，复用 buildPreviewResult 同款匹配）
  const srcRowsLabel: Array<Record<string, string>> = src.rows
    .filter((r) => set.has(r.id))
    .map((r) => {
      const map: Record<string, string> = {};
      for (const c of src.columns) map[c.label] = (r.values[c.id] ?? '') as string;
      return map;
    });
  // 重塑进目标表列结构（未命中列留空、绝不静默丢值）
  const newRows: TableRow[] = srcRowsLabel.map((map) => {
    const values: Record<string, string> = {};
    for (const col of resultCols) {
      const direct = map[col.label];
      const norm = normalizeLabel(col.label);
      let v = direct;
      if (v === undefined) {
        for (const [k, val] of Object.entries(map)) {
          if (normalizeLabel(k) === norm) {
            v = val;
            break;
          }
        }
      }
      values[col.id] = v !== undefined ? String(v) : '';
    }
    return { id: newRowId(), values };
  });
  return {
    ...tabs,
    tabs: tabs.tabs.map((t) => {
      if (t.id !== destTabId) return t;
      return { ...t, columns: resultCols, rows: [...t.rows, ...newRows] };
    }),
  };
}

/* ═ 跨标签页「查找替换」（spec：查找替换面板；纯文本、不区分大小写、不支持正则）═
 * 仅替换【单元格文本】（row.values[colId]），不动列名 / 表结构 / globalStyle（防崩边界）。
 * 用 indexOf 循环（不用正则，规避 `.`/`*` 等元字符被当正则语法崩坏）。 */

/**
 * 单单元格替换底层。
 *  - matchCount：匹配命中次数（面板「找到 M 处」用，与 replace 无关）；
 *  - changeCount：值真正变化的次数（replaceTextInTabs 的 count / toast「已替换 M 处」用；
 *    replace===find 等 no-op 匹配记为 0，避免谎报）。
 * 防无限循环：replace 串若含 find 子串，i 从 idx+flen 推进，不会回退重匹配。
 */
function replaceInCell(
  text: string,
  find: string,
  replace: string,
): { text: string; matchCount: number; changeCount: number } {
  if (!find) return { text, matchCount: 0, changeCount: 0 };
  const lower = text.toLowerCase();
  const f = find.toLowerCase();
  const flen = f.length;
  let i = 0;
  let out = '';
  let matchCount = 0;
  let changeCount = 0;
  while (true) {
    const idx = lower.indexOf(f, i);
    if (idx < 0) {
      out += text.slice(i);
      break;
    }
    const original = text.slice(idx, idx + flen);
    out += text.slice(i, idx) + replace;
    matchCount += 1;
    if (original !== replace) changeCount += 1;
    i = idx + flen;
  }
  return { text: out, matchCount, changeCount };
}

/**
 * 跨所有标签页替换单元格文本（全量一次性不可变更新；原子、无中间态）。
 * find 空 或 无任何变化 → 返回【原 tabs 引用】（幂等，不入新对象、不污染撤销栈）。
 * @returns { tabs, count } —— count = changeCount（实际改变处数，供 toast）。
 */
export function replaceTextInTabs(
  tabs: AssistantTableTabs,
  find: string,
  replace: string,
): { tabs: AssistantTableTabs; count: number } {
  if (!find) return { tabs, count: 0 };
  let total = 0;
  let anyChanged = false;
  const nextTabs: AssistantTableTabs = {
    ...tabs,
    tabs: tabs.tabs.map((t) => {
      let tabChanged = false;
      const rows = t.rows.map((r) => {
        const values = { ...r.values };
        for (const colId of Object.keys(values)) {
          const res = replaceInCell(values[colId], find, replace);
          if (res.text !== values[colId]) {
            values[colId] = res.text;
            total += res.changeCount;
            tabChanged = true;
          }
        }
        return tabChanged ? { ...r, values } : r; // 未变行保留原引用（不可变纪律）
      });
      if (!tabChanged) return t; // 未变 tab 保留原引用
      anyChanged = true;
      return { ...t, rows };
    }),
  };
  if (!anyChanged) return { tabs, count: 0 }; // 原样返回（幂等）
  return { tabs: nextTabs, count: total };
}

/**
 * 跨所有标签页实时统计 find 匹配次数（面板预览「找到 M 处」用；与 replace 无关，纯读数）。
 * find 空 → 0。
 */
export function countMatchesInTabs(tabs: AssistantTableTabs, find: string): number {
  if (!find) return 0;
  let total = 0;
  for (const t of tabs.tabs) {
    for (const r of t.rows) {
      for (const colId of Object.keys(r.values)) {
        total += replaceInCell(r.values[colId], find, find).matchCount;
      }
    }
  }
  return total;
}

/* ═ 系统剪贴板单元格粘贴解析（spec interaction-model §1.4）═
 * 把「外部复制来的文本」解析成可在表内按矩形铺开的二维 cells。
 * 与 parsePasted 的区别：parsePasted 把首行当表头（用于整体建表）；本函数只做"粘贴进已有格的矩形数据"，
 * 首行就是数据、非表头。返回 null 表示纯单值（无 \t 无换行），由调用方走单格覆盖。 */

/**
 * 解析系统剪贴板文本 → 判定是否"网格粘贴"。
 * @returns { cells } 非空返回二维 cells（含制表符或换行 → 网格）；单值/空 → null（调用方按单格覆盖处理）。
 *   - 按 \n 分行、\t 分格（与 rangeToTsv 对称）；\r 剥掉；
 *   - 行不要求等长（粘贴时越界自动裁剪，绝不扩列/加行，对齐 pasteCells 语义）；
 *   - 全空文本返回 null。
 */
export function parseClipboardGrid(text: string): string[][] | null {
  const s = String(text ?? '');
  if (!s.trim()) return null;
  // 仅含单个换行（内部允许 \n 作"内容换行"，此时仍算单值）——业界：纯多行且无 \t 才按列。
  if (!s.includes('\t')) {
    // 无制表符：若是单行值（多行文本里也无 \t）→ 视为单格（保留内嵌换行原样）
    return null;
  }
  const grid = s
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.split('\t'));
  if (!grid.length) return null;
  return grid;
}

/**
 * 读某格当前文本（含草稿回退 backing；供系统剪贴板单格复制）。业务由 UI 层提供值，本函数仅归一。
 */
export function cellCopyText(value: string): string {
  return String(value ?? '');
}
