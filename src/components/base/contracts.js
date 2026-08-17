/**
 * 横切契约登记表 —— 横切基础设施层的「单一事实来源」。
 *
 * 【职责】把跨切面的机制（事件/存储键/错误类型）集中登记，避免散落各文件、
 * 调用方式不一致、发布无订阅等死代码。后续所有新增机制先查/先登记本表。
 *
 * 【分层】横切基础设施分 5 类，各一个权威入口：
 *   ① 通信层 eventBus     —— 瞬时事件广播（本表 EVENTS 是其注册表）
 *   ② 表现层 toastStore   —— 用户可见即时反馈
 *   ③ 观测层 logger       —— 记录 + 上报，供排查
 *   ④ 持久化层 storageAdapter + *Store —— 数据存取
 *   ⑤ 能力层 mediaType / clipboard / filesApi / imageCompress 等 —— 工具函数单一入口
 *
 * 【约定】新增事件：先在本表 EVENTS 登记（发布方/订阅方须成对，避免「只监听未发布」），
 * 命名统一「领域:动作」，再用 eventBus.publish/subscribe。
 */

/**
 * 事件注册表（通信层 eventBus 的单一事实来源）。
 *
 * 每项：
 *   key  = 事件名（统一「领域:动作」）
 *   from = 发布方（文件:行）
 *   to   = 订阅方（文件:行，null/[] 表示当前无订阅方）
 *   payload = 载荷结构（约定）
 *   note = 用途/状态
 *
 * 来源：`grep -rn "publish('" src/components` 提取，2026-08-17 核对。
 */
export const EVENTS = {
  'agent:task-completed': {
    from: ['taskStore.js:191', 'pollTask.js:80'],
    to: ['useNodeGeneration.js:163'],
    payload: '{ taskId, nodeId, resultUrl, type, status: "completed" }',
    note: '任务完成 → 精准回填节点（刷新不丢图）。生产使用',
  },
  'presets-changed': {
    from: ['promptManager.js:88'],
    to: ['PromptLibrary.jsx:40'],
    payload: '{ presets }',
    note: '提示词库跨节点同步。生产使用',
  },
  'project:import': {
    from: ['ProjectSelector.jsx:103'],
    to: ['App.jsx'],
    payload: '{}',
    note: '导入按钮 → App 处理文件。生产使用（订阅方写法非 subscribe 字面量，待核对）',
  },
  'project:export': {
    from: ['ProjectSelector.jsx:107'],
    to: ['App.jsx'],
    payload: '{}',
    note: '导出按钮 → App 下载。生产使用',
  },
  'agent:workflow-status': {
    from: ['workflowRuntime.js:66'],
    to: [], // 预留，无订阅方（勿当 bug 删）
    payload: '{ workflowId, conversationId, status }',
    note: '工作流状态广播。⚠️ 预留广播',
  },
  'agent:workflow-confirmed': {
    from: ['workflowRuntime.js:123'],
    to: [], // 预留，无订阅方
    payload: '{ workflowId, conversationId }',
    note: '策划确认广播。⚠️ 预留广播',
  },
  'persist:failed': {
    from: ['storageAdapter.js:28'],
    to: [], // 订阅方待核对
    payload: '{ key, error }',
    note: '持久化失败广播（sSet/sRemove 失败）。订阅方需核对是否存在',
  },
}

/**
 * 存储键登记区（持久化层单一事实来源）。
 * ⚠️ 现状：存储键散落在各 store（backupStore/accountsStore/promptManager/cloudSync/
 * nodePrefs/assetStore 等），尚未集中。这里是收敛起点，后续逐步把散落的键收拢到此。
 * 新增存储键：先登记在此，禁止散落字符串字面量。
 */
export const STORAGE_KEYS = {
  // TODO(收敛)：从各 store 提取散落键到此集中登记（见 docs/08-存储键集中登记与收口规范）
}

/**
 * 错误类型登记区（错误降级/重试的单一事实来源）。
 * ⚠️ 现状：错误分类/文案散落，尚未集中。这里是收敛起点。
 * 新增错误：先登记 type 与其降级策略，禁止各节点自写 if(/网络错误/) 判断。
 */
export const GEN_ERRORS = {
  // TODO(收敛)：集中错误分类 GenErrorType / errorMessageByType / withRetry
}
