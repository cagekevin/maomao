/**
 * backupStore 单测：验证导出/导入的 ls（localStorage）收集与写回。
 * KV 画布快照依赖 localTool（fetch），测试环境不可用，仅验证 ls 部分。
 *
 * 运行：node scripts/test_backup_store.mjs
 */
// mock localStorage
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
}
// mock fetch（KV 不可用 → 画布快照为空，不影响 ls 测试）
globalThis.fetch = async () => { throw new Error('KV 不可用（测试环境）') }

const { exportAll, importAll } = await import('../src/components/base/backupStore.js')
const { sSet } = await import('../src/components/base/storageAdapter.js')

const assert = (cond, msg) => {
  if (!cond) { console.error('FAIL:', msg); process.exit(1) }
  console.log('PASS:', msg)
}

// 预置一些 localStorage 数据
sSet('projects', JSON.stringify([{ id: 'proj-1', name: '项目A' }, { id: 'proj-2', name: '项目B' }]))
sSet('app_settings', JSON.stringify({ theme: 'dark' }))
sSet('agent_chat_model', JSON.stringify({ providerId: 'm', modelId: 'q' }))
sSet('agent_skills', JSON.stringify([{ id: 's1', name: '技能1' }]))

// 1. exportAll 收集 ls
const backup = await exportAll()
assert(backup.version === 2 && backup.type === 'yimao-backup', 'exportAll 返回标准格式')
assert(Array.isArray(backup.ls.projects) && backup.ls.projects.length === 2, 'exportAll 收集 projects')
assert(backup.ls.app_settings?.theme === 'dark', 'exportAll 收集 app_settings')
assert(backup.ls.agent_chat_model?.modelId === 'q', 'exportAll 收集 agent_chat_model')
assert(backup.ls.agent_skills?.[0]?.name === '技能1', 'exportAll 收集 agent_skills')

// 2. 清空后 importAll 恢复 ls
store.clear()
const restored = await importAll(backup)
assert(restored.ok === true, 'importAll 成功')
assert(restored.ls >= 4, `importAll 恢复 ${restored.ls} 个 localStorage 键（含预置 4 个）`)

// 验证恢复的键
const restoredProjects = JSON.parse(store.get('yimao:projects'))
assert(Array.isArray(restoredProjects) && restoredProjects[0].name === '项目A', 'importAll 恢复 projects')
assert(JSON.parse(store.get('yimao:agent_skills'))[0].name === '技能1', 'importAll 恢复 agent_skills')
assert(JSON.parse(store.get('yimao:agent_chat_model')).modelId === 'q', 'importAll 恢复 agent_chat_model')

// 3. 非法备份
const bad = await importAll(null)
assert(bad.ok === false, '非法备份被拒')

console.log('\nALL OK')
