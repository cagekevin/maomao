/**
 * 3.6 任务 store — 全局任务队列/状态轮询/进度追踪
 */

import { create } from 'zustand';
import { localTool, gateway } from '../utils/api';

export interface TaskItem {
  taskId: string;
  nodeId?: string;
  prompt?: string;
  resultUrl?: string;
  thumbnailUrl?: string;
  errorMsg?: string;
  customOutputType?: string;
  channelName?: string;
  modelName?: string;
  progress: number;
  createdAt: number;
  notFoundCount?: number;
  customResultData?: unknown;
  customRawResponse?: unknown;
  requestData?: unknown;
  responseData?: unknown;
  mediaMeta?: unknown;
  [key: string]: unknown;
}

interface TaskState {
  tasks: TaskItem[];
  loading: boolean;
  total: number;

  // Actions
  loadTasks: () => Promise<void>;
  saveTask: (task: TaskItem) => Promise<void>;
  batchSaveTasks: (tasks: TaskItem[]) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  batchDeleteTasks: (ids: string[]) => Promise<void>;
  clearTasks: (statuses?: string[]) => Promise<void>;
  updateTaskProgress: (taskId: string, progress: number) => void;
  pollTask: (taskId: string) => Promise<void>;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  loading: false,
  total: 0,

  loadTasks: async () => {
    set({ loading: true });
    try {
      const result = await localTool.getTasks({ page: 1, pageSize: 100, sortBy: 'createdAt', sortDir: 'DESC' });
      set({
        tasks: result.items as TaskItem[],
        total: result.total,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  saveTask: async (task) => {
    set((s) => {
      const exists = s.tasks.findIndex((t) => t.taskId === task.taskId);
      if (exists >= 0) {
        return { tasks: s.tasks.map((t) => (t.taskId === task.taskId ? task : t)) };
      }
      return { tasks: [task, ...s.tasks], total: s.total + 1 };
    });
    try {
      await localTool.saveTask(task);
    } catch (e) {
      console.warn('[taskStore] 保存失败:', e);
    }
  },

  batchSaveTasks: async (tasks) => {
    set((s) => {
      const existingIds = new Set(s.tasks.map((t) => t.taskId));
      const newTasks = tasks.filter((t) => !existingIds.has(t.taskId));
      return { tasks: [...newTasks, ...s.tasks], total: s.total + newTasks.length };
    });
    try {
      await localTool.batchSaveTasks(tasks);
    } catch (e) {
      console.warn('[taskStore] 批量保存失败:', e);
    }
  },

  deleteTask: async (id) => {
    set((s) => ({
      tasks: s.tasks.filter((t) => t.taskId !== id),
      total: s.total - 1,
    }));
    try {
      await localTool.deleteTask(id);
    } catch (e) {
      console.warn('[taskStore] 删除失败:', e);
    }
  },

  batchDeleteTasks: async (ids) => {
    const idSet = new Set(ids);
    set((s) => ({
      tasks: s.tasks.filter((t) => !idSet.has(t.taskId)),
      total: s.total - ids.length,
    }));
    try {
      await localTool.batchDeleteTasks(ids);
    } catch (e) {
      console.warn('[taskStore] 批量删除失败:', e);
    }
  },

  clearTasks: async (statuses) => {
    try {
      const result = await localTool.clearTasks(statuses);
      set({ tasks: [], total: 0 });
    } catch (e) {
      console.warn('[taskStore] 清空失败:', e);
    }
  },

  updateTaskProgress: (taskId, progress) => {
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.taskId === taskId ? { ...t, progress } : t,
      ),
    }));
  },

  pollTask: async (taskId) => {
    try {
      await gateway.pollTask(taskId, {
        onProgress: (progress) => {
          get().updateTaskProgress(taskId, progress);
        },
      });
    } catch (e) {
      console.warn(`[taskStore] 轮询失败 ${taskId}:`, e);
    }
  },
}));
