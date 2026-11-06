import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PANEL_CONFIG } from '@/components/videoEditor/constants/editor-constants';

// 【2026-11-06 · V4】删除 PanelSizes.agent / setPanels / resetPanels：
// agent 侧栏未搬入（EditorShell.tsx「agent 侧栏未搬入，useAgentStore 依赖已移除」），
// panels.agent 与 PANEL_CONFIG.panels.agent 零读取；setPanels/resetPanels 零调用。
// migrate 保留旧持久化里的 agent 键不报错（多余键在 partialize 白名单外自动丢弃）。
//
// 【152-V3 · 有意不收编】本 store 的 persist 键 `panel-sizes` **不进 STORAGE_KEYS/备份**
// —— 纯本地面板布局比例，换机重拖即复原，备份收益 ≈ 0。这是**决定**不是遗漏：
// 裁定与「登记假收录」风险说明见 contracts.ts STORAGE_KEYS 的「有意不登记」段
// （若未来承载非布局数据，走完整收口，唯一可抄样本 = keybindings-store）。

export interface PanelSizes {
  tools: number;
  preview: number;
  properties: number;
  mainContent: number;
  timeline: number;
}

export type PanelId = keyof PanelSizes;

interface PanelState {
  panels: PanelSizes;
  setPanel: (panel: PanelId, size: number) => void;
}

export const usePanelStore = create<PanelState>()(
  persist(
    (set) => ({
      ...PANEL_CONFIG,
      setPanel: (panel, size) =>
        set((state) => ({
          panels: {
            ...state.panels,
            [panel]: size,
          },
        })),
    }),
    {
      name: 'panel-sizes',
      version: 2,
      migrate: (persistedState) => {
        const state = persistedState as
          | {
              panels?: Partial<PanelSizes> | null;
              toolsPanel?: number;
              previewPanel?: number;
              propertiesPanel?: number;
              mainContent?: number;
              timeline?: number;
              tools?: number;
              preview?: number;
              properties?: number;
            }
          | undefined
          | null;

        if (!state) return { panels: { ...PANEL_CONFIG.panels } };

        if (state.panels && typeof state.panels === 'object') {
          return {
            panels: {
              ...PANEL_CONFIG.panels,
              ...state.panels,
            },
          };
        }

        return {
          panels: {
            tools: state.tools ?? state.toolsPanel ?? PANEL_CONFIG.panels.tools,
            preview: state.preview ?? state.previewPanel ?? PANEL_CONFIG.panels.preview,
            properties: state.properties ?? state.propertiesPanel ?? PANEL_CONFIG.panels.properties,
            mainContent: state.mainContent ?? PANEL_CONFIG.panels.mainContent,
            timeline: state.timeline ?? PANEL_CONFIG.panels.timeline,
          },
        };
      },
      partialize: (state) => ({
        panels: state.panels,
      }),
    },
  ),
);
