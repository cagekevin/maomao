/**
 * 剧本盒子 · 缺陷②「场景未垫图」诊断测试（**残留：仅保留未被正式契约测试覆盖的边界**）
 * -------------------------------------------------------------------------
 * 对应诊断文档：docs/1mao-docs/剧本盒子/剧本盒子-缺陷诊断-垫图断点-2026-08-28.md §五
 *
 * 【去重说明 · 2026-09-10】
 * 本文件原为「先测试实证、再定位根因」的诊断稿，其中大量用例在完成使命后已变成
 * **固化旧行为的冗余**（matchAsset 的「@名后一位」边界在 collectAssets 中已被
 * matchAssetNames 词典匹配取代）。经审计后：
 *
 *  - 已删除：matchAsset 边界矩阵 + 旧行为复现 + 与 scriptBoxPrompts.test.ts 重复的
 *    collectAssets 用例（共约 150 行）；
 *  - 已迁移：修复后的正确行为契约（@名紧贴中文可垫图 / mergeShotsForVideo 同口修复 /
 *    matchAssetNames 词典最长匹配）→ `scriptBoxPrompts.test.ts`，作为永久回归锁；
 *  - 保留于此：以下**边界行为**，它们仍刻画「当前实现的确定行为」，属有价值的契约。
 *
 * 铁律：本文件只断言「当前代码的实际行为」，不改动被测源码。
 */
import { describe, it, expect } from 'vitest';
import { matchAsset, collectAssets } from '@/components/scriptbox/scriptBoxPrompts.ts';

// ═══════════════════════════════════════════════════════════════════
// matchAsset 的边界语义（仍被 stripAtRef / hlAt 等复用，需锁住）
// ═══════════════════════════════════════════════════════════════════
describe('matchAsset 边界语义（@名后一位非中英数才命中，防 @小马 误配 @小马妈妈）', () => {
  it('后一位=中英数 → false（视为更长词的一部分）', () => {
    expect(matchAsset('深夜@卧室内,柔和蓝紫色环境光', '卧室')).toBe(false); // 中文
    expect(matchAsset('@骷髅A站在床边', '骷髅A')).toBe(false);
    expect(matchAsset('@城堡C落', '城堡')).toBe(false); // 英文
    expect(matchAsset('@房间2间', '房间')).toBe(false); // 数字
  });

  it('后一位=空格 → true（空格是合法边界，只有「紧贴」才不命中）', () => {
    expect(matchAsset('@城堡 Castel', '城堡')).toBe(true);
  });

  it('后一位=结尾/标点 → true', () => {
    expect(matchAsset('@卧室', '卧室')).toBe(true);
    expect(matchAsset('后续@卧室。', '卧室')).toBe(true);
    expect(matchAsset('后续@卧室！', '卧室')).toBe(true);
    expect(matchAsset('后续@卧室；', '卧室')).toBe(true);
  });

  it('【判据】同一资产、仅后一位字符不同 → 结果不同（这是历史上"看起来偶发"的根源）', () => {
    expect(matchAsset('深夜@卧室,从窗外透入', '卧室')).toBe(true); // 后是逗号
    expect(matchAsset('深夜@卧室内,从窗外透入', '卧室')).toBe(false); // 后是中文
    // 结论：不是随机偶发，而是「数据依赖」——AI 写 @卧室, 还是 @卧室内 决定垫不垫图。
    // 该根源已由 collectAssets 改用 matchAssetNames 消除（见 scriptBoxPrompts.test.ts）。
  });
});

// ═══════════════════════════════════════════════════════════════════
// 隐藏 bug 探索：仍未修复的边界（保留为「已知行为」记录）
// ═══════════════════════════════════════════════════════════════════
describe('隐藏 bug 探索：collectAssets 的已知边界', () => {
  const assets = [{ id: 'a1', name: '卧室', assetUrl: '/files/room.png' }];

  it('已知①：@引用写在 dialogue（数组）里 → 因 `${shot.dialogue}` 拼成 "[object Object]" 而漏收', () => {
    // collectAssets 用模板串拼接 dialogue；真实 dialogue 是数组结构（textToDlg 产出）。
    // 若 @资产引用恰好写在 dialogue 里（而非 description），会因数组→"[object Object]" 漏掉。
    const shotWithDlg = {
      description: '窗外',
      dialogue: [{ kind: '台词', role: '小马', text: '@卧室 真美' }],
    };
    expect(collectAssets(shotWithDlg, assets)).toHaveLength(0); // 当前行为：漏收
    // 对照：@引用写在 description → 正常收集（证明只是拼接口径问题）
    expect(collectAssets({ description: '@卧室 真美' }, assets)).toHaveLength(1);
  });

  it('已知②：collectAssets 返回对象不含 category，下游无法区分场景/角色/道具（契约空白）', () => {
    const shotDesc = { description: '@卧室, @骷髅A, @HKH精华瓶' };
    const multi = [
      { id: 'a1', name: '卧室', category: 'scene', assetUrl: '/files/room.png' },
      { id: 'a2', name: '骷髅A', category: 'character', assetUrl: '/files/ka.png' },
      { id: 'a4', name: 'HKH精华瓶', category: 'prop', assetUrl: '/files/bottle.png' },
    ];
    const out = collectAssets(shotDesc, multi);
    expect(out).toHaveLength(3); // 图能拿到…
    expect(out.every((i) => 'category' in i)).toBe(false); // …但拿不到 category，只能靠 url 反查
  });
});
