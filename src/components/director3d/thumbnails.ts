// 镜头缩略图绘制逻辑 —— 纯函数模块（不依赖 React），供 App.jsx 收敛调用。
// 设计意图：把「画布内容 → 240×135 JPEG 缩略图」的绘制逻辑与 React / 组件解耦，
//   由调用方注入画布源（source）——monitor / 截图等使用方各自从 ref 取 current 后传入。
// 本模块为纯同步逻辑，可直接单测（构造 ImageData / canvas mock 验证输出）。

/**
 * 从任意 Canvas / ImageSource 生成 240×135 JPEG 缩略图 dataURL。
 * 无效源（无 width/height）或绘制失败均返回 ''（调用方按原样保留缩略图）。
 * @param {HTMLCanvasElement|ImageData} source 画布源
 * @returns {string} 缩略图 dataURL；无效时 ''
 */
export function thumbnailFromCanvas(source: HTMLCanvasElement) {
  if (!source?.width || !source?.height) return '';
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 135;
    const context = canvas.getContext('2d');
    context.fillStyle = '#11110f';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(canvas.width / source.width, canvas.height / source.height);
    const width = source.width * scale;
    const height = source.height * scale;
    context.drawImage(
      source,
      (canvas.width - width) / 2,
      (canvas.height - height) / 2,
      width,
      height,
    );
    return canvas.toDataURL('image/jpeg', 0.74);
  } catch {
    return '';
  }
}
