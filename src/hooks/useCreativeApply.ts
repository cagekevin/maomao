import { useCallback } from 'react';
// ★ TD-22-68 同款依赖方向（见 useNodeData.ts:6-13）：直连**纯逻辑模块** creativePresets.ts，
//   禁 import `@/components/creative` 域门面（那是 UI 组件 barrel，hooks → UI 属逻辑层依赖 UI 层）。
import { toDictEntry } from '../components/creative/creativePresets.ts';
import type { CreativePreset } from '../components/creative/creativePresets.ts';

/**
 * 创作库预设应用（handleCreativeApply）的唯一实现（TD-04-52 后半段收口，2026-11-06）。
 *
 * 【语义】点一张创作库卡片做两件事：
 *  ① 落提示词胶囊：有 preview 显示缩略图胶囊（kind:'image'），否则文本胶囊（kind:'text'）；
 *  ② 写 `data.creativePresets` 字典（键 = item.id），值经 `toDictEntry` 白名单裁剪
 *     （I4「面板内数据不外泄进快照」，见 creativePresets.ts 文件头）。
 *
 * 【为什么存在】ImageGenerate / TextGenerate / VideoGenerate 三处逐字相同的手抄体
 * （此前 TD-04-52 只收口了 insertMention 本体，本函数体仍是三份）。
 *
 * 【用法】
 * ```
 * const { insertAssetRef, insertMention } = useAssetInsertion();
 * const { addCreativePreset } = useNodeData(id);
 * const handleCreativeApply = useCreativeApply({ insertMention, addCreativePreset });
 * <CreativeLibraryButton onApply={handleCreativeApply} />
 * ```
 *
 * 【为什么不是 useCreativeApply(id) 内部自取依赖】① insertMention 的**引用稳定契约**
 * 归 useAssetInsertion（TD-04-52），自取会产生第二个实例、破坏「同一节点一份 ref」；
 * ② addCreativePreset 归 useNodeData（含字典 GC 契约）。本 hook 只组装、不另立真相。
 *
 * @returns onApply 回调（可直接传 CreativeLibraryButton）。引用稳定性随依赖：
 *          insertMention 恒定 + addCreativePreset 随 [id, setNodes]，memo 语义与手写版一致。
 */
export function useCreativeApply(deps: {
  insertMention: (asset: unknown) => void;
  addCreativePreset: (presetId: string, entry: ReturnType<typeof toDictEntry>) => void;
}) {
  const { insertMention, addCreativePreset } = deps;
  return useCallback(
    (item: CreativePreset) => {
      const hasPreview = !!item.preview;
      insertMention({
        id: item.id,
        label: item.name,
        kind: hasPreview ? 'image' : 'text',
        ...(hasPreview ? { url: item.preview } : {}),
      });
      // 字典写入走 addCreativePreset（useNodeData 的函数式单点合并），**不读闭包里的 data**：
      // 本函数可能被连续调用（连点多张卡），若用闭包快照合并会把上一张刚写入的键覆盖掉
      // → 生成时字典里查不到 → 红日志「预设未命中置空」（竞态防护在 useNodeData 侧）。
      addCreativePreset(item.id, toDictEntry(item));
    },
    [insertMention, addCreativePreset],
  );
}
