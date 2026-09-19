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
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { mocks } from './_nodeMocks.mjs';

// ── TD-21-2 打桩：抽帧原语的**消费方级**覆盖 ──
// 本文件此前 10 例无一触发「抽缩略图」effect（见 describe「抽缩略图」）。
// `vi.hoisted` 必须用：`vi.mock` 会被提升到所有 import 之前，工厂里直接引用普通顶层变量会踩 TDZ。
const captureFrameMock = vi.hoisted(() =>
  // 显式声明签名：否则 `mock.calls` 被推断成空元组 `[]`，下面按位置取参断言会报 TS2493。
  vi.fn<(url: string, atTime: number, quality: number) => Promise<Blob>>(
    async () => new Blob(['frame'], { type: 'image/jpeg' }),
  ),
);
vi.mock('../../src/components/base/utils/captureFrame.ts', () => ({
  captureFrame: captureFrameMock,
}));

vi.mock('@xyflow/react', () => mocks.xyflow);
vi.mock('../../src/components/base/ui/NodeShell.tsx', () => ({ default: mocks.NodeShell }));
vi.mock('../../src/components/base/ui/CustomHandle.tsx', () => ({ default: mocks.CustomHandle }));
vi.mock('../../src/hooks/useConnectedInputs.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useConnectedInputs: mocks.useConnectedInputs,
}));
vi.mock('../../src/hooks/useAssetDegrade.ts', () => ({ useAssetDegrade: mocks.useAssetDegrade }));
vi.mock('../../src/components/base/core/uiHooks.ts', () => ({
  useNodeResize: mocks.useNodeResize,
  useContentHeightSync: mocks.useContentHeightSync,
  useOutsideClick: mocks.useOutsideClick,
}));
vi.mock('../../src/components/base/core/toastStore.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  showToast: mocks.showToast,
  toastError: mocks.toastError,
  toastWarning: mocks.toastWarning,
}));
// 补全 subscribe/subscribeOnce（taskStore 等模块顶层会 subscribe，缺则崩）；返回 no-op unsubscribe
vi.mock('../../src/components/base/core/eventBus.ts', () => ({
  publish: mocks.publish,
  subscribe: (mocks as any).subscribe ?? (() => () => {}),
  subscribeOnce: (mocks as any).subscribeOnce ?? (() => () => {}),
  clearEvent: (mocks as any).clearEvent ?? (() => {}),
}));
// 【2026-09-17】`fileNameFromUrl`（core/utils.ts）现在依赖 `tryParse`；本 mock 原先只给
// `withTimeout/isTimeoutError`，缺 `tryParse` 会在**组件渲染路径**上抛
// "No tryParse export is defined on the mock"（表现为一堆与落盘无关的用例一起红）。
// 用 `importOriginal` 取真实实现：`tryParse` 是纯函数，mock 它没有意义。
vi.mock('../../src/components/base/utils/asyncGuard.ts', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../src/components/base/utils/asyncGuard.ts')>();
  return {
    ...actual,
    withTimeout: mocks.withTimeout,
    isTimeoutError: mocks.isTimeoutError,
  };
});
vi.mock('../../src/components/base/utils/videoEngine.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
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

import VideoProcessNode from '../../src/components/canvas/nodes/VideoProcessNode.tsx';
beforeEach(() => {
  mocks.resetNodeMockState();
  captureFrameMock.mockClear();
  // jsdom 不实现 URL.createObjectURL / revokeObjectURL，而抽帧成功后要走 previewUrls.create(blob)
  // （`create` 内部调 `globalThis.URL.createObjectURL`）—— 不补 stub 会直接抛。
  // 幂等判断：真实现了就不覆盖（避免掩盖真实行为）。
  const urlAny = URL as unknown as {
    createObjectURL?: (b: Blob) => string;
    revokeObjectURL?: (u: string) => void;
  };
  if (typeof urlAny.createObjectURL !== 'function') urlAny.createObjectURL = () => 'blob:preview';
  if (typeof urlAny.revokeObjectURL !== 'function') urlAny.revokeObjectURL = () => {};
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
  it('无视频 → 显示「连接视频节点以导入」占位（本地文件上传已移除）', () => {
    setup();
    expect(screen.getByText('连接视频节点以导入')).toBeTruthy();
  });

  it('data.sourceVideoUrl → 显示视频预览与文件名', () => {
    setup({ data: { sourceVideoUrl: 'http://x/v.mp4', sourceVideoName: 'v.mp4' } });
    expect(screen.getByText('v.mp4')).toBeTruthy();
    expect(screen.queryByText('连接视频节点以导入')).toBeNull();
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
    const btn = screen.getByText('开始处理').closest('button')!;
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(true);
  });

  it('data.errorMessage → 渲染错误信息', () => {
    setup({ data: { errorMessage: '解码失败' } });
    expect(screen.getByText('解码失败')).toBeTruthy();
  });
});

/**
 * TD-21-2：`captureFrame` 的**消费方级**行为锁。
 *
 * 缺口原状：`captureFrame` 的唯一消费方就是本节点（「抽缩略图」effect），而本文件此前 10 例
 * 只覆盖模式挂载 / 来源 / 错误态，**不触发该 effect** —— 于是"原消费方测试先红后绿"无从落地。
 *
 * 触发判据（读源码取证，不是猜的）：`sources.filter((s) => sourceMetadata[s.sourceId]?.duration)`
 * —— 即「**有源**」还不够，必须**该源有元数据且 duration 有值**。
 * 两例正好各锁一半：正例锁"触发后抽什么"，反例锁"判据是元数据而不是有源"。
 */
describe('VideoProcessNode — 抽缩略图（captureFrame 消费方 · TD-21-2）', () => {
  const UP = 'http://x/upstream.mp4';

  it('有源 + 有元数据 → 抽 6 帧（时间点 duration×(i+0.5)/6，质量恒 0.55）', async () => {
    mocks.setConnectedInputs({ images: [{ id: 'up', url: UP }], texts: [] });
    // duration=12 ⇒ 时间点恰为 1/3/5/7/9/11（整点，便于锁值；也顺带锁住"不抽首帧 0s"）
    setup({ data: { sourceMetadata: { [UP]: { duration: 12 } } } });

    await waitFor(() => expect(captureFrameMock).toHaveBeenCalledTimes(6));

    expect(captureFrameMock.mock.calls.map((c) => c[0])).toEqual(Array(6).fill(UP));
    expect(captureFrameMock.mock.calls.map((c) => c[1])).toEqual([1, 3, 5, 7, 9, 11]);
    expect(captureFrameMock.mock.calls.map((c) => c[2])).toEqual(Array(6).fill(0.55));
  });

  it('有源但无元数据 → **不抽帧**（判据是 metadata.duration，不是"有源"）', async () => {
    mocks.setConnectedInputs({ images: [{ id: 'up', url: UP }], texts: [] });
    setup();

    // 该 effect 是异步 IIFE，给足一个宏任务周期；不抽帧是"不该发生的调用"，只能靠等待反证。
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(captureFrameMock).not.toHaveBeenCalled();
  });
});

/**
 * TD-21-23 不变量：**引用抖动下不得进入渲染循环**。
 *
 * 循环链（2026-09-16 实测）：上游引用每渲染都变 ⇒ `sources` 重算 ⇒ `tracks` useMemo 重算
 * ⇒ 自动补的片段若用**随机 id**（`makeId`）就换一批新身份 ⇒ `:628` 选中态 effect 认不出
 * `selectedClipId` ⇒ `setSelectedClipId` ⇒ 渲染 ⇒ 回到起点 ⇒ **无限循环**（vitest 永久挂死）。
 *
 * 修复 = 派生 id 确定性化（`clip-auto-${sourceId}`）。本用例**故意把引用抖动打开**
 * （`setUnstableReactFlow`）来锁住该不变量 —— 真实 `@xyflow/react` 是引用稳定的，
 * 正常用例覆盖不到这条路径。
 *
 * ⚠️ **探针说明**：这条不变量**无法用 `probe.mjs` 验证** —— 破坏它不会让用例"变红"，
 * 而是让测试**挂死**（循环独占主线程，`setTimeout`/`--testTimeout` 全都排不上队，
 * 探针脚本会卡在等子进程返回，连 journal 还原都跑不到）。
 * 故"先红"以**挂死**形式取证：注入随机 id → 日志停在 `RUN` 一行 + worker 持续烧 CPU；
 * 还原 → 通过。见轮次文件。
 */
describe('VideoProcessNode — 上游引用抖动下的渲染收敛（TD-21-23 不变量）', () => {
  const UP = 'http://x/upstream.mp4';

  it('抖动开启时抽帧会**收敛**（自动补片段的 id 必须确定）', async () => {
    mocks.setUnstableReactFlow(true);
    mocks.setConnectedInputs({ images: [{ id: 'up', url: UP }], texts: [] });
    setup({ data: { sourceMetadata: { [UP]: { duration: 12 } } } });

    // ⚠️ 抖动场景**不能**断言"恰好 6 次"：`sources`/`setNodes` 每渲染都换新引用 ⇒ 抽帧 effect 每渲染都重跑，
    //    上一轮会被清理函数置 cancelled 而**中途退出**（帧数不定、次数 > 6）。这里只断言"确实抽到了帧"。
    await waitFor(() => expect(captureFrameMock.mock.calls.length).toBeGreaterThan(0));

    // 收敛判据：静置后**不再有新抽帧**。若自动补片段用了随机 id，选中态 effect 会持续 setState
    // ⇒ 持续渲染 ⇒ 抽帧 effect 持续重跑 ⇒ 这里的计数会持续增长（实测表现为主线程被独占、测试挂死）。
    await new Promise((resolve) => setTimeout(resolve, 50));
    const settled = captureFrameMock.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(captureFrameMock.mock.calls.length).toBe(settled);
  });
});
