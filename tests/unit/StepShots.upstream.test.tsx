/**
 * StepShots 上游接入只读素材区测试。
 *
 * 剧本盒子第 1 步（写剧本处）把连入的上游文本/图片以只读 ResourceStrip 展示在「剧情」框上方。
 * 断言：
 *  - 有上游接入时，只读素材区渲染且位于剧情 textarea 之前
 *  - 无上游接入时不渲染素材区
 *  - 断线回调（onDisconnectUpstream）被正确透传调用
 */
import 'react';
import { at } from '../helpers/at';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../src/components/canvas/shell/ResourceStrip.tsx', () => ({
  default: ({
    images = [] as Array<{ sourceNodeId: string }>,
    texts = [],
    readOnly = false,
    onDisconnect = (_id: string) => {},
  }: {
    images?: Array<{ sourceNodeId: string }>;
    texts?: unknown[];
    readOnly?: boolean;
    onDisconnect?: (id: string) => void;
  }) => (
    <div data-testid="upstream-strip" data-readonly={String(!!readOnly)}>
      <span data-testid="strip-imgs">{images.length}</span>
      <span data-testid="strip-texts">{texts.length}</span>
      {images[0] && (
        <button
          type="button"
          data-testid="disconnect"
          onClick={() => onDisconnect?.(at(images, 0).sourceNodeId)}
        >
          ×
        </button>
      )}
    </div>
  ),
}));
vi.mock('../../src/components/scriptbox/ScriptBoxModal.tsx', () => ({ default: () => null }));
vi.mock('../../src/components/base/core/interaction/uiHooks.ts', () => ({
  useOutsideClick: () => {},
}));

import StepShots from '../../src/components/scriptbox/StepShots.tsx';
import { normalizeScriptBoxData } from '../../src/components/scriptbox/scriptBoxSchema.ts';

const nodeId = 'sb1';
// 两点说明：
//  1. data 只给被测用到的字段，**经生产同一个归一化函数**补齐缺省后喂组件（与 ScriptBoxNode
//     的读路径一致）——不再 for cast：`ScriptBoxData` 有 20+ 必填项，Partial 直接 `as` 过不去，
//     旧写法只能靠双重断言硬跨，掩盖了「用例数据形状不对」这类问题。
//  2. callbacks 只给本文件断言的那个回调。旧写法把整个 data spread 进去再 cast 成
//     `Record<string, unknown>`：一是 `ScriptBoxCallbacks` 无索引签名，spread 结果必须靠 cast
//     才能赋值；二是 data 里根本没有回调，spread 纯属噪声。
//  3. props 组装成对象再 spread，而非在 JSX 上直接写 id={…}：StepShotsProps 无 id 字段，
//     直接写会触发 JSX 多余属性检查（TS2322）；spread 不检查多余属性，与生产侧
//     <StepShots {...stepProps} />（ScriptBoxNode）用法一致。
function setup(data: Record<string, unknown> = {}) {
  const props = {
    id: nodeId,
    data: normalizeScriptBoxData(data),
    updateData: () => {},
    callbacks: { onDisconnectUpstream: vi.fn() },
  };
  return render(<StepShots {...props} />);
}

beforeEach(() => vi.clearAllMocks());

describe('StepShots — 上游接入素材区（在剧情上方）', () => {
  it('有上游文本/图片时，只读素材区渲染且位于剧情 textarea 之前', () => {
    setup({
      story: '',
      upstreamImages: [{ id: 'i1', url: 'http://u/a.png', label: '产品', sourceNodeId: 's1' }],
      upstreamTexts: [{ id: 't1', text: '产品卖点', label: '卖点', sourceNodeId: 's2' }],
    });
    const strip = screen.getByTestId('upstream-strip');
    expect(strip).toBeTruthy();
    expect(strip.dataset['readonly']).toBe('true');
    expect(screen.getByTestId('strip-imgs').textContent).toBe('1');
    expect(screen.getByTestId('strip-texts').textContent).toBe('1');
    // 位于剧情 textarea 之前（顺序断言）
    const ta = screen.getByPlaceholderText('输入你的故事……');
    expect(strip.compareDocumentPosition(ta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('断线回调透传：点红色 × 调用 onDisconnectUpstream(sourceNodeId)', () => {
    const onDisconnect = vi.fn();
    const props = {
      id: nodeId,
      data: normalizeScriptBoxData({
        story: '',
        upstreamImages: [{ id: 'i1', url: 'http://u/a.png', sourceNodeId: 's1' }],
      }),
      updateData: () => {},
      callbacks: { onDisconnectUpstream: onDisconnect },
    };
    render(<StepShots {...props} />);
    fireEvent.click(screen.getByTestId('disconnect'));
    expect(onDisconnect).toHaveBeenCalledWith('s1');
  });

  it('无上游接入时不渲染素材区', () => {
    setup({ story: '' });
    expect(screen.queryByTestId('upstream-strip')).toBeNull();
  });
});
