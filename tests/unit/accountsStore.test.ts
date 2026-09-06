import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { flushAsync } from './_testUtils.mjs';

// 这些 store 的快照读取通过 useSyncExternalStore 暴露，但纯逻辑测试不需要 React 渲染。
// mock react 的 useSyncExternalStore 直接返回 getSnapshot()，即可在 node 下读取模块级 state。
vi.mock('react', () => ({
  useSyncExternalStore: (subscribe, getSnapshot) => getSnapshot(),
}));

// 模块级单例 + 内存 localStorage（tests/setup.mjs 已注入）。
// node 下 chrome 未定义 → isExtensionEnv()=false → 走浏览器端降级分支，状态机纯逻辑可测。
// 用 resetModules 隔离；测试间 localStorage 清空 + 通过重新导入重置模块级 state。
describe('accountsStore §4 多开账号管理', () => {
  let mod;
  beforeEach(async () => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    vi.resetModules();
    // 账号走后端 kv（contentGetAsync/contentSetAsync → /api/kv/*）。测试无 localTool，
    // 把 fetch mock 成成功响应（读 null / 写 ok），避免真实网络挂起与时序竞态，保证状态机断言确定性。
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => null,
      text: async () => '',
    });
    mod = await import('../../src/components/base/store/accountsStore.ts');
  });

  // 造环境：浏览器端降级分支（非扩展）写入「开发测试网」测试数据（store 已不再预置演示假数据 env_demo_*）。
  async function createEnv(name = '') {
    if (name) mod.setFormName(name);
    await mod.saveEnvironment(false);
    return mod.useAccounts().envs.slice(-1)[0];
  }

  // ── 域名上溯纯函数（加强版 cookie 抓取的域名扩展）──
  describe('hostOf / domainAscendants', () => {
    it('hostOf 解析主机名并去端口', () => {
      expect(mod.hostOf('https://www.qq.com/path')).toBe('www.qq.com');
      expect(mod.hostOf('http://im.qq.com:8080/x')).toBe('im.qq.com');
      expect(mod.hostOf('')).toBe('');
      expect(mod.hostOf('not-a-url')).toBe('');
    });
    it('domainAscendants：www.qq.com → [www.qq.com, qq.com]', () => {
      expect(mod.domainAscendants('www.qq.com')).toEqual(['www.qq.com', 'qq.com']);
    });
    it('domainAscendants：多级子域逐级上溯到注册域', () => {
      expect(mod.domainAscendants('a.b.qq.com')).toEqual(['a.b.qq.com', 'b.qq.com', 'qq.com']);
    });
    it('domainAscendants：单段/空 → 空数组', () => {
      expect(mod.domainAscendants('localhost')).toEqual([]);
      expect(mod.domainAscendants('')).toEqual([]);
      expect(mod.domainAscendants(null)).toEqual([]);
    });
  });

  // ── parseCookies 纯函数 ──
  describe('parseCookies', () => {
    it('空串返回 null', () => {
      expect(mod.parseCookies('')).toBeNull();
      expect(mod.parseCookies('   ')).toBeNull();
    });
    it('JSON 数组原样返回', () => {
      const input = JSON.stringify([{ name: 'a', value: '1' }]);
      expect(mod.parseCookies(input)).toEqual([{ name: 'a', value: '1' }]);
    });
    it('JSON 单对象包成数组', () => {
      const input = JSON.stringify({ name: 'a', value: '1' });
      expect(mod.parseCookies(input)).toEqual([{ name: 'a', value: '1' }]);
    });
    it('JSON 非对象（如字符串/数字）返回 null', () => {
      expect(mod.parseCookies('"abc"')).toBeNull();
      expect(mod.parseCookies('123')).toBeNull();
    });
    it('含 = 的串按 key=value; 拆分，value 内可含 =', () => {
      const out = mod.parseCookies('sid_tt=abc=def; uid_tt=123');
      expect(out).toHaveLength(2);
      expect(out[0]).toMatchObject({ name: 'sid_tt', value: 'abc=def' });
      expect(out[1]).toMatchObject({ name: 'uid_tt', value: '123' });
      // 退路自动补 domain/path/secure
      expect(out[0].domain).toBe('example.com');
      expect(out[0].path).toBe('/');
      expect(out[0].secure).toBe(true);
    });
    it('既非 JSON 也非 key=value 返回 null', () => {
      expect(mod.parseCookies('hello world')).toBeNull();
    });
  });

  // ── 表单状态机 ──
  describe('表单控制', () => {
    it('openCreateForm 清空表单态', () => {
      mod.openCreateForm();
      const s = mod.useAccounts();
      expect(s.formOpen).toBe(true);
      expect(s.formEditId).toBeNull();
      expect(s.formName).toBe('');
      expect(s.formCookies).toBe('');
    });
    it('openEditForm 回填目标环境', async () => {
      const env = await createEnv('即梦小号');
      mod.openEditForm(env.id);
      const s = mod.useAccounts();
      expect(s.formOpen).toBe(true);
      expect(s.formEditId).toBe(env.id);
      expect(s.formName).toBe('即梦小号');
    });
    it('openEditForm 不存在的 id 不打开表单', () => {
      // 未先打开表单，直接编辑不存在的 id → 保持关闭
      mod.openEditForm('nope');
      const s = mod.useAccounts();
      expect(s.formOpen).toBe(false);
      expect(s.formEditId).toBeNull();
    });
    it('setFormName / setFormCookies 更新', () => {
      mod.setFormName('新名字');
      mod.setFormCookies('sid_tt=1');
      const s = mod.useAccounts();
      expect(s.formName).toBe('新名字');
      expect(s.formCookies).toBe('sid_tt=1');
    });
    it('closeForm 重置表单态', () => {
      mod.openCreateForm();
      mod.setFormName('x');
      mod.closeForm();
      const s = mod.useAccounts();
      expect(s.formOpen).toBe(false);
      expect(s.formName).toBe('');
      expect(s.formCookies).toBe('');
    });
  });

  // ── 收藏 / 排序 / 删除（状态机）──
  describe('收藏/排序/删除', () => {
    it('toggleFavorite 翻转 isFavorite 且不改其他字段', async () => {
      const env = await createEnv('即梦小号');
      const before = mod.useAccounts().envs.find((e) => e.id === env.id);
      expect(before.isFavorite).toBeUndefined();
      mod.toggleFavorite(env.id);
      const after = mod.useAccounts().envs.find((e) => e.id === env.id);
      expect(after.isFavorite).toBe(true);
      expect(after.name).toBe('即梦小号');
    });
    it('moveEnv 调换顺序', async () => {
      const e1 = await createEnv('A');
      const e2 = await createEnv('B');
      const ids0 = mod.useAccounts().envs.map((e) => e.id);
      mod.moveEnv(0, 1);
      const ids1 = mod.useAccounts().envs.map((e) => e.id);
      expect(ids1[0]).toBe(ids0[1]);
      expect(ids1[1]).toBe(ids0[0]);
    });
    it('moveEnv from===to 不变', () => {
      const ids0 = mod.useAccounts().envs.map((e) => e.id);
      mod.moveEnv(0, 0);
      expect(mod.useAccounts().envs.map((e) => e.id)).toEqual(ids0);
    });
    it('requestDelete 二次确认才真正删除', async () => {
      const env = await createEnv('即梦小号');
      const n0 = mod.useAccounts().envs.length;
      await mod.requestDelete(env.id); // 第一次：标记
      expect(mod.useAccounts().confirmDeleteId).toBe(env.id);
      expect(mod.useAccounts().envs).toHaveLength(n0); // 还没删
      await mod.requestDelete(env.id); // 第二次：执行（异步落盘完成后清确认态）
      const s = mod.useAccounts();
      expect(s.confirmDeleteId).toBeNull();
      expect(s.envs).toHaveLength(n0 - 1);
      expect(s.envs.find((e) => e.id === env.id)).toBeUndefined();
    });
    it('requestDelete 删除当前激活环境会清 activeId', async () => {
      const env = await createEnv('即梦小号');
      await mod.activateEnv(env.id); // 非扩展：syncCookies 直接 return，activeId 同步设置
      expect(mod.useAccounts().activeId).toBe(env.id);
      await mod.requestDelete(env.id);
      await mod.requestDelete(env.id);
      expect(mod.useAccounts().activeId).toBeNull();
    });
  });

  // ── saveEnvironment 浏览器端降级分支（非扩展）──
  describe('saveEnvironment 浏览器端降级', () => {
    it('无表单、非扩展：写入演示测试数据返回 ok', async () => {
      const n0 = mod.useAccounts().envs.length;
      const res = await mod.saveEnvironment(false);
      expect(res).toEqual({ ok: true });
      const s = mod.useAccounts();
      expect(s.envs).toHaveLength(n0 + 1);
      const added = s.envs[s.envs.length - 1];
      expect(added.siteName).toBe('开发测试网');
      expect(added.siteUrl).toBe(mod.TEST_SITE_URL);
      expect(added.cookies).toEqual([{ name: 'test', value: '123' }]);
      expect(s.formOpen).toBe(false); // 保存后表单关闭
    });
    it('表单含合法 JSON Cookie：手动添加分支', async () => {
      mod.openCreateForm();
      mod.setFormName('手动号');
      mod.setFormCookies(JSON.stringify([{ name: 'sid_tt', value: 'v1' }]));
      const res = await mod.saveEnvironment(false);
      expect(res.ok).toBe(true);
      const added = mod.useAccounts().envs.slice(-1)[0];
      expect(added.name).toBe('手动号');
      expect(added.siteName).toBe('手动添加');
      expect(added.cookies).toEqual([{ name: 'sid_tt', value: 'v1' }]);
    });
    it('表单含非法 Cookie：返回格式错误', async () => {
      mod.openCreateForm();
      mod.setFormCookies('这不是合法cookie');
      const res = await mod.saveEnvironment(false);
      expect(res.ok).toBe(false);
      expect(res.error).toContain('Cookie 格式错误');
    });
    it('auto=true：忽略表单，自动降级写测试数据', async () => {
      mod.openCreateForm();
      mod.setFormName('表单名应被忽略');
      const n0 = mod.useAccounts().envs.length;
      const res = await mod.saveEnvironment(true);
      expect(res.ok).toBe(true);
      const added = mod.useAccounts().envs.slice(-1)[0];
      expect(added.name).not.toBe('表单名应被忽略');
      expect(mod.useAccounts().envs).toHaveLength(n0 + 1);
    });
  });

  // ── doc31 §一/§二 验收锁定：数据结构对齐官方 + KV 落盘 + 空读不写空覆盖 ──
  describe('结构对齐官方（doc31 §一）', () => {
    it('保存环境对象含 id/name/siteName/siteUrl/avatar/cookies 六字段', async () => {
      const env = await createEnv('即梦小号');
      const e = mod.useAccounts().envs.find((x) => x.id === env.id);
      for (const f of ['id', 'name', 'siteName', 'siteUrl', 'avatar', 'cookies']) {
        expect(f in e, `环境对象应含 ${f} 字段`).toBe(true);
      }
      expect(e.cookies).toEqual([{ name: 'test', value: '123' }]);
    });

    it('手动 JSON 带全部 cookie 字段 → 映射保留 name/value/domain/path/secure/httpOnly/expirationDate/sameSite/storeId', async () => {
      mod.openCreateForm();
      mod.setFormName('手动号');
      const fullCookie = {
        name: 'sid_tt',
        value: 'v1',
        domain: '.jimeng.jianying.com',
        path: '/',
        secure: true,
        httpOnly: true,
        expirationDate: 9999999999,
        sameSite: 'no_restriction',
        storeId: '1',
      };
      mod.setFormCookies(JSON.stringify([fullCookie]));
      await mod.saveEnvironment(false);
      const added = mod.useAccounts().envs.slice(-1)[0];
      expect(added.siteName).toBe('手动添加');
      expect(added.cookies[0]).toEqual(fullCookie);
    });
  });

  describe('存储走 KV + 空读不写（doc31 §二）', () => {
    it('保存后经 /api/kv/set 落盘 yimao_accounts（KV 持久化，非浏览器内存）', async () => {
      await createEnv('即梦小号');
      const setCalls = (
        globalThis.fetch as unknown as { mock: { calls: unknown[] } }
      ).mock.calls.filter((c: unknown[]) => String(c[0]).includes('/api/kv/set'));
      expect(setCalls.length).toBeGreaterThan(0);
    });

    it('load() KV 空 → envs 保持空，不写空覆盖（无 /api/kv/set、不写 localStorage）', async () => {
      await flushAsync(); // 等模块导入时 `void load()` 的异步 KV 读落定
      expect(mod.useAccounts().envs).toEqual([]);
      const setCalls = (
        globalThis.fetch as unknown as { mock: { calls: unknown[] } }
      ).mock.calls.filter((c: unknown[]) => String(c[0]).includes('/api/kv/set'));
      expect(setCalls).toHaveLength(0);
      expect(localStorage.getItem('yimao_accounts')).toBeNull();
    });
  });

  // 清理 requestDelete 的 3s setTimeout 副作用（避免影响其它测试/进程退出）
  afterEach(() => {
    vi.clearAllTimers?.();
  });
});

// ── 扩展端场景：保存环境时连带抓取当前页面 localStorage 快照（登录态 token 一并保存）──
describe('accountsStore §4 扩展端 · localStorage 隔离', () => {
  let mod;
  beforeEach(async () => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    vi.resetModules();
    // mock chrome 为「扩展端」环境（chrome.runtime.id 存在 → isExtensionEnv()=true）
    const lsStore = { sid_token: 'abc123' };
    vi.stubGlobal('chrome', {
      runtime: { id: 'test-ext' },
      tabs: {
        query: vi.fn(async () => [{ id: 1, url: 'https://www.qq.com/feed', title: '腾讯网' }]),
      },
      cookies: {
        getAll: vi.fn(async () => [{ name: 'uin', value: '1', domain: '.qq.com', path: '/' }]),
        set: vi.fn(async () => ({})),
        remove: vi.fn(async () => ({})),
      },
      scripting: {
        // chrome.scripting.executeScript 返回数组 [{ result }]（对齐真实 API）
        executeScript: vi.fn(async () => [{ result: { ...lsStore } }]),
      },
    });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => null,
      text: async () => '',
    });
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    mod = await import('../../src/components/base/store/accountsStore.ts');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllTimers?.();
  });

  it('扩展端保存环境：读取当前页面 localStorage 快照并写入环境', async () => {
    const res = await mod.saveEnvironment(true); // auto 模式：忽略表单，自动抓取
    expect(res.ok).toBe(true);
    const added = mod.useAccounts().envs.slice(-1)[0];
    expect(added.cookies).toEqual([{ name: 'uin', value: '1', domain: '.qq.com', path: '/' }]);
    // localStorage 快照被一并保存（含登录 token）
    expect(added.localStorage).toEqual({ sid_token: 'abc123' });
  });

  it('切换环境：写回该环境的 localStorage 快照（经 chrome.scripting main world 注入）', async () => {
    await mod.saveEnvironment(true);
    const env = mod.useAccounts().envs[0];
    await mod.activateEnv(env.id);
    // syncCookies 内部最后调 writeTabLocalStorage → executeScript 被调用
    expect(
      (
        globalThis as unknown as {
          chrome?: { scripting: { executeScript: ReturnType<typeof vi.fn> } };
        }
      ).chrome?.scripting.executeScript,
    ).toHaveBeenCalled();
  });
});
