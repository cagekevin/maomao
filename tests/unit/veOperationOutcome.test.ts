// @vitest-environment jsdom
/**
 * 回归锁：剪辑器「操作结果契约」（母体 M1 · 结果契约缺位）。
 *
 * ════════════════════════════════════════════════════════════════
 * 本域原本用四种方式回答成败，其中三种**不可判别**：
 *   · `addMediaAsset` 返回 `Promise<string>` —— **保存失败也返回新 id**（调用方只能二次探测）；
 *   · `flush()` 返回 `Promise<void>` —— `isSaving` 期间静默空转，`await` ≠ 已落盘；
 *   · `saveCurrentProject` 把失败**吞掉**（非 409 只 logger）—— 脏数据被当作已保存；
 *   · `ExportResult` 是全可选宽松形状 —— 消费端被迫双检、双检 else 静默。
 * 于是「成没成功」这个真相散落且不可读。本轮统一为 `ok` 判别联合
 * （`types/outcome.ts`，与 base 域 `PersistOutcome` 同构）。
 *
 * 【每个用例都写明「旧实现会怎么红」】—— 它们不是覆盖率凑数，是这几笔债的**行为证据**。
 * ════════════════════════════════════════════════════════════════
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorCore } from '../../src/components/videoEditor/engine/core';
import type { MediaAsset } from '../../src/components/videoEditor/types/assets';
import type { TProject } from '../../src/components/videoEditor/types/project';

const storageMock = vi.hoisted(() => ({
  saveMediaAsset: vi.fn(),
  deleteMediaAsset: vi.fn(),
  loadAllMediaAssets: vi.fn(),
  saveProject: vi.fn(),
  loadAllProjectsMetadata: vi.fn(),
}));

vi.mock('../../src/components/videoEditor/engine/services/storage/service', () => ({
  storageService: storageMock,
}));

// 【2026-09-16 · TD-02-35 已删】原 `migrations` 模块替身（jsdom 无 IndexedDB 故桩掉执行入口）——
// 迁移器整层已删除，本测试不再需要该桩。

vi.mock('../../src/components/videoEditor/lib/toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

function makeProject(id: string): TProject {
  return {
    metadata: { id, name: id, duration: 0, createdAt: new Date(), updatedAt: new Date() },
    scenes: [],
    currentSceneId: '',
    settings: {
      fps: 30,
      canvasSize: { width: 1920, height: 1080 },
      originalCanvasSize: null,
      background: { type: 'color', color: '#000000' },
    },
    version: 3,
  } as unknown as TProject;
}

function makeAsset(id: string): MediaAsset {
  return { id, name: id, type: 'video', url: `blob:${id}` } as unknown as MediaAsset;
}

/** `addMediaAsset` 的入参形态（id 由 manager 生成，故 Omit 掉）。 */
function makeAssetInput(name: string): Omit<MediaAsset, 'id'> {
  return {
    name,
    type: 'video',
    file: new File(['x'], `${name}.mp4`, { type: 'video/mp4' }),
    url: `blob:${name}`,
  } as unknown as Omit<MediaAsset, 'id'>;
}

/**
 * 造一个「已就绪」的编辑器上下文。
 * `ProjectManager.isLoading` 初值为 `true`（真实链路靠 EditorProvider 挂载时的
 * `loadAllProjects()` 落到 false）—— 不先走这一步，`SaveManager` 的前置守卫会直接
 * 返回 `loading`，测不到保存本身。
 */
async function bootEditor(editor: EditorCore): Promise<void> {
  storageMock.loadAllProjectsMetadata.mockResolvedValue([]);
  await editor.project.loadAllProjects();
  editor.project.setActiveProject({ project: makeProject('p1') });
}

describe('TD-22-37 · addMediaAsset 结果契约（判别联合，失败不再返回幽灵 id）', () => {
  let editor: EditorCore;

  beforeEach(async () => {
    EditorCore.reset();
    editor = EditorCore.getInstance();
    await bootEditor(editor);
    storageMock.saveMediaAsset.mockReset();
    storageMock.saveMediaAsset.mockResolvedValue(undefined);
  });

  afterEach(() => {
    editor.save.stop();
    editor.audio.dispose();
    EditorCore.reset();
  });

  it('保存成功 → { ok: true }，并带上素材本体（调用方无需回数组二次查）', async () => {
    const outcome = await editor.media.addMediaAsset({
      projectId: 'p1',
      asset: makeAssetInput('a1'),
    });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.id).toBeTruthy();
      expect(outcome.asset.id).toBe(outcome.id);
    }
    expect(editor.media.getAssets()).toHaveLength(1);
  });

  it('保存失败 → { ok: false, reason: "save-failed" }，且素材已回滚（旧实现此处返回了 id）', async () => {
    storageMock.saveMediaAsset.mockRejectedValue(new Error('local service offline'));

    const outcome = await editor.media.addMediaAsset({
      projectId: 'p1',
      asset: makeAssetInput('a1'),
    });

    // 旧实现返回 `newAsset.id`（一个**不存在的素材 id**）→ 此处 `outcome.ok` 为 undefined，
    // 调用方只能 `getAssets().find(...)` 二次探测（use-timeline-drag-drop）或直接插幽灵片段（TTS）。
    expect(outcome.ok).toBe(false);
    // 判别联合：失败支字段需显式判 `!ok` 才能访问（TS 按判别位收窄）。
    if (!outcome.ok) {
      expect(outcome.reason).toBe('save-failed');
      expect(outcome.message).toContain('offline');
    }
    expect(editor.media.getAssets()).toEqual([]);
  });
});

describe('TD-22-43 · loadProjectMedia 结果契约 + 重入守卫', () => {
  let editor: EditorCore;

  beforeEach(async () => {
    EditorCore.reset();
    editor = EditorCore.getInstance();
    await bootEditor(editor);
    storageMock.loadAllMediaAssets.mockReset();
  });

  afterEach(() => {
    editor.save.stop();
    editor.audio.dispose();
    EditorCore.reset();
  });

  it('加载失败 → { ok: false, reason: "load-failed" } 且暴露 loadError（面板据此渲染错误态）', async () => {
    storageMock.loadAllMediaAssets.mockRejectedValue(new Error('offline'));

    const outcome = await editor.media.loadProjectMedia({ projectId: 'p1' });

    // 旧实现返回 void + 只记 logger → 用户看到的是**静默空面板**（以为"这个工程没素材"）。
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toBe('load-failed');
    }
    expect(editor.media.getLoadError()).toContain('offline');
  });

  it('并发加载：先发起、后完成的旧请求不得覆盖新工程的素材（旧实现会串门）', async () => {
    let resolveOld: (value: MediaAsset[]) => void = () => {};
    const oldRequest = new Promise<MediaAsset[]>((resolve) => {
      resolveOld = resolve;
    });

    storageMock.loadAllMediaAssets
      .mockImplementationOnce(() => oldRequest) // 第 1 次（工程 A，慢）
      .mockImplementationOnce(() => Promise.resolve([makeAsset('B-asset')])); // 第 2 次（工程 B，快）

    const pendingOld = editor.media.loadProjectMedia({ projectId: 'A' });
    const pendingNew = editor.media.loadProjectMedia({ projectId: 'B' });

    // B（后发起）先完成 → 旧实现此时写 B；随后 A（先发起）完成 → 旧实现**再写 A**，B 的素材被覆盖。
    await pendingNew;
    resolveOld([makeAsset('A-asset')]);
    await pendingOld;

    expect(editor.media.getAssets().map((asset) => asset.id)).toEqual(['B-asset']);
  });
});

describe('TD-22-33 · 保存链路：flush 返回真实结果（不再有假信号）', () => {
  let editor: EditorCore;

  beforeEach(async () => {
    EditorCore.reset();
    editor = EditorCore.getInstance();
    await bootEditor(editor);
    storageMock.saveProject.mockReset();
    storageMock.saveProject.mockResolvedValue(undefined);
  });

  afterEach(() => {
    editor.save.stop();
    editor.audio.dispose();
    EditorCore.reset();
  });

  it('保存进行中再 flush → 返回时**再落一次盘**（旧实现在 isSaving 时直接空转）', async () => {
    let releaseFirst: () => void = () => {};
    const firstSave = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let saveCalls = 0;
    storageMock.saveProject.mockImplementation(() => {
      saveCalls += 1;
      return saveCalls === 1 ? firstSave : Promise.resolve(undefined);
    });

    const firstFlush = editor.save.flush(); // 进入在途
    await Promise.resolve(); // 让第一次保存真正开始（isSaving = true）

    const secondFlush = editor.save.flush(); // 在途期间调用
    releaseFirst();
    const outcome = await secondFlush;
    await firstFlush;

    // 旧实现：第二次 flush 撞上 `if (this.isSaving) return` → 静默空转，saveCalls 停在 1，
    // 且 `await flush()` 已经返回（调用方拿到**假信号**：以为落盘了，其实最后一次变更还在队列里）。
    expect(saveCalls).toBeGreaterThanOrEqual(2);
    expect(outcome.ok).toBe(true);
  });

  it('保存失败 → flush 返回 { ok: false }（旧实现吞掉失败，await 显示"成功"）', async () => {
    storageMock.saveProject.mockRejectedValue(new Error('quota exceeded'));

    const outcome = await editor.save.flush();

    // 旧实现：`saveCurrentProject` 内部 catch 掉非 409 异常且不 rethrow → `await flush()` 正常返回，
    // `hasPendingSave` 被清成 false（"脏数据已保存"），用户零感知 —— 退出即丢改动。
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toBe('save-failed');
    }
    expect(editor.save.getIsDirty()).toBe(true); // 失败必须**保持 dirty**（beforeunload 仍拦得住）
  });
});
