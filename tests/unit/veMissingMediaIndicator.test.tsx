// @vitest-environment jsdom
/**
 * 回归锁：时间轴「素材不可用」必须**看得见**（TD-22-48）。
 *
 * ════════════════════════════════════════════════════════════════
 * 契约一（组件）：两种缺失原因给出**不同**文案 —— 因为补救动作不同：
 *   `missing-asset`（记录都没了）→ 重新导入；`source-unavailable`（记录在、源取不到）→ 查本地服务。
 *
 * 契约二（渲染层守卫）：`timeline-element.tsx` 里**所有**"源不可用"分支都必须落到
 *   `MissingMediaIndicator`，不得再有坍缩成"一行裸 `element.name`"的分支 ——
 *   那正是用户报的"就是一片空白"（分不出"素材没了"和"片段本来就空"）。
 * ════════════════════════════════════════════════════════════════
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MissingMediaIndicator } from '../../src/components/videoEditor/ui/editor/panels/timeline/missing-media-indicator';

const TIMELINE_ELEMENT_SRC = join(
  process.cwd(),
  'src/components/videoEditor/ui/editor/panels/timeline/timeline-element.tsx',
);

describe('MissingMediaIndicator —— 缺失原因必须可区分（TD-22-48）', () => {
  it('素材记录缺失 → 提示"可能已被删除"（补救 = 重新导入）', () => {
    render(<MissingMediaIndicator kind="missing-asset" name="a.mp4" />);
    const text = screen.getByRole('alert').textContent ?? '';
    expect(text).toContain('素材缺失（可能已被删除）');
    expect(text).toContain('a.mp4');
  });

  it('源文件取不到 → 提示"源文件不可用"（补救 = 查本地服务 / 重新上传）', () => {
    render(<MissingMediaIndicator kind="source-unavailable" name="b.mp4" />);
    const text = screen.getByRole('alert').textContent ?? '';
    expect(text).toContain('源文件不可用');
    expect(text).not.toContain('可能已被删除');
    expect(text).toContain('b.mp4');
  });

  it('不传 name（如音频波形拿不到名字）仍能渲染', () => {
    render(<MissingMediaIndicator kind="source-unavailable" />);
    expect(screen.getByRole('alert').textContent ?? '').toContain('源文件不可用');
  });
});

describe('渲染层守卫 —— 时间轴不再把"源不可用"悄悄吞成空白（TD-22-48）', () => {
  const src = readFileSync(TIMELINE_ELEMENT_SRC, 'utf8');

  it('时间轴的 4 个"源不可用"分支全部落到 MissingMediaIndicator', () => {
    // ElementContent：audio 无缓冲/URL · !mediaAsset · video 缺 file / image 缺 url
    // TimelineImageElement：`<img>` onError（TD-16-29② 起可挂 onError 的那个分支）
    expect(src.match(/<MissingMediaIndicator /g)?.length).toBe(4);
  });

  it('各分支传的 kind 与场景匹配（1 处 missing-asset + 3 处 source-unavailable）', () => {
    // 只数"指示块个数"会漏掉"kind 传错"（那样两种缺失会被说成同一种，正是本债要消灭的）
    expect(src.match(/kind="missing-asset"/g)?.length).toBe(1);
    expect(src.match(/kind="source-unavailable"/g)?.length).toBe(3);
  });

  it('不存在"坍缩成一行裸 element.name"的兜底分支（那正是用户看到的空白）', () => {
    expect(src).not.toContain(
      'return <span className="text-foreground/80 truncate text-xs">{element.name}</span>;',
    );
  });

  it('音频波形错误态也复用同一指示块（同一种失败不能两种说法）', () => {
    const waveformSrc = readFileSync(
      join(
        process.cwd(),
        'src/components/videoEditor/ui/editor/panels/timeline/audio-waveform.tsx',
      ),
      'utf8',
    );
    expect(waveformSrc).toContain('<MissingMediaIndicator');
    // 断言 JSX 文本已消失（**只查渲染出的文字**；文件里保留的"此前是 Audio unavailable"注释不算）
    expect(waveformSrc).not.toContain('>Audio unavailable<');
  });
});
