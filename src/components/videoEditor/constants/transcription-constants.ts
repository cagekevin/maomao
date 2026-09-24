import { LANGUAGES } from '@/components/videoEditor/constants/language-constants';
import type { LanguageCode } from '@/components/videoEditor/types/language';

const SUPPORTED_TRANSCRIPTION_LANGS: ReadonlyArray<LanguageCode> = [
  'en',
  'es',
  'it',
  'fr',
  'de',
  'pt',
  'ru',
  'ja',
  'zh',
];

export const TRANSCRIPTION_LANGUAGES = LANGUAGES.filter((language) =>
  SUPPORTED_TRANSCRIPTION_LANGS.includes(language.code),
);

/**
 * 转写模型 —— **只有一个，不可选**（用户 2026-09-24 裁定：「不要那么多选择，要统一，就用 tiny」）。
 *
 * 【为什么是单对象而不是数组】原先这里是一张 5 条目的可选清单
 * （tiny 120MB · base 206MB · small 586MB · large-v3-turbo 1604MB · distil-small.en 538MB），
 * 连带出三处机制：UI 下拉选择器 · `service` 的"换模型即重建 worker"分支 · `worker` 的 distil 专用分块参数。
 * 固定成一个模型后那三处**全部成为死代码** ⇒ 一并删掉；**不保留"将来可能再加回来"的可选参数**
 * （`ADR-0030`：零生产消费的实现不许预留）。
 */
export const TRANSCRIPTION_MODEL = {
  /**
   * 本机模型目录名 = `localTool/runtime-models/<modelId>/`，也是 transformers.js 的 model id
   * （库据此拼 `localModelPath + modelId + /file` ⇒ `/models/whisper-tiny/<file>`）。
   * 来源与 revision 见该目录的 `MANIFEST.json`（前端不再需要 HF 仓库名 —— 已禁远端）。
   */
  modelId: 'whisper-tiny',
  /** 面板展示名 */
  name: 'Tiny',
  /** 面板展示说明（用户看不到选择，但要知道精度取舍） */
  description: '最快、精度较低（约 120MB）',
  /** encoder 精度（decoder 走 q4；具体文件名见 MANIFEST） */
  encoderDtype: 'fp32',
} as const;

export const DEFAULT_CHUNK_LENGTH_SECONDS = 30;
export const DEFAULT_STRIDE_SECONDS = 5;

export const DEFAULT_WORDS_PER_CAPTION = 3;
export const MIN_CAPTION_DURATION_SECONDS = 0.8;
