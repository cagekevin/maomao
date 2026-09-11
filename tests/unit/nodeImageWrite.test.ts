/**
 * 图片写回唯一出口护栏（docs/118 §五 C5b / §7.3 ⑤ / §十一 验收项）
 *
 * 两条防线：
 *  1. `replaceNodeImage` 是 **唯一** 负责「把新图写回节点」的函数 → 纯函数行为单测；
 *  2. **源码级护栏**：
 *     - 图片节点（ImageGenerate / AssetNode）不得再出现「内联直写 imageUrl / 双写 url」的旧写法；
 *     - **写侧停写 `data.url` 值**（只允许 `url: undefined` 清空），且**读侧兜底必须保留**——
 *       这是 §7.3 ⑤「读兼容、写唯一」的两半，缺一半就是破图或字段回流；
 *     - `useImageHoverActions` 的 4 条保存出口（编辑器 / 就地裁剪 / 压缩 / 放大）必须都走落盘。
 *
 * 为什么用源码断言而不是只测行为：本收口防的正是「新增一条路径忘了走唯一的门」——
 * 行为测试只能覆盖你想到的路径，源码断言能拦住「又冒出一处直写」。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Node } from '@xyflow/react';
import { replaceNodeImage } from '../../src/components/base/nodeImage.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const readSrc = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function fakeSetNodes() {
  const calls: Array<(ns: Node[]) => Node[]> = [];
  return {
    calls,
    setNodes: (updater: (ns: Node[]) => Node[]) => {
      calls.push(updater);
    },
    /** 对给定节点数组跑最后一次 updater，返回结果（便于断言写入了什么） */
    apply(ns: Node[]) {
      return calls.length ? calls[calls.length - 1](ns) : ns;
    },
  };
}
const node = (id: string, data: Record<string, unknown> = {}): Node =>
  ({ id, type: 'assetNode', position: { x: 0, y: 0 }, data }) as unknown as Node;

describe('replaceNodeImage — 节点主图唯一写入口', () => {
  it('只写 imageUrl；存量字段 url 不再写值（字段唯一化：读兼容、写唯一）', () => {
    const s = fakeSetNodes();
    replaceNodeImage({ id: 'n1', dataUrl: 'http://x/new.png' }, s.setNodes);
    const out = s.apply([node('n1', { imageUrl: 'http://x/old.png', url: 'http://x/old.png' })]);
    expect(out[0].data.imageUrl).toBe('http://x/new.png');
    expect(out[0].data.url).toBe('http://x/old.png'); // 不动存量字段（读侧仍兜底）
  });

  it('dataPatch 与主图同一次不可变更新写下去（「上传替换内容」用；值 undefined = 清空）', () => {
    const s = fakeSetNodes();
    replaceNodeImage(
      {
        id: 'n1',
        dataUrl: 'http://x/new.png',
        dataPatch: { mediaType: undefined, text: undefined },
      },
      s.setNodes,
    );
    const out = s.apply([node('n1', { imageUrl: 'o', url: 'o', mediaType: 'image', text: 'x' })]);
    expect(out[0].data.imageUrl).toBe('http://x/new.png');
    expect(out[0].data.url).toBe('o');
    expect(out[0].data.mediaType).toBeUndefined();
    expect(out[0].data.text).toBeUndefined();
  });

  it('不可变更新：其它字段与其它节点保持原引用，不原地 mutation', () => {
    const s = fakeSetNodes();
    replaceNodeImage({ id: 'n1', dataUrl: 'd1' }, s.setNodes);
    const other = node('n2', { imageUrl: 'keep' });
    const target = node('n1', { imageUrl: 'o', keep: 1 });
    const out = s.apply([other, target]);
    expect(out[0]).toBe(other);
    expect(out[1]).not.toBe(target);
    expect(target.data.imageUrl).toBe('o'); // 入参未被修改
    expect(out[1].data.keep).toBe(1); // 其它 data 字段保留
  });

  it('dims 原样透传给 afterWrite（尺寸模型留给调用方，本函数不碰尺寸）', () => {
    const s = fakeSetNodes();
    const seen: Array<unknown> = [];
    replaceNodeImage(
      { id: 'n1', dataUrl: 'd1', dims: { width: 800, height: 600 } },
      s.setNodes,
      (d) => seen.push(d),
    );
    expect(seen).toEqual([{ width: 800, height: 600 }]);
  });

  it('id / dataUrl 缺失 → 不写（防御早期返回）', () => {
    const s1 = fakeSetNodes();
    replaceNodeImage({ id: '', dataUrl: 'd' }, s1.setNodes);
    expect(s1.calls.length).toBe(0);
    const s2 = fakeSetNodes();
    replaceNodeImage({ id: 'n1', dataUrl: '' }, s2.setNodes);
    expect(s2.calls.length).toBe(0);
  });
});

describe('源码护栏 — 图片写回只有一个门', () => {
  it('ImageGenerate / AssetNode 的图片替换都必须经 replaceNodeImage', () => {
    for (const rel of [
      'src/components/nodes/ImageGenerate.tsx',
      'src/components/nodes/AssetNode.tsx',
    ]) {
      const src = readSrc(rel);
      expect(src.includes('replaceNodeImage('), `${rel} 必须走 replaceNodeImage`).toBe(true);
    }
    // 漂移原形：AssetNode 旧 replaceImage 内联双写 / ImageGenerate 旧 patchData 直接塞图
    expect(
      /imageUrl: dataUrl,\s*url: dataUrl/.test(readSrc('src/components/nodes/AssetNode.tsx')),
      'AssetNode 旧 replaceImage 内联双写不得回归（必须走 replaceNodeImage）',
    ).toBe(false);
    expect(
      /patchData\(\{\s*imageUrl: dataUrl/.test(readSrc('src/components/nodes/ImageGenerate.tsx')),
      'ImageGenerate 旧 patchData 直塞图片字段不得回归（必须走 replaceNodeImage）',
    ).toBe(false);
  });

  it('已知例外已收口：AssetNode「上传替换内容」也走 replaceNodeImage（不再直写图片字段）', () => {
    const src = readSrc('src/components/nodes/AssetNode.tsx');
    // 上传分支：主图经唯一入口写，mediaType/text 用 dataPatch 一并置空
    expect(
      /replaceNodeImage\(\s*\{[^}]*dataPatch:\s*\{\s*mediaType:\s*undefined,\s*text:\s*undefined/ms.test(
        src,
      ),
      'AssetNode 上传替换路径必须经 replaceNodeImage（dataPatch 清 mediaType/text）',
    ).toBe(true);
    // 该分支不得再出现「内联写 imageUrl + 双写 url」
    expect(/\{\s*\.\.\.n\.data,\s*imageUrl:\s*url,\s*url\b/.test(src)).toBe(false);
  });

  it('写侧停写 data.url（值写归零）：只允许 url: undefined 这种「清空」', () => {
    // docs/118 §7.3 ⑤ 分层收口：写侧只写 imageUrl；存量兼容字段 url 不再写【值】。
    for (const rel of [
      'src/components/nodes/AssetNode.tsx',
      'src/components/nodes/Director3DNode.tsx',
      'src/components/base/nodeImage.ts',
    ]) {
      const src = readSrc(rel);
      expect(
        /\burl:\s*(url|lastUrl|dataUrl|imageUrl)\b/.test(src),
        `${rel} 不得再向主图字段写 url 值（只允许 url: undefined 清空）`,
      ).toBe(false);
    }
    // 双写开关不得回归（加回来就等于又开了一条写 url 的路径）
    // 断言「没有这个字段声明」而非「源码不含该词」——注释里保留它的历史说明是有意为之
    expect(
      /\blegacyUrlField\??\s*:/.test(readSrc('src/components/base/nodeImage.ts')),
      'nodeImage 不得再提供 legacyUrlField 双写开关',
    ).toBe(false);
  });

  it('读侧兜底必须保留（存量快照里有只带 url 的节点，删了就读丢）', () => {
    expect(
      /data\.imageUrl\s*\|\|\s*data\.url/.test(readSrc('src/components/nodes/AssetNode.tsx')),
      'AssetNode 渲染必须保留 imageUrl || url 兜底',
    ).toBe(true);
    expect(
      /node\?\.data\?\.imageUrl\s*\|\|\s*node\?\.data\?\.url/.test(readSrc('src/App.tsx')),
      'App.copyNodeImage 必须保留 imageUrl || url 兜底',
    ).toBe(true);
    expect(
      /\['imageUrl',\s*'url'\]/.test(readSrc('src/components/agent/canvas/useCanvasAgentTools.ts')),
      'getNodeImageUrl 必须保留 imageUrl → url 的字段兼容顺序',
    ).toBe(true);
  });

  it('useImageHoverActions 的 4 条保存出口都落盘（编辑器/就地裁剪/压缩/放大）', () => {
    // 断言【行为】：4 条出口（handleEditorSave / handleCropSave / compress / upscale）
    // 都走全库唯一「图像入节点落盘策略」filesApi.showThenPersistInline。
    // 旧断言数的是 `saveInlineToLocal(`——该直调已被收口替换（见 CONTEXT §5.4.9 唯一实现），
    // 数它会恒为 0（陈旧断言，2026-09-11 修正）。按 tests 约定「测行为不测实现形式」改为数唯一入口。
    const src = readSrc('src/components/nodes/useImageHoverActions.tsx');
    const hits = src.match(/showThenPersistInline\(/g) || [];
    expect(
      hits.length,
      `4 条保存出口应各走一次唯一落盘入口 showThenPersistInline，实际 ${hits.length}`,
    ).toBeGreaterThanOrEqual(4);
  });
});
