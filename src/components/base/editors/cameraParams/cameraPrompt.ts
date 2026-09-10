/**
 * 摄影参数 → 提示词片段 的映射规则
 * （提取自 AI-Canvas-tauri/src/components/nodes/shared/image/cameraStudio.ts）。
 *
 * ⚠️ 关键：右下角相机面板只负责「收集参数」，真正让参数生效的是 buildGenerationCameraPrompt：
 * 把 cameraSettings 转成英文片段，拼进最终送给模型的提示词。
 * 只做 UI 不做这一步，选了焦距/光圈/曝光也不会影响生成结果。
 */

import type {
  CameraAperture,
  CameraGenerationSettings,
  CameraLens,
  CameraShutterEffect,
} from './types.ts';

export const LENS_PROMPTS: Record<CameraLens, string> = {
  '15mm': '15mm ultra-wide lens',
  '24mm': '24mm wide-angle lens',
  '35mm': '35mm cinematic lens',
  '50mm': '50mm natural perspective lens',
  '85mm': '85mm portrait lens',
  '200mm': '200mm telephoto lens compression',
  macro: '100mm macro lens, extreme close-up, 1:1 magnification, fine surface detail',
  fisheye: 'fisheye lens distortion',
};

/** 焦距 → 英文片段 */
export function describeCameraLens(lens: CameraLens): string {
  return LENS_PROMPTS[lens];
}

/** 快门效果 → 英文片段（已删 freeze：静帧生图默认定格，该词无引导力） */
export const SHUTTER_EFFECT_PROMPTS: Record<CameraShutterEffect, string> = {
  natural: 'natural shutter motion rendering',
  motion: 'slow-shutter motion blur',
  'light-trails': 'long-exposure light trails',
};

export const APERTURE_PROMPTS: Record<CameraAperture, string> = {
  'f/1.4': 'f/1.4 wide aperture, extremely shallow depth of field',
  'f/2': 'f/2 wide aperture, shallow depth of field',
  'f/2.8': 'f/2.8 aperture, soft background separation',
  'f/4': 'f/4 aperture, balanced depth of field',
  'f/5.6': 'f/5.6 aperture, moderate depth of field',
  'f/8': 'f/8 aperture, deep depth of field',
  'f/11': 'f/11 narrow aperture, extensive depth of field',
  'f/16': 'f/16 narrow aperture, maximum depth of field',
};

/**
 * 将相机/光圈/曝光参数拼成提示词片段（英文逗号分隔）。
 * 曝光时间仅作字符串拼接（如 "1/250s exposure time"），不参与真实摄影计算。
 * 全自动（settings 为空或缺字段）时返回空串。
 */
export function buildGenerationCameraPrompt(settings?: CameraGenerationSettings): string {
  if (!settings) return '';
  const terms = [
    settings.lens ? describeCameraLens(settings.lens) : undefined,
    settings.shutterEffect ? SHUTTER_EFFECT_PROMPTS[settings.shutterEffect] : undefined,
    settings.aperture ? APERTURE_PROMPTS[settings.aperture] : undefined,
    settings.exposureTime ? `${settings.exposureTime} exposure time` : undefined,
  ].filter((term): term is string => Boolean(term));
  return terms.join(', ');
}

/**
 * 将摄影参数合并到最终提示词（仅生图节点调用）。
 * 有参数时返回 `${basePrompt}\n\nCamera settings: ${片段}.`，否则原样返回。
 */
export function applyCameraSettingsToPrompt(
  basePrompt: string,
  cameraSettings: CameraGenerationSettings | undefined,
): string {
  const cameraPrompt = buildGenerationCameraPrompt(cameraSettings);
  if (cameraPrompt) {
    return `${basePrompt}\n\nCamera settings: ${cameraPrompt}.`;
  }
  return basePrompt;
}
