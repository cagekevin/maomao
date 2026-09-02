/**
 * core/host-types — 宿主状态的最小类型（画布节点 / 项目资产）。
 *
 * 原项目里这些类型来自 App 的画布/资产体系。kit 不引入画布概念，
 * 只保留生成代码真正读到的字段，作为宿主注入的最小形状。
 */

/** 画布节点数据（kit 不提供实现，仅保留类型占位）。 */
export interface BaseNodeData {
  id?: string;
  label?: string;
  status?: string;
  displayId?: number;
  prompt?: string;
  model?: string;
  /** 参考媒体（图/视频/音频），供厂商适配器读取首尾帧角色。 */
  videoReferences?: Array<{ id?: string; url?: string; role?: string; kind?: string }>;
  imageUrls?: string[];
  videoUrls?: string[];
  audioUrls?: string[];
  /** 本地文件路径与远端原始 URL。 */
  filePath?: string;
  sourceUrl?: string;
  [key: string]: unknown;
}

/** 项目资产（角色/场景/道具）。 */
export interface DramaAsset {
  id: string;
  name: string;
  kind?: 'character' | 'scene' | 'prop' | string;
  type?: string;
  url?: string;
  referenceImages?: string[];
  [key: string]: unknown;
}
