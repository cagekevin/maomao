/**
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
const tools = []

/** 追加一个工具定义，返回 def（便于链式/赋值）。重复 name 允许（注册表按注册序排列）。 */
export function registerTool(def) {
  if (def && typeof def === 'object' && def.name) tools.push(def)
  return def
}

/** 返回注册表数组（live 引用；顺序 = 注册序 = 模型选择优先级）。 */
export function getTools() {
  return tools
}

/** 清空注册表（测试隔离用；生产不要调用）。 */
export function resetTools() {
  tools.length = 0
}