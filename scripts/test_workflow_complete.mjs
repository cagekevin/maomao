/**
 * AI 助手工作流完整测试（纯逻辑层，无 React/ReactFlow）。
 *
 * 覆盖：
 *  1. conversationStore 的工作流状态（pendingGenerations/aiUndoStack/awaitingConfirm）per-conversation
 *  2. 多对话隔离（不串话）
 *  3. 确认态：present_plan 置 awaitingConfirm → execute_plan 校验拒绝 → confirm 翻转 → 放行
 *
 * 运行：node scripts/test_workflow_complete.mjs
 * 说明：conversationStore 依赖 storageAdapter（localStorage），此处 mock 全局 localStorage。
 */
// ---- mock localStorage ----
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
}

const {
  ensureActiveConversation, applyConversation, switchConversation, newConversation,
  setActivePendingGenerations, getActivePendingGenerations,
  setAwaitingConfirm, getAwaitingConfirm,
  pushActiveAiUndo, popActiveAiUndo, getActiveAiUndoStack,
  getActiveConversationId, resetConversationCache,
} = await import('../src/components/base/conversationStore.js')

const assert = (cond, msg) => {
  if (!cond) { console.error('FAIL:', msg); process.exit(1) }
  console.log('PASS:', msg)
}

// ── 1. 确认态：present_plan → awaitingConfirm；execute_plan 校验；confirm → 放行 ──
console.log('\n── 确认态硬约束 ──')
resetConversationCache()
ensureActiveConversation() // 建一个对话

// present_plan 后 awaitingConfirm=true
setActivePendingGenerations([{ id: 'g1', prompt: '图1' }])
setAwaitingConfirm(true)
assert(getAwaitingConfirm() === true, 'present_plan 后 awaitingConfirm=true')
assert(getActivePendingGenerations()?.length === 1, 'pendingGenerations 已暂存')

// execute_plan 校验：未确认拒绝
const executePlanGate = () => {
  if (getAwaitingConfirm()) return { ok: false, error: '策划尚未确认，请先确认后再执行。' }
  return { ok: true }
}
assert(executePlanGate().ok === false, '未确认时 execute_plan 被拒')

// confirm 翻转 → 放行
setAwaitingConfirm(false)
assert(getAwaitingConfirm() === false, 'confirm 后 awaitingConfirm=false')
assert(executePlanGate().ok === true, '确认后 execute_plan 放行')

// ── 2. pendingGenerations 多对话隔离 ──
console.log('\n── 多对话隔离：pendingGenerations ──')
resetConversationCache()
const id1 = ensureActiveConversation()
setActivePendingGenerations([{ id: 'A' }]) // 对话1 存策划
const { id: id2 } = newConversation() // 新建对话2
assert(getActivePendingGenerations() === null, '对话2 无策划（不串话）')
setActivePendingGenerations([{ id: 'B' }])
switchConversation(id1) // 切回对话1
assert(getActivePendingGenerations()?.[0]?.id === 'A', '对话1 策划仍在（per-conversation）')
switchConversation(id2)
assert(getActivePendingGenerations()?.[0]?.id === 'B', '对话2 策划独立')
assert(getActiveConversationId() === id2, '当前对话为 id2')

// ── 3. aiUndoStack 多对话隔离 ──
console.log('\n── 多对话隔离：aiUndoStack ──')
pushActiveAiUndo({ nodes: ['n1'], action: 'create_node' }) // 对话2 push
switchConversation(id1)
assert(getActiveAiUndoStack().length === 0, '对话1 撤销栈为空（不串话）')
pushActiveAiUndo({ nodes: ['x'], action: 'move_node' })
switchConversation(id2)
assert(getActiveAiUndoStack().length === 1, '对话2 撤销栈有 1 项')
const popped = popActiveAiUndo()
assert(popped?.action === 'create_node', 'pop 出对话2 自己的快照（不串话）')

// ── 4. awaitingConfirm 多对话隔离 + 持久化 ──
console.log('\n── awaitingConfirm per-conversation ──')
setAwaitingConfirm(true) // 对话2
switchConversation(id1)
assert(getAwaitingConfirm() === false, '对话1 未确认（不串话）')
setAwaitingConfirm(true) // 对话1
switchConversation(id2)
assert(getAwaitingConfirm() === true, '对话2 保持确认态')

console.log('\nALL OK')
