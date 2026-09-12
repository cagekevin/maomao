/**
 * TD-7 方案A 收口回归测试（director3d 工程持久化双通道）。
 * 锁死两条不变量，防止债复发：
 *  1. d3dPersistence 的读/写必须委托 contentStore 的 contentSetKvWithFallback / contentGetKvWithFallback，
 *     不得再裸调 kvGet/kvSet/sGet/sSet（消除「收口缺口」）。
 *  2. STORAGE_KEYS 中 director3d-project* 必须登记 backend:'kv' + fallback:true + timeout>0，
 *     使双通道形态由唯一登记表驱动（per-key 选项）。
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/components/base/core/contentStore.ts', () => ({
  contentSetKvWithFallback: vi.fn(),
  contentGetKvWithFallback: vi.fn(),
}));
vi.mock('../../src/components/base/api/filesApi.ts', () => ({
  saveInlineToLocal: vi.fn(async () => 'http://127.0.0.1:18080/files/director3d/x.png'),
}));

import {
  contentSetKvWithFallback,
  contentGetKvWithFallback,
} from '../../src/components/base/core/contentStore.ts';
import { STORAGE_KEYS } from '../../src/components/base/core/contracts.ts';
import { writeProject, hydrateProject } from '../../src/components/director3d/d3dPersistence.ts';

// 每个用例前重置 mock，避免 mockResolvedValueOnce 队列与调用计数跨用例泄漏
beforeEach(() => {
  vi.resetAllMocks();
});

describe('TD-7 方案A — d3d 双通道收口 contentStore', () => {
  it('writeProject 委托 contentSetKvWithFallback 且透传实际落点（kv）', async () => {
    (contentSetKvWithFallback as ReturnType<typeof vi.fn>).mockResolvedValueOnce('kv');
    const r = await writeProject('director3d-project', { shots: [] });
    expect(contentSetKvWithFallback).toHaveBeenCalledWith('director3d-project', expect.anything());
    expect(r).toBe('kv');
  });

  it('writeProject 降级返回 local（KV 不可达路径）', async () => {
    (contentSetKvWithFallback as ReturnType<typeof vi.fn>).mockResolvedValueOnce('local');
    const r = await writeProject('director3d-project-abc', { shots: [] });
    expect(contentSetKvWithFallback).toHaveBeenCalledWith(
      'director3d-project-abc',
      expect.anything(),
    );
    expect(r).toBe('local');
  });

  it('hydrateProject 经 contentGetKvWithFallback 读取；KV 空且本地有 → 触发 local→KV 迁移写回', async () => {
    (contentGetKvWithFallback as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      value: { shots: [{ id: 'ls' }] },
      from: 'local',
    });
    (contentSetKvWithFallback as ReturnType<typeof vi.fn>).mockResolvedValueOnce('kv');
    const r = await hydrateProject('director3d-project');
    expect(contentGetKvWithFallback).toHaveBeenCalledWith('director3d-project');
    expect(contentSetKvWithFallback).toHaveBeenCalled(); // 一次性迁移写回 KV
    expect(r).toEqual({ shots: [{ id: 'ls' }] });
  });

  it('hydrateProject KV 命中 → 不触发迁移', async () => {
    (contentGetKvWithFallback as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      value: { shots: [{ id: 'kv' }] },
      from: 'kv',
    });
    const r = await hydrateProject('director3d-project');
    expect(contentSetKvWithFallback).not.toHaveBeenCalled();
    expect(r).toEqual({ shots: [{ id: 'kv' }] });
  });
});

describe('TD-02-3 — 跨窗口广播通道（首调建立 / 次调复用，修恒真守卫假护栏）', () => {
  it('首次保存建立 BroadcastChannel 并广播；再次保存复用同一实例', async () => {
    // 原实现初值 null + 守卫 `!== undefined`（恒真）→ 通道从未建立、广播静默失效。
    // 本用例是「护栏真的生效」的机器证据：建 1 次、两次保存各广播 1 次。
    vi.resetModules();
    const posts: unknown[] = [];
    let built = 0;
    class FakeChannel {
      onmessage: unknown = null;
      constructor(public name: string) {
        built += 1;
      }
      postMessage = (msg: unknown) => void posts.push(msg);
    }
    vi.stubGlobal('BroadcastChannel', FakeChannel);
    const mod = await import('../../src/components/director3d/d3dPersistence.ts');
    (contentSetKvWithFallback as ReturnType<typeof vi.fn>).mockResolvedValue('kv');

    await mod.writeProject('director3d-project', { shots: [] });
    await mod.writeProject('director3d-project', { shots: [] });

    expect(built).toBe(1); // 只建立一次（复用，不每次保存都 new）
    expect(posts).toHaveLength(2); // 两次成功写入各广播一次
    expect((posts[0] as { type?: string }).type).toBe('D3D_SAVED');
    vi.unstubAllGlobals();
  });

  it('环境不支持 BroadcastChannel → 退化为无冲突提示（不抛错），且只尝试建立一次', async () => {
    vi.resetModules();
    let tries = 0;
    class ThrowingChannel {
      constructor() {
        tries += 1;
        throw new Error('BroadcastChannel unsupported');
      }
    }
    vi.stubGlobal('BroadcastChannel', ThrowingChannel);
    const mod = await import('../../src/components/director3d/d3dPersistence.ts');
    (contentSetKvWithFallback as ReturnType<typeof vi.fn>).mockResolvedValue('kv');

    await expect(mod.writeProject('director3d-project', { shots: [] })).resolves.toBe('kv');
    await mod.writeProject('director3d-project', { shots: [] });

    expect(tries).toBe(1); // 不可用记入 null 复用，不每次保存重试构造
    vi.unstubAllGlobals();
  });
});

describe('TD-7 方案A — STORAGE_KEYS 登记表兜底双通道选项', () => {
  it('director3d-project* 登记 backend=kv + fallback=true + timeout>0', () => {
    expect(STORAGE_KEYS['director3d-project'].backend).toBe('kv');
    expect(STORAGE_KEYS['director3d-project'].fallback).toBe(true);
    expect(STORAGE_KEYS['director3d-project'].timeout).toBeGreaterThan(0);
    expect(STORAGE_KEYS['director3d-project-{nodeId}'].backend).toBe('kv');
    expect(STORAGE_KEYS['director3d-project-{nodeId}'].fallback).toBe(true);
    expect(STORAGE_KEYS['director3d-project-{nodeId}'].timeout).toBeGreaterThan(0);
  });
});
