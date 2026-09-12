import { useState, useRef, useCallback } from 'react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { toastError } from '../core/toastStore.ts';
import { loadImageWithTimeout } from '../utils/asyncGuard.ts';
import { compressImage } from '../utils/imageCompress.ts';

/**
 * 就地裁剪浮层（极简，只做裁剪）。
 *
 * 要求（来自需求）：
 *  1. 无菜单、无顶部按钮栏——只有图片 + 「取消 / 裁剪」两个按钮，按钮浮在节点下方居中。
 *  2. 默认按图片原始尺寸铺满：选区初始 = 整图（100%），ReactCrop 按图片比例铺满节点图片区；
 *     保存时换算回原始像素，不缩放失真。
 *  3. 选完选区后，点「裁剪」按钮确认保存写回。
 *
 * 【坐标精确的关键】图片用 object-contain 撑满容器（这样 ReactCrop 盒子 = 容器，选区手柄
 * 能拖到最边边，不留白）。object-contain 会让 img 元素盒子含四周留白（letterbox），因此
 * ReactCrop 的 % 坐标是相对「盒子」而非「可见图」——保存时需先用渲染 <img> 的自然/客户尺寸
 * 算 containScale 与 offsetX/offsetY 留白偏移，把 % 换算到可见图内容框、再映射回原图像素，
 * 否则会裁到留白或"右边多出一截"。
 *
 * 【绘制源与输出格式（TASK 治理：三处根源 bug 一次修净）】
 *  - 绘制源不再手动 cleanImgRef 加载，统一走 compressImage(url, { keepOriginalFormat: true })
 *    拿「原尺寸 + 同源 dataURL + 原图格式」，再 loadImageWithTimeout(dataUrl) 得到 100% 干净
 *    Image（dataURL 天然同源，canvas 永不污染）→ 杜绝跨域 SecurityError 静默崩溃。
 *  - 输出格式跟随原图：PNG/WebP 等带透明 → 输出 PNG（不丢透明、不变黑底）；JPEG → 白底填充。
 *    不再写死 image/jpeg 0.9（那是透明图变黑底的根源）。
 *  - 跨域/加载失败 → compressImage 抛明确错误，toast 透传真实原因，不静默吞错。
 *
 * 挂载：由调用方放在「节点主框」层级（ImageGenerate / AssetNode 里与图片区同级、位于
 * NodeShell 的 mainShellClassName 这个 `relative` 容器内）。本组件 `absolute inset-0`
 * 覆盖整个节点内容区，按钮栏 `top-full` 以「主框底边 = 节点底边」为基准浮到节点正下方。
 * ⚠️ 不要把它挂在「图片区 relative 子容器」里：那样 inset-0 / top-full 会以图片区为基准，
 * 一旦图片区高度≠整节点，遮罩只盖住节点一部分、按钮栏会压到节点上（即「和节点重叠」）。
 * 【溢出约束】按钮栏用 `top-full` 浮到节点外，因此**父级链（含节点主容器）
 * 不可加 overflow-hidden**。NodeShell 主容器已明确不加 overflow-hidden（见其注释），
 * 各节点挂载点的直接父容器（mainShellClassName）也均无 overflow-hidden——
 * overflow-hidden 只出现在更内层的兄弟 div 上，不影响本组件溢出。
 *
 * @param {Object} props
 * @param {string} props.assetUrl 要裁剪的图片 URL
 * @param {Function} props.onSave  保存回调，入参 { dataUrl }
 * @param {Function} props.onClose 关闭回调
 */

/** 就地裁剪浮层 Props。 */
interface InlineImageCropperProps {
  /** 要裁剪的图片 URL */
  assetUrl: string;
  /** 保存回调，入参 { dataUrl } */
  onSave?: (payload: { dataUrl: string }) => void;
  /** 关闭回调 */
  onClose?: () => void;
}

/**
 * 把 ReactCrop 的「百分比选区」换算成原图像素裁剪矩形（**纯函数，唯一实现**）。
 *
 * 【为什么必须做 contain 校正】ReactCrop 的 % 坐标相对「img 元素盒子」，而图片用
 * object-contain 撑满盒子 → 盒子含四周留白（letterbox），% 不是相对可见图。故先用
 * contain 比例算出「可见图内容框」与留白偏移，再把 % 换算到内容框内像素、最后映射自然像素；
 * 否则会裁到留白或「右边多出一截」。
 *
 * 组件 handleSave 与本文件单测**共用本函数**（此前组件内联一份、另导出 `cropRectFromSelection`
 * 一份且口径不同 → 双实现、测试锁住的还不是生产路径，见区域 06 TD-06-3）。
 *
 * @param percentCrop ReactCrop 的 PercentCrop（% 相对盒子）
 * @param boxW/boxH 渲染盒子尺寸（= 渲染 <img> 的 clientWidth/Height）
 * @param natW/natH 原图自然尺寸
 * @returns {{sx,sy,sw,sh}} 已收敛到自然像素边界；选区/尺寸无效返回 null
 */
export function cropRectFromPercent({
  percentCrop,
  boxW,
  boxH,
  natW,
  natH,
}: {
  percentCrop: { x: number; y: number; width: number; height: number };
  boxW: number;
  boxH: number;
  natW: number;
  natH: number;
}): { sx: number; sy: number; sw: number; sh: number } | null {
  const c = percentCrop;
  if (!c || !c.width || !c.height || !boxW || !boxH || !natW || !natH) return null;
  const containScale = Math.min(boxW / natW, boxH / natH);
  const contentW = natW * containScale;
  const contentH = natH * containScale;
  const offsetX = (boxW - contentW) / 2; // 左右留白宽
  const offsetY = (boxH - contentH) / 2; // 上下留白高
  // %（相对盒子）→ 内容框内像素 → 自然像素。
  // 位置要减留白 offset；尺寸【不能】减 offset（留白是两侧对称的位移，不改变可见图内的长度）。
  const toNatPos = (pct: number, box: number, content: number, offset: number, nat: number) =>
    Math.round((((pct / 100) * box - offset) / content) * nat);
  const toNatSize = (pct: number, box: number, content: number, nat: number) =>
    Math.round((((pct / 100) * box) / content) * nat);
  const sx = Math.max(0, toNatPos(c.x, boxW, contentW, offsetX, natW));
  const sy = Math.max(0, toNatPos(c.y, boxH, contentH, offsetY, natH));
  const sw = Math.max(1, Math.min(natW - sx, toNatSize(c.width, boxW, contentW, natW)));
  const sh = Math.max(1, Math.min(natH - sy, toNatSize(c.height, boxH, contentH, natH)));
  return { sx, sy, sw, sh };
}

export default function InlineImageCropper({ assetUrl, onSave, onClose }: InlineImageCropperProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState(undefined);
  // 百分比选区：保存用它（相对图片本身，布局无关，最稳）；onChange 第二个参数即 PercentCrop
  const [percentCrop, setPercentCrop] = useState(undefined);

  // 图片加载 → 默认整图选区（100%），即初始尺寸 = 图片尺寸
  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    imgRef.current = e.currentTarget;
    const full = { unit: '%', x: 0, y: 0, width: 100, height: 100 };
    setCrop(full);
    setPercentCrop(full);
  }, []);

  // 确认裁剪：把选区换算成原图像素 → 用干净绘制源 canvas 裁切 → 回传 dataURL。
  // 绘制源统一走 compressImage（keepOriginalFormat）拿「原尺寸 + 同源 dataURL + 原图格式」，
  // 不手动 new Image / 不回退渲染 <img>，从根上避免跨域污染与绘制源不一致。
  const handleSave = useCallback(async () => {
    if (!percentCrop || !percentCrop.width || !percentCrop.height) {
      onClose?.();
      return;
    }
    try {
      // 1) 干净原图 + 原图格式（compressImage 内部已补 /files/ 相对路径、带超时、
      //    keepOriginalFormat 推断 MIME：透明图回退 PNG、JPEG 白底填充、跨域抛明确错误）
      const clean = await compressImage(assetUrl, { keepOriginalFormat: true });
      // 2) 同源 dataURL 再加载成绘制源（100% 干净，canvas 永不污染）
      const drawImg = await loadImageWithTimeout(clean.dataUrl);
      // 2.5) ReactCrop 的 % 相对「img 元素盒子」（含 object-contain 留白）→ 统一经唯一纯函数
      //      cropRectFromPercent 换算到可见图内容框、再映射自然像素（同一实现，勿再内联）。
      //      盒子尺寸取渲染 <img>（imgRef.current，=容器）的 clientWidth/Height。
      const renderImg = imgRef.current;
      const rect = cropRectFromPercent({
        percentCrop,
        boxW: renderImg?.clientWidth || drawImg.naturalWidth,
        boxH: renderImg?.clientHeight || drawImg.naturalHeight,
        natW: drawImg.naturalWidth,
        natH: drawImg.naturalHeight,
      });
      if (!rect) {
        onClose?.();
        return;
      }
      const { sx, sy, sw, sh } = rect;
      // 3) 按选区裁切；输出格式跟随原图（从 dataURL header 推断），透明图不转 JPEG 变黑底
      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        toastError('裁剪失败：无法创建画布');
        return;
      }
      ctx.drawImage(drawImg, sx, sy, sw, sh, 0, 0, sw, sh);
      const m = /^data:([^;,]+)/.exec(clean.dataUrl);
      const outFormat = m && m[1] === 'image/jpeg' ? 'image/jpeg' : 'image/png';
      onSave?.({ dataUrl: canvas.toDataURL(outFormat, 0.9) });
      onClose?.();
    } catch (e) {
      toastError(`裁剪保存失败：${e?.message || '图片加载失败'}`);
    }
  }, [assetUrl, percentCrop, onSave, onClose]);

  return (
    // 外层遮罩不再用 flex flex-col 分栏：图片区独占整个节点，按钮栏浮到节点外下方。
    <div className="absolute inset-0 z-50 bg-black/70 nodrag">
      {/* 图片区：ReactCrop 撑满容器、图片 object-contain 完整显示。
          关键：必须让 ReactCrop 盒子 = 容器（无留白），选区手柄才能拖到最边边。
          原实现 flex 居中 + p-2 使图片盒子 < 容器，选区到图片边缘即停，四周留白处拖不到。
          absolute inset-0（原 flex-1）：图片区占满整个节点，不再被按钮栏压掉一块高度。 */}
      <div className="absolute inset-0">
        <ReactCrop
          crop={crop}
          onChange={(_, pc) => {
            setCrop(pc);
            setPercentCrop(pc);
          }}
          className="w-full h-full"
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          <img
            src={assetUrl}
            alt="裁剪预览"
            onLoad={onImageLoad}
            className="block w-full h-full object-contain select-none"
            draggable={false}
          />
        </ReactCrop>
      </div>

      {/* 取消 / 裁剪：absolute top-full 浮到节点下方居中，不再占据节点内高度。
          胶囊容器沿用 HoverToolbar 同一套（bg-surface-raised/90 backdrop-blur-md
          border border-edge rounded-full shadow-lg），按钮尺寸/配色对齐节点内 ToolbarButton。
          【依赖】父级链不可加 overflow-hidden，否则节点外按钮栏会被裁掉——
          NodeShell 主容器注释明确「不加 overflow-hidden」，正是为了让 HoverToolbar
          这类 top-full / -top-12 的节点外元素能溢出显示。 */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 flex items-center gap-1 px-3 py-2 bg-surface-raised/90 backdrop-blur-md border border-edge rounded-full shadow-lg">
        <button
          type="button"
          onClick={onClose}
          className="px-2.5 py-1 rounded-md text-caption-sm text-secondary hover:text-primary hover:bg-surface-hover transition-colors"
        >
          取消
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="px-2.5 py-1 rounded-md text-caption-sm text-primary bg-surface-hover-strong hover:bg-surface-hover-strong/80 font-medium transition-colors"
        >
          裁剪
        </button>
      </div>
    </div>
  );
}
