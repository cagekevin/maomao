import React, { useState, useRef, useCallback } from 'react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { toastError } from '../core/toastStore.ts';
import { loadImageWithTimeout } from '../utils/asyncGuard.ts';
import { compressImage } from '../utils/imageCompress.ts';

/**
 * 就地裁剪浮层（极简，只做裁剪）。
 *
 * 要求（来自需求）：
 *  1. 无菜单、无顶部按钮栏——只有图片 + 底部「取消 / 裁剪」两个按钮。
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
 * 挂载：由调用方放在图片区 `relative` 容器内，本组件 `absolute inset-0` 覆盖。
 *
 * @param {Object} props
 * @param {string} props.imageUrl 要裁剪的图片 URL
 * @param {Function} props.onSave  保存回调，入参 { dataUrl }
 * @param {Function} props.onClose 关闭回调
 */

/** 就地裁剪浮层 Props。 */
interface InlineImageCropperProps {
  /** 要裁剪的图片 URL */
  imageUrl: string;
  /** 保存回调，入参 { dataUrl } */
  onSave?: (payload: { dataUrl: string }) => void;
  /** 关闭回调 */
  onClose?: () => void;
}

/**
 * 把 ReactCrop 的选区换算成原图像素上的裁剪矩形。
 *
 * 【两种单位，两种映射】
 *  - unit === '%'：百分比是「图片本身的占比」，与盒子渲染/缩放完全无关 → 直接映射原图像素
 *    （sx=x/100×natW）。这是最稳的，避免不同宽高比在节点盒子里缩放不一致导致的「右边多出一截」。
 *  - unit === 'px'：像素坐标是「渲染盒上的像素」，需按 natural/render 换算（兜底）。
 *
 * @param {Object} sel     { x, y, width, height, unit }
 * @param {number} renderW 渲染盒子宽（仅 px 分支用）
 * @param {number} renderH 渲染盒子高（仅 px 分支用）
 * @param {number} natW    原图宽
 * @param {number} natH    原图高
 * @returns {{sx:number,sy:number,sw:number,sh:number} | null}
 */
export function cropRectFromSelection({ sel, renderW, renderH, natW, natH }) {
  if (!sel || !sel.width || !sel.height) return null;
  let sx, sy, sw, sh;
  if (sel.unit === '%') {
    sx = Math.max(0, Math.round((sel.x / 100) * natW));
    sy = Math.max(0, Math.round((sel.y / 100) * natH));
    sw = Math.max(1, Math.min(natW - sx, Math.round((sel.width / 100) * natW)));
    sh = Math.max(1, Math.min(natH - sy, Math.round((sel.height / 100) * natH)));
  } else {
    const iw = renderW || natW || 1;
    const ih = renderH || natH || 1;
    const scaleX = natW / iw;
    const scaleY = natH / ih;
    sx = Math.max(0, Math.round(sel.x * scaleX));
    sy = Math.max(0, Math.round(sel.y * scaleY));
    sw = Math.max(1, Math.min(natW - sx, Math.round(sel.width * scaleX)));
    sh = Math.max(1, Math.min(natH - sy, Math.round(sel.height * scaleY)));
  }
  return { sx, sy, sw, sh };
}

export default function InlineImageCropper({ imageUrl, onSave, onClose }: InlineImageCropperProps) {
  const imgRef = useRef(null);
  const [crop, setCrop] = useState(undefined);
  // 百分比选区：保存用它（相对图片本身，布局无关，最稳）；onChange 第二个参数即 PercentCrop
  const [percentCrop, setPercentCrop] = useState(undefined);

  // 图片加载 → 默认整图选区（100%），即初始尺寸 = 图片尺寸
  const onImageLoad = useCallback((e) => {
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
      const clean = await compressImage(imageUrl, { keepOriginalFormat: true });
      // 2) 同源 dataURL 再加载成绘制源（100% 干净，canvas 永不污染）
      const drawImg = await loadImageWithTimeout(clean.dataUrl);
      // 2.5) ReactCrop 的 % 相对「img 元素盒子」（=容器）。img 用 object-contain 撑满容器，
      //      盒子含四周留白（letterbox），% 不是相对可见图 → 需先换算到可见图内容框。
      //      用渲染 <img>（imgRef.current，盒子=容器）的自然/客户尺寸算 contain 内容框偏移。
      const renderImg = imgRef.current;
      const boxW = renderImg?.clientWidth || drawImg.naturalWidth;
      const boxH = renderImg?.clientHeight || drawImg.naturalHeight;
      const natW = drawImg.naturalWidth;
      const natH = drawImg.naturalHeight;
      const containScale = Math.min(boxW / natW, boxH / natH);
      const contentW = natW * containScale;
      const contentH = natH * containScale;
      const offsetX = (boxW - contentW) / 2; // 左右留白宽
      const offsetY = (boxH - contentH) / 2; // 上下留白高
      // %（相对盒子）→ 内容框内像素（相对可见图）→ 再映射到自然像素
      const toNat = (pct, box, content, offset, nat) =>
        Math.round((((pct / 100) * box - offset) / content) * nat);
      const rect = {
        sx: toNat(percentCrop.x, boxW, contentW, offsetX, natW),
        sy: toNat(percentCrop.y, boxH, contentH, offsetY, natH),
        sw: toNat(percentCrop.width, boxW, contentW, offsetX, natW),
        sh: toNat(percentCrop.height, boxH, contentH, offsetY, natH),
      };
      // 收敛到自然像素边界，杜绝越界/负值
      rect.sx = Math.max(0, rect.sx);
      rect.sy = Math.max(0, rect.sy);
      rect.sw = Math.max(1, Math.min(natW - rect.sx, rect.sw));
      rect.sh = Math.max(1, Math.min(natH - rect.sy, rect.sh));
      if (!rect.sw || !rect.sh) {
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
  }, [imageUrl, percentCrop, onSave, onClose]);

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-black/70 nodrag">
      {/* 图片区：ReactCrop 撑满容器、图片 object-contain 完整显示。
          关键：必须让 ReactCrop 盒子 = 容器（无留白），选区手柄才能拖到最边边。
          原实现 flex 居中 + p-2 使图片盒子 < 容器，选区到图片边缘即停，四周留白处拖不到。 */}
      <div className="flex-1 relative overflow-hidden">
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
            src={imageUrl}
            alt="裁剪预览"
            onLoad={onImageLoad}
            className="block w-full h-full object-contain select-none"
            draggable={false}
          />
        </ReactCrop>
      </div>

      {/* 底部仅两个按钮：取消 / 裁剪 */}
      <div className="flex items-center justify-end gap-2 px-3 py-2 bg-surface-raised border-t border-edge">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded-lg text-body hover:bg-surface-hover-strong text-sm transition-colors"
        >
          取消
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          裁剪
        </button>
      </div>
    </div>
  );
}
