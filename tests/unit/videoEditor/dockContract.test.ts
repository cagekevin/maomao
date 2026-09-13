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
