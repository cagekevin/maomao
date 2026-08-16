/**
 * workflowRuntime 单测（纯逻辑，无 React）。
 * 运行：node scripts/test_workflow_runtime.mjs
 */
import { createWorkflow } from '../src/components/base/workflowRuntime.js'

const assert = (cond, msg) => {
  if (!cond) { console.error('FAIL:', msg); process.exit(1) }
  console.log('PASS:', msg)
}

// 1. 基本状态机
const wf = createWorkflow({ conversationId: 'conv1' })
wf.start()
assert(wf.status === 'planning', `start 后 status=planning (got ${wf.status})`)
assert(wf.isRunning === true, 'planning 属于运行中')

// 2. awaitNode 正常完成 + addNode
let completed = false
await wf.awaitNode(async () => { await new Promise((r) => setTimeout(r, 10)); completed = true; return 'ok' })
assert(completed, 'awaitNode 正常完成')
wf.addNode('n1')
assert(wf.nodeIds.includes('n1'), 'addNode 记录节点')

// 3. cancel 真取消 awaitNode
const wf2 = createWorkflow({})
wf2.start()
let aborted = false
const p2 = wf2.awaitNode(async (signal) => {
  await new Promise((r, rej) => {
    signal.addEventListener('abort', () => rej(Object.assign(new Error('Aborted'), { name: 'AbortError' })))
    setTimeout(() => r('done'), 100)
  })
}).catch(() => { aborted = true })
wf2.cancel()
await p2
assert(aborted, 'cancel 真取消 awaitNode')

// 4. runParallel 并行
const wf3 = createWorkflow({})
const startT = Date.now()
const results = await wf3.runParallel([1, 2, 3, 4], async (x) => { await new Promise((r) => setTimeout(r, 30)); return x * 10 }, { concurrency: 4 })
const elapsed = Date.now() - startT
assert(JSON.stringify(results) === JSON.stringify([10, 20, 30, 40]), `runParallel 结果正确 (${JSON.stringify(results)})`)
assert(elapsed < 100, `runParallel 并行（耗时 ${elapsed}ms < 100ms，串行应 120ms）`)

// 5. confirm 确认态
const wf4 = createWorkflow({})
wf4.requestConfirm()
assert(wf4.awaitingConfirm === true && wf4.status === 'awaiting_confirm', 'requestConfirm 进入确认态')
wf4.confirm()
assert(wf4.awaitingConfirm === false, 'confirm 退出确认态')

// 6. pushUndo/popUndo + rollback
const wf5 = createWorkflow({})
wf5.addNode('n1').addNode('n2')
wf5.pushUndo({ nodes: ['a'] })
assert(wf5.aiUndoStack.length === 1, 'pushUndo 入栈')
assert(wf5.popUndo()?.nodes?.[0] === 'a', 'popUndo 出栈')
const removed = []
wf5.rollback({ deleteNode: (id) => removed.push(id) })
assert(removed.length === 2 && wf5.nodeIds.length === 0, `rollback 清理节点 (removed=${removed.length})`)

// 7. steer 补充指令
const wf6 = createWorkflow({})
wf6.steer('补充', ['att1'])
assert(wf6.steerQueue.length === 1, 'steer 入队')
assert(wf6.nextSteer()?.text === '补充', 'nextSteer 出队')

console.log('\nALL OK')
