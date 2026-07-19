/**
 * 3.5 账号 store — 账号列表/Cookie 读写
 */

import { create } from 'zustand';
import { localTool } from '../utils/api';

export interface Account {
  id: string;
  name: string;
  platform: string;
  cookie?: string;
  createdAt: number;
}

interface AccountState {
  accounts: Account[];
  loaded: boolean;

  // Actions
  loadAccounts: () => Promise<void>;
  addAccount: (account: Omit<Account, 'id' | 'createdAt'>) => Promise<void>;
  updateAccount: (id: string, data: Partial<Account>) => Promise<void>;
  removeAccount: (id: string) => Promise<void>;
}

const STORAGE_KEY = 'canvas-accounts';

export const useAccountStore = create<AccountState>((set, get) => ({
  accounts: [],
  loaded: false,

  loadAccounts: async () => {
    try {
      const data = await localTool.kvGet(STORAGE_KEY);
      if (data && Array.isArray(data)) {
        set({ accounts: data, loaded: true });
      } else {
        set({ loaded: true });
      }
    } catch {
      set({ loaded: true });
    }
  },

  addAccount: async (account) => {
    const newAccount: Account = {
      ...account,
      id: `acct_${Date.now()}`,
      createdAt: Date.now(),
    };
    set((s) => ({ accounts: [...s.accounts, newAccount] }));
    await persistAccounts(get().accounts);
  },

  updateAccount: async (id, data) => {
    set((s) => ({
      accounts: s.accounts.map((a) =>
        a.id === id ? { ...a, ...data } : a,
      ),
    }));
    await persistAccounts(get().accounts);
  },

  removeAccount: async (id) => {
    set((s) => ({
      accounts: s.accounts.filter((a) => a.id !== id),
    }));
    await persistAccounts(get().accounts);
  },
}));

async function persistAccounts(accounts: Account[]): Promise<void> {
  try {
    await localTool.kvSet(STORAGE_KEY, accounts);
  } catch (e) {
    console.warn('[accountStore] 持久化失败:', e);
  }
}
