/**
 * 回归锁：剪辑器「工程本体写盘的槽位，由**工程实体自带 id** 决定」。
 *
 * ════════════════════════════════════════════════════════════════
 * 契约（2026-09-15 修正）：
 *   · 键 = `videoEditorProjectKey(canvasProjectId, project.metadata.id)`；
 *   · `canvasProjectId` 是**存储层独有真相**（引擎不携带）→ 由 `setEditorContext` 注入；
 *   · `project.metadata.id` 是**工程实体自带真相**（`ProjectManager.createNewProject` 生成）
 *     → 绝不在存储层再抄一份「当前活跃 editorId」来裁决写盘目标。
 *
 * 【为什么锁它】原实现在模块上下文里多存了一格 `editorId`，并加了守卫
 *   「上下文 editorId ≠ project.metadata.id → 抛『张冠李戴』」。
 * 该守卫是**假守卫**：它拦的是**合法操作** —— 用户报的「新建作品失败」正是它
 *   （新建 = 生成新 uuid ⇒ 必然 ≠ 旧上下文 ⇒ 必抛）。
 * 同一守卫还会拦 `duplicateProjects`：一次落 N 个新 id，而上下文只有一格 ——
 *   **结构上就表达不了**。这证明"写盘判据"必须落回实体自带 id，而非上下文。
 * ════════════════════════════════════════════════════════════════
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const CANVAS_ID = 'canvas-p1';

/** 极简 KV 内存替身：只关心"写到了哪个键、内容是什么"。 */
const kv = vi.hoisted(() => ({ store: new Map<string, unknown>() }));

vi.mock('../../src/components/base/core/contentStore.ts', () => ({
  contentGetAsync: vi.fn(async (key: string) => kv.store.get(key) ?? null),
  contentSetAsync: vi.fn(async (key: string, value: unknown) => {
    kv.store.set(key, value);
  }),
  contentDeleteAsync: vi.fn(async (key: string) => {
    kv.store.delete(key);
  }),
  contentKvGetVersion: vi.fn(async () => 0),
  contentKvReadWithVersion: vi.fn(async (key: string) => ({
    value: kv.store.get(key) ?? null,
    version: 0,
  })),
  contentKvSetCas: vi.fn(async (key: string, value: unknown) => {
    kv.store.set(key, value);
  }),
}));

// 本用例只走工程本体落盘，不碰素材；这两个模块 import 进来即够（防真模块拉浏览器依赖）。
vi.mock('../../src/components/base/api/filesApi.ts', () => ({
  uploadFileToLocal: vi.fn(async () => null),
}));
vi.mock('../../src/components/base/api/localToolApi.ts', () => ({
  deleteResource: vi.fn(async () => undefined),
  fetchResources: vi.fn(async () => ({ data: { items: [] } })),
}));

import {
  clearEditorContext,
  setEditorContext,
  storageService,
} from '../../src/components/videoEditor/engine/services/storage/service';
import { videoEditorProjectKey } from '../../src/components/base/core/videoEditorKeys.ts';
import type { TProject } from '../../src/components/videoEditor/types/project';

function makeProject(id: string): TProject {
  const now = new Date('2026-09-15T00:00:00.000Z');
  return {
    metadata: { id, name: `作品 ${id}`, duration: 0, createdAt: now, updatedAt: now },
    scenes: [],
    currentSceneId: '',
    settings: { fps: 30, canvasSize: { width: 1920, height: 1080 }, originalCanvasSize: null },
    version: 1,
  } as unknown as TProject;
}

function writtenProjectId(key: string): string | undefined {
  const written = kv.store.get(key) as { metadata?: { id?: string } } | undefined;
  return written?.metadata?.id;
}

describe('剪辑器工程本体：写盘槽位由工程自带 id 决定', () => {
  beforeEach(() => {
    kv.store.clear();
    clearEditorContext();
    setEditorContext({ canvasProjectId: CANVAS_ID });
  });

  it('已有一部作品时，保存「另一部」必须成功，且写进它自己的键（用户报「新建作品失败」的根因）', async () => {
    await storageService.saveProject({ project: makeProject('editor-a') });
    // 旧实现在此行抛：上下文 editorId=editor-a ≠ project.metadata.id=editor-b
    await storageService.saveProject({ project: makeProject('editor-b') });

    expect(writtenProjectId(videoEditorProjectKey(CANVAS_ID, 'editor-b'))).toBe('editor-b');
    // 且不覆盖前一部 —— 两部各占自己的槽位
    expect(writtenProjectId(videoEditorProjectKey(CANVAS_ID, 'editor-a'))).toBe('editor-a');
  });

  it('一次落多部（复制作品形态：N 个新 id）也成立 —— 上下文一格表达不了它', async () => {
    await storageService.saveProject({ project: makeProject('editor-a') });
    await Promise.all(
      ['copy-1', 'copy-2', 'copy-3'].map((id) =>
        storageService.saveProject({ project: makeProject(id) }),
      ),
    );

    for (const id of ['copy-1', 'copy-2', 'copy-3']) {
      expect(writtenProjectId(videoEditorProjectKey(CANVAS_ID, id))).toBe(id);
    }
  });

  it('未注入画布 id 时仍 fail-fast（不落到 default 键）—— 保留的判据只有这一条', async () => {
    clearEditorContext();
    await expect(storageService.saveProject({ project: makeProject('editor-x') })).rejects.toThrow(
      /setEditorContext/,
    );
  });
});
