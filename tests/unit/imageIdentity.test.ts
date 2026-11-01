/**
 * imageIdentity 单测（docs/plan/151 §5.2 1-2）。
 *
 * 守的是三条硬规则（计划 §2）：
 *  - R1 `makeImageId` 是唯一生成点，格式与 `generateId` 一致（本步**不改 id 格式**）；
 *  - R2 `imageKeyOf` id 优先；无 id 走内容派生退化键；**永不下标**；
 *  - R3 退化键必须**芯片格式安全**（不含 `:`，否则破坏 `@{id:label}` 的 group1 `([^:]+)`）。
 *
 * 断言写法：不写死 hash 字面量（那会把实现抄一遍、源码一变必红却是"抄错"而红），
 * 只锁**行为**（同 url 同键 / 不同 url 不同键 / 冒号不出现 / 空输入返回空串）。
 */
import { describe, it, expect } from 'vitest';
import {
  makeImageId,
  imageKeyOf,
  readExtractedImages,
  withImageIds,
  reopenImageIdentities,
  applyImageOrder,
  mergeRefImages,
} from '../../src/components/base/utils/media/imageIdentity.ts';
import { rewriteChipIds } from '../../src/components/canvas/shell/promptChipFormat.ts';

describe('makeImageId（R1 唯一生成点）', () => {
  it('缺省前缀 img，格式 = {prefix}_{ts36}_{rand36}（本步不改 id 格式）', () => {
    const id = makeImageId();
    expect(id.startsWith('img_')).toBe(true);
    // 三段、段间下划线、无冒号（芯片格式安全）
    expect(id.split('_')).toHaveLength(3);
    expect(id).not.toContain(':');
  });

  it('前缀透传（pano / ref 等），非法字符被规整为下划线', () => {
    expect(makeImageId('pano').startsWith('pano_')).toBe(true);
    expect(makeImageId('a:b').startsWith('a_b_')).toBe(true);
  });

  it('连续调用不重复（时间戳 + 随机段）', () => {
    const ids = Array.from({ length: 50 }, () => makeImageId());
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('imageKeyOf（R2/R3 身份键唯一实现）', () => {
  it('id 优先：有 id 就原样返回（不看 url）', () => {
    expect(imageKeyOf({ id: 'img_1', url: 'http://x/a.png' })).toBe('img_1');
    expect(imageKeyOf({ id: 'img_1', url: 'http://x/other.png' })).toBe('img_1');
  });

  it('无 id → 退化键 img_<hash(url)>，同 url 同键、不同 url 不同键', () => {
    const a = imageKeyOf({ url: 'http://x/a.png' });
    const b = imageKeyOf({ url: 'http://x/a.png' });
    const c = imageKeyOf({ url: 'http://x/b.png' });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a.startsWith('img_')).toBe(true);
  });

  it('退化键**不含冒号**（否则破坏芯片格式 @{id:label} 的 group1 ([^:]+)）', () => {
    const keys = [
      imageKeyOf({ url: 'http://x/a.png' }),
      imageKeyOf({ url: '/files/tasks/中文 名.png' }),
      imageKeyOf({ url: 'data:image/png;base64,AAA' }),
    ];
    for (const k of keys) expect(k).not.toContain(':');
  });

  it('空输入一律返回空串（空是合法结论，不是失败）', () => {
    expect(imageKeyOf(null)).toBe('');
    expect(imageKeyOf(undefined)).toBe('');
    expect(imageKeyOf({})).toBe('');
    expect(imageKeyOf({ id: '', url: '' })).toBe('');
    expect(imageKeyOf({ id: '', url: undefined })).toBe('');
  });

  it('不返回下标型键（R2：永不下标）—— 与调用方传入的数组位置无关', () => {
    // 同一 item 不论排在第几个，键恒定（本函数不接受下标入参，此例锁住"签名没有下标"这一事实）
    const item = { url: 'http://x/a.png' };
    expect(imageKeyOf(item)).toBe(imageKeyOf({ url: item.url }));
  });
});

// ── 第 2 步（docs/plan/151 §6.2）：物化 id 的读/写两边界 ──
describe('readExtractedImages（读侧归一 · 2-4）', () => {
  it('旧画布裸 string[] → 用确定性退化键（同 url 同键，可重复）', () => {
    const list = ['data:image/png;base64,aaa', 'data:image/png;base64,bbb'];
    const out = readExtractedImages(list);
    expect(out.map((x) => x.url)).toEqual(list);
    // 两次读同一份数据 → 键完全相同（读取路径**不许**生成随机 UUID，否则每次 render 都在变）
    expect(readExtractedImages(list)).toEqual(out);
    expect(out[0]?.id).toBe(imageKeyOf({ url: list[0] ?? '' }));
  });

  it('新形态 {id,url} → **只取不造**：原 id 原样透传（不重算成退化键）', () => {
    const out = readExtractedImages([{ id: 'frame_abc_1', url: '/files/a.png' }]);
    expect(out).toEqual([{ id: 'frame_abc_1', url: '/files/a.png' }]);
  });

  it('新形态缺 id → 退化键兜底（不崩、不造随机 id）', () => {
    const out = readExtractedImages([{ url: '/files/a.png' }]);
    expect(out[0]?.id).toBe(imageKeyOf({ url: '/files/a.png' }));
  });

  it('脏数据（null / 数字 / 空串 / 缺 url 对象）一律丢弃，不抛', () => {
    const out = readExtractedImages([null, 42, '', {}, { url: '' }, 'data:image/png;base64,ok']);
    expect(out).toEqual([
      { id: imageKeyOf({ url: 'data:image/png;base64,ok' }), url: 'data:image/png;base64,ok' },
    ]);
    expect(readExtractedImages(undefined)).toEqual([]);
    expect(readExtractedImages('not-array')).toEqual([]);
  });
});

describe('withImageIds（写侧物化 · 2-2）', () => {
  it('每个 url 得到一个真 UUID，且互不相同', () => {
    const out = withImageIds(['/files/a.png', '/files/b.png'], 'frame');
    expect(out.map((x) => x.url)).toEqual(['/files/a.png', '/files/b.png']);
    expect(out.every((x) => x.id.startsWith('frame_'))).toBe(true);
    expect(new Set(out.map((x) => x.id)).size).toBe(2);
  });

  it('**落盘前后 id 不变**（本步核心硬指标）：url 换了但 id 由入参 url 定死 → 重新读不改身份', () => {
    // 模拟写边界：落盘前是 dataURL，落盘后是 /files/ URL（persistInlineOrKeep 的真实行为）
    const persisted = withImageIds(['/files/tasks/x.png'], 'split');
    // 之后任何一次读（refresh / 下游聚合）都必须拿到同一个 id
    expect(readExtractedImages(persisted)).toEqual(persisted);
    // 反例：若 id 是从 url 派生的退化键，换 url 就会换身份 —— 这里断言物化后 id 与 url 无派生关系
    expect(persisted[0]?.id).not.toBe(imageKeyOf({ url: '/files/tasks/x.png' }));
  });

  it('空/脏 url 被过滤（不会产出无 url 的项）', () => {
    const out = withImageIds(['', '/files/a.png']);
    expect(out).toHaveLength(1);
    expect(out[0]?.url).toBe('/files/a.png');
  });

  it('每批只调一次即定型；再调一次 = 重开身份（调用方契约，非本函数保证）', () => {
    const a = withImageIds(['/files/a.png']);
    const b = withImageIds(['/files/a.png']);
    expect(a[0]?.id).not.toBe(b[0]?.id);
  });
});

// ── 第 2.5 步（docs/plan/151 §7 / R4）：复制 = 新实例 ⇒ 必须重开身份 ──
describe('reopenImageIdentities（复制/粘贴重开身份）', () => {
  it('images[].id 全部换新，且与源数据的 id 无交集（R4 核心判据）', () => {
    const src = {
      images: [
        { id: 'img_a', url: '/files/a.png' },
        { id: 'img_b', url: '/files/b.png' },
      ],
    };
    const out = reopenImageIdentities(src);
    const oldIds = src.images.map((i) => i.id);
    const newIds = out.images?.map((i) => i.id) ?? [];
    expect(newIds).toHaveLength(2);
    expect(newIds.every((id) => !oldIds.includes(id))).toBe(true);
    expect(new Set(newIds).size).toBe(2);
    // url / 其它字段原样保留（只动身份，不动内容）
    expect(out.images?.map((i) => i.url)).toEqual(['/files/a.png', '/files/b.png']);
  });

  it('extractedImages（第 2 步物化形态）同样重开身份', () => {
    const src = { extractedImages: [{ id: 'frame_1', url: '/files/f1.png' }] };
    const out = reopenImageIdentities(src);
    expect(out.extractedImages?.[0]?.url).toBe('/files/f1.png');
    expect(out.extractedImages?.[0]?.id).not.toBe('frame_1');
  });

  it('prompt 芯片按映射重写（旧 id → 新 id，label/thumb 保持）', () => {
    const src = {
      images: [{ id: 'old_1', url: '/files/a.png' }],
      prompt: `参考 @{old_1:人物|${encodeURIComponent('/files/a.png')}} 生成`,
    };
    // 用真实格式真源（不是手写 split）—— 顺带锁住「芯片 id 重写必须走 buildChipText」
    let capturedId: string | undefined;
    const out = reopenImageIdentities(src, (prompt, idMap) => {
      capturedId = idMap.get('old_1');
      return rewriteChipIds(prompt, idMap);
    });
    expect(capturedId).toBe(out.images?.[0]?.id);
    expect(out.prompt).toContain(out.images?.[0]?.id ?? '');
    expect(out.prompt).not.toContain('old_1');
    expect(out.prompt).toContain('人物');
  });

  it('没有 id 的图不分配新 id（R1：读取路径不生成随机 UUID；无身份可撞）', () => {
    const src = { images: [{ url: '/files/a.png' }, 'data:image/png;base64,x'] };
    const out = reopenImageIdentities(src);
    expect(out.images?.[0]).toEqual({ url: '/files/a.png' });
    expect(out.images?.[1]).toBe('data:image/png;base64,x');
  });

  it('不改入参（纯函数）：源 data 的 id 原样不动', () => {
    const src = { images: [{ id: 'img_a', url: '/files/a.png' }], prompt: '@{img_a:猫}' };
    reopenImageIdentities(src);
    expect(src.images[0]?.id).toBe('img_a');
    expect(src.prompt).toBe('@{img_a:猫}');
  });

  it('无相关字段 / 空 data → 原样返回（不崩、不造键）', () => {
    expect(reopenImageIdentities({})).toEqual({});
    expect(reopenImageIdentities({ prompt: '纯文本提示词' })).toEqual({ prompt: '纯文本提示词' });
  });
});

describe('rewriteChipIds（芯片 id 重写 · 格式真源）', () => {
  it('命中映射 → 换 id，label 与 thumb 原样保留', () => {
    const out = rewriteChipIds(
      `@{old:人物|${encodeURIComponent('/files/a.png')}}`,
      new Map([['old', 'new']]),
    );
    expect(out).toBe(`@{new:人物|${encodeURIComponent('/files/a.png')}}`);
  });

  it('未命中映射 → 逐字节原样（上游连线图 / 已失配旧芯片不受影响）', () => {
    const input = '@{ghost:幽灵} 与 @{up_1:连线图}';
    expect(rewriteChipIds(input, new Map([['other', 'x']]))).toBe(input);
  });

  it('空 prompt / 空映射 → 原样返回（不做无谓重建）', () => {
    expect(rewriteChipIds('', new Map([['a', 'b']]))).toBe('');
    expect(rewriteChipIds('@{a:猫}', new Map())).toBe('@{a:猫}');
  });
});

// ── 7-3 端到端：复制含图节点 → 两节点 images[].id 无交集 + prompt 芯片指向新 id ──
describe('复制含图节点（R4 端到端）', () => {
  it('duplicateSelectedWithEdges 的克隆体与原节点身份不撞，芯片指向克隆体自己的新 id', async () => {
    const { duplicateSelectedWithEdges } =
      await import('../../src/components/canvas/structure/groupNodes.ts');
    const source = {
      id: 'src-1',
      type: 'imageGenerateNode',
      position: { x: 0, y: 0 },
      data: {
        images: [{ id: 'img_orig_1', url: '/files/a.png' }],
        prompt: `@ {img_orig_1:人物}`.replace('@ {', '@{'), // 避免本文件被芯片正则误伤的可读写法
      },
    };
    const out = duplicateSelectedWithEdges([source], [], ['src-1']);
    const clone = out.clones[0];
    expect(clone).toBeTruthy();
    const cloneImages = (clone?.data as { images?: Array<{ id?: string; url?: string }> }).images;
    const clonePrompt = (clone?.data as { prompt?: string }).prompt;
    // ① 两节点 id 无交集
    expect(cloneImages?.map((i) => i.id)).not.toContain('img_orig_1');
    expect(new Set(cloneImages?.map((i) => i.id)).size).toBe(1);
    // ② 芯片指向克隆体自己的新 id（不是原节点的旧 id）
    expect(clonePrompt).toContain(`@{${cloneImages?.[0]?.id ?? ''}:人物}`);
    expect(clonePrompt).not.toContain('img_orig_1');
    // ③ 原节点完全不受影响（纯函数）
    const srcData = (out.nodes.find((n) => n.id === 'src-1')?.data ?? {}) as {
      images?: Array<{ id?: string }>;
      prompt?: string;
    };
    expect(srcData.images?.[0]?.id).toBe('img_orig_1');
    expect(srcData.prompt).toContain('img_orig_1');
  });
});

// ── 第 3 步（docs/plan/151 §8.2 3-2）：applyImageOrder 五种情形 ──
describe('applyImageOrder（顺序表重排）', () => {
  const A = { id: 'a', url: '/files/a.png' };
  const B = { id: 'b', url: '/files/b.png' };
  const C = { id: 'c', url: '/files/c.png' };

  it('① 表内顺序生效（表内 id 优先）', () => {
    expect(applyImageOrder([A, B, C], ['c', 'a', 'b']).map((x) => x.id)).toEqual(['c', 'a', 'b']);
  });

  it('② 表外新增 → 追加末尾（保持入参相对顺序）', () => {
    expect(applyImageOrder([A, B, C], ['c', 'a']).map((x) => x.id)).toEqual(['c', 'a', 'b']);
  });

  it('③ 表内失效 id（图已删/断线）→ 丢弃，不产生空洞', () => {
    expect(applyImageOrder([A, B], ['gone', 'b', 'a']).map((x) => x.id)).toEqual(['b', 'a']);
  });

  it('④ 空表 / 缺省 → 原样返回（既有行为逐字节不变）', () => {
    const list = [A, B, C];
    expect(applyImageOrder(list, []).map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(applyImageOrder(list, null).map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(applyImageOrder(list, undefined).map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('⑤ 重复 id（表里同一键出现两次）→ 只取一次，不重复出图', () => {
    expect(applyImageOrder([A, B], ['a', 'a', 'b']).map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('无 id 的项走退化键参与排序（R2：身份键统一由 imageKeyOf 给出）', () => {
    const noId = { url: '/files/z.png' };
    const out = applyImageOrder([A, noId], [imageKeyOf(noId), 'a']);
    expect(out[0]).toEqual(noId);
    expect(out[1]).toEqual(A);
  });

  it('纯函数：不改入参、不改元素内容', () => {
    const list = [A, B, C];
    applyImageOrder(list, ['c', 'b', 'a']);
    expect(list.map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('mergeRefImages（多路图片源去重 · 原住 core/utils，2026-11-01 迁入）', () => {
  it('同 id 图片两路进入 → 去重后仅 1 张（保留首次出现）', () => {
    const a = [{ id: 'script-asset-1', url: '/files/a.png' }];
    const b = [
      { id: 'script-asset-1', url: '/files/a.png' },
      { id: 'script-asset-2', url: '/files/b.png' },
    ];
    expect(mergeRefImages(a, b)).toEqual([
      { id: 'script-asset-1', url: '/files/a.png' },
      { id: 'script-asset-2', url: '/files/b.png' },
    ]);
  });

  it('无 id 时按 url 去重；id/url 皆空的项丢弃', () => {
    const g = [{ url: '/x.png' }, { url: '/x.png' }, {}, { url: '/y.png' }];
    expect(mergeRefImages(g)).toEqual([{ url: '/x.png' }, { url: '/y.png' }]);
  });

  it('空/非数组入参安全（不抛）', () => {
    expect(mergeRefImages(null, undefined, [])).toEqual([]);
    expect(mergeRefImages([], [])).toEqual([]);
  });
});

describe('mergeRefImages · 判同口径已收口到 imageKeyOf（A8）', () => {
  it('空 id + 有 url → 按 url 去重（旧 `im.id ?? im.url` 会把空串当有效键，静默丢图）', () => {
    // 旧实现的漂移：`'' ?? url` === ''（空串不是 null/undefined）⇒ key 为空 ⇒ 该项被丢弃。
    const out = mergeRefImages([{ id: '', url: '/files/a.png' }]);
    expect(out).toEqual([{ id: '', url: '/files/a.png' }]);
  });

  it('同 url 不同 id → 保留两条（id 是身份，不同 id 即不同图，与 §11.6-1 的已知差异无关）', () => {
    const out = mergeRefImages([
      { id: 'a', url: '/files/x.png' },
      { id: 'b', url: '/files/x.png' },
    ]);
    expect(out).toHaveLength(2);
  });
});
