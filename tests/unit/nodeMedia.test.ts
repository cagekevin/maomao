/**
 * nodeMedia 单测（04 区母体 TD-04-24/25/27）。
 *
 * 【2026-09-25 按件切后分成两处被测】
 *   - `base/utils/media/nodeMedia.ts`（**横切**）：
 *       getNodeAssetUrl / getNodeMedia —— 逐例保持原行为（零炸基线），并新增「认 contentId」断言。
 *   - `canvas/lib/selectedAssets.ts`（**画布语义**）：
 *       deriveSelectedAssets / selectedAssetSig / selectedNodeIdSig。
 */
import { describe, it, expect } from 'vitest';
import type { Node } from '@xyflow/react';
import {
  getNodeAssetUrl,
  getNodeMedia,
  type ContentUrlResolver,
} from '../../src/components/base/utils/media/nodeMedia.ts';
import { buildContentUrlResolver } from '../../src/components/base/utils/media/assetUrl.ts';
import {
  deriveSelectedAssets,
  selectedAssetSig,
  selectedNodeIdSig,
} from '../../src/components/canvas/lib/selectedAssets.ts';

const mkNode = (data: Record<string, unknown> = {}, over: Partial<Node> = {}): Node => ({
  id: 'n',
  position: { x: 0, y: 0 },
  data,
  ...over,
});

/** 没有 contentId 可解析时的解析器（真实调用方在无 resource 时等价于它） */
const noContent: ContentUrlResolver = () => null;

describe('getNodeAssetUrl（下沉回归 + 唯一读入口委托）', () => {
  it('data.assetUrl 优先，data.url 兜底', () => {
    expect(getNodeAssetUrl(mkNode({ assetUrl: 'A', url: 'B' }), noContent)).toBe('A');
    expect(getNodeAssetUrl(mkNode({ url: 'B' }), noContent)).toBe('B');
  });
  it('images / assetUrls 数组（字符串元素 / {url} / {assetUrl}）', () => {
    expect(getNodeAssetUrl(mkNode({ images: ['http://a'] }), noContent)).toBe('http://a');
    expect(getNodeAssetUrl(mkNode({ images: [{ url: 'http://b' }] }), noContent)).toBe('http://b');
    expect(getNodeAssetUrl(mkNode({ images: [{ assetUrl: 'http://c' }] }), noContent)).toBe(
      'http://c',
    );
    expect(getNodeAssetUrl(mkNode({ assetUrls: ['http://d'] }), noContent)).toBe('http://d');
  });
  it('无图 → 空串', () => {
    expect(getNodeAssetUrl(mkNode({}), noContent)).toBe('');
    expect(getNodeAssetUrl(null, noContent)).toBe('');
  });

  // ── 母体断言（TD-14-2 / TD-16-23）：读侧必须认 contentId 型节点 ──────────────────
  // 断言用**真实解析器**跑「contentId → resource url」端到端，不是断实现细节。
  // 把委托改回「只嗅探 assetUrl/url」⇒ 本组必红。
  it('认得「只持 contentId」的文件型节点（母体：曾静默读不到 → 上游缩略图空白 / 画布来源少节点）', () => {
    const resolve = buildContentUrlResolver([{ contentId: 'sha1:abc', url: '/files/abc.png' }]);
    expect(getNodeAssetUrl(mkNode({ contentId: 'sha1:abc' }), resolve)).toBe('/files/abc.png');
    expect(getNodeMedia(mkNode({ contentId: 'sha1:abc' }), resolve)).toEqual({
      type: 'image',
      url: '/files/abc.png',
    });
  });

  it('contentId 是稳定身份，优先于存量字段（编辑后不得再解析出旧图）', () => {
    const resolve = buildContentUrlResolver([{ contentId: 'sha1:new', url: '/files/new.png' }]);
    expect(
      getNodeAssetUrl(mkNode({ contentId: 'sha1:new', assetUrl: 'http://old.png' }), resolve),
    ).toBe('/files/new.png');
  });

  it('contentId 查不到 resource（已删）→ 回落存量字段，不静默返回空', () => {
    expect(
      getNodeAssetUrl(mkNode({ contentId: 'sha1:gone', assetUrl: 'http://a/1.png' }), noContent),
    ).toBe('http://a/1.png');
  });
});

describe('getNodeMedia（下沉回归）', () => {
  it('视频节点返回本体 videoUrl + type=video', () => {
    expect(
      getNodeMedia(mkNode({ videoUrl: 'http://a/c.mp4', assetUrl: 'http://a/cov.png' }), noContent),
    ).toEqual({ type: 'video', url: 'http://a/c.mp4' });
    expect(getNodeMedia(mkNode({ assetType: 'video', url: 'http://a/c.mp4' }), noContent)).toEqual({
      type: 'video',
      url: 'http://a/c.mp4',
    });
  });
  it('音频节点返回本体 audioUrl + type=audio', () => {
    expect(getNodeMedia(mkNode({ audioUrl: 'http://a/v.mp3' }), noContent)).toEqual({
      type: 'audio',
      url: 'http://a/v.mp3',
    });
  });
  it('图片节点退化为主图 + type=image；无媒体返回空', () => {
    expect(getNodeMedia(mkNode({ assetUrl: 'http://a/1.png' }), noContent)).toEqual({
      type: 'image',
      url: 'http://a/1.png',
    });
    expect(getNodeMedia(mkNode({}), noContent)).toEqual({ type: '', url: '' });
  });
  it('声明了 video 本体类型但只持 contentId → 仍能解析出地址（原实现静默为空）', () => {
    const resolve = buildContentUrlResolver([{ contentId: 'sha1:v', url: '/files/v.mp4' }]);
    expect(getNodeMedia(mkNode({ assetType: 'video', contentId: 'sha1:v' }), resolve)).toEqual({
      type: 'video',
      url: '/files/v.mp4',
    });
  });
});

describe('deriveSelectedAssets（单一事实来源 = nodes[].selected）', () => {
  it('未选中 → 空列表', () => {
    expect(deriveSelectedAssets([mkNode({ assetUrl: 'http://a/1.png' })], noContent)).toEqual([]);
    expect(deriveSelectedAssets(null, noContent)).toEqual([]);
  });

  it('选中带媒体节点 → 投影出 nodeId/type/url/坐标/label', () => {
    const nodes = [
      mkNode(
        { assetUrl: 'http://a/1.png', label: '图A' },
        { id: 'n1', selected: true, position: { x: 12, y: 34 }, type: 'imageGenerateNode' },
      ),
      mkNode({ assetUrl: 'http://a/2.png' }, { id: 'n2', selected: false }),
    ];
    expect(deriveSelectedAssets(nodes, noContent)).toEqual([
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
    expect(deriveSelectedAssets(nodes, noContent)).toEqual([]);
  });

  it('视频/音频节点 → type 原样透传（不被拍平成 image）', () => {
    const nodes = [
      mkNode({ assetType: 'video', url: 'http://a/c.mp4' }, { id: 'v1', selected: true }),
      mkNode({ assetType: 'audio', url: 'http://a/vo.mp3' }, { id: 'a1', selected: true }),
    ];
    expect(deriveSelectedAssets(nodes, noContent).map((a) => a.type)).toEqual(['video', 'audio']);
  });

  it('label 兜底 data.projectName', () => {
    const nodes = [
      mkNode({ assetUrl: 'http://a/1.png', projectName: '项目名' }, { id: 'n1', selected: true }),
    ];
    expect(deriveSelectedAssets(nodes, noContent)[0].label).toBe('项目名');
  });

  it('选中「只持 contentId」的节点 → 也能进待发送区（此前被静默判空）', () => {
    const resolve = buildContentUrlResolver([{ contentId: 'sha1:sel', url: '/files/sel.png' }]);
    const nodes = [mkNode({ contentId: 'sha1:sel' }, { id: 'n1', selected: true })];
    expect(deriveSelectedAssets(nodes, resolve)).toEqual([
      expect.objectContaining({ nodeId: 'n1', type: 'image', url: '/files/sel.png' }),
    ]);
  });

  it('节点媒体 URL 变化 → 派生结果随之更新（原「仅 select 变化才同步」的缺口）', () => {
    const before = deriveSelectedAssets(
      [mkNode({ assetUrl: 'http://a/old.png' }, { id: 'n1', selected: true })],
      noContent,
    );
    const after = deriveSelectedAssets(
      [mkNode({ assetUrl: 'http://a/new.png' }, { id: 'n1', selected: true })],
      noContent,
    );
    expect(selectedAssetSig(before)).not.toBe(selectedAssetSig(after));
  });
});

describe('selectedAssetSig / selectedNodeIdSig（短路签名）', () => {
  it('selectedAssetSig：内容（nodeId/type/url）变化敏感', () => {
    expect(
      selectedAssetSig(
        deriveSelectedAssets([mkNode({ url: 'u1' }, { id: 'a', selected: true })], noContent),
      ),
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

// 【2026-09-25 删除】原「selectedNodeIdsOfSig（selectedAssetSig 的逆）」一组用例随之删除：
// 被测函数零生产消费（唯一消费者 videoEditor 入轨已于 a3ffc5d0 移除）⇒ 这组断言属
// 「只测自己、全仓零生产消费」（§7.2 禁自证式断言 形态④），随能力一起删。
