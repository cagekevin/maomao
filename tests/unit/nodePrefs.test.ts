import { describe, it, expect, beforeEach } from 'vitest';
import {
  getNodePrefs,
  injectNodePrefs,
  mergeNodePrefs,
} from '../../src/components/base/canvas/nodePrefs.ts';
import { contentSet, contentClearCache } from '../../src/components/base/core/contentStore.ts';

// 记忆写入必须走业务唯一入口 contentSet（带 yimao: 前缀 + STORAGE_KEYS 登记），
// 禁止裸写 localStorage（会绕开前缀导致读不到，正是记忆功能失效的坑）。
beforeEach(() => {
  localStorage.clear();
  contentClearCache();
});

describe('getNodePrefs', () => {
  it('无记忆时返回默认值', () => {
    expect(
      getNodePrefs('imageGenerateNode', { model: '', aspectRatio: 'Auto', imageSize: '1K' }),
    ).toEqual({
      model: '',
      aspectRatio: 'Auto',
      imageSize: '1K',
    });
  });

  it('有记忆时合并覆盖', () => {
    contentSet('yimao_node_prefs', { imageGenerateNode: { aspectRatio: '16:9', imageSize: '2K' } });
    expect(
      getNodePrefs('imageGenerateNode', { model: '', aspectRatio: 'Auto', imageSize: '1K' }),
    ).toEqual({
      model: '',
      aspectRatio: '16:9',
      imageSize: '2K',
    });
  });
});

describe('injectNodePrefs（新建注入，不污染存量）', () => {
  it('新建节点：data 缺字段时注入记忆值', () => {
    contentSet('yimao_node_prefs', {
      imageGenerateNode: { model: 'm1', aspectRatio: '16:9', imageSize: '2K' },
    });
    const data = injectNodePrefs('imageGenerateNode', {});
    // 新建节点沿用上次参数
    expect(data.selectedModel).toBe('m1');
    expect(data.aspectRatio).toBe('16:9');
    expect(data.imageSize).toBe('2K');
  });

  it('传入优先于记忆：已显式传的字段不被记忆覆盖', () => {
    contentSet('yimao_node_prefs', { imageGenerateNode: { aspectRatio: '16:9', imageSize: '2K' } });
    const data = injectNodePrefs('imageGenerateNode', { aspectRatio: '1:1' });
    // 显式传入的 1:1 保留；未传的 imageSize 用记忆
    expect(data.aspectRatio).toBe('1:1');
    expect(data.imageSize).toBe('2K');
  });

  it('未知类型不注入（快照还原/未登记节点安全）', () => {
    contentSet('yimao_node_prefs', { scriptBoxNode: { foo: 'bar' } });
    const data = injectNodePrefs('scriptBoxNode', {});
    expect(data).toEqual({});
  });

  it('记忆为空时回退纯常量默认', () => {
    const data = injectNodePrefs('imageGenerateNode', {});
    expect(data.aspectRatio).toBe('Auto');
    expect(data.imageSize).toBe('1K');
    expect(data.selectedModel).toBe('');
  });
});

describe('mergeNodePrefs（写存储：以存储最新为基准合并 patch，TD-02-5）', () => {
  it('同类型两实例各持旧副本、先后改不同字段 → 两次更新都保留（旧实现末写胜会丢）', () => {
    // 实例 A、B 都从「无记忆」起步（各自持初始副本），A 先改 model、B 再改 imageSize。
    mergeNodePrefs('imageGenerateNode', {}, { model: 'm1' });
    mergeNodePrefs('imageGenerateNode', {}, { imageSize: '2K' });
    // 旧实现写的是 `{...本实例prev, ...patch}` → B 落盘会把 A 的 model 整份盖掉（只剩 imageSize）
    expect(getNodePrefs('imageGenerateNode')).toEqual({ model: 'm1', imageSize: '2K' });
  });

  it('同名字段以最新为准（patch 覆盖，非丢弃）', () => {
    mergeNodePrefs('imageGenerateNode', {}, { model: 'm1' });
    mergeNodePrefs('imageGenerateNode', {}, { model: 'm2' });
    expect(getNodePrefs('imageGenerateNode')).toEqual({ model: 'm2' });
  });

  it('不同节点类型的记忆互不干扰（整表结构保留）', () => {
    mergeNodePrefs('imageGenerateNode', {}, { model: 'm1' });
    mergeNodePrefs('textGenerateNode', {}, { model: 't1' });
    expect(getNodePrefs('imageGenerateNode')).toEqual({ model: 'm1' });
    expect(getNodePrefs('textGenerateNode')).toEqual({ model: 't1' });
  });

  it('返回值 = 本实例新 UI 态（含 defaults 合并，供节点立即生效）', () => {
    const next = mergeNodePrefs('imageGenerateNode', { aspectRatio: 'Auto' }, { model: 'm1' });
    expect(next).toEqual({ aspectRatio: 'Auto', model: 'm1' });
    // 存储侧只落本次 patch + 已有记忆，不把 UI 态里的 defaults 一起写进去
    expect(getNodePrefs('imageGenerateNode')).toEqual({ model: 'm1' });
  });
});
