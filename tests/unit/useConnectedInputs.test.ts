import { describe, it, expect } from 'vitest';
import {
  getNodeOutput,
  NODE_OUTPUTS,
  buildIncomingIndex,
  incomingOf,
  collectUpstream,
  upstreamEqual,
  aggregateUpstream,
} from '../../src/hooks/useConnectedInputs.ts';
import {
  SHOT_HANDLE_PREFIX,
  shotHandleId,
  parseShotHandle,
} from '../../src/components/base/core/contracts.ts';

// 分镜端口契约（contracts.SHOT_HANDLE_PREFIX）：写侧 shotHandleId / 读侧 parseShotHandle 必须成对往返
describe('分镜端口 handle 契约', () => {
  it('前缀值与 handle 形态', () => {
    expect(SHOT_HANDLE_PREFIX).toBe('shot-');
    expect(shotHandleId('s1')).toBe('shot-s1');
  });

  it('编解码往返（写侧→读侧）', () => {
    expect(parseShotHandle(shotHandleId('abc-123'))).toBe('abc-123');
  });

  it('分镜 id 自身含前缀不误伤（旧 replace 实现在此会红）', () => {
    expect(shotHandleId('shot-9')).toBe('shot-shot-9');
    expect(parseShotHandle(shotHandleId('shot-9'))).toBe('shot-9');
  });

  it('非分镜端口 / 空值一律 null', () => {
    expect(parseShotHandle('output')).toBeNull();
    expect(parseShotHandle('shot-')).toBeNull();
    expect(parseShotHandle('')).toBeNull();
    expect(parseShotHandle(undefined)).toBeNull();
    expect(parseShotHandle(null)).toBeNull();
  });
});

// §2.4 管线契约：getNodeOutput 是「连线上游→下游参考」的核心纯函数
describe('管线契约 getNodeOutput', () => {
  it('只接一层：返回四类聚合空对象当无产出', () => {
    const r = getNodeOutput({ id: 'x', type: 'promptNode', data: {} });
    expect(r).toEqual({ images: [], texts: [], videos: [], audios: [] });
  });

  it('textNode → texts（{id,label,text}）', () => {
    const r = getNodeOutput({
      id: 't1',
      type: 'textNode',
      data: { text: '你好世界', label: '标题' },
    });
    expect(r.texts).toHaveLength(1);
    expect(r.texts[0]).toMatchObject({ id: 't1', label: '标题', text: '你好世界' });
  });

  it('textNode 空文本不产出', () => {
    const r = getNodeOutput({ id: 't1', type: 'textNode', data: { text: '' } });
    expect(r.texts).toHaveLength(0);
  });

  it('imageBoxNode.images[] → 聚合对象数组', () => {
    const r = getNodeOutput({
      id: 'b1',
      type: 'imageBoxNode',
      data: {
        images: [
          { id: 'a', url: '/files/a.png', label: '图A' },
          { id: 'b', url: '' },
        ],
      },
    });
    expect(r.images).toHaveLength(1);
    expect(r.images[0]).toMatchObject({ id: 'a', url: '/files/a.png', label: '图A' });
  });

  it('videoExtractNode.extractedImages[] → 帧（image 类）', () => {
    const r = getNodeOutput({
      id: 'v1',
      type: 'videoExtractNode',
      data: { extractedImages: ['data:image/png;base64,aaa', 'data:image/png;base64,bbb'] },
    });
    expect(r.images).toHaveLength(2);
    expect(r.images[0].id).toBe('frame-0');
    expect(r.images[1].label).toBe('帧 2');
  });

  it('gridSplitNode / gridMergeNode → 切片/图 聚合', () => {
    const sp = getNodeOutput({
      id: 's',
      type: 'gridSplitNode',
      data: { extractedImages: ['u1', 'u2'] },
    });
    expect(sp.images.map((x) => x.id)).toEqual(['split-0', 'split-1']);
    const mg = getNodeOutput({ id: 'm', type: 'gridMergeNode', data: { extractedImages: ['u1'] } });
    expect(mg.images[0].id).toBe('merge-0');
  });

  it('通用兜底 imageUrl → images', () => {
    const r = getNodeOutput({ id: 'p1', type: 'promptNode', data: { imageUrl: 'http://x/y.png' } });
    expect(r.images).toHaveLength(1);
    expect(r.images[0].url).toBe('http://x/y.png');
  });

  it('通用兜底图片产出带 label（改名流向下游候选）', () => {
    const r = getNodeOutput({
      id: 'p1',
      type: 'promptNode',
      data: { imageUrl: 'http://x/y.png', label: '猫' },
    });
    expect(r.images[0].label).toBe('猫');
  });

  it('通用兜底图片无 label → 不注入（下游兜底 图片N）', () => {
    const r = getNodeOutput({ id: 'p1', type: 'promptNode', data: { imageUrl: 'http://x/y.png' } });
    expect(r.images[0].label).toBeUndefined();
  });

  it('通用兜底 videoUrl（data:video）→ videos，尊重 mediaType，且带 label（预留）', () => {
    const r = getNodeOutput({
      id: 'p1',
      type: 'discountVideoNode',
      data: { videoUrl: 'data:video/mp4;base64,xxx', label: '参考' },
    });
    expect(r.videos).toHaveLength(1);
    expect(r.videos[0].label).toBe('参考');
  });

  it('通用兜底：resultUrl 兜底、mediaType=audio 优先，且带 label（预留）', () => {
    const r = getNodeOutput({
      id: 'a1',
      type: 'imageNode',
      data: { resultUrl: 'blob:x', mediaType: 'audio', label: 'BGM' },
    });
    expect(r.audios).toHaveLength(1);
    expect(r.audios[0].label).toBe('BGM');
  });

  it('imageUrl > videoUrl > resultUrl 优先级', () => {
    const r = getNodeOutput({
      id: 'p1',
      type: 'promptNode',
      data: { imageUrl: 'http://x/i.png', videoUrl: 'http://x/v.mp4' },
    });
    expect(r.images).toHaveLength(1);
    expect(r.videos).toHaveLength(0);
  });

  it('剧本盒子按 shot-${id} 只取对应镜头资产（collectAssets 匹配）', () => {
    const node = {
      id: 'sb',
      type: 'scriptBoxNode',
      data: {
        shots: [
          { id: 's1', description: '@小红帽 走进森林' },
          { id: 's2', description: '@大灰狼 出现' },
        ],
        assets: [
          { id: 'a1', name: '小红帽', imageUrl: '/files/r.png' },
          { id: 'a2', name: '大灰狼', imageUrl: '/files/w.png' },
        ],
      },
    };
    const r1 = getNodeOutput(node, 'shot-s1');
    expect(r1.images).toHaveLength(1);
    expect(r1.images[0].url).toBe('/files/r.png');
    expect(r1.images[0].label).toBe('小红帽'); // 资产名带出，供下游 @名 匹配
    const r2 = getNodeOutput(node, 'shot-s2');
    expect(r2.images[0].url).toBe('/files/w.png');
    expect(r2.images[0].label).toBe('大灰狼');
  });

  it('剧本盒子非 shot- 端口走通用兜底', () => {
    const node = { id: 'sb', type: 'scriptBoxNode', data: { imageUrl: '/files/out.png' } };
    const r = getNodeOutput(node, 'output');
    expect(r.images).toHaveLength(1);
    expect(r.images[0].url).toBe('/files/out.png');
  });

  it('剧本盒声明在非分镜端口时「弃权」（返回 undefined），不屏蔽通用兜底', () => {
    // 断言实现一变必红：若有人把 getNodeOutput 里的 `if (out)` 改回 `|| {}`，
    // 声明返回 undefined 会被当空产出 → 通用兜底被屏蔽 → 上一条断言立刻变红。
    const d = { imageUrl: '/files/out.png' };
    expect(NODE_OUTPUTS.scriptBoxNode(d, 'output')).toBeUndefined();
    expect(NODE_OUTPUTS.scriptBoxNode(d, undefined)).toBeUndefined();
    // 分镜端口命中时正常返回产出对象
    expect(NODE_OUTPUTS.scriptBoxNode({ shots: [{ id: 's1' }] }, shotHandleId('s1'))).toBeDefined();
  });

  it('无节点/无 data 返回空', () => {
    expect(getNodeOutput(null)).toEqual({ images: [], texts: [], videos: [], audios: [] });
    expect(getNodeOutput({ id: 'x' })).toEqual({ images: [], texts: [], videos: [], audios: [] });
  });

  it('剧本盒产出已登记进 NODE_OUTPUTS 声明表（防回退成 getNodeOutput 内特判）', () => {
    // 断言实现一变必红：若有人把 scriptBoxNode 挪回 getNodeOutput 的 if 特判，
    // 本表查不到该键 → 走 genericOutput 兜底 → 分镜资产静默丢失且 dev 校验器失声。
    expect(Object.keys(NODE_OUTPUTS)).toContain('scriptBoxNode');
    // textNode 刻意保留特判（读 node.id 非 data 派生），不应出现在声明表里
    expect(Object.keys(NODE_OUTPUTS)).not.toContain('textNode');
  });
});

// ════════════════════════════════════════════════════════════════
// P0-B（docs/106 画布重渲放大器根治）窄订阅纯函数契约
// 三段式：① incomingOf（入边，edges 引用缓存）→ ② collectUpstream/upstreamEqual（上游窄订阅）
//        → ③ aggregateUpstream（聚合，签名与旧 useMemo 体一致）
// ════════════════════════════════════════════════════════════════

function mkNode(
  id: string,
  type: string,
  data: Record<string, unknown> = {},
  extra: Record<string, unknown> = {},
) {
  return { id, type, data, position: { x: 0, y: 0 }, ...extra };
}

describe('P0-B ① 入边索引（incomingOf 引用缓存，edges 引用变才重建）', () => {
  it('同 edges 引用 → 返回同一缓存数组对象（拖拽期间 edges 引用稳定 → 不重建不重渲）', () => {
    const edges = [
      { id: 'e1', source: 'u1', target: 'd1' },
      { id: 'e2', source: 'u2', target: 'd1' },
    ];
    const a = incomingOf(edges, 'd1');
    const b = incomingOf(edges, 'd1');
    expect(a).toBe(b);
    expect(a.map((x) => x.source)).toEqual(['u1', 'u2']);
  });

  it('edges 引用变化（增连线）→ 重建并反映新入边', () => {
    const edges1 = [{ id: 'e1', source: 'u1', target: 'd1' }];
    const edges2 = [
      { id: 'e1', source: 'u1', target: 'd1' },
      { id: 'e2', source: 'u3', target: 'd1' },
    ];
    const a = incomingOf(edges1, 'd1');
    const b = incomingOf(edges2, 'd1');
    expect(a).not.toBe(b);
    expect(b.map((x) => x.source)).toEqual(['u1', 'u3']);
  });

  it('删连线 → 入边收缩', () => {
    const edges1 = [
      { id: 'e1', source: 'u1', target: 'd1' },
      { id: 'e2', source: 'u2', target: 'd1' },
    ];
    const edges2 = [{ id: 'e2', source: 'u2', target: 'd1' }];
    expect(incomingOf(edges1, 'd1')).toHaveLength(2);
    expect(incomingOf(edges2, 'd1')).toHaveLength(1);
  });

  it('无 nodeId / 无 edges / 无入边 → 空数组（不报错）', () => {
    const edges = [{ id: 'e1', source: 'u1', target: 'd1' }];
    expect(incomingOf(edges, undefined)).toEqual([]);
    expect(incomingOf(undefined, 'd1')).toEqual([]);
    expect(incomingOf(edges, 'nobody')).toEqual([]);
    expect(incomingOf([], 'd1')).toEqual([]);
  });

  it('buildIncomingIndex 按 target 分组（多 target 各得其边）', () => {
    const edges = [
      { id: 'e1', source: 'u1', target: 'd1', sourceHandle: 'out-a' },
      { id: 'e2', source: 'u2', target: 'd2' },
      { id: 'e3', source: 'u3', target: 'd1' },
    ];
    const idx = buildIncomingIndex(edges);
    expect(idx.get('d1')?.map((x) => x.source)).toEqual(['u1', 'u3']);
    expect(idx.get('d1')?.[0].sourceHandle).toBe('out-a');
    expect(idx.get('d2')?.map((x) => x.source)).toEqual(['u2']);
  });
});

describe('P0-B ② 上游收集与判等（collectUpstream / upstreamEqual）', () => {
  it('上游改 data（引用变化）→ upstreamEqual 判不等 → 重算', () => {
    const before = mkNode('u1', 'promptNode', { imageUrl: 'http://a.png' });
    const after = mkNode('u1', 'promptNode', { imageUrl: 'http://b.png' }); // 重新生成 → 新 data 引用
    const upA = [{ node: before, sourceHandle: undefined }];
    const upB = [{ node: after, sourceHandle: undefined }];
    expect(upstreamEqual(upA, upB)).toBe(false);
  });

  it('上游被拖拽只改 position（node 引用变、data 引用不变）→ 判等 → 下游不重渲', () => {
    const data = { imageUrl: 'http://a.png' };
    const still1 = mkNode('u1', 'promptNode', data, { position: { x: 0, y: 0 } });
    const moved = mkNode('u1', 'promptNode', data, { position: { x: 10, y: 10 } }); // 新 node 引用，data 同引用
    expect(upstreamEqual([{ node: still1 }], [{ node: moved }])).toBe(true);
  });

  it('同引用 / 同内容 → 判等（不重渲）', () => {
    const n = mkNode('u1', 'promptNode', { imageUrl: 'http://a.png' });
    expect(upstreamEqual([{ node: n, sourceHandle: 'o' }], [{ node: n, sourceHandle: 'o' }])).toBe(
      true,
    );
    expect(upstreamEqual([], [])).toBe(true);
    expect(upstreamEqual(undefined, undefined)).toBe(true);
  });

  it('长度 / 来源 id / handle / 类型 任一变化 → 判不等', () => {
    const n1 = mkNode('u1', 'promptNode', { imageUrl: 'http://a.png' });
    const n2 = mkNode('u2', 'promptNode', { imageUrl: 'http://a.png' });
    expect(upstreamEqual([{ node: n1 }], [])).toBe(false); // 删连线 → 上游变短
    expect(upstreamEqual([{ node: n1 }], [{ node: n1 }, { node: n2 }])).toBe(false); // 增连线
    expect(
      upstreamEqual([{ node: n1, sourceHandle: 'a' }], [{ node: n1, sourceHandle: 'b' }]),
    ).toBe(false);
    const renamed = { ...n1, type: 'imageNode' };
    expect(upstreamEqual([{ node: n1 }], [{ node: renamed }])).toBe(false); // 类型变化
  });

  it('上游节点被删除 → 从 lookup 消失 → 上游收缩（判不等）', () => {
    const lookup = new Map([['u1', mkNode('u1', 'promptNode', { imageUrl: 'http://a.png' })]]);
    const incoming = [{ source: 'u1', sourceHandle: undefined }];
    const up = collectUpstream({ nodeLookup: lookup }, incoming);
    expect(up).toHaveLength(1);
    lookup.delete('u1'); // 节点被删
    expect(collectUpstream({ nodeLookup: lookup }, incoming)).toHaveLength(0);
  });
});

describe('P0-B ③ 聚合（aggregateUpstream 与旧 useMemo 体语义等价）', () => {
  it('非编组上游：聚合产出 + 补 sourceNodeId', () => {
    const src = mkNode('u1', 'promptNode', { imageUrl: 'http://a.png' });
    const out = aggregateUpstream([{ node: src, sourceHandle: undefined }]);
    expect(out.images).toHaveLength(1);
    expect(out.images[0].url).toBe('http://a.png');
    expect(out.images[0].sourceNodeId).toBe('u1');
  });

  it('textNode 上游 → texts 通道带 sourceNodeId', () => {
    const src = mkNode('t1', 'textNode', { text: '你好' });
    const out = aggregateUpstream([{ node: src, sourceHandle: undefined }]);
    expect(out.texts[0].text).toBe('你好');
    expect(out.texts[0].sourceNodeId).toBe('t1');
  });

  it('相对 /files/ URL 兜底为绝对 URL（刷新不破图）', () => {
    const src = mkNode('u1', 'promptNode', { imageUrl: '/files/a.png' });
    const out = aggregateUpstream([{ node: src, sourceHandle: undefined }]);
    expect(out.images[0].url).toContain('/files/a.png');
    expect(out.images[0].url.startsWith('http')).toBe(true);
  });

  it('无上游 → 空聚合', () => {
    expect(aggregateUpstream([])).toEqual({ images: [], texts: [], videos: [], audios: [] });
  });
});

describe('P0-B 编组出口（parentLookup 展开，行为与旧 nodes.filter 等价）', () => {
  const group = mkNode('g1', 'group', {});
  const child1 = mkNode('c1', 'imageNode', { imageUrl: 'http://c1.png' });
  const childHidden = mkNode('c2', 'imageNode', { imageUrl: 'http://c2.png' }, { hidden: true });

  it('group 上游展开为非 hidden 子节点（hidden 被排除）', () => {
    const lookup = new Map([
      ['g1', group],
      ['c1', child1],
      ['c2', childHidden],
    ]);
    const parentLookup = new Map([
      [
        'g1',
        new Map([
          ['c1', child1],
          ['c2', childHidden],
        ]),
      ],
    ]);
    const up = collectUpstream({ nodeLookup: lookup, parentLookup }, [
      { source: 'g1', sourceHandle: undefined },
    ]);
    expect(up).toHaveLength(1);
    expect(up[0].node.id).toBe('c1');
    expect(up[0].fromGroup).toBe(true);
  });

  it('组内子节点聚合：不补 sourceNodeId（保持既有行为）', () => {
    const up = [{ node: child1, sourceHandle: undefined, fromGroup: true }];
    const out = aggregateUpstream(up);
    expect(out.images[0].url).toBe('http://c1.png');
    expect(out.images[0].sourceNodeId).toBeUndefined();
  });

  it('组内子节点 data 变化 → upstreamEqual 判不等（折叠/增删子节点同理走长度/元素变化）', () => {
    const childNew = mkNode('c1', 'imageNode', { imageUrl: 'http://c1-new.png' });
    expect(
      upstreamEqual(
        [{ node: child1, sourceHandle: undefined, fromGroup: true }],
        [{ node: childNew, sourceHandle: undefined, fromGroup: true }],
      ),
    ).toBe(false);
  });

  it('子节点被移出组（parentLookup 不再含它）→ 上游收缩', () => {
    const lookup = new Map([
      ['g1', group],
      ['c1', child1],
    ]);
    const incoming = [{ source: 'g1', sourceHandle: undefined }];
    // 移出前：组内有 c1
    const before = collectUpstream(
      { nodeLookup: lookup, parentLookup: new Map([['g1', new Map([['c1', child1]])]]) },
      incoming,
    );
    expect(before).toHaveLength(1);
    // 移出后：组空
    const after = collectUpstream({ nodeLookup: lookup, parentLookup: new Map() }, incoming);
    expect(after).toHaveLength(0);
  });
});
