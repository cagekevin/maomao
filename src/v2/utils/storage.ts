// ============================================================
// 一毛AI画布 - 本地存储工具
// 基于 localforage (IndexedDB)，用于存储大量资源数据
// ============================================================
import localforage from 'localforage';

// 初始化不同的存储实例
const stores = {
  /** 画布状态 */
  canvas: localforage.createInstance({ name: 'yimao', storeName: 'canvas' }),
  /** 资源文件 */
  resources: localforage.createInstance({ name: 'yimao', storeName: 'resources' }),
  /** 临时中转资源 */
  transit: localforage.createInstance({ name: 'yimao', storeName: 'transit' }),
  /** 用户设置 */
  settings: localforage.createInstance({ name: 'yimao', storeName: 'settings' }),
};

/** 存储键名常量 */
export const STORAGE_KEYS = {
  TRANSIT_RESOURCES: 'transitResources',
  CANVAS_STATE: 'canvasState',
  USER_SETTINGS: 'userSettings',
  PROJECTS: 'projects',
  ACCOUNTS: 'accounts',
  MODEL_CONFIG: 'modelConfig',
};

/** 通用存储接口 */
export const storage = {
  async get<T>(key: string, storeName: keyof typeof stores = 'transit'): Promise<T | null> {
    try {
      return await stores[storeName].getItem<T>(key);
    } catch {
      return null;
    }
  },

  async set<T>(key: string, value: T, storeName: keyof typeof stores = 'transit'): Promise<void> {
    try {
      await stores[storeName].setItem(key, value);
    } catch (e) {
      console.error(`Storage set failed [${storeName}:${key}]:`, e);
    }
  },

  async remove(key: string, storeName: keyof typeof stores = 'transit'): Promise<void> {
    try {
      await stores[storeName].removeItem(key);
    } catch {}
  },

  async clear(storeName: keyof typeof stores = 'transit'): Promise<void> {
    try {
      await stores[storeName].clear();
    } catch {}
  },
};

/**
 * 迁移 transitResources 从 chrome.storage.local 到 localforage
 * 当 App 加载时调用，读取 background 存入的临时资源并迁移到 IndexedDB
 */
export async function migrateTransitResources(): Promise<void> {
  try {
    if (chrome.storage?.local) {
      const result = await chrome.storage.local.get(['transitResources']);
      const resources = result.transitResources;
      if (Array.isArray(resources) && resources.length > 0) {
        // 合并到 localforage
        const existing = await storage.get<any[]>(STORAGE_KEYS.TRANSIT_RESOURCES);
        const merged = [...(existing || [])];

        for (const resource of resources) {
          if (!merged.find((r: any) => r.id === resource.id)) {
            merged.push(resource);
          }
        }

        await storage.set(STORAGE_KEYS.TRANSIT_RESOURCES, merged);
        // 清空 chrome.storage.local
        await chrome.storage.local.remove(['transitResources']);
      }
    }
  } catch (e) {
    console.log('Migrate transit resources failed (non-extension env):', e);
  }
}