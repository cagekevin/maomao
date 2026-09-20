import { useCallback, useRef } from 'react';

/**
 * 富文本素材插入原语：把「素材」交给节点主框 PromptInput 上抛的插入函数。
 *
 * 【为什么存在】此前 4 个节点（TemplateNode / ImageGenerate / TextGenerate / VideoGenerate）
 * 各自抄了一份完全相同的两行实现：
 * ```
 * const insertAssetRef = useRef<((asset: unknown) => void) | null>(null);
 * const insertMention = (asset: unknown) => {
 *   if (typeof insertAssetRef.current === 'function') insertAssetRef.current(asset);
 * };
 * ```
 * 两个问题：
 *  ① **同一能力 4 份实现**（改一处要改四处，必然漂移）；
 *  ② `insertMention` 是**普通函数**（每次渲染新引用）⇒ 它作为 `onInsert` 传给
 *     `memo(ResourceStrip)` ⇒ **浅比较必失败 ⇒ memo 恒失效**（TD-04-52）。
 *
 * 【契约】`insertMention` 引用**永久稳定**（useCallback + 空依赖：只读 ref，不捕获渲染期变量）
 * ⇒ 消费方（`memo(ResourceStrip)` 等）可真正 bail out。**不要**给它加依赖或改成内联箭头。
 *
 * 【用法】
 * ```
 * const { insertAssetRef, insertMention } = useAssetInsertion();
 * // PromptInput 就绪时上抛插入能力
 * onReady={(fn) => { insertAssetRef.current = fn; }}
 * // 素材条 / 创作库预设插入
 * <ResourceStrip onInsert={insertMention} … />
 * ```
 *
 * @returns insertAssetRef（承接上抛的插入函数）+ insertMention（引用稳定的转发器）
 */
export function useAssetInsertion() {
  const insertAssetRef = useRef<((asset: unknown) => void) | null>(null);

  // 空依赖是**契约的一部分**：只读 ref.current，不捕获任何渲染期变量 ⇒ 引用永久稳定。
  const insertMention = useCallback((asset: unknown) => {
    if (typeof insertAssetRef.current === 'function') insertAssetRef.current(asset);
  }, []);

  return { insertAssetRef, insertMention };
}
