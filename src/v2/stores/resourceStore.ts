/**
 * 3.4 资源 store — 资源列表/收藏/筛选/分页
 */

import { create } from 'zustand';
import { localTool } from '../utils/api';

export interface TransitResource {
  id: string;
  url: string;
  type: string; // image | video | audio | text
  source?: string;
  folder?: string;
  name?: string;
  pageUrl?: string;
  pageTitle?: string;
  isFavorite: boolean;
  timestamp: number;
}

interface ResourceState {
  resources: TransitResource[];
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  search: string;
  filterType?: string;

  // Actions
  loadResources: () => Promise<void>;
  addResource: (resource: Omit<TransitResource, 'id' | 'timestamp'>) => Promise<void>;
  removeResource: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  setPage: (page: number) => void;
  setSearch: (search: string) => void;
  setFilterType: (type?: string) => void;
  clearResources: (folder?: string) => Promise<void>;
}

export const useResourceStore = create<ResourceState>((set, get) => ({
  resources: [],
  loading: false,
  total: 0,
  page: 1,
  pageSize: 20,
  search: '',
  filterType: undefined,

  loadResources: async () => {
    set({ loading: true });
    try {
      const params: Record<string, unknown> = {
        page: get().page,
        pageSize: get().pageSize,
      };
      if (get().search) params.search = get().search;
      if (get().filterType) params.filters = { type: get().filterType };

      const result = await localTool.getResources(params as Parameters<typeof localTool.getResources>[0]);
      set({
        resources: result.items as TransitResource[],
        total: result.total,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  addResource: async (resource) => {
    const newResource: TransitResource = {
      ...resource,
      id: `res_${Date.now()}`,
      timestamp: Date.now(),
    };
    set((s) => ({
      resources: [newResource, ...s.resources],
      total: s.total + 1,
    }));
    try {
      await localTool.saveResource(newResource as unknown as Record<string, unknown>);
    } catch (e) {
      console.warn('[resourceStore] 保存失败:', e);
    }
  },

  removeResource: async (id) => {
    set((s) => ({
      resources: s.resources.filter((r) => r.id !== id),
      total: s.total - 1,
    }));
    try {
      await localTool.deleteResource(id);
    } catch (e) {
      console.warn('[resourceStore] 删除失败:', e);
    }
  },

  toggleFavorite: async (id) => {
    const resource = get().resources.find((r) => r.id === id);
    if (!resource) return;

    set((s) => ({
      resources: s.resources.map((r) =>
        r.id === id ? { ...r, isFavorite: !r.isFavorite } : r,
      ),
    }));
    try {
      await localTool.saveResource({ ...resource, isFavorite: !resource.isFavorite } as unknown as Record<string, unknown>);
    } catch (e) {
      console.warn('[resourceStore] 收藏切换失败:', e);
    }
  },

  setPage: (page) => {
    set({ page });
    get().loadResources();
  },

  setSearch: (search) => {
    set({ search, page: 1 });
    get().loadResources();
  },

  setFilterType: (type) => {
    set({ filterType: type, page: 1 });
    get().loadResources();
  },

  clearResources: async (folder) => {
    try {
      await localTool.clearResources(folder ? { folder } : undefined);
      set({ resources: [], total: 0, page: 1 });
    } catch (e) {
      console.warn('[resourceStore] 清空失败:', e);
    }
  },
}));
