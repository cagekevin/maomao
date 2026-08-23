// generationCanvasStore 临时 stub：Nomi 画布 store。
// 当前只用 nodes（找 take 节点）。给空数组，功能后续接真实宿主。
import { create } from 'zustand'

type GenerationCanvasStoreState = {
  nodes: Array<{ id: string; meta?: Record<string, unknown> }>
}

export const useGenerationCanvasStore = create<GenerationCanvasStoreState>(() => ({
  nodes: [],
}))
