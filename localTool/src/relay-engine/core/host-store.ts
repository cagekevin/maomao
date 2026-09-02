/**
 * ai/_store — 原 AI 层对宿主状态的访问适配。
 *
 * 原实现直接读 App 的 Zustand store，用到的东西分两类：
 *
 * 1. **连接配置**（`config.providers[...]`）—— API 中转真正需要的，由宿主通过
 *    `setStoreSource` 注入，是 kit 的核心数据来源。
 * 2. **画布 / 项目 / UI**（`nodes`、`edges`、`workflows`、`showToast`、
 *    `updateNodeDataTransient`、`activeRequestAbort`）—— 属于 App 业务，
 *    kit 不提供，这里给安全空实现，让这些分支在 kit 里安静地不生效。
 *
 * 这样原文件的业务代码一行都不用改，只需要把
 * `import { useAppStore } from '../../store/useAppStore'` 指向本文件。
 */
import type { ApiProviderConfig, GeneralModelConfig } from '../types/connection';
import type { BaseNodeData, DramaAsset } from './host-types';

export interface RelayStoreConfig {
  providers: Record<string, ApiProviderConfig>;
  generalModels?: GeneralModelConfig[];
  assistantModelId?: string;
  webSearchProviderId?: string;
  comfyUIUrl?: string;
  dreaminaAuth?: { loggedIn?: boolean };
}

/** 画布节点的最小形状（与 ai 层代码期望一致；data 非可选）。 */
export interface RelayNode {
  id: string;
  type?: string;
  data: BaseNodeData;
  [key: string]: unknown;
}

/** 宿主可注入的最小状态切片。 */
export interface RelayStoreState {
  config: RelayStoreConfig;
  currentProjectId?: string | null;
  /** 画布节点；kit 场景下一般为空。 */
  nodes: RelayNode[];
  /** 项目资产（角色/场景/道具）；kit 场景下为空。 */
  dramaAssets: DramaAsset[];
  /** 画布连线：source/target 为节点 ID；kit 场景下为空。 */
  edges: Array<{ source: string; target: string; [key: string]: unknown }>;
  workflows: unknown[];
  projects: unknown[];
  activeRequestAbort: AbortController | null;
  setActiveRequestAbort: (controller: AbortController | null) => void;
  showToast: (message: string, tone?: string) => void;
  updateNodeDataTransient: (nodeId: string, patch: Record<string, unknown>) => void;
}

const emptyState: RelayStoreState = {
  config: { providers: {} },
  currentProjectId: null,
  nodes: [],
  dramaAssets: [],
  edges: [],
  workflows: [],
  projects: [],
  activeRequestAbort: null,
  setActiveRequestAbort: () => {},
  showToast: () => {},
  updateNodeDataTransient: () => {},
};

let source: () => Partial<RelayStoreState> = () => ({});

/**
 * 注入连接配置等宿主状态。
 * 至少要给 `config.providers`，否则所有生成入口都拿不到 apiKey / baseUrl。
 */
export function setStoreSource(provider: () => Partial<RelayStoreState>): void {
  source = provider;
}

/** 取一份合并后的状态：宿主给的覆盖在默认空实现之上。 */
export function getStoreState(): RelayStoreState {
  return { ...emptyState, ...source() };
}

/** 与原 `useAppStore` 同形的门面，只提供原 AI 层用到的成员。 */
export const useAppStore = {
  getState: getStoreState,
  setState: (partial: Partial<RelayStoreState>) => {
    // kit 不做状态回写；宿主需要感知变更时请在注入的 source 里自行处理
    void partial;
  },
  subscribe: () => () => {},
};

/** 原 `store/useAppStore` 顺带导出的 ID 生成器。 */
export function generateId(prefix = 'id'): string {
  const random = globalThis.crypto?.randomUUID?.().replace(/-/g, '').slice(0, 10)
    ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}-${random}`;
}
