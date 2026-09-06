/**
 * VideoProcessNode 深度测试（修复"大而复杂测最浅"）。
 *
 * 覆盖审计建议 P0：挂载各模式、核心参数渲染、上游输入传递、错误态、无视频校验。
 * 策略：
 *  - httpRequest mock 为 reject，避免挂载时元数据 effect 触发真实网络请求（jsdom/DNS 噪音）。
 *  - useConnectedInputs 本地可控（images 里放 .mp4），验证上游视频自动取链并显示名称。
 *  - 断言以稳定文本/标签为主，不依赖 videoEngine 真实处理（处理链路已由 videoEngine 独立契约测试覆盖）。
 */
import 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { mocks } from './_nodeMocks.mjs';

vi.mock('@xyflow/react', () => mocks.xyflow);
vi.mock('../../src/components/base/ui/NodeShell.tsx', () => ({ default: mocks.NodeShell }));
vi.mock('../../src/components/edges/CustomHandle.tsx', () => ({ default: mocks.CustomHandle }));
vi.mock('../../src/hooks/useConnectedInputs.ts', () => ({
  useConnectedInputs: mocks.useConnectedInputs,
}));
vi.mock('../../src/hooks/useMediaDegrade.ts', () => ({ useMediaDegrade: mocks.useMediaDegrade }));
vi.mock('../../src/components/base/core/uiHooks.ts', () => ({
  useNodeResize: mocks.useNodeResize,
  useContentHeightSync: mocks.useContentHeightSync,
  useOutsideClick: mocks.useOutsideClick,
}));
vi.mock('../../src/components/base/core/toastStore.ts', () => ({
  showToast: mocks.showToast,
  toastError: mocks.toastError,
  toastWarning: mocks.toastWarning,
}));
// 补全 subscribe/subscribeOnce（taskStore 等模块顶层会 subscribe，缺则崩）；返回 no-op unsubscribe
vi.mock('../../src/components/base/core/eventBus.ts', () => ({
  publish: mocks.publish,
  subscribe: mocks.subscribe ?? (() => () => {}),
  subscribeOnce: mocks.subscribeOnce ?? (() => () => {}),
  clearEvent: mocks.clearEvent ?? (() => {}),
}));
vi.mock('../../src/components/base/utils/asyncGuard.ts', () => ({
  withTimeout: mocks.withTimeout,
  isTimeoutError: mocks.isTimeoutError,
}));
vi.mock('../../src/components/base/utils/videoEngine.ts', () => ({
  readVideoMetadata: mocks.readVideoMetadata,
  processVideo: mocks.processVideo,
  concatVideos: mocks.concatVideos,
  videoToGif: mocks.videoToGif,
  formatBytes: mocks.formatBytes,
  uploadResult: mocks.uploadResult,
  ProgressController: mocks.ProgressController,
  ConversionCanceled: mocks.ConversionCanceled,
}));
// preserve 其余 httpClient 导出（deriveNodes 等依赖），仅把 network 请求 stub 成拒绝
vi.mock('../../src/components/base/api/httpClient.ts', async (importOriginal) => {
  const mod =
    (await importOriginal()) as unknown as typeof import('../../src/components/base/api/httpClient.ts');
  return { ...mod, httpRequest: vi.fn(() => Promise.reject(new Error('mock: no network'))) };
});

import VideoProcessNode from '../../src/components/nodes/VideoProcessNode.tsx';
beforeEach(() => {
  mocks.resetNodeMockState();
});
const setup = (props = {}) =>
  render(<VideoProcessNode id="vp1" data={{}} selected={false} {...props} />);

describe('VideoProcessNode — 模式挂载与切换', () => {
  it('空态：显示 5 个模式标签，默认 trim 显示「开始处理」', () => {
    setup();
    expect(screen.getByText('视频截取')).toBeTruthy();
    expect(screen.getByText('提取音频')).toBeTruthy();
    expect(screen.getByText('尺寸帧率')).toBeTruthy();
    expect(screen.getByText('视频拼接')).toBeTruthy();
    expect(screen.getByText('视频转GIF')).toBeTruthy();
    expect(screen.getByText('开始处理')).toBeTruthy();
  });

  it('切到提取音频 → 显示 M4A/WAV/MP3 三种格式', () => {
    setup();
    fireEvent.click(screen.getByText('提取音频'));
    expect(screen.getByText('M4A')).toBeTruthy();
    expect(screen.getByText('WAV')).toBeTruthy();
    expect(screen.getByText('MP3')).toBeTruthy();
  });

  it('切到尺寸帧率 → 显示预设 + 宽高 + fps', () => {
    setup();
    fireEvent.click(screen.getByText('尺寸帧率'));
    expect(screen.getByText('480p')).toBeTruthy();
    expect(screen.getByText('720p')).toBeTruthy();
    expect(screen.getByText('1080p')).toBeTruthy();
    expect(screen.getByText('宽度')).toBeTruthy();
    expect(screen.getByText('高度')).toBeTruthy();
    expect(screen.getByText('24 fps')).toBeTruthy();
    expect(screen.getByText('60 fps')).toBeTruthy();
  });

  it('切到视频拼接 → 显示新增轨道 + 按时间线拼接', () => {
    setup();
    fireEvent.click(screen.getByText('视频拼接'));
    expect(screen.getByText('新增轨道')).toBeTruthy();
    expect(screen.getByText('按时间线拼接')).toBeTruthy();
    expect(screen.queryByText('开始处理')).toBeNull();
  });

  it('切到视频转GIF → 显示清晰度/帧率/速度/色彩 与裁剪', () => {
    // 裁剪开关仅在有视频元数据（gifDuration > 0）时渲染，故注入 gifDuration
    setup({ data: { gifDuration: 10 } });
    fireEvent.click(screen.getByText('视频转GIF'));
    expect(screen.getByText('清晰度')).toBeTruthy();
    expect(screen.getByText('帧率')).toBeTruthy();
    expect(screen.getByText('速度')).toBeTruthy();
    expect(screen.getByText('色彩')).toBeTruthy();
    expect(screen.getByText('裁剪')).toBeTruthy();
    expect(screen.getByText('生成GIF')).toBeTruthy();
  });
});

describe('VideoProcessNode — 视频来源', () => {
  it('无视频 → 显示上传占位提示', () => {
    setup();
    expect(screen.getByText('上传视频或连接视频节点')).toBeTruthy();
  });

  it('data.sourceVideoUrl → 显示视频预览与文件名', () => {
    setup({ data: { sourceVideoUrl: 'http://x/v.mp4', sourceVideoName: 'v.mp4' } });
    expect(screen.getByText('v.mp4')).toBeTruthy();
    expect(screen.queryByText('上传视频或连接视频节点')).toBeNull();
  });

  it('上游连接 .mp4 → 自动取链并显示名称', () => {
    mocks.setConnectedInputs({ images: [{ id: 'up', url: 'http://x/upstream.mp4' }], texts: [] });
    setup();
    expect(screen.getByText('upstream.mp4')).toBeTruthy();
  });
});

describe('VideoProcessNode — 校验与错误态', () => {
  it('无视频时 trim 模式「开始处理」禁用（不可点）', () => {
    setup();
    const btn = screen.getByText('开始处理').closest('button');
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(true);
  });

  it('data.errorMessage → 渲染错误信息', () => {
    setup({ data: { errorMessage: '解码失败' } });
    expect(screen.getByText('解码失败')).toBeTruthy();
  });
});
