/**
 * nodeDataSchema 单测（TD-02-7 主体，2026-09-12）。
 *
 * 锁定三条行为契约（源码一变必红）：
 *  1. `defaultNodeData` = 「expanded 注入（仅 INPUT_PANEL 节点）」+「NODE_DATA_DEFAULTS 登记项」；
 *  2. 未登记 data 的类型返回**纯注入结果**（不凭空造字段）；
 *  3. **嵌套值深拷贝** —— 不同调用/不同节点不得共享同一数组实例（否则一处 push 污染全局）。
 */
import { describe, it, expect } from 'vitest';
import {
  defaultNodeData,
  NODE_DATA_DEFAULTS,
} from '../../src/components/base/canvas/nodeDataSchema.ts';

describe('nodeDataSchema.defaultNodeData', () => {
  it('有输入面板的节点注入 expanded:false，并合并该类型登记项', () => {
    expect(defaultNodeData('textGenerateNode')).toEqual({ expanded: false, text: '' });
  });

  it('非输入面板节点不注入 expanded', () => {
    const d = defaultNodeData('gridSplitNode');
    expect(d.expanded).toBeUndefined();
    expect(d.rows).toBe(3);
  });

  it('未登记 data 的类型只返回注入结果（不凭空造字段）', () => {
    // assetNode 无 data 默认值（幽灵 images:[] 已于 2026-09-11 删除），且不在 INPUT_PANEL 内
    expect(defaultNodeData('assetNode')).toEqual({});
    // group 同理（其 label 由建组路径写入，非新建默认）
    expect(defaultNodeData('group')).toEqual({});
  });

  it('登记项可显式覆盖 expanded（imageBoxNode 自带展开态）', () => {
    expect(defaultNodeData('imageBoxNode')).toEqual({
      images: [],
      activeIndex: 0,
      expanded: false,
    });
  });

  it('嵌套数组/对象深拷贝：不同调用不共享实例（防跨节点污染）', () => {
    const a = defaultNodeData('imageBoxNode');
    const b = defaultNodeData('imageBoxNode');
    expect(a).not.toBe(b);
    expect(a.images).not.toBe(b.images);
    (a.images as unknown[]).push('polluted');
    expect((b.images as unknown[]).length).toBe(0);
    // 默认值真源本身也不得被污染
    expect((NODE_DATA_DEFAULTS.imageBoxNode.images as unknown[]).length).toBe(0);
  });

  it('登记表的每个类型都能解析出对象（键名与真源一致，防登记名拼错）', () => {
    for (const type of Object.keys(NODE_DATA_DEFAULTS)) {
      const d = defaultNodeData(type);
      for (const k of Object.keys(NODE_DATA_DEFAULTS[type])) {
        expect(d[k], `${type}.${k} 应出现在 defaultNodeData 结果中`).toEqual(
          NODE_DATA_DEFAULTS[type][k],
        );
      }
    }
  });
});
