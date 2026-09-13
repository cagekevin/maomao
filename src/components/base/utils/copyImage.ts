import { loadImageWithTimeout } from './asyncGuard.ts';
import { toastWarning, toastError } from '../core/toastStore.ts';

/**
 * 复制图片到剪贴板（供各节点「复制图片」按钮统一调用）。
 * 优先以 image/png 写入（画布转 blob），失败（跨域/权限/浏览器不支持）退化为复制图片链接文本。
 * 复制后由用户自行 Ctrl+V 粘贴到画布。
 */
export async function copyImageToClipboard(url: string): Promise<void> {
  try {
    const img = await loadImageWithTimeout(url);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas ctx');
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
    if (!blob) throw new Error('blob null');
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  } catch {
    try {
      await navigator.clipboard.writeText(url);
      toastWarning('图片链接已复制（直接复制图片失败）');
    } catch {
      toastError('复制失败，可能因跨域或权限限制');
    }
  }
}
