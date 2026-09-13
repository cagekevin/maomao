import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * 基座形态契约（机器化 `docs/123` G3 的**人工验收项**）。
 *
 * 人工验收原文：「基座展开时画布仍可点选/拖节点（证明**没登记 modalLayer**）」。
 * 人工项容易在后续改动里被悄悄破坏（谁顺手套个 FullscreenShell 就全废），故把它的**根因**
 * 变成源码断言 —— 不是断言"看起来能点"，而是断言"那几样会毁掉它的东西一个都没用"。
 */
const DOCK = 'src/components/videoEditor/panels/dock/VideoEditorDock.tsx';
const src = readFileSync(DOCK, 'utf8');

/**
 * 去掉注释后的代码。
 * 必须剥注释：本文件顶部**正文明写**了「不用 FullscreenShell / 不登记 modalLayer」——
 * 不剥就会把「我们不用 X」的说明文字当成「用了 X」而误报。
 */
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('基座不得登记 modalLayer（docs/120 C10.1 红线）', () => {
  it('不用 FullscreenShell / useFullscreenEditorKeys / registerLayer（登记一次画布快捷键全废）', () => {
    expect(code).not.toContain('FullscreenShell');
    expect(code).not.toContain('useFullscreenEditorKeys');
    expect(code).not.toContain('registerLayer');
  });

  it('不用 portal（常驻底部层，挂 App 根 flex 列）', () => {
    expect(code).not.toContain('createPortal');
    expect(code).not.toContain('document.body');
  });
});

describe('键盘归属判据单点（docs/123 §二.6 G-3）', () => {
  it('基座与 useCanvasShortcuts 共用同一个 editorKeyAction（不各自判一套）', () => {
    const shortcuts = readFileSync('src/hooks/useCanvasShortcuts.ts', 'utf8');
    expect(code).toContain('editorKeyAction');
    expect(shortcuts).toContain('editorKeyAction');
    expect(shortcuts).toContain('isEditorActive');
  });

  it('让位清单不得在别处被复制（基座内不出现裸的按键比较）', () => {
    // 只允许经 editorKeyAction 判断；出现裸 Delete/z 比较说明判据被抄了第二份
    expect(code).not.toMatch(/key\s*===\s*'z'/);
    expect(code).not.toMatch(/key\s*===\s*'Delete'/);
  });
});

/* ────────────────────────────────────────────────────────────────
 * G5：入轨 / 导出 / 断链 的**结构性守卫**
 *
 * 这几条是「一旦被绕过，功能看起来还在、但判据已经分叉」的那类退化 ——
 * 人工点一遍发现不了（导出照样出片），所以必须机器守。
 * ──────────────────────────────────────────────────────────────── */

describe('导出必须经唯一入口（docs/120 C5.1：判路只准有一次）', () => {
  it('基座不得直调导出实现（exportLossless / exportComposite）', () => {
    // 直调 = 在基座里自判「走哪条路」，于是出现「常驻信息说走直通、实际走了合成」
    expect(code).not.toContain('exportLossless');
    expect(code).not.toContain('exportComposite');
  });

  it('基座不得自己判「要不要合成」（needsCompositing 只准在 pipeline 里被消费）', () => {
    expect(code).not.toContain('needsCompositing');
  });

  it('导出走 runExport（唯一入口），路径与原因来自 planExport（常驻展示用）', () => {
    expect(code).toContain('runExport');
    expect(code).toContain('planExport');
  });
});

describe('C11.5 激活门：折叠态点选不留痕', () => {
  it('入轨 effect 里有「未展开即返回」的门（少它 = 折叠态点两下就静默塞片段）', () => {
    // 门必须在 enqueue 之前：`if (!open) return;`
    const gate = code.indexOf('if (!open) return;');
    expect(gate).toBeGreaterThan(-1);
    expect(code.indexOf('enqueue(')).toBeGreaterThan(gate);
  });

  it('入轨用「选中集内容签名」驱动（不订阅逐帧坐标 —— 拖动不该触发入轨）', () => {
    // 复用 base/canvas 既有原语；自己写一份选中 diff 就是第二个判据
    expect(code).toContain('selectedAssetSig');
    expect(code).toContain('deriveSelectedAssets');
  });
});

describe('C4.5 挂载硬断言（provider 上下文缺失必须立刻炸）', () => {
  it('挂载期断言 ReactFlowProvider 上下文（缺失时导出回写会静默失败）', () => {
    expect(code).toContain('useReactFlow');
    expect(code).toContain('throw new Error');
    expect(code).toContain('ReactFlowProvider');
  });
});

describe('C13 断链是持续状态（红标），不是一次性提示', () => {
  it('片段按素材状态上红标（不是靠 toast 一闪而过）', () => {
    expect(code).toContain('broken');
    expect(code).toContain('bg-danger');
  });
});

describe('C5.6 导出前信息常驻', () => {
  it('有一条常驻信息行（路径 / 工程参数 / 黑边 / 音频出口）', () => {
    expect(code).toContain('data-export-info');
  });
});
