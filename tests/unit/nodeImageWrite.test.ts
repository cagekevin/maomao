/**
 * 图片写回唯一出口护栏（docs/118 §五 C5b / §7.3 ⑤ / §十一 验收项）
 *
 * 两条防线：
 *  1. `replaceNodeImage` 是 **唯一** 负责「把新图写回节点」的函数 → 纯函数行为单测；
 *  2. **源码级护栏**：
 *     - 图片节点（ImageGenerate / AssetNode）不得再出现「内联直写 assetUrl / 双写 url」的旧写法；
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
import {
  replaceNodeImage,
  clearNodeMainImage,
} from '../../src/components/base/utils/media/nodeImage.ts';
import {
  resolveAssetDisplayUrl,
  buildContentUrlResolver,
} from '../../src/components/base/utils/media/assetUrl.ts';

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
  it('只写 assetUrl 值；**旧身份字段一并失效**（存量 url 不得把新图短路）', () => {
    const s = fakeSetNodes();
    replaceNodeImage({ id: 'n1', dataUrl: 'http://x/new.png' }, s.setNodes);
    const out = s.apply([node('n1', { assetUrl: 'http://x/old.png', url: 'http://x/old.png' })]);
    expect(out[0].data.assetUrl).toBe('http://x/new.png');
    // 【2026-09-25 改判】原断言要求 `url` 原样保留（理由写"不动存量字段，读侧仍兜底"）—— 那条是在
    // **旧优先级**（`url > assetUrl`）下写的；保留旧 `url` 恰恰就是那条短路：存量带 `url` 的节点被编辑后
    // 仍解析出旧图（与 `contentId` 同一个病、另一个入口）。写新图 = 旧身份整体失效 ⇒ `url` 一并清。
    expect(out[0].data.url).toBeUndefined();
    // 端到端：显示解析必须落到**新图**（不是同义反复，走真实解析入口）
    expect(resolveAssetDisplayUrl(out[0].data as object, buildContentUrlResolver([]))).toEqual({
      kind: 'ok',
      url: 'http://x/new.png',
    });
  });

  it('主图换新必须让旧 contentId 失效（否则显示被它短路，原图纹丝不动）', () => {
    // 【2026-09-25 用户实测】素材库拖入 / 拖文件建的 assetNode 带 contentId（那张图的 sha1）。
    // 读侧 `resolveAssetDisplayUrl` 优先级 = contentId > assetUrl > url，而新图写在 `assetUrl` 这格、
    // 且 patch 是浅合并（旧字段不丢）⇒ 不清 contentId 就永远解析出**被替换掉的那张旧图**
    //（用户观察：「JPG 换成 PNG 后还是显 JPG」—— contentId 解析出的正是那张 JPG）。
    const s = fakeSetNodes();
    replaceNodeImage({ id: 'n1', dataUrl: '/files/canvas/new.png' }, s.setNodes);
    const out = s.apply([node('n1', { contentId: 'sha1:old', assetUrl: '/files/web/old.jpg' })]);
    // ① 旧内容的身份必须失效
    expect(out[0].data.contentId).toBeUndefined();
    // ② 端到端：显示解析必须落到**新图**（用真实 resolver 验证优先级后果，不是同义反复）
    expect(
      resolveAssetDisplayUrl(
        out[0].data as object,
        buildContentUrlResolver([{ contentId: 'sha1:old', url: '/files/web/old.jpg' }]),
      ),
    ).toEqual({ kind: 'ok', url: '/files/canvas/new.png' });
  });

  it('调用方要用新身份时经 dataPatch 显式写 contentId（如「上传换图」）', () => {
    // dataPatch 排在清空之后 ⇒ 可覆盖，保证"上传换图"仍能写新 contentId。
    const s = fakeSetNodes();
    replaceNodeImage(
      { id: 'n1', dataUrl: '/files/canvas/new.png', dataPatch: { contentId: 'sha1:new' } },
      s.setNodes,
    );
    const out = s.apply([node('n1', { contentId: 'sha1:old', assetUrl: '/files/web/old.jpg' })]);
    expect(out[0].data.contentId).toBe('sha1:new');
  });

  it('清空主图必须清三个字段（漏 contentId ⇒ 文本态节点仍显示旧图）', () => {
    // 与写新图**同一条不变式**：读侧 `contentId > assetUrl > url`，只清 assetUrl 会被高优先级字段读回旧图。
    const s = fakeSetNodes();
    clearNodeMainImage('n1', s.setNodes, { assetType: 'text', text: 'hi' });
    const out = s.apply([
      node('n1', {
        assetUrl: '/files/web/old.jpg',
        url: '/files/web/old.jpg',
        contentId: 'sha1:old',
        assetType: 'image',
      }),
    ]);
    expect(out[0].data.assetUrl).toBeUndefined();
    expect(out[0].data.url).toBeUndefined();
    expect(out[0].data.contentId).toBeUndefined();
    expect(out[0].data.assetType).toBe('text');
    expect(out[0].data.text).toBe('hi');
    // 端到端：清空后显示解析不得再读到旧图
    expect(
      resolveAssetDisplayUrl(
        out[0].data as object,
        buildContentUrlResolver([{ contentId: 'sha1:old', url: '/files/web/old.jpg' }]),
      ),
    ).toEqual({ kind: 'missing' });
  });

  it('dataPatch 与主图同一次不可变更新写下去（「上传替换内容」用；值 undefined = 清空）', () => {
    const s = fakeSetNodes();
    replaceNodeImage(
      {
        id: 'n1',
        dataUrl: 'http://x/new.png',
        dataPatch: { assetType: undefined, text: undefined },
      },
      s.setNodes,
    );
    const out = s.apply([node('n1', { assetUrl: 'o', url: 'o', assetType: 'image', text: 'x' })]);
    expect(out[0].data.assetUrl).toBe('http://x/new.png');
    expect(out[0].data.url).toBeUndefined(); // 旧身份字段一并失效（2026-09-25 改判，见上一条）
    expect(out[0].data.assetType).toBeUndefined();
    expect(out[0].data.text).toBeUndefined();
  });

  it('不可变更新：其它字段与其它节点保持原引用，不原地 mutation', () => {
    const s = fakeSetNodes();
    replaceNodeImage({ id: 'n1', dataUrl: 'd1' }, s.setNodes);
    const other = node('n2', { assetUrl: 'keep' });
    const target = node('n1', { assetUrl: 'o', keep: 1 });
    const out = s.apply([other, target]);
    expect(out[0]).toBe(other);
    expect(out[1]).not.toBe(target);
    expect(target.data.assetUrl).toBe('o'); // 入参未被修改
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
      'src/components/image/nodes/ImageGenerate.tsx',
      'src/components/image/nodes/AssetNode.tsx',
    ]) {
      const src = readSrc(rel);
      expect(src.includes('replaceNodeImage('), `${rel} 必须走 replaceNodeImage`).toBe(true);
    }
    // 漂移原形：AssetNode 旧 replaceImage 内联双写 / ImageGenerate 旧 patchData 直接塞图
    expect(
      /assetUrl: dataUrl,\s*url: dataUrl/.test(readSrc('src/components/image/nodes/AssetNode.tsx')),
      'AssetNode 旧 replaceImage 内联双写不得回归（必须走 replaceNodeImage）',
    ).toBe(false);
    expect(
      /patchData\(\{\s*assetUrl: dataUrl/.test(
        readSrc('src/components/image/nodes/ImageGenerate.tsx'),
      ),
      'ImageGenerate 旧 patchData 直塞图片字段不得回归（必须走 replaceNodeImage）',
    ).toBe(false);
  });

  it('已知例外已收口：AssetNode「上传替换内容」也走 replaceNodeImage（不再直写图片字段）', () => {
    const src = readSrc('src/components/image/nodes/AssetNode.tsx');
    // 上传分支：主图经唯一入口写，assetType/text 用 dataPatch 一并置空
    expect(
      /replaceNodeImage\(\s*\{[^}]*dataPatch:\s*\{\s*assetType:\s*undefined,\s*text:\s*undefined/ms.test(
        src,
      ),
      'AssetNode 上传替换路径必须经 replaceNodeImage（dataPatch 清 assetType/text）',
    ).toBe(true);
    // 该分支不得再出现「内联写 assetUrl + 双写 url」
    expect(/\{\s*\.\.\.n\.data,\s*assetUrl:\s*url,\s*url\b/.test(src)).toBe(false);
  });

  it('写侧停写 data.url（值写归零）：只允许 url: undefined 这种「清空」', () => {
    // docs/118 §7.3 ⑤ 分层收口：写侧只写 assetUrl；存量兼容字段 url 不再写【值】。
    for (const rel of [
      'src/components/image/nodes/AssetNode.tsx',
      'src/components/canvas/nodes/Director3DNode.tsx',
      'src/components/base/utils/media/nodeImage.ts',
    ]) {
      const src = readSrc(rel);
      expect(
        /\burl:\s*(url|lastUrl|dataUrl|assetUrl)\b/.test(src),
        `${rel} 不得再向主图字段写 url 值（只允许 url: undefined 清空）`,
      ).toBe(false);
    }
    // 双写开关不得回归（加回来就等于又开了一条写 url 的路径）
    // 断言「没有这个字段声明」而非「源码不含该词」——注释里保留它的历史说明是有意为之
    expect(
      /\blegacyUrlField\??\s*:/.test(readSrc('src/components/base/utils/media/nodeImage.ts')),
      'nodeImage 不得再提供 legacyUrlField 双写开关',
    ).toBe(false);
  });

  it('读侧兜底必须保留（存量快照里有只带 url 的节点，删了就读丢）', () => {
    // docs/122 #4/#5：读侧「渲染解析」已收口为唯一入口 resolveAssetDisplayUrl
    // （AssetNode 不再内联 `assetUrl || url`，统一走该入口；兜底行为迁到 assetUrl.ts）。
    // 护栏分两层：① AssetNode 必须经由该入口（防回退内联 / 绕过 missing 态）；
    // ② 该入口函数本身必须保留 assetUrl 存量兜底（无 resourceId/url 时退回 assetUrl）。
    expect(
      /resolveAssetDisplayUrl\(/.test(readSrc('src/components/image/nodes/AssetNode.tsx')),
      'AssetNode 渲染必须经唯一入口 resolveAssetDisplayUrl（不得回退内联 assetUrl || url）',
    ).toBe(true);
    expect(
      /typeof d\.assetUrl === 'string'/.test(
        readSrc('src/components/base/utils/media/assetUrl.ts'),
      ),
      'resolveAssetDisplayUrl 必须保留 assetUrl 存量兜底（无 resourceId/url 时退回 assetUrl）',
    ).toBe(true);
    // 【2026-09-25 改判】原两条护栏锁的是**实现形式**（App 源码必须出现 `assetUrl ?? url`、
    // nodeMedia 必须出现字面量 `['assetUrl','url']`）—— 属「断源码文本」形态，而且锁的正是
    // 本次要消灭的漂移：字段优先级被写成两份（App 内联嗅探 + nodeMedia 自定顺序），且**都不认 contentId**。
    // 现在「取节点主媒体地址」只有唯一入口 `resolveAssetDisplayUrl` ⇒ 护栏改为**锁唯一入口**（各读取点必须委托它）。
    // 行为面（认 contentId / contentId 优先于存量字段 / resource 缺失回落）由 `nodeMedia.test.ts`
    // 的端到端断言覆盖 —— 那些是**可被证伪**的断言（改回字段嗅探即红）。
    expect(
      /resolveAssetDisplayUrl\(/.test(readSrc('src/components/base/utils/media/nodeMedia.ts')),
      'getNodeAssetUrl / getNodeMedia 必须委托唯一读入口 resolveAssetDisplayUrl（不得自定字段优先级）',
    ).toBe(true);
    expect(
      /getNodeAssetUrl\(/.test(readSrc('src/App.tsx')),
      'App.copyNodeImage 必须经 getNodeAssetUrl（唯一读入口），不得内联嗅探 assetUrl/url',
    ).toBe(true);
  });

  it('useImageHoverActions 的 4 条保存出口都落盘（编辑器/就地裁剪/压缩/放大）', () => {
    // 断言【行为】：4 条出口（handleEditorSave / handleCropSave / compress / upscale）
    // 都走全库唯一「图像入节点落盘策略」filesApi.showThenPersistInline。
    // 旧断言数的是 `saveInlineToLocal(`——该直调已被收口替换（见 CONTEXT §5.4.9 唯一实现），
    // 数它会恒为 0（陈旧断言，2026-09-11 修正）。按 tests 约定「测行为不测实现形式」改为数唯一入口。
    const src = readSrc('src/components/image/useImageHoverActions.tsx');
    const hits = src.match(/showThenPersistInline\(/g) || [];
    expect(
      hits.length,
      `4 条保存出口应各走一次唯一落盘入口 showThenPersistInline，实际 ${hits.length}`,
    ).toBeGreaterThanOrEqual(4);
  });

  it('主图写回的消费方已全部收编（2026-09-25：6 处直写/直清 → 0）', () => {
    // 【收口背景】此前「写已存在节点主图」有 7 个中心：1 真源 + 6 处绕过
    //（全景截图 · 宫格合成 · 3D 导出下游 AssetNode · 3D 封面 · agent 生成结果 · 切文本态清空主图）。
    // 6 处绕过**全都缺「旧 contentId 失效」** ⇒ 全都会「写新图却显示旧图」（用户实测：「原图纹丝不动」）。
    // 本护栏锁住：这些消费方必须经唯一入口，且不得再直写/直清主图字段。
    const consumers = [
      'src/components/image/nodes/AssetNode.tsx',
      'src/components/image/nodes/ImageGenerate.tsx',
      'src/components/image/nodes/PanoramaNode.tsx',
      'src/components/image/nodes/GridMergeNode.tsx',
      'src/components/canvas/nodes/Director3DNode.tsx',
      'src/components/agent/canvas/canvasPlanExecutor.ts',
    ];
    for (const rel of consumers) {
      const src = readSrc(rel);
      expect(
        src.includes("from '@/components/base/utils/media/nodeImage'"),
        `${rel} 必须经主图写回唯一入口（nodeImage）`,
      ).toBe(true);
      // 禁止对**已存在节点**直写主图字段（建节点时的初值 `data: {...}` / `addNode(...)` 不在此列）
      expect(
        /(patchData|patchNodeDataById|updateNodeData)\([\s\S]{0,200}?\{\s*assetUrl:/.test(src),
        `${rel} 不得直写主图 assetUrl（必须走 replaceNodeImage / clearNodeMainImage）`,
      ).toBe(false);
    }
  });
});
