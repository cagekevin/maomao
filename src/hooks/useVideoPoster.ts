import { useState, useEffect } from 'react';
import {
  drawVideoFrame,
  setCrossOriginForReadable,
} from '../components/base/utils/captureFrame.ts';

/**
 * 视频首帧封面 hook。
 *
 * 【为什么抽成 hook】
 * 视频节点未播放时要显示「封面」而非破图。官方用 localTool 生成 _frame1.jpg 首帧图；
 * 原型无后端，改为前端本地抓帧：加载视频 → seek 到首帧 → 画到 canvas → 得 dataURL 作封面。
 * 这是独立能力，抽出来供任何视频节点复用（AssetNode / 未来的视频节点）。
 *
 * 【跨域注意】
 * 对无 CORS 头的跨域视频，canvas.toDataURL 会抛「Tainted canvases」→ 抓帧失败，此时
 * 返回空串，调用方回退到视频图标占位。本地上传的 dataURL 视频无此问题。
 *
 * 更新(2026-09-13)：seek+drawImage 已收口到 `base/utils/captureFrame.ts` 的 `drawVideoFrame`
 * （抽帧唯一原语，见其文件头「同机制清单」）。本 hook 退化为**宿主薄包装**，只保留自己的判据：
 *  - `crossOrigin` 走 `setCrossOriginForReadable` 单点裁决（TD-22-1：同源不设 / 真跨源设 anonymous；
 *    替换本 hook 原有的 `startsWith('http')` 第二判据 —— 它在同源绝对地址下会误设、污染 canvas）；
 *  - `preload='metadata'`（首帧海报要快，不预载整片）；
 *  - 抓帧时刻 `0.05`（部分视频首帧是黑的，微调一帧）；
 *  - 输出 **原尺寸** `toDataURL('image/jpeg', 0.7)`；
 *  - **失败静默回退空串**（跨域污染是浏览器预期限制，不是缺陷 —— 保持原判据，勿改成抛错/提示）；
 *  - 卸载/换源时 `cancelled` 短路 + 清 `src`。
 *
 * @param {string} url 视频 URL
 * @param {boolean} enabled 是否启用（如视频且非播放态时才抓）
 * @returns {string} posterUrl 首帧封面 dataURL；未就绪/失败为空串
 */
export function useVideoPoster(url: string, enabled: boolean) {
  const [posterUrl, setPosterUrl] = useState('');

  useEffect(() => {
    if (!enabled || !url) {
      setPosterUrl('');
      return;
    }
    let cancelled = false;
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.playsInline = true;
    // TD-22-1：crossOrigin 单点裁决（同源不设 / 真跨源设 anonymous）。
    // 旧实现 startsWith('http') 在**生产同源部署**下会把同源 /files/ 绝对地址也设成 anonymous
    // → 走 CORS 模式 → 网关不回 ACAO 时 canvas 被污染 → toDataURL 失败。统一到单点后消除该坑。
    setCrossOriginForReadable(v, url);
    v.src = url;
    v.load();
    drawVideoFrame(v, { atTime: 0.05 })
      .then((canvas) => {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        if (!cancelled && dataUrl) setPosterUrl(dataUrl);
      })
      .catch(() => {
        // catch-ok: BROWSER_API
      });
    return () => {
      cancelled = true;
      v.src = '';
    };
  }, [url, enabled]);

  return posterUrl;
}
