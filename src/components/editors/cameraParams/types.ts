/**
 * 摄影参数相关类型定义（提取自 AI-Canvas-tauri/src/types/index.ts）。
 * 自包含：不依赖本目录之外的模块。
 *
 * 注意：这里的「摄影参数」是生图/生视频节点右下角的轻量参数面板（焦距/快门效果/光圈/曝光时间），
 * 与 CameraStudioPanel（3D 摄影棚：球面拖拽机位 + 打光）是两套独立功能，不可混用。
 */

/** 镜头焦距 */
export type CameraLens = '15mm' | '24mm' | '35mm' | '50mm' | '85mm' | '200mm' | 'macro' | 'fisheye';

/**
 * 快门效果（动态表现，非真实快门速度）。
 * 【精简说明】已删掉 freeze（凝固动作）：静帧生图本来就默认定格，
 * "high-speed / frozen" 类词对模型近乎无引导，等于不设置，故不作为独立档位。
 */
export type CameraShutterEffect = 'natural' | 'motion' | 'light-trails';

/** 光圈档位 */
export type CameraAperture = 'f/1.4' | 'f/2' | 'f/2.8' | 'f/4' | 'f/5.6' | 'f/8' | 'f/11' | 'f/16';

/**
 * 曝光时间。
 * 【精简说明】只保留「模型能翻译成明暗」的两端档：
 *  - 短曝压暗：1/2000s / 1/1000s / 1/500s
 *  - 长曝提亮：1/2s / 1s / 5s
 * 中间档（1/250s / 1/125s / 1/60s / 1/30s / 1/8s）给模型的是纯数值字符串，
 * 模型无法映射成画面明暗差异 → 生不出不同的图，故删去。
 */
export type CameraExposureTime = '1/2000s' | '1/1000s' | '1/500s' | '1/2s' | '1s' | '5s';

/** 生图/生视频的摄影机参数；字段缺省（自动）时不写入提示词 */
export interface CameraGenerationSettings {
  lens?: CameraLens;
  shutterEffect?: CameraShutterEffect;
  aperture?: CameraAperture;
  exposureTime?: CameraExposureTime;
}
