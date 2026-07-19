/**
 * 3.7 UI store — activeTab/settingsTab/toasts/modals/loading
 * TabId / SettingsTab 对齐原版 App.js
 */

import { create } from 'zustand';

export type TabId = 'canvas' | 'transit' | 'accounts' | 'settings' | 'appcenter';
export type SettingsTab = 'builtin' | 'models' | 'basic' | 'data' | 'upgrade' | 'endpoint';

export interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  duration?: number;
}

interface UIState {
  // Tab 状态
  activeTab: TabId;
  settingsTab: SettingsTab;
  setActiveTab: (tab: TabId) => void;
  setSettingsTab: (tab: SettingsTab) => void;

  // Toast
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  showToastMessage: (message: string) => void;

  // Modal
  activeModal: string | null;
  modalData: unknown;
  openModal: (modal: string, data?: unknown) => void;
  closeModal: () => void;

  // Loading
  globalLoading: boolean;
  setGlobalLoading: (loading: boolean) => void;

  // 侧边栏
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  // 任务中心弹窗
  showTaskCenter: boolean;
  setShowTaskCenter: (show: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeTab: 'canvas',
  settingsTab: 'builtin',
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSettingsTab: (tab) => set({ settingsTab: tab }),

  toasts: [],
  addToast: (toast) => {
    const id = `toast_${Date.now()}`;
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    // 自动移除
    const duration = toast.duration ?? 3000;
    if (duration > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, duration);
    }
  },
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  showToastMessage: (message) => {
    const id = `toast_${Date.now()}`;
    set((s) => ({ toasts: [...s.toasts, { id, message, type: 'info' }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3000);
  },

  activeModal: null,
  modalData: null,
  openModal: (modal, data) => set({ activeModal: modal, modalData: data }),
  closeModal: () => set({ activeModal: null, modalData: null }),

  globalLoading: false,
  setGlobalLoading: (loading) => set({ globalLoading: loading }),

  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  showTaskCenter: false,
  setShowTaskCenter: (show) => set({ showTaskCenter: show }),
}));