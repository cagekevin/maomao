// @vitest-environment node
/**
 * cloudSync 单测（批 1-3）。
 * 覆盖：CloudSyncEngine.callGateway（URL 校验/重入守卫/响应解析）、push/pull 成功与失败分支、
 * uploadConfig（无本地数据边界）、downloadConfig（云端无数据边界）。
 * 策略：node 环境；mock fetch 让 callGateway 走通；providerApi/projectsApi 用 stub。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { jsonResp, createKvMem } from './_testUtils.mjs';
import { contentClearCache } from '../../src/components/base/core/contentStore.ts';

// 复用 setup.mjs 强制 mock 的全局 fetch（Node 原生 fetch 不可配置，vi.stubGlobal 会静默失效）
// 类型对齐：TS 默认把 globalThis.fetch 当 typeof fetch，cast 为 vi.fn 类型以启用 .mock* / mock.calls。
const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;

// 账号 KV mock：走内存 Map，让 contentSetAsync('yimao_accounts') 先落 KV 再被 collectLocal 读回，
// 走真实 KV 读写路径；若缺 kvGet/kvSet，将退化为「写读都降级到本地副本」的误导链。
// 注意：工厂提升到模块顶部，须在工厂的异步函数体内引用顶层 kv（而不能直接读取 kv.kvGet 属性，
// 否则提升期静态改写会报 "Cannot access 'kv' before initialization"）。
const kv = createKvMem();
vi.mock('../../src/components/base/api/localToolApi.ts', () => ({
  providerApi: { getProviders: vi.fn(), saveProviders: vi.fn(), syncConfigBase: vi.fn() },
  fetchProjects: vi.fn(),
  saveProjects: vi.fn(),
  kvGet: vi.fn(async (key) => kv.memKV.get(key) ?? null),
  kvSet: vi.fn(async (key, value) => {
    kv.memKV.set(key, value);
    return { ok: true };
  }),
  kvDelete: vi.fn(async (key) => {
    kv.memKV.delete(key);
    return { ok: true };
  }),
}));

const { providerApi } = await import('@/components/base/api/localToolApi.ts');
const {
  CloudSyncEngine,
  uploadConfig,
  downloadConfig,
  normalizeCloudPayload,
  decideUpload,
  diffWithLocal,
  describeUploadConflict,
  describeDownloadConflict,
} = await import('../../src/components/base/store/cloudSync.ts');

/**
 * 定位发往 GAS 的指定 action 请求（pull_data / push_data）。
 * 不能假定 calls[0]：① collectLocal 会先走 KV 读账号；② 【防覆盖】上传前会先 pull 一次云端读版本，
 * 即一次上传 = pull + push 两次 GAS 请求。按 action 精确定位才稳。
 */
function gasCalls(action) {
  return fetchMock.mock.calls.filter((c) => {
    if (!String(c[0]).startsWith('https://script.google.com')) return false;
    try {
      return JSON.parse(c[1].body).action === action;
    } catch {
      return false;
    }
  });
}

/** 取 uploadConfig 的 push 请求体中的 ls 清单 */
function pushLs() {
  const calls = gasCalls('push_data');
  expect(calls.length, '应存在发往 GAS 的 push 请求').toBeGreaterThan(0);
  return JSON.parse(calls[0][1].body).data.data;
}

beforeEach(() => {
  globalThis.fetch = fetchMock;
  fetchMock.mockClear();
  kv.memKV.clear();
  vi.mocked(providerApi.getProviders).mockReset();
  vi.mocked(providerApi.getProviders).mockResolvedValue({ data: null }); // 默认无 providers，与既有用例行为一致
  CloudSyncEngine.isSyncing = false;
  localStorage.clear();
  contentClearCache();
});
afterEach(() => {});

describe('cloudSync — CloudSyncEngine.callGateway 守卫', () => {
  it('重入时抛出「系统正在通信中」', async () => {
    CloudSyncEngine.isSyncing = true;
    await expect(CloudSyncEngine.callGateway('push_data', {})).rejects.toThrow('通信中');
  });

  it('fetch 返回 html → 抛权限拦截错误', async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => '<html>login</html>' });
    await expect(CloudSyncEngine.callGateway('push_data', {})).rejects.toThrow('权限拦截');
  });

  it('正常返回 JSON', async () => {
    fetchMock.mockResolvedValue(jsonResp({ msg: 'ok', data: { a: 1 } }));
    const res = await CloudSyncEngine.callGateway('push_data', {});
    expect(res.data).toEqual({ a: 1 });
  });
});

describe('cloudSync — push / pull', () => {
  it('push 成功返回 true，调用 onSuccess', async () => {
    fetchMock.mockResolvedValue(jsonResp({ msg: '同步成功' }));
    const onSuccess = vi.fn();
    const ok = await CloudSyncEngine.push(
      {},
      () => {},
      onSuccess,
      () => {},
    );
    expect(ok).toBe(true);
    expect(onSuccess).toHaveBeenCalled();
  });

  it('push 网关返回 error → 返回 false 并调用 onError', async () => {
    fetchMock.mockResolvedValue(jsonResp({ error: 'boom' }));
    const onError = vi.fn();
    const ok = await CloudSyncEngine.push(
      {},
      () => {},
      () => {},
      onError,
    );
    expect(ok).toBe(false);
    expect(onError).toHaveBeenCalledWith('boom');
  });

  it('pull 成功返回 data', async () => {
    fetchMock.mockResolvedValue(jsonResp({ data: { projects: [] } }));
    const data = await CloudSyncEngine.pull(
      () => {},
      () => {},
      () => {},
    );
    expect(data).toEqual({ projects: [] });
  });

  it('pull 网关报错 → 返回 null', async () => {
    fetchMock.mockResolvedValue(jsonResp({ error: 'noauth' }));
    const data = await CloudSyncEngine.pull(
      () => {},
      () => {},
      () => {},
    );
    expect(data).toBeNull();
  });
});

describe('cloudSync — uploadConfig / downloadConfig 边界', () => {
  it('uploadConfig 无本地可同步数据 → 返回 ok:false', async () => {
    const res = await uploadConfig(() => {});
    expect(res.ok).toBe(false);
    expect(res.count).toBe(0);
  });

  it('downloadConfig 云端无数据 → 返回 hasCloud:false', async () => {
    fetchMock.mockResolvedValue(jsonResp({ error: 'empty' }));
    const res = await downloadConfig(() => {});
    expect(res.ok).toBe(false);
    expect(res.hasCloud).toBe(false);
  });

  it('uploadConfig 有数据且 push 成功 → ok:true + count', async () => {
    // 写入一些可同步的本地数据
    const { contentSet } = await import('../../src/components/base/core/contentStore.ts');
    contentSet('app_settings', { theme: 'dark' });
    fetchMock.mockResolvedValue(jsonResp({ msg: 'ok' }));
    const res = await uploadConfig(() => {});
    expect(res.ok).toBe(true);
    expect(res.count).toBeGreaterThan(0);
  });

  it('localTool 未连（getProviders 抛错）→ collectLocal 跳过 API 配置，仍成功且不含 providers', async () => {
    // 【R6 边角3】localTool 未连的降级路径：catch 静默跳过，不阻塞本地配置上传
    const { contentSet } = await import('../../src/components/base/core/contentStore.ts');
    contentSet('app_settings', { theme: 'dark' });
    vi.mocked(providerApi.getProviders).mockRejectedValue(new Error('ECONNREFUSED'));
    fetchMock.mockResolvedValue(jsonResp({ msg: 'ok' }));
    const res = await uploadConfig(() => {});
    expect(res.ok).toBe(true);
    const ls = pushLs(); // push 请求体里 cloud.data 才是 ls 清单
    expect(ls.app_settings).toEqual({ theme: 'dark' }); // 本地配置仍上传
    expect(ls.providers).toBeUndefined(); // API 配置跳过
  });

  it('同步清单由 contracts.ts getLocalKeys() 生成：真实设置进云，排除本机/临时/本地引用键', async () => {
    const { contentSet } = await import('../../src/components/base/core/contentStore.ts');
    // 真实设置（此前未进手写清单，收口后应同步）
    contentSet('agent_panel_width', '320');
    contentSet('agent_input_mode', 'agent');
    // 不同步清单：本机偏好 / 本地 URL 素材 / 临时草稿 / 跨窗口剪贴板
    contentSet('lastOpenedProject', 'p1');
    contentSet('yimao_asset_library', [{ id: 'a' }]);
    contentSet('agent_draft', '草稿');
    contentSet('mutiwindow-clipboard', 'clip');
    fetchMock.mockResolvedValue(jsonResp({ msg: 'ok' }));
    const res = await uploadConfig(() => {});
    expect(res.ok).toBe(true);
    const ls = pushLs(); // push 请求体里 cloud.data 才是 ls 清单
    expect(ls.agent_panel_width).toBe('320');
    expect(ls.agent_input_mode).toBe('agent');
    expect(ls.lastOpenedProject).toBeUndefined();
    expect(ls.yimao_asset_library).toBeUndefined();
    expect(ls.agent_draft).toBeUndefined();
    expect(ls.mutiwindow_clipboard).toBeUndefined();
  });

  it('account 领域开：账号环境（KV 后端）随上传进入云端', async () => {
    const { contentSet, contentSetAsync } =
      await import('../../src/components/base/core/contentStore.ts');
    contentSet('app_settings', { theme: 'dark' });
    await contentSetAsync('yimao_accounts', [{ id: 'acc1', name: '环境1' }]);
    // 按 URL 分流：KV 读账号 → 返回账号数组；其余（GAS push / kvSet 写）→ 返回成功
    fetchMock.mockImplementation((url, opt) => {
      if (String(url).includes('/api/kv/get')) {
        return Promise.resolve(jsonResp([{ id: 'acc1', name: '环境1' }]));
      }
      return Promise.resolve(jsonResp({ msg: 'ok' }));
    });
    const res = await uploadConfig(() => {});
    expect(res.ok).toBe(true);
    const ls = pushLs();
    expect(ls.accounts).toEqual([{ id: 'acc1', name: '环境1' }]);
  });

  it('project 领域关：云端 projects 下载时不覆写本地（堵「云覆盖丢新项目」）', async () => {
    const cloud = {
      type: 'cloud_config',
      version: 5,
      updatedAt: 0,
      data: { projects: [{ id: 'cloud-p', name: '云项目' }] },
    };
    fetchMock.mockResolvedValueOnce(jsonResp(cloud)); // pull 返回
    const { saveProjects } = await import('@/components/base/api/localToolApi.ts');
    const res = await downloadConfig(() => {});
    expect(res.ok).toBe(false); // projects 领域关 → 无任何写回 → count 0
    expect(res.hasCloud).toBe(true);
    expect(saveProjects).not.toHaveBeenCalled();
  });
});

describe('cloudSync — 防覆盖保护：云端包解析（GAS 两种回包形态）', () => {
  it('形态A（完整包）：取外层 rev/updatedAt，data 剔除 __meta', () => {
    const snap = normalizeCloudPayload({
      type: 'cloud_config',
      version: 5,
      rev: 7,
      updatedAt: 111,
      data: { app_settings: { a: 1 }, __meta: { rev: 7, updatedAt: 111 } },
    });
    expect(snap.hasMeta).toBe(true);
    expect(snap.rev).toBe(7);
    expect(snap.updatedAt).toBe(111);
    expect(snap.data).toEqual({ app_settings: { a: 1 } });
    expect(snap.data.__meta).toBeUndefined();
  });

  it('形态B（GAS 只回 data 内容）：rev/updatedAt 从 data.__meta 兜底取回', () => {
    const snap = normalizeCloudPayload({
      app_settings: { a: 1 },
      __meta: { rev: 3, updatedAt: 222 },
    });
    expect(snap.hasMeta).toBe(false);
    expect(snap.rev).toBe(3);
    expect(snap.updatedAt).toBe(222);
    expect(snap.data).toEqual({ app_settings: { a: 1 } });
  });

  it('无版本信息的旧包 → rev/updatedAt 归 0（表示「不知道」，不做新旧判断）', () => {
    const snap = normalizeCloudPayload({ type: 'cloud_config', version: 5, data: { a: 1 } });
    expect(snap.rev).toBe(0);
    expect(snap.updatedAt).toBe(0);
  });

  it('空/非对象输入 → null（代表云端无数据）', () => {
    expect(normalizeCloudPayload(null)).toBeNull();
    expect(normalizeCloudPayload(undefined)).toBeNull();
    expect(normalizeCloudPayload('x')).toBeNull();
  });
});

describe('cloudSync — 防覆盖保护：上传冲突判定（纯函数）', () => {
  const ledger = { rev: 2, syncedAt: 1000, localHash: 'hash-v2' };
  const base = { cloudReadable: true, cloudExists: true, cloudRev: 5, cloudUpdatedAt: 1 };

  it('云端 rev 更大 + 本地改过 → both-changed（真冲突）', () => {
    const d = decideUpload({ ...base, ledger, localHash: 'hash-v3' });
    expect(d.kind).toBe('both-changed');
    expect(d.localDirty).toBe(true);
  });

  it('云端 rev 更大 + 本地没改 → cloud-newer（提示该下载而不是上传）', () => {
    const d = decideUpload({ ...base, ledger, localHash: 'hash-v2' });
    expect(d.kind).toBe('cloud-newer');
    expect(d.localDirty).toBe(false);
  });

  it('云端不比我新 → none（静默上传，不打扰）', () => {
    expect(decideUpload({ ...base, cloudRev: 2, ledger, localHash: 'hash-v3' }).kind).toBe('none');
    expect(decideUpload({ ...base, cloudRev: 1, ledger, localHash: 'hash-v3' }).kind).toBe('none');
  });

  it('无台账（首次同步，无基线可比）→ none', () => {
    expect(decideUpload({ ...base, ledger: null, localHash: 'hash-x' }).kind).toBe('none');
  });

  it('云端为空 → none（首次上传）', () => {
    expect(decideUpload({ ...base, cloudExists: false, ledger, localHash: 'hash-v3' }).kind).toBe(
      'none',
    );
  });

  it('云端读不到 → cloud-unknown（不硬阻断，交用户定夺）', () => {
    expect(decideUpload({ ...base, cloudReadable: false, ledger, localHash: 'hash-v3' }).kind).toBe(
      'cloud-unknown',
    );
  });

  it('无台账时保守视为「本地改过」，宁可多问不可静默覆盖', () => {
    expect(
      decideUpload({ ...base, cloudReadable: false, ledger: null, localHash: 'x' }).localDirty,
    ).toBe(true);
  });
});

describe('cloudSync — 防覆盖保护：下载冲突比对（纯函数）', () => {
  it('值不同 → conflicts；仅云端有 → cloudOnly；仅本地有 → localOnly', () => {
    const d = diffWithLocal({ a: 1, b: 2, c: 3 }, { a: 1, b: 99, d: 4 });
    expect(d.conflicts.map((x) => x.key)).toEqual(['b']);
    expect(d.cloudOnly.map((x) => x.key)).toEqual(['c']);
    expect(d.localOnly.map((x) => x.key)).toEqual(['d']);
  });

  it('键序不同但内容相同 → 不报冲突（稳定序列化生效，否则会误报）', () => {
    const d = diffWithLocal({ x: { p: 1, q: 2 } }, { x: { q: 2, p: 1 } });
    expect(d.conflicts).toEqual([]);
  });

  it('__meta 元字段不参与比对（它不是数据项）', () => {
    const d = diffWithLocal({ a: 1, __meta: { rev: 1 } }, { a: 1 });
    expect(d.conflicts).toEqual([]);
    expect(d.cloudOnly).toEqual([]);
  });

  it('冲突项带可读名；未登记键回退键名（绝不静默省略条目）', () => {
    const d = diffWithLocal(
      { yimao_preset_prompts: [1], weird_key: 1 },
      { yimao_preset_prompts: [2], weird_key: 2 },
    );
    expect(d.conflicts.map((x) => x.label)).toEqual(['提示词预设', 'weird_key']);
  });
});

describe('cloudSync — 防覆盖保护：弹窗文案', () => {
  it('上传三种冲突各有明确标题与 danger 标记；cloud-newer 会引导去下载', () => {
    const both = describeUploadConflict({
      kind: 'both-changed',
      cloudRev: 5,
      cloudUpdatedAt: 111,
      ledgerRev: 2,
      localDirty: true,
    });
    expect(both.title).toContain('云端和本地都有更新');
    expect(both.danger).toBe(true);
    const newer = describeUploadConflict({
      kind: 'cloud-newer',
      cloudRev: 5,
      cloudUpdatedAt: 111,
      ledgerRev: 2,
      localDirty: false,
    });
    expect(newer.title).toContain('云端内容比你本地新');
    expect(newer.message).toContain('从云端拉取'); // 引导用户往正确方向走
    const unknown = describeUploadConflict({
      kind: 'cloud-unknown',
      cloudRev: 0,
      cloudUpdatedAt: 0,
      ledgerRev: 2,
      localDirty: true,
    });
    expect(unknown.title).toContain('无法确认');
    expect(unknown.danger).toBe(true);
  });

  it('下载无冲突 → null（静默下载）；有冲突 → 列条目清单', () => {
    expect(describeDownloadConflict({ conflicts: [], cloudOnly: [], localOnly: [] })).toBeNull();
    const copy = describeDownloadConflict({
      conflicts: [{ key: 'app_settings', label: '应用设置' }],
      cloudOnly: [],
      localOnly: [],
    });
    expect(copy.title).toContain('1 项');
    expect(copy.items).toEqual(['应用设置']);
    expect(copy.danger).toBe(true);
  });
});

describe('cloudSync — 防覆盖保护：端到端（用户取消 / 用户确认）', () => {
  it('上传遇冲突且用户取消 → cancelled:true，且不发起 push（云端保持原样）', async () => {
    const { contentSet } = await import('../../src/components/base/core/contentStore.ts');
    contentSet('app_settings', { theme: 'dark' });
    // 造台账：上次同步到 rev=1，且本地指纹已变（模拟本地改过）
    contentSet('yimao_cloud_sync_ledger', { rev: 1, syncedAt: 1, localHash: 'stale-hash' });
    // 注意信封：CloudSyncEngine.pull 返回 res.data，故 GAS 回包需是 { data: <完整同步包> }
    fetchMock.mockResolvedValue(
      jsonResp({
        data: {
          type: 'cloud_config',
          version: 5,
          rev: 9,
          updatedAt: Date.now(),
          data: { app_settings: { theme: 'light' } },
        },
      }),
    );
    const res = await uploadConfig(() => {}, { onConfirm: async () => false });
    expect(res.cancelled).toBe(true);
    expect(res.ok).toBe(false);
    expect(gasCalls('push_data').length, '用户取消后不应发起 push').toBe(0);
  });

  it('上传遇冲突但用户确认 → 正常推送，且 rev = 云端 rev + 1（单调递增）', async () => {
    const { contentSet } = await import('../../src/components/base/core/contentStore.ts');
    contentSet('app_settings', { theme: 'dark' });
    contentSet('yimao_cloud_sync_ledger', { rev: 1, syncedAt: 1, localHash: 'stale-hash' });
    fetchMock.mockImplementation((_url, opt) => {
      let action = '';
      try {
        action = JSON.parse(opt.body).action;
      } catch {
        /* 非 GAS 报文 */
      }
      if (action === 'pull_data') {
        return Promise.resolve(
          jsonResp({
            data: {
              // 信封：pull 返回 res.data
              type: 'cloud_config',
              version: 5,
              rev: 4,
              updatedAt: 1,
              data: { app_settings: { theme: 'light' } },
            },
          }),
        );
      }
      return Promise.resolve(jsonResp({ msg: 'ok' }));
    });
    const res = await uploadConfig(() => {}, { onConfirm: async () => true });
    expect(res.ok).toBe(true);
    const pushed = gasCalls('push_data');
    expect(pushed.length).toBe(1);
    const body = JSON.parse(pushed[0][1].body).data;
    expect(body.rev).toBe(5); // 云端 4 → 本次 5
    expect(body.data.__meta.rev).toBe(5); // 形态B 兜底元字段同步写入
  });

  it('下载有覆盖项且用户取消 → cancelled:true，本地一个字节都没改', async () => {
    const { contentSet, contentGet } =
      await import('../../src/components/base/core/contentStore.ts');
    contentSet('app_settings', { theme: 'dark' });
    // 注意信封：CloudSyncEngine.pull 返回的是 res.data，故 GAS 回包必须是 { data: <完整同步包> }
    fetchMock.mockResolvedValue(
      jsonResp({
        data: {
          type: 'cloud_config',
          version: 5,
          rev: 3,
          updatedAt: Date.now(),
          data: { app_settings: { theme: 'light' } },
        },
      }),
    );
    const res = await downloadConfig(() => {}, { onConfirm: async () => false });
    expect(res.cancelled).toBe(true);
    expect(contentGet('app_settings')).toEqual({ theme: 'dark' }); // 本地原值未被覆盖
  });

  it('下载有覆盖项但用户确认 → 正常覆盖本地', async () => {
    const { contentSet, contentGet } =
      await import('../../src/components/base/core/contentStore.ts');
    contentSet('app_settings', { theme: 'dark' });
    // 注意信封：CloudSyncEngine.pull 返回的是 res.data，故 GAS 回包必须是 { data: <完整同步包> }
    fetchMock.mockResolvedValue(
      jsonResp({
        data: {
          type: 'cloud_config',
          version: 5,
          rev: 3,
          updatedAt: Date.now(),
          data: { app_settings: { theme: 'light' } },
        },
      }),
    );
    const res = await downloadConfig(() => {}, { onConfirm: async () => true });
    expect(res.ok).toBe(true);
    expect(contentGet('app_settings')).toEqual({ theme: 'light' }); // 已被云端覆盖
  });

  it('下载成功后写台账：下一次上传不再误报冲突（基线已跟上云端 rev）', async () => {
    const { contentSet } = await import('../../src/components/base/core/contentStore.ts');
    contentSet('app_settings', { theme: 'dark' });
    // 注意信封：CloudSyncEngine.pull 返回的是 res.data，故 GAS 回包必须是 { data: <完整同步包> }
    fetchMock.mockResolvedValue(
      jsonResp({
        data: {
          type: 'cloud_config',
          version: 5,
          rev: 3,
          updatedAt: Date.now(),
          data: { app_settings: { theme: 'light' } },
        },
      }),
    );
    await downloadConfig(() => {}, { onConfirm: async () => true });
    // 本地已与云端一致 → 再上传时 diff 无冲突、且台账 rev=3 不低于云端 → 不弹确认
    const onConfirm = vi.fn(async () => true);
    fetchMock.mockClear();
    // 注意信封：CloudSyncEngine.pull 返回的是 res.data，故 GAS 回包必须是 { data: <完整同步包> }
    fetchMock.mockResolvedValue(
      jsonResp({
        data: {
          type: 'cloud_config',
          version: 5,
          rev: 3,
          updatedAt: Date.now(),
          data: { app_settings: { theme: 'light' } },
        },
      }),
    );
    const res = await uploadConfig(() => {}, { onConfirm });
    expect(res.ok).toBe(true);
    expect(onConfirm, '基线已跟上，不应再弹确认').not.toHaveBeenCalled();
  });
});
