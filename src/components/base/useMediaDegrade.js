import { useMemo } from 'react'
import { useLod } from './useLod.js'

/**
 * 性能模式媒体降级 hook（复刻官方横幅"图片视频已隐藏"）。
 *
 * 【为什么抽成 hook】
 * ImageNode / DiscountVideoNode / PromptNode 都要在缩小时隐藏重型媒体，逻辑相同：
 *  - lodLevel>=2（缩到 ≤0.3）→ 隐藏图片内容
 *  - lodLevel>=3（缩到 ≤0.2）→ 连视频/音频也隐藏
 * 统一收敛，新增节点要响应性能降级时直接用它，别各自写字符串判断。
 *
 * 【返回说明】
 * - hideMedia：字符串 'image' / 'image video audio' / ''，用 includes 判断某类型是否隐藏
 * - isHidden(type)：便捷函数 hideMedia.includes(type)
 *
 * 接真系统：官方是「用缩略图替换原图」（useThumbnail）而非完全隐藏。接 localTool 缩略图
 * 服务后，可把「隐藏占位」改成「换 thumbnailUrl」，本 hook 只负责算降级级别，无需改。
 */
export function useMediaDegrade() {
  const { lodLevel = 0 } = useLod()
  const hideMedia = useMemo(
    () => (lodLevel >= 3 ? 'image video audio' : lodLevel >= 2 ? 'image' : ''),
    [lodLevel]
  )
  const isHidden = (type) => hideMedia.includes(type)
  return { lodLevel, hideMedia, isHidden }
}
