/**
 * ── 唯一性/兄弟声明（2026-08-30）──
 * 画布 AI 工具注册表（数组 push：registerTool/getTools/resetTools）。
 * 兄弟：taskStore.js 的 retryRegistry（Map<nodeId,fn> 键控回调注册表）——两者同为
 * 「运行时注册 + 查询」形态（toolRegistry 按注册序取全量，retryRegistry 按 key 取单个）。
 * 新增可插拔扩展点只能复用这两者之一，禁止再开第三种注册形态。
 *
 * ════════════════════════════════════════════════════════════════
 * 工具轴注册表（docs/25 · 阶段2）：AGENT_TOOLS 静态数组 → 可扩展注册表
 * ════════════════════════════════════════════════════════════════
 *
 * 【目标】加一个画布工具 = registerTool 一条，不碰其他逻辑。
 *
 * 【toolDef 结构】{ name, description, parameters, execute(ctx,args), mutating:bool }
 *   - mutating：该工具是否「写画布」（true → buildCanvasAgentTools 在调用前统一压 AI 撤销栈，
 *     使 undo_ai 能整体撤回）。由 useCanvasAgentTools 在注册时从 MUTATING_TOOLS 派生入条目。
 *
 * 【注册时机】约定 useCanvasAgentTools 模块**加载时同步 registerTool 一批**，保证：
 *   1) 工具定义与注册同模块、同次 module eval，顺序天然正确（无 TDZ / 初始化顺序雷）；
 *   2) 所有消费方（buildCanvasAgentTools / buildCanvasAgentToolSchemas / CANVAS_AGENT_TOOL_NAMES）
 *      在模块载入后读 getTools() 即可看到全量工具。
 *
 * 【幂等】getTools() 返回注册表数组引用（live）；resetTools() 仅供测试清空。
 * ════════════════════════════════════════════════════════════════
 */
/** 工具执行上下文（由 buildCanvasAgentTools 注入） */
export type ToolExecuteCtx = Record<string, unknown>

/** 工具定义（docs/25 · 阶段2） */
export interface ToolDef {
  name: string
  description?: string
  parameters?: unknown
  /** mutating=true → 调用前统一压 AI 撤销栈，使 undo_ai 能整体撤回 */
  mutating?: boolean
  execute: (ctx: ToolExecuteCtx, args?: Record<string, unknown>) => unknown | Promise<unknown>
  [key: string]: unknown
}

const tools: ToolDef[] = []

/** 追加一个工具定义，返回 def（便于链式/赋值）。重复 name 允许（注册表按注册序排列）。 */
export function registerTool<T extends ToolDef>(def: T): T {
  if (def && typeof def === 'object' && def.name) tools.push(def)
  return def
}

/** 返回注册表数组（live 引用；顺序 = 注册序 = 模型选择优先级）。 */
export function getTools(): ToolDef[] {
  return tools
}

/** 清空注册表（测试隔离用；生产不要调用）。 */
export function resetTools(): void {
  tools.length = 0
}