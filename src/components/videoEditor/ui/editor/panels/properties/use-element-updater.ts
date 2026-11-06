'use client';

import { useCallback } from 'react';
import { useEditor } from '@/components/videoEditor/hooks-cutia/use-editor';

/**
 * 属性面板「单元素字段更新」原语（updateElement 的唯一实现，2026-11-06 收口）。
 *
 * 【语义】把一份 `Partial<Record<string, unknown>>` 更新写给**当前选中元素**，
 * 底层走 `editor.timeline.updateElements`（引擎侧逐条转 UpdateElementCommand，pushHistory
 * 控制是否进撤销栈——预览提交传 false，落定提交传 true，见 use-draft-commit 文件头契约）。
 *
 * 【为什么存在】audio-properties 与 sticker-properties 各抄一份逐字相同的 10 行体；
 * text 面板的同语义体是**多选批量**版（buildBatchUpdates 按 elementRefs 展开），形态不同不属本收口。
 *
 * 【用法】
 * ```tsx
 * const updateElement = useElementUpdater({ trackId, elementId: element.id });
 * // updateElement({ updates: { volume: 0.5 } })            // 默认 pushHistory: true
 * // updateElement({ updates, pushHistory: false })          // 预览提交
 * ```
 */
export function useElementUpdater({ trackId, elementId }: { trackId: string; elementId: string }) {
  const editor = useEditor('timeline');
  return useCallback(
    ({
      updates,
      pushHistory = true,
    }: {
      updates: Partial<Record<string, unknown>>;
      pushHistory?: boolean;
    }) => {
      editor.timeline.updateElements({
        updates: [{ trackId, elementId, updates }],
        pushHistory,
      });
    },
    [editor, trackId, elementId],
  );
}
