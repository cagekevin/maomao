/**
 * 场景纯函数库。
 * 【2026-09-17 TD-22-63】已删 3 个随场景层幽灵预留一同下线的函数：
 * `canDeleteScene` / `getFallbackSceneAfterDelete` / `findCurrentScene` ——
 * 消费者只有同样零消费的场景增删改/切换链（详见 scenes-manager.ts 头注释的取证链）。
 * 留下的函数全部有活消费者（initializeScenes / createNewProject / 书签命令 / 时长计算）。
 */
import type { TScene } from '@/components/videoEditor/types/timeline';
import { generateUUID } from '@/components/base/core/idGen.ts';
import { calculateTotalDuration } from '@/components/videoEditor/engine/timeline';
import { ensureMainTrack } from '@/components/videoEditor/engine/timeline/track-utils';

export function getMainScene({ scenes }: { scenes: TScene[] }): TScene | null {
  return scenes.find((scene) => scene.isMain) || null;
}

export function ensureMainScene({ scenes }: { scenes: TScene[] }): TScene[] {
  const hasMain = scenes.some((scene) => scene.isMain);
  if (!hasMain) {
    const mainScene = buildDefaultScene({ name: 'Main scene', isMain: true });
    return [mainScene, ...scenes];
  }
  return scenes;
}

export function buildDefaultScene({ name, isMain }: { name: string; isMain: boolean }): TScene {
  const tracks = ensureMainTrack({ tracks: [] });
  return {
    id: generateUUID(),
    name,
    isMain,
    tracks,
    bookmarks: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function getProjectDurationFromScenes({ scenes }: { scenes: TScene[] }): number {
  const mainScene = getMainScene({ scenes }) ?? scenes[0] ?? null;
  if (!mainScene?.tracks || !Array.isArray(mainScene.tracks)) {
    return 0;
  }

  return calculateTotalDuration({ tracks: mainScene.tracks });
}

export function updateSceneInArray({
  scenes,
  sceneId,
  updates,
}: {
  scenes: TScene[];
  sceneId: string;
  updates: Partial<TScene>;
}): TScene[] {
  return scenes.map((scene) => (scene.id === sceneId ? { ...scene, ...updates } : scene));
}
