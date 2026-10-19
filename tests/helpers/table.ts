/**
 * 表格测试的「行列访问器」—— `noUncheckedIndexedAccess` 下测试侧 R4（领域嵌套）的唯一入口。
 *
 * 【为什么不是 at()】
 * 表格断言的真实写法是 `sb.rows[0].cells[1]`（两层索引）。直接套 `at()` 会变成
 * `at(at(sb.rows, 0).cells, 1)` —— 146 处双嵌套，可读性崩且错误信息仍是"第几层越界"。
 * 本辅助把「行/列/单元格」这三个领域概念收成单层调用，失败信息直接说清是哪个行列。
 *
 * 【签名为什么吃 rows/columns 而不是整表】
 * `buildPreviewResult` 等函数返回的是裸 `TableRow[]` / `TableColumn[]`（不是 AssistantTable），
 * 让辅助接受数组可以让 `sb.rows` 与 `r.resultRows` 共用同一套访问器，不写第二份。
 *
 * 【不适用】
 * 断言「该键/该行不存在」的场景（`expect(map[key]).toBeUndefined()`）不要套本辅助 ——
 * 那类断言的意图是"取不到"，包一层会把断言失败变成抛错。本文件只服务「已知存在」的读取。
 */
import type {
  AssistantTableTabs,
  TableColumn,
  TableRow,
  TableTab,
} from '../../src/components/agent/assistantTable/assistantTable.ts';
import { at } from './at';

/** 第 index 行（越界抛 `at(): 下标 N 越界（长度 M）`）。 */
export function rowOf(rows: readonly TableRow[], index: number): TableRow {
  return at(rows, index);
}

/** 第 row 行第 col 列单元格文本（任一层越界即抛出，带行列坐标）。 */
export function cellOf(rows: readonly TableRow[], row: number, col: number): string {
  return at(at(rows, row).cells, col);
}

/** 第 index 列。 */
export function colOf(columns: readonly TableColumn[], index: number): TableColumn {
  return at(columns, index);
}

/** 第 index 个标签页（`tabs.tabs[i]` 的语义化写法）。 */
export function tabOf(tabs: AssistantTableTabs, index: number): TableTab {
  return at(tabs.tabs, index);
}
