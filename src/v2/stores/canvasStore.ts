/**
 * 3.3 画布状态 store — nodes/edges/viewport
 * 与 React Flow 的 onNodesChange/onEdgesChange/onConnect 绑定
 */

import { create } from 'zustand';
import type { Node, Edge, Viewport } from '@xyflow/react';

interface CanvasState {
  nodes: Node[];
  edges: Edge[];
  viewport: Viewport;

  // React Flow 绑定
  onNodesChange: (changes: unknown) => void;
  onEdgesChange: (changes: unknown) => void;
  onConnect: (connection: Edge) => void;

  // 画布操作
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  setViewport: (viewport: Viewport) => void;
  addNode: (node: Node) => void;
  updateNodeData: (nodeId: string, data: Partial<Node['data']>) => void;
  removeNode: (nodeId: string) => void;
  removeEdge: (edgeId: string) => void;

  // 序列化（过滤函数字段）
  getCanvasSnapshot: () => { nodes: unknown[]; edges: unknown[]; viewport: Viewport };
  loadCanvasSnapshot: (data: { nodes?: unknown[]; edges?: unknown[]; viewport?: Viewport }) => void;
}

/** 过滤掉函数字段，只保留可序列化数据 */
function stripFunctions(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'function') return undefined;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stripFunctions).filter((v) => v !== undefined);
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const stripped = stripFunctions(value);
    if (stripped !== undefined) {
      result[key] = stripped;
    }
  }
  return result;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },

  onNodesChange: (changes: unknown) => {
    // 简化实现：后续对接 React Flow 时替换为 applyNodeChanges
    set((s) => ({ nodes: s.nodes })); // placeholder
  },

  onEdgesChange: (changes: unknown) => {
    set((s) => ({ edges: s.edges })); // placeholder
  },

  onConnect: (connection: Edge) => {
    set((s) => ({
      edges: [...s.edges, { ...connection, id: `edge-${Date.now()}` }],
    }));
  },

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setViewport: (viewport) => set({ viewport }),

  addNode: (node) => set((s) => ({ nodes: [...s.nodes, node] })),

  updateNodeData: (nodeId, data) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n,
      ),
    })),

  removeNode: (nodeId) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== nodeId),
      edges: s.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    })),

  removeEdge: (edgeId) =>
    set((s) => ({
      edges: s.edges.filter((e) => e.id !== edgeId),
    })),

  getCanvasSnapshot: () => {
    const { nodes, edges, viewport } = get();
    return {
      nodes: stripFunctions(nodes) as unknown[],
      edges: stripFunctions(edges) as unknown[],
      viewport,
    };
  },

  loadCanvasSnapshot: (data) => {
    if (data.nodes) set({ nodes: data.nodes as Node[] });
    if (data.edges) set({ edges: data.edges as Edge[] });
    if (data.viewport) set({ viewport: data.viewport });
  },
}));
