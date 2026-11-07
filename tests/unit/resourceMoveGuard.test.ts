/**
 * 「拖文件到文件夹卡片」的判据（2026-11-07 从 useResourceMoveToFolder.test.tsx 迁来）。
 *
 * 原锁法：renderHook + 假 drag 事件，逐个断言 toast 文案与 moveFile 调用。
 * 现改锁纯函数 `decideResourceMove` / `canDragResourceCard`（AGENTS.md §2.3：判据下沉再测）——
 * 真正会出错的是「该不该移动、移到哪、说什么话」，不是事件对象本身。
 */
import { describe, it, expect } from 'vitest';
import {
  canDragResourceCard,
  decideResourceMove,
} from '@/components/resource/resourceMoveGuard.ts';

const localAsset = {
  folder: 'a',
  name: 'x.png',
  url: '/files/a/x.png',
  source: 'local-tool',
  type: 'image',
};

describe('canDragResourceCard —— 谁是拖拽源', () => {
  it('文件夹不参与拖拽（它本身是被移入的目标）', () => {
    expect(canDragResourceCard({ ...localAsset, type: 'folder' })).toBe(false);
  });

  it('无 url 的条目不可拖（没有磁盘落点，拖了也移不动）', () => {
    expect(canDragResourceCard({ ...localAsset, url: '' })).toBe(false);
    expect(canDragResourceCard({ name: 'x.png', type: 'image' })).toBe(false);
  });

  it('普通素材可拖', () => {
    expect(canDragResourceCard(localAsset)).toBe(true);
  });
});

describe('decideResourceMove —— 落点判据（顺序即优先级）', () => {
  it('引擎未连接 → 说清原因（warning，不静默）', () => {
    const d = decideResourceMove({ connected: false, item: localAsset, target: 'web' });
    expect(d).toEqual({ kind: 'warn', message: '请先连接本地引擎' });
  });

  it('没有载荷 → 忽略（别的来源拖进来的，不归这里管）', () => {
    const d = decideResourceMove({ connected: true, item: null, target: 'web' });
    expect(d).toEqual({ kind: 'ignore', reason: 'no-payload' });
  });

  it('非本地资源 → 「仅支持移动本地资源」，不调 moveFile', () => {
    const d = decideResourceMove({
      connected: true,
      item: { ...localAsset, source: 'web' },
      target: 'web',
    });
    expect(d).toEqual({ kind: 'warn', message: '仅支持移动本地资源' });
  });

  it('已在目标目录 → 提示且不移动（否则撞后端去重、行留旧目录 = 假成功）', () => {
    const d = decideResourceMove({ connected: true, item: localAsset, target: 'a' });
    expect(d).toEqual({ kind: 'warn', message: '文件已在目标目录' });
  });

  it('TD-12-8：src/dst 由不可变 url 派生，不用 UI 的 folder/name 拼', () => {
    const d = decideResourceMove({
      connected: true,
      // folder/name 与磁盘脱钩（UI 显示名），真源是 url
      item: { ...localAsset, folder: '假目录', name: '假名.png' },
      target: 'web',
    });
    expect(d).toEqual({ kind: 'move', src: 'a/x.png', dst: 'web/x.png', target: 'web' });
  });
});
