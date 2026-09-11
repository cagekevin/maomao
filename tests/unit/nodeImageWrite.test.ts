/**
 * 图片写回唯一出口护栏（docs/118 §五 C5b / §7.3 ⑤ / §十一 验收项）
 *
 * 两条防线：
 *  1. `replaceNodeImage` 是 **唯一** 负责「把新图写回节点」的函数 → 纯函数行为单测；
 *  2. **源码级护栏**：两个图片节点（ImageGenerate / AssetNode）不得再出现「内联直写 imageUrl」的旧写法；
 *     `useImageHoverActions` 的 4 条保存出口（编辑器 / 就地裁剪 / 压缩 / 放大）必须都走落盘。
 *
 * 为什么用源码断言而不是只测行为：本收口防的正是「新增一条路径忘了走唯一的门」——
 * 行为测试只能覆盖你想到的路径，源码断言能拦住「又冒出一处直写」。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Node } from '@xyflow/react';
import { replaceNodeImage } from '../../src/components/nodes/nodeImage.ts';

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
  it('写 imageUrl；未传 legacyUrlField 时不写 url', () => {
    const s = fakeSetNodes();
    replaceNodeImage({ id: 'n1', dataUrl: 'http://x/new.png' }, s.setNodes);
    const out = s.apply([node('n1', { imageUrl: 'http://x/old.png', url: 'http://x/old.png' })]);
    expect(out[0].data.imageUrl).toBe('http://x/new.png');
    expect(out[0].data.url).toBe('http://x/old.png'); // 不动存量字段
  });

  it('legacyUrlField: true → 同步写 url（AssetNode 存量兼容）', () => {
    const s = fakeSetNodes();
    replaceNodeImage({ id: 'n1', dataUrl: 'http://x/new.png', legacyUrlField: true }, s.setNodes);
    const out = s.apply([node('n1', { imageUrl: 'o', url: 'o' })]);
    expect(out[0].data.imageUrl).toBe('http://x/new.png');
    expect(out[0].data.url).toBe('http://x/new.png');
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

  it('已知例外：AssetNode「上传替换内容」路径直写 imageUrl+url+mediaType（不在本次收口范围）', () => {
    // 该路径语义是「把节点内容整体换成上传的媒体」，同时清 mediaType/text，
    // replaceNodeImage 的签名（只管主图）表达不了 → 保留为档 2 遗留（见 docs/118 实施记录·遗留）。
    const src = readSrc('src/components/nodes/AssetNode.tsx');
    expect(src.includes('mediaType: undefined, text: undefined')).toBe(true);
  });

  it('useImageHoverActions 的 4 条保存出口都落盘（编辑器/就地裁剪/压缩/放大）', () => {
    const src = readSrc('src/components/nodes/useImageHoverActions.tsx');
    const hits = src.match(/saveInlineToLocal\(/g) || [];
    // compress + upscale + handleEditorSave + handleCropSave
    expect(hits.length, `保存出口落盘调用数应 ≥4，实际 ${hits.length}`).toBeGreaterThanOrEqual(4);
  });
});
