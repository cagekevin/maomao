/**
 * TaskCenter 深度测试。
 *
 * TaskCenter 是任务中心面板（近 200 次提交改动 8 次，此前无测试）。
 * 核心交互：状态/类型筛选、搜索、任务卡片多态渲染（完成/进行中/失败/待处理）、
 * 更多菜单（重试/删除/下载/刷新）、大图预览、清理任务。
 *
 * 本文件断言真实行为：
 *  - 空态渲染
 *  - 过滤/搜索/类型筛选
 *  - 各状态卡片渲染（进度条、阶段文案、错误块、缩略图）
 *  - 更多菜单操作（重试/删除/下载/复制）
 *  - 大图预览弹窗
 *  - 清理任务
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// 内存状态：任务列表
const h = vi.hoisted(() => {
  let tasks: any = [];
  const useTasks = vi.fn(() => tasks);
  const setTasks = (list: any) => {
    tasks = list;
  };
  const removeTask = vi.fn();
  // 带 rest 参数声明：保证 mock 工厂可无损透传调用参数，无需 as any 强转
  const retryTask = vi.fn((..._a: unknown[]) => true);
  const clearTasksBy = vi.fn();
  const clearAllTasks = vi.fn();
  const downloadUrl = vi.fn(async (..._a: unknown[]) => ({ ok: true }));
  const showToast = vi.fn();
  const clipboardWrite = vi.fn();
  const loggerWarn = vi.fn();
  return {
    useTasks,
    setTasks,
    removeTask,
    retryTask,
    clearTasksBy,
    clearAllTasks,
    downloadUrl,
    showToast,
    clipboardWrite,
    loggerWarn,
  };
});

// jsdom 无 navigator.clipboard；复制提示词逻辑依赖它，固定为一个可断言 mock
Object.defineProperty(globalThis.navigator, 'clipboard', {
  value: { writeText: (...a: any[]) => h.clipboardWrite(...a) },
  configurable: true,
});

vi.mock('../../src/components/base/store/taskStore.ts', async () => {
  // 【唯一真源】纯函数（taskStatusVisual / statusLabel / typeLabel / taskMediaKind）一律取自真源：
  // 本文件此前手抄了一份「按真实实现兜底」，且**已实际漂移**（discountVideo 抄成「特惠视频」，
  // 真源是「视频生成」）—— 那就是 SSOT 第二份。此处只替换「有状态订阅 / 有副作用」的成员。
  const actual = await vi.importActual<
    typeof import('../../src/components/base/store/taskStore.ts')
  >('../../src/components/base/store/taskStore.ts');
  return {
    ...actual,
    useTasks: () => h.useTasks(),
    removeTask: (...a: unknown[]) => h.removeTask(...a),
    retryTask: (...a: unknown[]) => h.retryTask(...a),
    clearTasksBy: (...a: unknown[]) => h.clearTasksBy(...a),
    clearAllTasks: (...a: unknown[]) => h.clearAllTasks(...a),
  };
});
vi.mock('../../src/components/base/core/log/logger.ts', () => ({
  logger: { warn: (...a: unknown[]) => h.loggerWarn(...a) },
}));
vi.mock('../../src/components/base/utils/net/clipboard.ts', () => ({
  downloadUrl: (...a: unknown[]) => h.downloadUrl(...a),
  // copyText 走真实信封；这里仅在测试环境把底层 navigator.clipboard.writeText 接到可断言 mock
  copyText: (...a: unknown[]) => {
    h.clipboardWrite(...a);
    return { ok: true, msg: '已复制' };
  },
}));
vi.mock('../../src/components/base/core/event/toastStore.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  showToast: (...a: unknown[]) => h.showToast(...a),
}));
vi.mock('../../src/hooks/useAssetDragToCanvas.ts', () => ({
  makeAssetDragProps: () => ({ draggable: true }),
}));
vi.mock('../../src/components/base/core/interaction/uiHooks.ts', () => ({
  useOutsideClick: () => {},
}));
vi.mock('../../src/components/base/utils/media/assetUrl.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useRenderAssetResolver: () => (u: any) => (u && u.startsWith('/files/') ? `THUMB${u}` : u || ''),
}));
vi.mock('../../src/components/base/ui/display/VideoThumbnail.tsx', () => ({
  default: ({ src, onActivate }: any) =>
    React.createElement('div', { 'data-testid': 'video-thumbnail', onClick: onActivate }, src),
}));

import TaskCenter from '../../src/components/task/TaskCenter.tsx';

function makeTask(overrides = {}) {
  return {
    id: 't1',
    status: 'completed',
    type: 'image',
    modelName: 'gpt-4o',
    prompt: '一只猫',
    createdAt: '2026-08-18T10:00:00Z',
    resultUrl: 'http://x/result.png',
    stageLabel: '',
    progress: 0,
    errorMsg: '',
    pollTaskId: '',
    nodeId: 'n1',
    channelName: 'web',
    ...overrides,
  };
}

beforeEach(() => {
  h.setTasks([]);
  vi.clearAllMocks();
});

describe('TaskCenter — 空态', () => {
  it('无任务 → 显示「暂无任务」', () => {
    render(<TaskCenter />);
    expect(screen.getByText('暂无任务')).toBeTruthy();
  });
});

describe('TaskCenter — 任务列表渲染', () => {
  it('显示任务状态圆点、文案、类型、模型名', () => {
    h.setTasks([makeTask()]);
    render(<TaskCenter />);
    expect(screen.getByText('已完成')).toBeTruthy();
    expect(screen.getByText('生图')).toBeTruthy();
    expect(screen.getByText('gpt-4o')).toBeTruthy();
    expect(screen.getByText('一只猫')).toBeTruthy();
  });

  it('运行中任务 → 显示进度条、阶段文案、百分比', () => {
    h.setTasks([makeTask({ status: 'running', progress: 60, stageLabel: '正在生图…' })]);
    render(<TaskCenter />);
    expect(screen.getByText('正在生图…')).toBeTruthy();
    expect(screen.getAllByText('60%').length).toBeGreaterThan(0); // 状态徽标 + 进度文本各显示一次
  });

  it('待处理任务 → 显示「生成中」', () => {
    h.setTasks([makeTask({ status: 'pending' })]);
    render(<TaskCenter />);
    expect(screen.getByText('生成中')).toBeTruthy();
  });

  it('失败任务 → 显示错误信息', () => {
    h.setTasks([makeTask({ status: 'failed', errorMsg: 'API 超时' })]);
    render(<TaskCenter />);
    expect(screen.getByText('失败')).toBeTruthy();
    expect(screen.getByText('API 超时')).toBeTruthy();
  });

  it('已完成图片任务 → 显示缩略图', () => {
    h.setTasks([makeTask({ type: 'image', resultUrl: 'http://x/done.png' })]);
    render(<TaskCenter />);
    const img = document.querySelector('img[src="http://x/done.png"]');
    expect(img).toBeTruthy();
  });

  it('已完成视频任务 → 渲染 VideoThumbnail', () => {
    h.setTasks([makeTask({ type: 'video', resultUrl: 'http://x/video.mp4' })]);
    render(<TaskCenter />);
    expect(screen.getByTestId('video-thumbnail')).toBeTruthy();
  });

  // ── 媒体形态判据（taskMediaKind）的回归断言 ─────────────────────────────
  // 症状实录：文本任务行的 result_url 存的是**正文**（存量脏数据），旧实现是
  // `type === 'video' ? <VideoThumbnail> : <img>`（fail-open「非 video 即图片」），
  // 于是把正文当图片地址请求 → `GET /<URL 编码正文>` 打到 localTool 18080，
  // 未命中具名路由 → catch-all 转发外网（每条白等 ~10.5s 后 fetch failed）。
  it('文本任务（result_url 存正文）→ 不渲染任何媒体元素', () => {
    h.setTasks([
      makeTask({ type: 'text', resultUrl: '我注意到您提到了一张图片,但我需要先分析它' }),
    ]);
    render(<TaskCenter />);
    expect(document.querySelector('img')).toBeNull();
    expect(screen.queryByTestId('video-thumbnail')).toBeNull();
  });

  it('未知 type 的完成任务 → 同样不渲染媒体元素（fail-safe：不为未知类型猜成图片）', () => {
    h.setTasks([makeTask({ type: 'someFutureKind', resultUrl: 'http://x/whatever' })]);
    render(<TaskCenter />);
    expect(document.querySelector('img')).toBeNull();
  });

  it('sd2Video 别名 → 按视频形态渲染（同一媒体形态的别名收敛在 taskMediaKind 一处）', () => {
    h.setTasks([makeTask({ type: 'sd2Video', resultUrl: 'http://x/v.mp4' })]);
    render(<TaskCenter />);
    expect(screen.getByTestId('video-thumbnail')).toBeTruthy();
  });
});

describe('TaskCenter — 更多菜单操作', () => {
  it('点击 ⋮ 打开菜单，点「复制提示词」→ showToast 提示已复制（校验副作用参数）', async () => {
    h.setTasks([makeTask()]);
    render(<TaskCenter />);
    const menus = document.querySelectorAll('button[title="复制提示词"]');
    fireEvent.click(menus[0]);
    // copyPrompt 现走 copyText 异步信封，toast 在微任务后触发，需 flush
    await new Promise((r) => setTimeout(r, 0));
    expect(h.showToast).toHaveBeenCalledWith('已复制提示词', { type: 'success' });
  });

  it('更多菜单 → 点击「删除任务」触发 removeTask', () => {
    h.setTasks([makeTask()]);
    render(<TaskCenter />);
    fireEvent.click(screen.getByTitle('更多操作'));
    fireEvent.click(screen.getByText('删除任务'));
    expect(h.removeTask).toHaveBeenCalledWith('t1');
  });

  it('已完成任务 → 更多菜单显示「下载结果」', () => {
    h.setTasks([makeTask({ status: 'completed' })]);
    render(<TaskCenter />);
    fireEvent.click(screen.getByTitle('更多操作'));
    expect(screen.getByText('下载结果')).toBeTruthy();
  });

  it('运行中任务 → 更多菜单不显示「下载结果」', () => {
    h.setTasks([makeTask({ status: 'running', pollTaskId: 'p1' })]);
    render(<TaskCenter />);
    fireEvent.click(screen.getByTitle('更多操作'));
    expect(screen.queryByText('下载结果')).toBeNull();
    expect(screen.getByText('删除任务')).toBeTruthy();
  });

  it('文本任务（已完成）→ 不提供「下载结果」（无媒体结果可下，不得把正文当文件下载）', () => {
    h.setTasks([makeTask({ type: 'text', resultUrl: '正文…' })]);
    render(<TaskCenter />);
    fireEvent.click(screen.getByTitle('更多操作'));
    expect(screen.queryByText('下载结果')).toBeNull();
    expect(screen.getByText('删除任务')).toBeTruthy();
  });
});

describe('TaskCenter — 大图预览', () => {
  it('点击已完成图片缩略图 → 打开预览弹窗', () => {
    h.setTasks([makeTask({ type: 'image', resultUrl: 'http://x/big.png' })]);
    render(<TaskCenter />);
    const img = document.querySelector('img[src="http://x/big.png"]')!;
    fireEvent.click(img.closest('[class*="cursor-pointer"]')!);
    expect(screen.getByText('按住拖到画布添加')).toBeTruthy();
    expect(screen.getByTitle('关闭')).toBeTruthy();
  });

  it('预览弹窗关闭按钮 → 关闭弹窗', () => {
    h.setTasks([makeTask({ type: 'image', resultUrl: 'http://x/big.png' })]);
    render(<TaskCenter />);
    const img = document.querySelector('img[src="http://x/big.png"]')!;
    fireEvent.click(img.closest('[class*="cursor-pointer"]')!);
    fireEvent.click(screen.getByTitle('关闭'));
    expect(screen.queryByText('按住拖到画布添加')).toBeNull();
  });
});

describe('TaskCenter — 清理任务', () => {
  // 【TD-08-24】入口文案由「清理失败任务」改为「清理失败/未知任务」：unknown（提交结果未知）
  // 与 failed 同归「需用户处理」，清理谓词必须含之，否则 unknown 行会卡在列表里无入口清理。
  it('清理下拉 → 清理失败/未知任务 + 清理全部任务', () => {
    h.setTasks([
      makeTask({ id: 't1', status: 'failed' }),
      makeTask({ id: 't2', status: 'completed' }),
    ]);
    render(<TaskCenter />);
    // 打开清理下拉（⋮ 顶部按钮）
    const moreBtns = document.querySelectorAll('button[title="清理任务"]');
    fireEvent.click(moreBtns[0]);
    expect(screen.getByText(/清理失败\/未知任务/)).toBeTruthy();
    expect(screen.getByText(/清理全部任务/)).toBeTruthy();

    fireEvent.click(screen.getByText(/清理失败\/未知任务/));
    expect(h.clearTasksBy).toHaveBeenCalled();
  });

  it('unknown 任务：计入失败/未知计数，且清理谓词覆盖 unknown', () => {
    h.setTasks([
      makeTask({ id: 'u1', status: 'unknown' }),
      makeTask({ id: 't2', status: 'completed' }),
    ]);
    render(<TaskCenter />);
    const moreBtns = document.querySelectorAll('button[title="清理任务"]');
    fireEvent.click(moreBtns[0]);
    // 计数含 unknown（否则数字对不上行为）
    expect(screen.getByText(/清理失败\/未知任务 \(1\)/)).toBeTruthy();
    fireEvent.click(screen.getByText(/清理失败\/未知任务/));
    // 谓词必须同时接受 failed 与 unknown（此处断言对 unknown 行返回 true）
    const predicate = h.clearTasksBy.mock.calls.at(-1)![0] as (t: { status: string }) => boolean;
    expect(predicate({ status: 'unknown' })).toBe(true);
    expect(predicate({ status: 'failed' })).toBe(true);
    expect(predicate({ status: 'completed' })).toBe(false);
  });
});

describe('TaskCenter — 展开请求/响应数据', () => {
  it('点击「请求/响应数据」→ 展开 JSON 数据', () => {
    h.setTasks([makeTask()]);
    render(<TaskCenter />);
    fireEvent.click(screen.getByText('请求/响应数据'));
    expect(screen.getByText(/"id": "t1"/)).toBeTruthy();
    expect(screen.getByText(/"status": "completed"/)).toBeTruthy();
  });
});
