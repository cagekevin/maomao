/**
 * 回归锁：剪辑器开合是**会话态**（刷新即回默认关），不是持久化设置项。
 *
 * ════════════════════════════════════════════════════════════════
 * 契约（`base/core/editorSession.ts`）：
 *   · 初始 = **关**（`isEditorSessionOpen() === false`）—— 用户报障的反面：
 *     "现在默认我打开画布，Video editor 就打开了；我要点按钮才能打开"。
 *   · 开合只经 `setEditorSessionOpen`（唯一写入口），并通知订阅者。
 *   · **不落任何存储**（本模块不 import contentStore / localStorage）——
 *     这是它区别于 `appSettings` 的核心：写它不该产生持久化副作用。
 * ════════════════════════════════════════════════════════════════
 * 【为什么会有这条锁】改前它是 `app_settings.videoEditorOpen`（整键持久化 + 随云端同步）→
 * 打开过一次就**永远自动开**，还会同步到别的设备。本用例守住"它不再是持久化状态"。
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  isEditorSessionOpen,
  setEditorSessionOpen,
  subscribeEditorSession,
} from '../../src/components/base/core/interaction/editorSession';

describe('editorSession：剪辑器开合 = 会话态', () => {
  beforeEach(() => {
    setEditorSessionOpen(false);
  });

  it('★模块初始值 = 「关」（刷新后不该自动打开编辑器）', async () => {
    // 必须**重新加载模块**读它真实的初始值 —— 否则 beforeEach 的 setEditorSessionOpen(false)
    // 会把初始值抹平，这条断言就永远为真（测了个寂寞）。
    vi.resetModules();
    const fresh = await import('../../src/components/base/core/interaction/editorSession');
    expect(fresh.isEditorSessionOpen()).toBe(false);
  });

  it('setEditorSessionOpen(true) → 开；false → 关', () => {
    setEditorSessionOpen(true);
    expect(isEditorSessionOpen()).toBe(true);
    setEditorSessionOpen(false);
    expect(isEditorSessionOpen()).toBe(false);
  });

  it('状态变化通知订阅者（React Flow deleteKeyCode 靠它让位）', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeEditorSession(listener);

    setEditorSessionOpen(true);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    setEditorSessionOpen(false);
    expect(listener).toHaveBeenCalledTimes(1); // 退订后不再收
  });

  it('同值重复设置不通知（避免无谓重渲染）', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeEditorSession(listener);

    setEditorSessionOpen(false); // 已是 false
    expect(listener).not.toHaveBeenCalled();

    unsubscribe();
  });

  it('★本模块**不 import 任何存储**（源码级：无 contentStore / appSettings / storage 依赖）', async () => {
    // 用源码断言而非运行时 spy：运行时难以证明"没写"，源码依赖可以直接证明。
    // 只看 import 语句 —— 注释里会出现这些词（用于说明"为什么不做"），不该误伤。
    const fs = await import('node:fs');
    const src = fs.readFileSync(
      new URL('../../src/components/base/core/interaction/editorSession.ts', import.meta.url),
      'utf8',
    );
    const importLines = src
      .split('\n')
      .filter((line) => /^\s*import\s/.test(line))
      .join('\n');
    expect(importLines).not.toMatch(/contentStore|appSettings|storage|localStorage/);
  });
});
