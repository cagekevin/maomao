import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// 这些 store 的快照读取通过 useSyncExternalStore 暴露，但纯逻辑测试不需要 React 渲染。
// mock react 的 useSyncExternalStore 直接返回 getSnapshot()，即可在 node 下读取模块级 state。
vi.mock('react', () => ({
  useSyncExternalStore: (subscribe, getSnapshot) => getSnapshot(),
}))

// 模块级单例 + 内存 localStorage（tests/setup.mjs 已注入）。
// node 下 chrome 未定义 → isExtensionEnv()=false → 走浏览器端降级分支，状态机纯逻辑可测。
// 用 resetModules 隔离；测试间 localStorage 清空 + 通过重新导入重置模块级 state。
describe('accountsStore §4 多开账号管理', () => {
  let mod
  beforeEach(async () => {
    try { localStorage.clear() } catch { /* ignore */ }
    vi.resetModules()
    mod = await import('../../src/components/base/settings/accountsStore.js')
  })

  // 造环境：浏览器端降级分支（非扩展）写入「开发测试网」测试数据（store 已不再预置演示假数据 env_demo_*）。
  async function createEnv(name = '') {
    if (name) mod.setFormName(name)
    await mod.saveEnvironment(false)
    return mod.useAccounts().envs.slice(-1)[0]
  }

  // ── parseCookies 纯函数 ──
  describe('parseCookies', () => {
    it('空串返回 null', () => {
      expect(mod.parseCookies('')).toBeNull()
      expect(mod.parseCookies('   ')).toBeNull()
    })
    it('JSON 数组原样返回', () => {
      const input = JSON.stringify([{ name: 'a', value: '1' }])
      expect(mod.parseCookies(input)).toEqual([{ name: 'a', value: '1' }])
    })
    it('JSON 单对象包成数组', () => {
      const input = JSON.stringify({ name: 'a', value: '1' })
      expect(mod.parseCookies(input)).toEqual([{ name: 'a', value: '1' }])
    })
    it('JSON 非对象（如字符串/数字）返回 null', () => {
      expect(mod.parseCookies('"abc"')).toBeNull()
      expect(mod.parseCookies('123')).toBeNull()
    })
    it('含 = 的串按 key=value; 拆分，value 内可含 =', () => {
      const out = mod.parseCookies('sid_tt=abc=def; uid_tt=123')
      expect(out).toHaveLength(2)
      expect(out[0]).toMatchObject({ name: 'sid_tt', value: 'abc=def' })
      expect(out[1]).toMatchObject({ name: 'uid_tt', value: '123' })
      // 退路自动补 domain/path/secure
      expect(out[0].domain).toBe('example.com')
      expect(out[0].path).toBe('/')
      expect(out[0].secure).toBe(true)
    })
    it('既非 JSON 也非 key=value 返回 null', () => {
      expect(mod.parseCookies('hello world')).toBeNull()
    })
  })

  // ── 表单状态机 ──
  describe('表单控制', () => {
    it('openCreateForm 清空表单态', () => {
      mod.openCreateForm()
      const s = mod.useAccounts()
      expect(s.formOpen).toBe(true)
      expect(s.formEditId).toBeNull()
      expect(s.formName).toBe('')
      expect(s.formCookies).toBe('')
    })
    it('openEditForm 回填目标环境', async () => {
      const env = await createEnv('即梦小号')
      mod.openEditForm(env.id)
      const s = mod.useAccounts()
      expect(s.formOpen).toBe(true)
      expect(s.formEditId).toBe(env.id)
      expect(s.formName).toBe('即梦小号')
    })
    it('openEditForm 不存在的 id 不打开表单', () => {
      // 未先打开表单，直接编辑不存在的 id → 保持关闭
      mod.openEditForm('nope')
      const s = mod.useAccounts()
      expect(s.formOpen).toBe(false)
      expect(s.formEditId).toBeNull()
    })
    it('setFormName / setFormCookies 更新', () => {
      mod.setFormName('新名字')
      mod.setFormCookies('sid_tt=1')
      const s = mod.useAccounts()
      expect(s.formName).toBe('新名字')
      expect(s.formCookies).toBe('sid_tt=1')
    })
    it('closeForm 重置表单态', () => {
      mod.openCreateForm()
      mod.setFormName('x')
      mod.closeForm()
      const s = mod.useAccounts()
      expect(s.formOpen).toBe(false)
      expect(s.formName).toBe('')
      expect(s.formCookies).toBe('')
    })
  })

  // ── 收藏 / 排序 / 删除（状态机）──
  describe('收藏/排序/删除', () => {
    it('toggleFavorite 翻转 isFavorite 且不改其他字段', async () => {
      const env = await createEnv('即梦小号')
      const before = mod.useAccounts().envs.find((e) => e.id === env.id)
      expect(before.isFavorite).toBeUndefined()
      mod.toggleFavorite(env.id)
      const after = mod.useAccounts().envs.find((e) => e.id === env.id)
      expect(after.isFavorite).toBe(true)
      expect(after.name).toBe('即梦小号')
    })
    it('moveEnv 调换顺序', async () => {
      const e1 = await createEnv('A')
      const e2 = await createEnv('B')
      const ids0 = mod.useAccounts().envs.map((e) => e.id)
      mod.moveEnv(0, 1)
      const ids1 = mod.useAccounts().envs.map((e) => e.id)
      expect(ids1[0]).toBe(ids0[1])
      expect(ids1[1]).toBe(ids0[0])
    })
    it('moveEnv from===to 不变', () => {
      const ids0 = mod.useAccounts().envs.map((e) => e.id)
      mod.moveEnv(0, 0)
      expect(mod.useAccounts().envs.map((e) => e.id)).toEqual(ids0)
    })
    it('requestDelete 二次确认才真正删除', async () => {
      const env = await createEnv('即梦小号')
      const n0 = mod.useAccounts().envs.length
      mod.requestDelete(env.id) // 第一次：标记
      expect(mod.useAccounts().confirmDeleteId).toBe(env.id)
      expect(mod.useAccounts().envs).toHaveLength(n0) // 还没删
      mod.requestDelete(env.id) // 第二次：执行
      const s = mod.useAccounts()
      expect(s.confirmDeleteId).toBeNull()
      expect(s.envs).toHaveLength(n0 - 1)
      expect(s.envs.find((e) => e.id === env.id)).toBeUndefined()
    })
    it('requestDelete 删除当前激活环境会清 activeId', async () => {
      const env = await createEnv('即梦小号')
      await mod.activateEnv(env.id) // 非扩展：syncCookies 直接 return，activeId 同步设置
      expect(mod.useAccounts().activeId).toBe(env.id)
      mod.requestDelete(env.id)
      mod.requestDelete(env.id)
      expect(mod.useAccounts().activeId).toBeNull()
    })
  })

  // ── saveEnvironment 浏览器端降级分支（非扩展）──
  describe('saveEnvironment 浏览器端降级', () => {
    it('无表单、非扩展：写入演示测试数据返回 ok', async () => {
      const n0 = mod.useAccounts().envs.length
      const res = await mod.saveEnvironment(false)
      expect(res).toEqual({ ok: true })
      const s = mod.useAccounts()
      expect(s.envs).toHaveLength(n0 + 1)
      const added = s.envs[s.envs.length - 1]
      expect(added.siteName).toBe('开发测试网')
      expect(added.siteUrl).toBe(mod.TEST_SITE_URL)
      expect(added.cookies).toEqual([{ name: 'test', value: '123' }])
      expect(s.formOpen).toBe(false) // 保存后表单关闭
    })
    it('表单含合法 JSON Cookie：手动添加分支', async () => {
      mod.openCreateForm()
      mod.setFormName('手动号')
      mod.setFormCookies(JSON.stringify([{ name: 'sid_tt', value: 'v1' }]))
      const res = await mod.saveEnvironment(false)
      expect(res.ok).toBe(true)
      const added = mod.useAccounts().envs.slice(-1)[0]
      expect(added.name).toBe('手动号')
      expect(added.siteName).toBe('手动添加')
      expect(added.cookies).toEqual([{ name: 'sid_tt', value: 'v1' }])
    })
    it('表单含非法 Cookie：返回格式错误', async () => {
      mod.openCreateForm()
      mod.setFormCookies('这不是合法cookie')
      const res = await mod.saveEnvironment(false)
      expect(res.ok).toBe(false)
      expect(res.error).toContain('Cookie 格式错误')
    })
    it('auto=true：忽略表单，自动降级写测试数据', async () => {
      mod.openCreateForm()
      mod.setFormName('表单名应被忽略')
      const n0 = mod.useAccounts().envs.length
      const res = await mod.saveEnvironment(true)
      expect(res.ok).toBe(true)
      const added = mod.useAccounts().envs.slice(-1)[0]
      expect(added.name).not.toBe('表单名应被忽略')
      expect(mod.useAccounts().envs).toHaveLength(n0 + 1)
    })
  })

  // 清理 requestDelete 的 3s setTimeout 副作用（避免影响其它测试/进程退出）
  afterEach(() => {
    vi.clearAllTimers?.()
  })
})
