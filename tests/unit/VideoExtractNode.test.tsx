/**
 * VideoExtractNode 深度测试。
 *
 * 视频抽帧节点（此前只有「挂载不崩」冒烟）。覆盖真实交互：
 *  - 空态 / 上传视频 / 替换视频
 *  - 上游视频自动获取（useConnectedInputs.videos）
 *  - 配置面板开关、5 种模式切换与对应参数显示（manual 隐藏开始处理）
 *  - 开始处理校验（无视频 → toast 提示）
 *  - 抽帧完整流程（mock video/canvas，断言帧数、进度、toast）
 *  - 复制全部 / 复制单帧（mutiwindow-images payload）与下载
 *  - 手动模式截取
 *
 * 隔离策略：
 *  - useConnectedInputs 本地可控（提供 videos），验证上游自动取链。
 *  - toast/contentSet/downloadUrl/clipboard/previewUrl 用 hoisted mock 断言副作用。
 *  - 抽帧流程通过 spy document.createElement 注入 fake video/canvas。
 */
import 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { mocks } from './_nodeMocks.mjs';

// ── 可控 hoisted 状态 ──
const h = vi.hoisted(() => {
  let connected: { videos: unknown[] } = { videos: [] };
  const showToast = vi.fn();
  const contentSet = vi.fn();
  const downloadUrl = vi.fn((..._a: unknown[]) => ({ ok: true, msg: '' }));
  const clipboardWrite = vi.fn();
  const previewCreate = vi.fn(() => 'blob:upload');
  const patchData = vi.fn();
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), log: vi.fn(), debug: vi.fn() };
  return {
    get connected() {
      return connected;
    },
    setConnected: (v: { videos: unknown[] }) => {
      connected = v;
    },
    showToast,
    contentSet,
    downloadUrl,
    clipboardWrite,
    previewCreate,
    patchData,
    logger,
  };
});

vi.mock('@xyflow/react', () => mocks.xyflow);
vi.mock('../../src/components/base/ui/NodeTitle.tsx', () => ({ default: mocks.NodeTitle }));
vi.mock('../../src/hooks/useConnectedInputs.ts', () => ({ useConnectedInputs: () => h.connected }));
vi.mock('../../src/hooks/useAssetDegrade.ts', () => ({ useAssetDegrade: mocks.useAssetDegrade }));
vi.mock('../../src/components/base/core/toastStore.ts', () => ({
  showToast: (...a: unknown[]) => h.showToast(...a),
  toastError: vi.fn(),
  toastWarning: vi.fn(),
  toastInfo: vi.fn(),
}));
vi.mock('../../src/components/base/core/contentStore.ts', () => ({
  contentSet: (...a: unknown[]) => (h.contentSet as unknown as (...x: unknown[]) => void)(...a),
}));
vi.mock('../../src/components/base/utils/clipboard.ts', () => ({
  downloadUrl: (...a: unknown[]) => h.downloadUrl(...a),
}));
vi.mock('../../src/components/base/core/logger.ts', () => ({ logger: h.logger }));
vi.mock('../../src/components/base/utils/previewUrl.ts', () => ({
  default: {
    create: (...a: unknown[]) => (h.previewCreate as unknown as (...x: unknown[]) => void)(...a),
    release: vi.fn(),
  },
}));
vi.mock('../../src/components/base/api/filesApi.ts', () => ({
  toAbsoluteFileUrl: mocks.toAbsoluteFileUrl,
}));
// 结果落盘唯一入口：断言节点把 extractedImages 写回 node.data（刷新不丢）
vi.mock('../../src/hooks/useNodeData.ts', () => ({
  useNodeData: () => ({ patchData: (...a: unknown[]) => h.patchData(...a) }),
}));

import VideoExtractNode from '../../src/components/nodes/VideoExtractNode.tsx';

/** 抽帧失败用例里用于顶替 <video> 的最小形状（仅实现被测用到的字段）。 */
interface FakeVideo {
  src: string;
  duration: number;
  videoWidth: number;
  videoHeight: number;
  currentTime: number;
  muted: boolean;
  playsInline: boolean;
  crossOrigin: string;
  load: () => void;
  addEventListener: () => void;
  removeEventListener: () => void;
  onloadedmetadata: ((e?: unknown) => void) | null;
  onerror: ((e: unknown) => void) | null;
}

// jsdom 无 navigator.clipboard；复制逻辑依赖它，固定为可断言 mock
Object.defineProperty(globalThis.navigator, 'clipboard', {
  value: { writeText: (...a: unknown[]) => h.clipboardWrite(...a) },
  configurable: true,
});

const setup = (props = {}) =>
  render(<VideoExtractNode id="ve1" data={{}} selected={false} {...props} />);

// 抽帧流程用：spy document.createElement 注入 fake video/canvas
let createElSpy: { mockRestore: () => void } | undefined;
function installMediaMocks() {
  const origCreate = document.createElement.bind(document);
  const ctx = {
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(16 * 16 * 4) })),
  };
  const canvas = {
    getContext: () => ctx,
    toDataURL: () => 'data:image/jpeg;base64,frame',
    width: 0,
    height: 0,
  };
  // 必须返回真实 <video> 元素：手动模式 React 会把 <video> 渲染进 DOM（appendChild），
  // 普通对象不是 Node 会报错。用 defineProperty 在实例上注入测试所需的时长/尺寸/seek 行为。
  const video = origCreate('video');
  video.load = vi.fn(); // 覆盖原生 load，避免 jsdom "Not implemented" 噪音
  Object.defineProperty(video, 'duration', { configurable: true, writable: true, value: 10 });
  Object.defineProperty(video, 'videoWidth', { configurable: true, writable: true, value: 640 });
  Object.defineProperty(video, 'videoHeight', { configurable: true, writable: true, value: 360 });
  // seek 进度用闭包变量记录（避免往真实 HTMLVideoElement 上挂自定义字段 _t）
  let seekT = 0;
  Object.defineProperty(video, 'currentTime', {
    configurable: true,
    get: () => seekT,
    set: (t: number) => {
      seekT = t;
      video.dispatchEvent(new Event('seeked'));
    },
  });
  createElSpy = vi.spyOn(document, 'createElement').mockImplementation(((tag: string) =>
    // 测试 mock 只实现被测用到的分支；返回形状与真实 createElement 不完全一致，收窄为原函数类型
    tag === 'video'
      ? (setTimeout(() => {
          if (video.onloadedmetadata) video.onloadedmetadata(new Event('loadedmetadata'));
        }, 0),
        video)
      : tag === 'canvas'
        ? canvas
        : origCreate(tag)) as unknown as typeof document.createElement);
  return { video, ctx };
}

beforeEach(() => {
  mocks.resetNodeMockState();
  h.setConnected({ videos: [] });
  vi.clearAllMocks();
  if (createElSpy) {
    createElSpy.mockRestore();
    createElSpy = undefined;
  }
});

describe('VideoExtractNode — 空态与视频来源', () => {
  it('无视频 → 显示「连接视频节点以导入」占位，且无提取结果', () => {
    setup();
    // 本地文件上传已移除：唯一来源是上游连接，故占位文案改为引导连线
    expect(screen.getByText('连接视频节点以导入')).toBeTruthy();
    expect(screen.getByText('等待提取')).toBeTruthy();
    expect(screen.queryByText('复制全部')).toBeNull();
  });

  it('data.videoUrl 预置 → 显示视频名', () => {
    setup({ data: { videoUrl: 'http://x/myvideo.mp4', videoName: 'myvideo.mp4' } });
    expect(screen.getByText('myvideo.mp4')).toBeTruthy();
    expect(screen.queryByText('连接视频节点以导入')).toBeNull();
  });

  it('上游连接视频 → 自动获取并显示视频名', async () => {
    h.setConnected({ videos: [{ url: 'http://x/clip.mp4' }] });
    setup();
    expect(await screen.findByText('clip.mp4')).toBeTruthy();
  });
});

describe('VideoExtractNode — 配置面板与模式切换', () => {
  it('点击配置 → 展开抽帧模式（默认 count 显示提取总张数）', () => {
    setup();
    fireEvent.click(screen.getByTitle('参数配置'));
    expect(screen.getByText('抽帧模式')).toBeTruthy();
    expect(screen.getByText('提取总张数')).toBeTruthy();
    fireEvent.click(screen.getByText('收起配置'));
    expect(screen.queryByText('提取总张数')).toBeNull();
  });

  it('切换模式 → 显示对应参数；manual 隐藏开始处理', () => {
    setup();
    fireEvent.click(screen.getByTitle('参数配置'));
    const select = screen.getByRole('combobox');

    fireEvent.change(select, { target: { value: 'interval' } });
    expect(screen.getByText('间隔秒数 (秒)')).toBeTruthy();

    fireEvent.change(select, { target: { value: 'smart' } });
    expect(screen.getByText('检测敏感度')).toBeTruthy();

    fireEvent.change(select, { target: { value: 'first_last' } });
    expect(screen.queryByText('提取总张数')).toBeNull();

    // manual 模式：配置面板保持展开，开始处理按钮消失
    fireEvent.change(select, { target: { value: 'manual' } });
    expect(screen.queryByText('开始处理')).toBeNull();
    expect(screen.getByText('收起配置')).toBeTruthy();
  });
});

describe('VideoExtractNode — 开始处理校验', () => {
  it('无视频点开始处理 → toast 提示先连接视频节点', () => {
    setup();
    fireEvent.click(screen.getByText('开始处理'));
    // 无视频时由按钮的 onGenerate 守卫直接拦截并 toast（不会走到 startExtract 的同一判据）
    expect(h.showToast).toHaveBeenCalledWith('请先连接视频节点');
  });
});

describe('VideoExtractNode — 抽帧完整流程', () => {
  it('count 模式 → 抽帧完成、展示帧数、toast 汇总', async () => {
    installMediaMocks();
    setup({
      data: { videoUrl: 'http://x/v.mp4', videoName: 'v.mp4', mode: 'count', frameCount: 9 },
    });
    fireEvent.click(screen.getByText('开始处理'));
    // duration=10, count=9 → times=[1..9] → 9 帧
    expect(await screen.findByText('已提取 9 帧')).toBeTruthy();
    expect(h.showToast).toHaveBeenCalledWith('抽帧完成！共提取 9 张图片');
  });

  it('手动模式 → 点击截取 → 截取当前帧并 toast', async () => {
    installMediaMocks();
    setup({ data: { videoUrl: 'http://x/v.mp4', videoName: 'v.mp4', mode: 'manual' } });
    fireEvent.click(screen.getByText('截取'));
    expect(h.showToast).toHaveBeenCalledWith('已截取当前帧');
  });

  it('加载失败（视频 onerror）→ 展示错误信息 + 分类记录（business）', async () => {
    const origCreate = document.createElement.bind(document);
    // 必须存入 createElSpy：beforeEach 统一 mockRestore，否则 spy 泄漏污染后续用例
    createElSpy = vi.spyOn(document, 'createElement').mockImplementation(((tag: string) =>
      // 测试 mock 只实现被测用到的分支；返回形状与真实 createElement 不完全一致，收窄为原函数类型
      tag === 'video'
        ? (() => {
            const v: FakeVideo = {
              src: '',
              duration: 0,
              videoWidth: 0,
              videoHeight: 0,
              currentTime: 0,
              muted: false,
              playsInline: false,
              crossOrigin: '',
              load: vi.fn(),
              addEventListener: () => {},
              removeEventListener: () => {},
              onloadedmetadata: null,
              onerror: null,
            };
            setTimeout(() => {
              if (v.onerror) v.onerror(new Error('boom'));
            }, 0);
            return v;
          })()
        : origCreate(tag)) as unknown as typeof document.createElement);
    setup({ data: { videoUrl: 'http://x/bad.mp4', videoName: 'bad.mp4' } });
    fireEvent.click(screen.getByText('开始处理'));
    expect(await screen.findByText('无法加载视频')).toBeTruthy();
    // 【R7 错误分类记录】本地 video 加载失败归 business（不可自动重试），分类进日志（message 经加载逻辑透传/兜底）
    expect(h.logger.error).toHaveBeenCalledWith(
      'VideoExtractNode',
      'Frame extraction failed',
      expect.objectContaining({ errType: 'business', retryable: false }),
    );
  });
});

describe('VideoExtractNode — 结果操作（复制/下载）', () => {
  const WITH_RESULT = {
    data: {
      videoUrl: 'http://x/v.mp4',
      videoName: 'v.mp4',
      extractedImages: ['data:image/jpeg;base64,a', 'data:image/jpeg;base64,b'],
    },
  };

  it('有提取结果 → 显示帧数与复制全部', () => {
    setup(WITH_RESULT);
    expect(screen.getByText('已提取 2 帧')).toBeTruthy();
    expect(screen.getByText('复制全部')).toBeTruthy();
  });

  it('复制全部 → clipboard 写入 mutiwindow-images payload', async () => {
    setup(WITH_RESULT);
    fireEvent.click(screen.getByText('复制全部'));
    // copyAll 是 async：clipboard 写入后的 toast 在微任务里，需 waitFor
    await waitFor(() => {
      expect(h.clipboardWrite).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'mutiwindow-images',
          images: ['data:image/jpeg;base64,a', 'data:image/jpeg;base64,b'],
        }),
      );
      expect(h.showToast).toHaveBeenCalledWith('已复制 2 张图片');
    });
  });

  it('复制单帧 → 写入单张 payload', () => {
    setup(WITH_RESULT);
    fireEvent.click(screen.getAllByTitle('复制为新节点 (Ctrl+V粘贴)')[0]);
    expect(h.clipboardWrite).toHaveBeenCalledWith(
      JSON.stringify({ type: 'mutiwindow-images', images: ['data:image/jpeg;base64,a'] }),
    );
  });

  it('下载单帧 → downloadUrl 调用', () => {
    setup(WITH_RESULT);
    fireEvent.click(screen.getAllByTitle('下载')[0]);
    expect(h.downloadUrl).toHaveBeenCalledWith('data:image/jpeg;base64,a', 'frame-1.jpg');
  });

  it('clipboard 不可用 → 回退 contentSet 写入', async () => {
    h.clipboardWrite.mockRejectedValueOnce(new Error('denied'));
    setup(WITH_RESULT);
    fireEvent.click(screen.getByText('复制全部'));
    await new Promise((r) => setTimeout(r, 10));
    expect(h.contentSet).toHaveBeenCalledWith(
      'mutiwindow-clipboard',
      JSON.stringify({
        type: 'mutiwindow-images',
        images: ['data:image/jpeg;base64,a', 'data:image/jpeg;base64,b'],
      }),
    );
  });
});

describe('VideoExtractNode — 结果落盘 node.data（刷新不丢）', () => {
  it('开始处理 → 先清空 data.extractedImages，抽帧完成后一次性写回帧数组', async () => {
    installMediaMocks();
    setup({
      data: { videoUrl: 'http://x/v.mp4', videoName: 'v.mp4', mode: 'count', frameCount: 9 },
    });
    fireEvent.click(screen.getByText('开始处理'));
    expect(await screen.findByText('已提取 9 帧')).toBeTruthy();
    const calls = h.patchData.mock.calls.map((c) => c[0] as { extractedImages?: string[] });
    // 开始先清空旧帧
    expect(calls).toContainEqual({ extractedImages: [] });
    // 完成时写入 9 帧（mock canvas 每帧返回同一 base64）
    const finalCall = calls.find((c) => c.extractedImages?.length === 9);
    expect(finalCall).toBeTruthy();
    expect(
      finalCall!.extractedImages!.every((f: string) => f === 'data:image/jpeg;base64,frame'),
    ).toBe(true);
  });

  it('手动截取 → 逐帧追加到 node.data', () => {
    installMediaMocks();
    setup({ data: { videoUrl: 'http://x/v.mp4', videoName: 'v.mp4', mode: 'manual' } });
    fireEvent.click(screen.getByText('截取'));
    expect(h.patchData).toHaveBeenLastCalledWith({
      extractedImages: ['data:image/jpeg;base64,frame'],
    });
    fireEvent.click(screen.getByText('截取'));
    expect(h.patchData).toHaveBeenLastCalledWith({
      extractedImages: ['data:image/jpeg;base64,frame', 'data:image/jpeg;base64,frame'],
    });
  });

  it('抽帧失败 → 只清空不写结果（data 无帧数组）', async () => {
    const origCreate = document.createElement.bind(document);
    // 存入 createElSpy，beforeEach 统一还原（防泄漏污染后续用例）
    createElSpy = vi.spyOn(document, 'createElement').mockImplementation(((tag: string) =>
      // 测试 mock 只实现被测用到的分支；返回形状与真实 createElement 不完全一致，收窄为原函数类型
      tag === 'video'
        ? (() => {
            const v: FakeVideo = {
              src: '',
              duration: 0,
              videoWidth: 0,
              videoHeight: 0,
              currentTime: 0,
              muted: false,
              playsInline: false,
              crossOrigin: '',
              load: vi.fn(),
              addEventListener: () => {},
              removeEventListener: () => {},
              onloadedmetadata: null,
              onerror: null,
            };
            setTimeout(() => {
              if (v.onerror) v.onerror(new Error('boom'));
            }, 0);
            return v;
          })()
        : origCreate(tag)) as unknown as typeof document.createElement);
    setup({ data: { videoUrl: 'http://x/bad.mp4', videoName: 'bad.mp4' } });
    fireEvent.click(screen.getByText('开始处理'));
    expect(await screen.findByText('无法加载视频')).toBeTruthy();
    const calls = h.patchData.mock.calls.map((c) => c[0]);
    expect(calls.some((c) => (c.extractedImages?.length || 0) > 0)).toBe(false);
  });
});
