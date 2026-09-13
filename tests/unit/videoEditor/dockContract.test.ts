import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 基座形态契约（机器化 `docs/123` G3 的**人工验收项**）。
 *
 * 人工验收原文：「基座展开时画布仍可点选/拖节点（证明**没登记 modalLayer**）」。
 * 人工项容易在后续改动里被悄悄破坏（谁顺手套个 FullscreenShell 就全废），故把它的**根因**
 * 变成源码断言 —— 不是断言"看起来能点"，而是断言"那几样会毁掉它的东西一个都没用"。
 *
 * ── 本文件为什么**按文件精确定位**（不是扫整层合并成一份）──
 * Dock 拆分后这层有多个文件。若把所有文件拼成一份再断言，出错时只知道"图层里有问题"，
 * 却难定位是哪个文件 —— 改回来/排查时很难下手。故每个**正向**不变式钉到它真正归属的那个文件：
 * 断言失败时，vitest 会直接点名是哪个文件哪一行不满足，问题可定位、改回可追溯。
 * 只有**负向**不变式（"全层禁用某标识符"）才扫全层 —— 禁止本就是层级的，不是单文件的事。
 */
const DOCK_DIR = 'src/components/videoEditor/panels/dock';

/** 读取 dock 层指定文件的源码（去掉注释 —— 正文里的「不用 X」说明文字不能算用了 X）。 */
function readFileStripped(relPath: string): string {
  return readFileSync(join(DOCK_DIR, relPath), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

/** 整层拼接（负向"全层禁用"断言用）。 */
function readLayer(): string {
  const files = readdirSync(DOCK_DIR)
    .filter((f) => /\.tsx?$/.test(f))
    .filter((f) => !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'));
  return files.map((f) => readFileStripped(f)).join('\n');
}

describe('基座不得登记 modalLayer（docs/120 C10.1 红线 · 全层禁用）', () => {
  it('不用 FullscreenShell / useFullscreenEditorKeys / registerLayer（登记一次画布快捷键全废）', () => {
    const code = readLayer();
    expect(code).not.toContain('FullscreenShell');
    expect(code).not.toContain('useFullscreenEditorKeys');
    expect(code).not.toContain('registerLayer');
  });

  it('不用 portal（常驻底部层，挂 App 根 flex 列）', () => {
    const code = readLayer();
    expect(code).not.toContain('createPortal');
    expect(code).not.toContain('document.body');
  });
});

describe('键盘归属判据单点（docs/123 §二.6 G-3）', () => {
  it('基座与 useCanvasShortcuts 共用同一个 editorKeyAction（不各自判一套）', () => {
    // 键盘不变式归属 `useTimelineDrag`（onKeyDown 落在那里）
    const dock = readFileStripped('useTimelineDrag.ts');
    const shortcuts = readFileSync('src/hooks/useCanvasShortcuts.ts', 'utf8');
    expect(dock).toContain('editorKeyAction');
    expect(shortcuts).toContain('editorKeyAction');
    expect(shortcuts).toContain('isEditorActive');
  });

  it('让位清单不得被复制（dock 层内不出现裸的按键比较）', () => {
    const code = readLayer();
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
  it('dock 层不得直调导出实现（exportLossless / exportComposite / needsCompositing）', () => {
    const code = readLayer();
    expect(code).not.toContain('exportLossless');
    expect(code).not.toContain('exportComposite');
    expect(code).not.toContain('needsCompositing');
  });

  it('导出走 runExport / planExport（唯一入口 + 常驻判路），归属 useEditorExport', () => {
    const code = readFileStripped('useEditorExport.ts');
    expect(code).toContain('runExport');
    expect(code).toContain('planExport');
  });
});

describe('C11.5 激活门：折叠态点选不留痕', () => {
  it('入轨 effect 里有「未展开即返回」的门（少它 = 折叠态点两下就静默塞片段），归属 useEditorIngest', () => {
    const code = readFileStripped('useEditorIngest.ts');
    const gate = code.indexOf('if (!open) return;');
    expect(gate).toBeGreaterThan(-1);
    expect(code.indexOf('enqueue(')).toBeGreaterThan(gate);
  });

  it('入轨用「选中集内容签名」驱动（不订阅逐帧坐标 —— 拖动不该触发入轨）', () => {
    const code = readFileStripped('useEditorIngest.ts');
    expect(code).toContain('selectedAssetSig');
    expect(code).toContain('deriveSelectedAssets');
  });
});

describe('C4.5 挂载硬断言（provider 上下文缺失必须立刻炸）· 归属 VideoEditorDock', () => {
  it('挂载期断言 ReactFlowProvider 上下文（缺失时导出回写会静默失败）', () => {
    const code = readFileStripped('VideoEditorDock.tsx');
    expect(code).toContain('useReactFlow');
    expect(code).toContain('throw new Error');
    expect(code).toContain('ReactFlowProvider');
  });
});

describe('C13 断链是持续状态（红标），不是一次性提示 · 归属 VideoEditorDock（Lane）', () => {
  it('片段按素材状态上红标（不是靠 toast 一闪而过）', () => {
    const code = readFileStripped('VideoEditorDock.tsx');
    expect(code).toContain('broken');
    expect(code).toContain('bg-danger');
  });
});

describe('C5.6 导出前信息常驻 · 归属 DockStatusBar', () => {
  it('有一条常驻信息行（路径 / 工程参数 / 黑边 / 音频出口）', () => {
    const code = readFileStripped('DockStatusBar.tsx');
    expect(code).toContain('data-export-info');
  });
});

describe('C11 时间轴标尺用共用原语（不要第二份刻度）· 归属 RulerStrip', () => {
  it('用 pickTickStep / buildTicks 生成刻度（不自己发明步长序列 / 刻度生成）', () => {
    const code = readFileStripped('RulerStrip.tsx');
    expect(code).toContain('pickTickStep(');
    expect(code).toContain('buildTicks(');
  });

  it('标尺是真实渲染点（data-timeline-ruler），刻度经渲染循环输出（接上消费方）', () => {
    const code = readFileStripped('RulerStrip.tsx');
    expect(code).toContain('data-timeline-ruler');
    expect(code).toContain('ticks.map');
  });

  it('播放头可拖动（beginPlayheadDrag），拖动 seek 走同一条 snapTime(clipEdges) 判据（不抄折叠吸附）· 归属 useEditorTransport', () => {
    const code = readFileStripped('useEditorTransport.ts');
    expect(code).toContain('beginPlayheadDrag');
    expect(code).toContain('snapTime(');
  });
});
