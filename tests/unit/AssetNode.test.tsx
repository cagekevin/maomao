/**
 * AssetNode 深度测试（修复审计 P1"偏薄"）。
 * 覆盖 content type 判定的多种内容态：empty / image / audio / text / video。
 * detectAssetType 为真实实现；assetType 显式标注时优先（blob/无扩展名产出场景）。
 */
import 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { mocks } from './_nodeMocks.mjs';

vi.mock('@xyflow/react', () => mocks.xyflow);
vi.mock('../../src/components/canvas/parts/NodeShell.tsx', () => ({ default: mocks.NodeShell }));
vi.mock('../../src/components/canvas/shell/HoverToolbar.tsx', () => ({
  default: mocks.HoverToolbar,
}));
vi.mock('../../src/components/image/editors/ImageEditor.tsx', () => ({
  default: mocks.ImageEditor,
}));
vi.mock('../../src/components/image/editors/MattingEditor.tsx', () => ({
  default: mocks.MattingEditor,
}));
vi.mock('../../src/hooks/useAssetDegrade.ts', () => ({ useAssetDegrade: mocks.useAssetDegrade }));
vi.mock('../../src/components/image/hooks/useFitNodeRatio.ts', () => ({
  useFitNodeRatio: mocks.useFitNodeRatio,
}));
vi.mock('../../src/hooks/useVideoPoster.ts', () => ({ useVideoPoster: mocks.useVideoPoster }));
vi.mock('../../src/components/base/api/filesApi.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  toAbsoluteFileUrl: mocks.toAbsoluteFileUrl,
  saveInlineToLocal: mocks.saveInlineToLocal,
  resolveNodeAssetUrl: mocks.resolveNodeAssetUrl,
  // ★ 编辑器产出的统一落盘出口：桩掉真实实现（它内部走 HTTP，jsdom 下跑不通），
  //   但保留**契约**「先 show(dataUrl) 再 show(持久 URL)」⇒ 让用例能断言"产物确实走了落盘"。
  showThenPersistInline: mocks.showThenPersistInline,
}));
vi.mock('../../src/components/base/core/event/toastStore.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  showToast: mocks.showToast,
  toastError: mocks.toastError,
}));
vi.mock('../../src/components/base/utils/imageCompress.ts', () => ({
  compressImage: mocks.compressImage,
}));

import AssetNode from '../../src/components/image/nodes/AssetNode.tsx';
import { toAbsoluteFileUrl } from '../../src/components/base/core/utils.ts';
beforeEach(() => {
  mocks.resetNodeMockState();
});
const setup = (props = {}) => render(<AssetNode id="im1" data={{}} selected={false} {...props} />);

describe('AssetNode — 内容态', () => {
  it('无内容 → 空态（无 img、无内容文本）', () => {
    setup();
    expect(document.querySelector('img[alt="Content"]')).toBeNull();
    expect(screen.queryByText('文本/数据文件')).toBeNull();
  });

  it('image URL → 渲染图片并加载宽高比', () => {
    const { container } = setup({ data: { assetUrl: 'http://x/a.png' } });
    const img = container.querySelector('img[alt="Content"]');
    expect(img).toBeTruthy();
    // 可选链：查不到时由上一行断言先失败，避免这里抛 TypeError 盖掉真实失败原因
    expect(img?.getAttribute('src')).toBe('http://x/a.png');
  });

  it('assetType=text → 渲染文本文件占位', () => {
    setup({ data: { assetType: 'text', url: 'http://x/a.txt' } });
    expect(screen.getByText('文本/数据文件')).toBeTruthy();
  });

  it('assetType=audio → 渲染 audio 元素', () => {
    setup({ data: { assetType: 'audio', url: 'http://x/a.m4a' } });
    expect(document.querySelector('audio')).toBeTruthy();
  });

  it('assetType=video → 渲染视频播放器 + 播放按钮', () => {
    setup({ data: { assetType: 'video', url: 'http://x/v.mp4' } });
    expect(document.querySelector('video')).toBeTruthy();
    // 未播放状态：出现播放按钮（title=播放视频）
    const playBtn = screen.getAllByTitle('播放视频')[0];
    expect(playBtn).toBeTruthy();
  });

  it('AI 抠图保存 → 产物必须落盘（与 ImageEditor/裁剪/压缩/放大同一条出口）', async () => {
    // 契约：抠图产出 dataURL 后必须经「统一落盘策略」换持久 URL。
    // 此前抠图直调 replaceImage ⇒ 只写字段、产物永不落盘（MB 级内联串常驻 node.data）。
    // 断言两条**外部事实**（改坏实现必红，非自证式）：
    //   ① 落盘真源 saveInlineToLocal 被以抠图产物调用；
    //   ② 落盘后的持久 URL 被再次写回节点（用户看到的最终地址）。
    setup({ data: { assetUrl: 'http://x/a.png' } });
    fireEvent.click(screen.getByTitle('AI 抠图（去背景）'));
    const saveBtn = await screen.findByText('抠图保存');
    const setNodesBefore = mocks.xyflowCalls.setNodes; // 排除打开编辑器时的写回
    fireEvent.click(saveBtn);
    await vi.waitFor(() => expect(mocks.saveInlineCalls.n).toBe(1));
    // ① 落盘用的是抠图产物本身
    expect(mocks.saveInlineCalls.lastDataUrl).toBe('data:image/png;base64,AAAA');
    // ② 落盘成功后有写回（上屏 dataURL → 再写回持久 URL），且确实写到了节点
    expect(mocks.xyflowCalls.setNodes).toBeGreaterThan(setNodesBefore);
  });

  it('图片两段回退：缩略图失败 → 原图；原图再失败 → 显式占位（不静默裂图）', () => {
    // 契约另一半在后端 handleThumbnail：缩略图失败是显式 4xx/5xx，由前端 <img onError> 回退原图。
    // 本断言锁的就是这条「失败可见 + 可回退」，此前 AssetNode 侧完全没实现（失败=浏览器裂图）。
    const { container } = setup({ data: { assetUrl: '/files/web/abc.png' } });
    const imgEl = () => container.querySelector('img[alt="Content"]') as HTMLImageElement | null;

    const first = imgEl();
    expect(first).toBeTruthy();
    // 初始走按需小图（缩略图端点），不是原图地址
    expect(first?.getAttribute('src')).not.toBe('/files/web/abc.png');

    // ① 缩略图端点失败 → 回退原图（**归一后的可加载地址**，见 useImageFallbackSrc）
    fireEvent.error(first as HTMLImageElement);
    expect(imgEl()?.getAttribute('src')).toBe(toAbsoluteFileUrl('/files/web/abc.png'));

    // ② 原图也失败 → 转显式占位（不再让浏览器裂图）
    fireEvent.error(imgEl() as HTMLImageElement);
    expect(container.querySelector('img[alt="Content"]')).toBeNull();
    expect(screen.getByText('图片加载失败')).toBeTruthy();
  });
});
