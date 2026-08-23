// toast 临时 stub：Nomi 的 toast(message, type) + useToastStore。
// 这里用 console 代替，之后可接你项目的 toastStore/ToastContainer。
import { create } from 'zustand'

type ToastEntry = {
  id: string
  message: string
  type?: 'info' | 'success' | 'warning' | 'error'
  actionLabel?: string
  action?: () => void
  onAction?: () => void
  duration?: number
}

type ToastStoreState = {
  toasts: ToastEntry[]
  push: (entry: Omit<ToastEntry, 'id'>) => void
}

export const useToastStore = create<ToastStoreState>((set) => ({
  toasts: [],
  push: (entry) => {
    const id = `toast-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    set((s) => ({ toasts: [...s.toasts, { ...entry, id }] }))
    if (typeof console !== 'undefined') console.log(`[toast] ${entry.message}`)
  },
}))

export function toast(message: string, type?: 'info' | 'success' | 'warning' | 'error'): void {
  useToastStore.getState().push({ message, type })
  if (typeof console !== 'undefined') console.log(`[toast] ${message}`)
}
