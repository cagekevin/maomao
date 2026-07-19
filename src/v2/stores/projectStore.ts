/**
 * 3.2 项目 store — 项目列表 CRUD + 当前项目切换
 * 持久化 key: canvas-projects
 */

import { create } from 'zustand';
import { localTool } from '../utils/api';

export interface CanvasProject {
  id: string;
  name: string;
  nodes: unknown[];
  edges: unknown[];
  viewport?: { x: number; y: number; zoom: number };
  createdAt: number;
  updatedAt: number;
}

interface ProjectState {
  projects: CanvasProject[];
  currentProjectId: string | null;
  loaded: boolean;

  // Actions
  loadProjects: () => Promise<void>;
  createProject: (name: string) => Promise<CanvasProject>;
  switchProject: (id: string) => void;
  renameProject: (id: string, name: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  updateProjectData: (id: string, data: Partial<Pick<CanvasProject, 'nodes' | 'edges' | 'viewport'>>) => Promise<void>;
  getCurrentProject: () => CanvasProject | null;
}

const STORAGE_KEY = 'canvas-projects';

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProjectId: null,
  loaded: false,

  loadProjects: async () => {
    try {
      const data = await localTool.kvGet(STORAGE_KEY);
      if (data && Array.isArray(data)) {
        set({ projects: data, loaded: true });
        // 恢复上次打开的项目
        const lastId = await localTool.kvGet('canvas-current-project-id');
        if (lastId && typeof lastId === 'string') {
          set({ currentProjectId: lastId });
        }
      } else {
        set({ loaded: true });
      }
    } catch {
      set({ loaded: true });
    }
  },

  createProject: async (name: string) => {
    const project: CanvasProject = {
      id: `proj_${Date.now()}`,
      name,
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((s) => ({
      projects: [project, ...s.projects],
      currentProjectId: project.id,
    }));
    await persistProjects(get().projects);
    await localTool.kvSet('canvas-current-project-id', project.id);
    return project;
  },

  switchProject: (id: string) => {
    set({ currentProjectId: id });
    localTool.kvSet('canvas-current-project-id', id).catch(() => {});
  },

  renameProject: async (id: string, name: string) => {
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === id ? { ...p, name, updatedAt: Date.now() } : p,
      ),
    }));
    await persistProjects(get().projects);
  },

  deleteProject: async (id: string) => {
    const { currentProjectId, projects } = get();
    const remaining = projects.filter((p) => p.id !== id);
    set({
      projects: remaining,
      currentProjectId: currentProjectId === id
        ? (remaining[0]?.id ?? null)
        : currentProjectId,
    });
    await persistProjects(remaining);
  },

  updateProjectData: async (id, data) => {
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === id ? { ...p, ...data, updatedAt: Date.now() } : p,
      ),
    }));
    // 防抖持久化（不每次都写）
    await persistProjects(get().projects);
  },

  getCurrentProject: () => {
    const { projects, currentProjectId } = get();
    return projects.find((p) => p.id === currentProjectId) ?? null;
  },
}));

/** 持久化项目列表到 localTool KV */
async function persistProjects(projects: CanvasProject[]): Promise<void> {
  try {
    await localTool.kvSet(STORAGE_KEY, projects);
  } catch (e) {
    console.warn('[projectStore] 持久化失败:', e);
  }
}
