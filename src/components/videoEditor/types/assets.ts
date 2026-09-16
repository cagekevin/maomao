import type { OperationFailure } from './outcome';

export type MediaType = 'image' | 'video' | 'audio';

/**
 * 素材的**持久化形态**（真正落存储的那些字段）。
 *
 * 【为什么定义在本文件（2026-09-15 · TD-22-31）】它原先住在
 * `engine/services/storage/types.ts`，而 `MediaAsset`（类型层）要 `Omit` 它
 * ⇒ **types 层反向 import engine 层**（层位倒置、埋循环依赖隐患）。
 * 它本身**零 engine 依赖**（只用到同层的 `MediaType`）⇒ 移到这里是把层位摆正，
 * 而 `engine/services/storage/types.ts` 改为 re-export，既有消费方零改动。
 * ⚠️ 本文件**不得** import `@/components/videoEditor/engine*`（见同目录 `archLayering` 守卫）。
 */
export interface MediaAssetData {
  id: string;
  name: string;
  type: MediaType;
  size: number;
  lastModified: number;
  width?: number;
  height?: number;
  duration?: number;
  fps?: number;
  /** 视频文件是否含音轨（TD-21-17：贴「带原声视频」🔊 角标用；非视频/未探测到 → undefined）。 */
  hasAudio?: boolean;
  ephemeral?: boolean;
  thumbnailUrl?: string;
  /** T4（docs/134）：素材二进制落 localTool /files/ 后的可访问 URL（替代 OPFS 二进制存储）。 */
  url?: string;
}

export interface MediaAsset extends Omit<MediaAssetData, 'size' | 'lastModified'> {
  file: File;
  url?: string;
  /**
   * 素材落 localTool 后的**持久可访问地址**（`/files/…`）—— **"显示"的唯一输入**（TD-22-52）。
   *
   * 【两条 URL 的分工，勿混用】
   *  - `url`（blob: objectURL，全分辨率，随 `file` 创建/revoke）：**只给渲染引擎**用
   *    （`scene-builder` 喂 `ImageNode`/`VideoNode`，导出成片必须原图质量）。
   *  - `persistentUrl`：**只给缩略图/预览场景**用，且必须经统一出口
   *    `resolveAssetUrl(u, { scope: 'render' })` ⇒ 服务端按需出小图（治网格全分辨率解码）
   *    + 尊重 `thumbnailOn` 开关（此前该开关对剪辑器**完全无感** = 假生效）。
   *  - 未落盘（ephemeral / 上传中 / 后端离线）→ 值为 `undefined`，显示侧回退 `url`（不破图）。
   *
   * 【为什么新增而不是复用 `url`】原先 `MediaAsset.url` **覆盖**了 `MediaAssetData.url` 的语义
   * （持久 `/files/` 地址 → 临时 blob:），**持久地址就此丢失** ⇒ 显示侧只能裸用 blob:
   * 全分辨率解码，且没有第二个可用地址去走服务端出图。
   */
  persistentUrl?: string;
}

/**
 * `MediaManager.addMediaAsset` 结果（判别联合）。
 *
 * 【收口（TD-22-37 · 母体 M1 结果契约缺位）】原返回 `Promise<string>`：**保存失败也返回新 id**，
 * 调用方无法从返回值判成败 —— `use-timeline-drag-drop.ts` 只能靠
 * `getAssets().find(name && url)` **二次探测**确认素材真的在，TTS 路径更直接拿这个 id
 * 去插时间轴 → 产生**指向不存在素材的幽灵片段**。
 *
 * 成功支返回 `asset` 本体：调用方**不再需要**回数组里二次查对象（原二次探测的第二个成因）。
 */
export type AddMediaAssetOutcome =
  { ok: true; id: string; asset: MediaAsset } | OperationFailure<'save-failed'>;

/**
 * `MediaManager.loadProjectMedia` 结果（判别联合）。
 *
 * 【收口（TD-22-43）】原返回 `Promise<void>`：失败只记 logger → 用户看到**静默空面板**
 * （以为"这个工程没素材"）。`superseded` = 本次加载已被更新的加载取代
 * （正常的并发丢弃，**不是错误**，调用方不得据此提示用户）。
 */
export type LoadProjectMediaOutcome = { ok: true } | OperationFailure<'load-failed' | 'superseded'>;
