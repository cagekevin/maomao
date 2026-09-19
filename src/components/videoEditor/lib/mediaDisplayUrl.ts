import type { MediaAsset } from '@/components/videoEditor/types/assets';
import { videoEditorLogger } from '@/components/videoEditor/lib/videoEditorLogger';

/** `useRenderAssetResolver()` 的返回形态（只取本模块需要的那一维，避免反向依赖 base 的 hook 类型）。 */
export type RenderAssetResolver = (
  url: string,
  extra?: { maxDim?: number; thumbnail?: boolean },
) => string;

/**
 * 素材在「缩略图 / 预览格子」场景下的显示地址 —— **唯一入口**（TD-22-52）。
 *
 * 【为什么需要它】剪辑器此前显示素材一律裸用 `MediaAsset.url`（blob: objectURL = **全分辨率原图**）：
 *  ① 网格里每格都解码全分辨率图 → 拖拽/滚动卡；
 *  ② 设置里的「显示缩略图」开关（`thumbnailOn`）**对剪辑器完全无感** = 假生效；
 *  ③ 素材的持久地址（`/files/…`）**在运行期压根没被保存**（原 `MediaAsset.url` 覆盖了它的语义）
 *     ⇒ 想走服务端出图也没有第二个地址可用。
 *
 * 【判据（本模块就是它的唯一实现）】
 *  - 有 `persistentUrl`（已落盘）→ 过统一 render 出口 `resolve()` ⇒
 *    服务端按需出小图（`/api/files/thumbnail`）+ 开关真生效；
 *  - 无（ephemeral 临时素材 / 上传中 / 后端离线）→ 回退 `url`（blob: 原图）——**不破图**，
 *    且**绝不**把 blob: 交给 render 出口（`buildThumbnailUrl` 对非 `/files/` 输入会原样返回，交过去等于没接）。
 *
 * 【不适用于】渲染引擎（`scene-builder` 喂 `ImageNode`/`VideoNode`）与预览播放器（`preview/index.tsx`）——
 * 那两处需要**全分辨率原图**（导出成片质量 / 播放），继续用 `MediaAsset.url`。
 */
export function mediaDisplayUrl({
  asset,
  resolve,
  maxDim,
}: {
  asset: MediaAsset;
  resolve: RenderAssetResolver;
  maxDim?: number;
}): string {
  if (asset.persistentUrl) {
    return resolve(asset.persistentUrl, maxDim ? { maxDim } : undefined);
  }
  // 【2026-09-17 TD-16-29③】原为 `return asset.url ?? '';`
  // （**回改原文 A7**：本改动第一版注释写"`MediaAsset.url` 类型是 `string`、`?? ''` 永不触发"——
  //   **该断言是错的**，TS 立即报 `string | undefined` 不能赋给 `string`。`url` 确实可为 undefined。）
  // 真实病根不是"`??` 冗余"，而是**把「无地址」静默递给下游成空串**：
  // `<img src="">` 与 CSS `url()` **都不会触发 onError** ⇒ "这里本该有图但出不来"在渲染出口
  // 完全不可见（空白/无背景，零线索）。现改为：**缺失即留痕**，空串只作类型收敛的返回值，
  // 由已收口的消费者显式呈现（`LazyImage` 无地址 → 占位「没有可显示的图片地址」）。
  if (!asset.url) {
    videoEditorLogger.warn('剪辑器', 'mediaDisplayUrl：素材无可用显示地址（不静默）', {
      assetId: asset.id,
      type: asset.type,
    });
    return '';
  }
  return asset.url;
}
