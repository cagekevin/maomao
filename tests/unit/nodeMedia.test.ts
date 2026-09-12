/**
 * nodeMedia 单测（04 区母体 TD-04-24/25/27）。
 * 覆盖：
 *   - getNodeAssetUrl / getNodeMedia：自 useCanvasAgentTools 下沉后的行为回归（原样搬迁，逐例保持）
 *   - deriveSelectedAssets：从 nodes[].selected 实时派生「选中带媒体节点」（幽灵清除 / 媒体更新）
 *   - selectedAssetSig / selectedNodeIdSig：内容签名短路（拖动坐标不进签名 → 引用稳定）
 */
import { describe, it, expect } from 'vitest';
import type { Node } from '@xyflow/react';
import {
  getNodeAssetUrl,
  getNodeMedia,
  deriveSelectedAssets,
  selectedAssetSig,
  selectedNodeIdSig,
} from '../../src/components/base/canvas/nodeMedia.ts';

const mkNode = (data: Record<string, unknown> = {}, over: Partial<Node> = {}): Node => ({
  id: 'n',
  position: { x: 0, y: 0 },
  data,
  ...over,
});

describe('getNodeAssetUrl（下沉回归）', () => {
  it('data.assetUrl 优先，data.url 兜底', () => {
    expect(getNodeAssetUrl(mkNode({ assetUrl: 'A', url: 'B' }))).toBe('A');
    expect(getNodeAssetUrl(mkNode({ url: 'B' }))).toBe('B');
  });
  it('images / assetUrls 数组（字符串元素 / {url} / {assetUrl}）', () => {
    expect(getNodeAssetUrl(mkNode({ images: ['http://a'] }))).toBe('http://a');
    expect(getNodeAssetUrl(mkNode({ images: [{ url: 'http://b' }] }))).toBe('http://b');
    expect(getNodeAssetUrl(mkNode({ images: [{ assetUrl: 'http://c' }] }))).toBe('http://c');
    expect(getNodeAssetUrl(mkNode({ assetUrls: ['http://d'] }))).toBe('http://d');
  });
  it('无图 → 空串', () => {
    expect(getNodeAssetUrl(mkNode({}))).toBe('');
    expect(getNodeAssetUrl(null)).toBe('');
  });
});

describe('getNodeMedia（下沉回归）', () => {
  it('视频节点返回本体 videoUrl + type=video', () => {
    expect(
      getNodeMedia(mkNode({ videoUrl: 'http://a/c.mp4', assetUrl: 'http://a/cov.png' })),
    ).toEqual({ type: 'video', url: 'http://a/c.mp4' });
    expect(getNodeMedia(mkNode({ assetType: 'video', url: 'http://a/c.mp4' }))).toEqual({
      type: 'video',
      url: 'http://a/c.mp4',
    });
  });
  it('音频节点返回本体 audioUrl + type=audio', () => {
    expect(getNodeMedia(mkNode({ audioUrl: 'http://a/v.mp3' }))).toEqual({
      type: 'audio',
      url: 'http://a/v.mp3',
    });
  });
  it('图片节点退化为主图 + type=image；无媒体返回空', () => {
    expect(getNodeMedia(mkNode({ assetUrl: 'http://a/1.png' }))).toEqual({
      type: 'image',
      url: 'http://a/1.png',
    });
    expect(getNodeMedia(mkNode({}))).toEqual({ type: '', url: '' });
  });
});

describe('deriveSelectedAssets（单一事实来源 = nodes[].selected）', () => {
  it('未选中 → 空列表', () => {
    expect(deriveSelectedAssets([mkNode({ assetUrl: 'http://a/1.png' })])).toEqual([]);
    expect(deriveSelectedAssets(null)).toEqual([]);
  });

  it('选中带媒体节点 → 投影出 nodeId/type/url/坐标/label', () => {
    const nodes = [
      mkNode(
        { assetUrl: 'http://a/1.png', label: '图A' },
        { id: 'n1', selected: true, position: { x: 12, y: 34 }, type: 'imageGenerateNode' },
      ),
      mkNode({ assetUrl: 'http://a/2.png' }, { id: 'n2', selected: false }),
    ];
    expect(deriveSelectedAssets(nodes)).toEqual([
      {
        nodeId: 'n1',
        nodeType: 'imageGenerateNode',
        label: '图A',
        type: 'image',
        url: 'http://a/1.png',
        x: 12,
        y: 34,
      },
    ]);
  });

  it('选中无媒体节点（如文本）→ 被过滤掉', () => {
    const nodes = [mkNode({ text: 'hi' }, { id: 't1', selected: true, type: 'textGenerateNode' })];
    expect(deriveSelectedAssets(nodes)).toEqual([]);
  });

  it('视频/音频节点 → type 原样透传（不被拍平成 image）', () => {
    const nodes = [
      mkNode({ assetType: 'video', url: 'http://a/c.mp4' }, { id: 'v1', selected: true }),
      mkNode({ assetType: 'audio', url: 'http://a/vo.mp3' }, { id: 'a1', selected: true }),
    ];
    expect(deriveSelectedAssets(nodes).map((a) => a.type)).toEqual(['video', 'audio']);
  });

  it('label 兜底 data.projectName', () => {
    const nodes = [
      mkNode({ assetUrl: 'http://a/1.png', projectName: '项目名' }, { id: 'n1', selected: true }),
    ];
    expect(deriveSelectedAssets(nodes)[0].label).toBe('项目名');
  });

  it('节点媒体 URL 变化 → 派生结果随之更新（原「仅 select 变化才同步」的缺口）', () => {
    const before = deriveSelectedAssets([
      mkNode({ assetUrl: 'http://a/old.png' }, { id: 'n1', selected: true }),
    ]);
    const after = deriveSelectedAssets([
      mkNode({ assetUrl: 'http://a/new.png' }, { id: 'n1', selected: true }),
    ]);
    expect(selectedAssetSig(before)).not.toBe(selectedAssetSig(after));
  });
});

describe('selectedAssetSig / selectedNodeIdSig（短路签名）', () => {
  it('selectedAssetSig：内容（nodeId/type/url）变化敏感', () => {
    expect(
      selectedAssetSig(deriveSelectedAssets([mkNode({ url: 'u1' }, { id: 'a', selected: true })])),
    ).toBe('a:image:u1');
  });

  it('selectedAssetSig：坐标变化不敏感（拖动不应触发回写）', () => {
    const base = [
      { nodeId: 'a', nodeType: 'x', label: '', type: 'image' as const, url: 'u1', x: 0, y: 0 },
    ];
    const moved = [{ ...base[0], x: 999, y: 999 }];
    expect(selectedAssetSig(base)).toBe(selectedAssetSig(moved));
  });

  it('selectedNodeIdSig：排序稳定 + 空集为空串', () => {
    const nodes = [
      mkNode({}, { id: 'b', selected: true }),
      mkNode({}, { id: 'a', selected: true }),
      mkNode({}, { id: 'c', selected: false }),
    ];
    expect(selectedNodeIdSig(nodes)).toBe('a|b');
    expect(selectedNodeIdSig([mkNode({}, { id: 'a', selected: false })])).toBe('');
  });
});
