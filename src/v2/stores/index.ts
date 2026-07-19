/**
 * 3.8 持久化桥接 — 启动时从 localTool KV 并行恢复所有 store
 */

import { useProjectStore } from './projectStore';
import { useResourceStore } from './resourceStore';
import { useAccountStore } from './accountStore';
import { useTaskStore } from './taskStore';

/** 启动时并行加载所有 store 数据 */
export async function initStores(): Promise<void> {
  await Promise.all([
    useProjectStore.getState().loadProjects(),
    useResourceStore.getState().loadResources(),
    useAccountStore.getState().loadAccounts(),
    useTaskStore.getState().loadTasks(),
  ]);
}

// 导出所有 store
export { useProjectStore } from './projectStore';
export { useCanvasStore } from './canvasStore';
export { useResourceStore } from './resourceStore';
export { useAccountStore } from './accountStore';
export { useTaskStore } from './taskStore';
export { useUIStore } from './uiStore';
