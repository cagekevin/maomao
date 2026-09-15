// @vitest-environment node
/**
 * 守卫：**渲染树构建的单一路径** + **声画源时间同源**。
 *
 * ════════════════════════════════════════════════════════════════
 * 这两条守的是 **TD-22-13 / TD-22-14 的今天形态**（原债的落点文件已随
 * `_legacy` 清理 + cutia 版重构消失，但母体还活着）：
 *
 *   ① M-B「预览与导出必须同一条路径」——
 *      今天靠**三处都调 `buildScene`**成立（预览 / 导出 / 项目缩略图），
 *      可一旦有人绕开它自己 `new VideoNode(...)`，预览与导出就会**静默分叉**
 *      （改一处忘另一处 = 导出与所见不同，且没有任何测试会红）。
 *
 *   ② 「落点清单靠人记得」——
 *      变速下"现在该播源素材的哪一刻"必须只有**一个式子**：画面取帧与音频调度
 *      若各自手写，迟早在某次改动后失步（画面 2× / 声音 1×，且无明显报错）。
 * ════════════════════════════════════════════════════════════════
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getElementPlaybackRate } from '../../src/components/videoEditor/engine/timeline/element-utils';
import type { TimelineElement } from '../../src/components/videoEditor/types/timeline';

const VE_ROOT = join(process.cwd(), 'src/components/videoEditor');
const VE_PREFIX = 'src/components/videoEditor/';

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const FILES = walk(VE_ROOT);

function filesMatching(re: RegExp): string[] {
  return FILES.filter((file) => re.test(readFileSync(file, 'utf8')))
    .map((file) => file.replace(/\\/g, '/').split(VE_PREFIX)[1])
    .sort();
}

describe('渲染树构建的单一路径（TD-22-13 的今天形态 · 母体 M-B）', () => {
  it('`buildScene` 的调用点恰好是白名单 3 处：预览 / 导出 / 项目缩略图', () => {
    expect(filesMatching(/\bbuildScene\(\{/)).toEqual([
      'engine/core/managers/project-manager.ts',
      'engine/core/managers/renderer-manager.ts',
      'ui/editor/panels/preview/index.tsx',
    ]);
  });

  it('渲染树只能由 buildScene 构造：`new RootNode(` 只出现在 scene-builder.ts', () => {
    expect(filesMatching(/new RootNode\s*\(/)).toEqual([
      'engine/services/renderer/scene-builder.ts',
    ]);
  });

  it('导出唯一入口：`new SceneExporter(` 只在 renderer-manager', () => {
    expect(filesMatching(/new SceneExporter\s*\(/)).toEqual([
      'engine/core/managers/renderer-manager.ts',
    ]);
  });
});

describe('声画源时间同源（TD-22-14 的今天形态）', () => {
  it('画面取帧与音频调度共用唯一时间域原语 `getVisualSourceTime`', () => {
    const users = filesMatching(/\bgetVisualSourceTime\(/).filter(
      (file) => file !== 'engine/timeline/element-utils.ts',
    );
    // 画面侧（渲染节点）与声音侧（播放调度）都必须在名单里 —— 缺一个即"手写了第二份式子"
    expect(users).toContain('engine/services/renderer/nodes/visual-node.ts');
    expect(users).toContain('engine/core/managers/audio-manager.ts');
  });

  it('`playbackRate` 的读取只经 `getElementPlaybackRate`（无手写判据残留）', () => {
    // 手写判据长这样：`'playbackRate' in element && typeof element.playbackRate === 'number'`
    expect(filesMatching(/'playbackRate' in /)).toEqual(['engine/timeline/element-utils.ts']);
  });
});

describe('getElementPlaybackRate —— rate 的唯一读取口', () => {
  it('有 playbackRate → 如实返回', () => {
    expect(
      getElementPlaybackRate({ element: { type: 'video', playbackRate: 2 } as TimelineElement }),
    ).toBe(2);
  });

  it('缺省 / 非数字 / 无该字段的元素（文本、贴纸）→ 1', () => {
    expect(getElementPlaybackRate({ element: { type: 'video' } as TimelineElement })).toBe(1);
    expect(getElementPlaybackRate({ element: { type: 'text' } as TimelineElement })).toBe(1);
  });

  it('越界值**如实**返回 —— 夹取属 UI 写入侧（speed-utils.clampPlaybackRate），读取侧不得偷改', () => {
    expect(
      getElementPlaybackRate({ element: { type: 'video', playbackRate: 99 } as TimelineElement }),
    ).toBe(99);
  });
});
