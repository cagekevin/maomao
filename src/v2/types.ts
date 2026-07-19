// ============================================================
// 一毛AI画布 - 类型定义
// ============================================================

import type { Node, Edge } from '@xyflow/react';

// ====== 节点数据 ======

/** 节点 data 负载 */
export interface NodeData {
  prompt?: string;
  output?: string;
  selectedModel?: string;
  aspectRatio?: string;
  imageSize?: string;
  imageUrl?: string;
  videoUrl?: string;
  resultUrl?: string;
  thumbnailUrl?: string;
  status?: 'idle' | 'running' | 'completed' | 'failed';
  errorMsg?: string;
  progress?: number;
  taskId?: string;
  // 节点布局属性
  label?: string;
  collapsed?: boolean;
  url?: string;
  // 裁剪节点
  crop?: { x: number; y: number; width: number; height: number };
  // 万能节点
  customApi?: { url: string; method: string; headers: Record<string, string>; body: string };
  // 网格分割
  rows?: number;
  cols?: number;
  // 视频提取
  trim?: { start: number; end: number };
  // 回调（由引擎注入）
  onShowToast?: (msg: string) => void;
  [key: string]: unknown;
}

/** 应用级节点 */
export type AppNode = Node<NodeData>;

/** 画布项目 */
export interface CanvasProject {
  id: string;
  name: string;
  timestamp: number;
  nodes: AppNode[];
  edges: Edge[];
  viewport?: { x: number; y: number; zoom: number };
}

// ====== 预设提示词 ======

export interface PresetPrompt {
  id: string;
  title: string;
  prompt: string;
  category: 'drawing' | 'video' | 'text' | 'general';
}

// ====== Toast 通知 ======

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

// ====== 资源 ======

export interface TransitResource {
  id: string;
  url: string;
  type: string;
  name?: string;
  timestamp: number;
  pageUrl?: string;
  pageTitle?: string;
  source?: string;
  folder?: string;
  isFavorite?: boolean;
}

// ====== API 配置 ======

export interface ApiConfig {
  id: string;
  label: string;
  url: string;
  key?: string;
  readonly?: boolean;
  showKey?: boolean;
}

// ====== 账号 ======

export interface AccountCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  expirationDate?: number;
  sameSite?: string;
  storeId?: string;
}

export interface Account {
  id: string;
  name: string;
  siteName: string;
  siteUrl: string;
  avatar?: string;
  cookies: AccountCookie[];
}

// ====== 任务 ======

export interface GlobalTask {
  id: string;
  nodeId?: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  resultUrl?: string;
  thumbnailUrl?: string;
  customResultData?: string;
  customOutputType?: string;
  errorMsg?: string;
  createdAt?: number;
  progress?: number;
}

// ====== 会员 ======

export interface Membership {
  type: 'FREE' | 'PREMIUM' | 'UNLIMITED';
  expiry: number;
  code?: string;
}

// ====== 存储键 ======

export const STORAGE_KEYS = {
  TRANSIT_RESOURCES: 'transitResources',
  PROJECTS: 'projects',
  USERS: 'users',
  MEMBERSHIP: 'membership',
  APP_SETTINGS: 'app_settings',
  API_CONFIGS: 'api_configs',
  PRESET_PROMPTS: 'presetPrompts',
  CUSTOM_NODE_TEMPLATES: 'customNodeTemplates',
  CLOUD_STORAGE_CONFIG: 'cloud_storage_config',
  GLOBAL_TASKS: 'globalTasks',
  LAST_OPENED_PROJECT: 'lastOpenedProject',
} as const;