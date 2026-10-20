import {
  pipeline,
  WhisperTextStreamer,
  env,
  type AutomaticSpeechRecognitionPipeline,
} from '@huggingface/transformers';
import { configureTranscriptionModelEnv } from './modelEnv';
import type {
  TranscriptionSegment,
  TranscriptionChunk,
} from '@/components/videoEditor/types/transcription';
import {
  DEFAULT_CHUNK_LENGTH_SECONDS,
  DEFAULT_STRIDE_SECONDS,
} from '@/components/videoEditor/constants/transcription-constants';

/**
 * 从第三方对象上逐层读一个数值（transformers.js 的 processor/model 内部字段无公开类型）。
 * 任一层缺失或末值非 number ⇒ undefined（调用方据此 fail-loud，而不是让 NaN 流进时间换算）。
 */
function readNumberAt(root: unknown, ...path: string[]): number | undefined {
  let cur: unknown = root;
  for (const key of path) {
    if (cur === null || typeof cur !== 'object') return undefined;
    // `Reflect.get` 对缺失键返回 undefined，且其返回类型是 any（赋给 unknown 无需断言）
    cur = Reflect.get(cur, key);
  }
  return typeof cur === 'number' ? cur : undefined;
}

export type WorkerMessage =
  | {
      type: 'init';
      modelId: string;
      encoderDtype: 'fp16' | 'fp32';
    }
  | {
      type: 'transcribe';
      audio: Float32Array;
      language: string;
      subtask: string | null;
    }
  | { type: 'cancel' };

export type WorkerResponse =
  | { type: 'init-progress'; progress: number }
  | { type: 'init-complete' }
  | { type: 'init-error'; error: string }
  | {
      type: 'transcribe-update';
      chunks: TranscriptionChunk[];
      tps: number;
    }
  | { type: 'transcribe-progress'; progress: number }
  | {
      type: 'transcribe-complete';
      text: string;
      segments: TranscriptionSegment[];
      tps: number;
    }
  | { type: 'transcribe-error'; error: string }
  | { type: 'cancelled' };

let transcriber: AutomaticSpeechRecognitionPipeline | null = null;
let cancelled = false;
let lastReportedProgress = -1;
const fileBytes = new Map<string, { loaded: number; total: number }>();

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  switch (message.type) {
    case 'init':
      await handleInit({
        modelId: message.modelId,
        encoderDtype: message.encoderDtype,
      });
      break;
    case 'transcribe':
      await handleTranscribe({
        audio: message.audio,
        language: message.language,
        subtask: message.subtask,
      });
      break;
    case 'cancel':
      cancelled = true;
      self.postMessage({ type: 'cancelled' } satisfies WorkerResponse);
      break;
  }
};

async function handleInit({
  modelId,
  encoderDtype,
}: {
  modelId: string;
  encoderDtype: 'fp16' | 'fp32';
}) {
  // 单模型（见 transcription-constants.ts）：原「同模型直接回 init-complete / 换模型先 dispose 旧的」两支
  // 随可选清单一起删掉 —— service 只在需要装载时新建 worker，故每个 worker 的 init 只会到一次。

  lastReportedProgress = -1;
  fileBytes.clear();

  try {
    // 模型 + ORT wasm 均已落地本机：指向 /models/<modelId>/ 并禁远端（形态与 depthVideo/loader.ts 一致）。
    // 必须在 pipeline 之前设，否则库已按默认（远程 huggingface.co / cdn.jsdelivr.net）解析路径。
    configureTranscriptionModelEnv(env, modelId);
    transcriber = await pipeline('automatic-speech-recognition', modelId, {
      dtype: {
        encoder_model: encoderDtype,
        decoder_model_merged: 'q4',
      },
      device: 'webgpu',
      // 只认本机文件：缺任何一份都**明确报错**（不静默回落公网）
      local_files_only: true,
      progress_callback: (progressInfo: {
        status?: string;
        file?: string;
        loaded?: number;
        total?: number;
      }) => {
        const file = progressInfo.file;
        if (!file) return;

        const loaded = progressInfo.loaded ?? 0;
        const total = progressInfo.total ?? 0;

        if (progressInfo.status === 'progress' && total > 0) {
          fileBytes.set(file, { loaded, total });
        } else if (progressInfo.status === 'done') {
          const existing = fileBytes.get(file);
          if (existing) {
            fileBytes.set(file, {
              loaded: existing.total,
              total: existing.total,
            });
          }
        }

        let totalLoaded = 0;
        let totalSize = 0;
        for (const { loaded, total } of fileBytes.values()) {
          totalLoaded += loaded;
          totalSize += total;
        }

        if (totalSize === 0) return;

        const overallProgress = (totalLoaded / totalSize) * 100;
        const roundedProgress = Math.floor(overallProgress);

        if (roundedProgress !== lastReportedProgress) {
          lastReportedProgress = roundedProgress;
          self.postMessage({
            type: 'init-progress',
            progress: roundedProgress,
          } satisfies WorkerResponse);
        }
      },
    });

    self.postMessage({ type: 'init-complete' } satisfies WorkerResponse);
  } catch (error) {
    self.postMessage({
      type: 'init-error',
      error: error instanceof Error ? error.message : 'Failed to load model',
    } satisfies WorkerResponse);
  }
}

async function handleTranscribe({
  audio,
  language,
  subtask,
}: {
  audio: Float32Array;
  language: string;
  subtask: string | null;
}) {
  if (!transcriber) {
    self.postMessage({
      type: 'transcribe-error',
      error: 'Model not initialized',
    } satisfies WorkerResponse);
    return;
  }

  cancelled = false;

  try {
    // transformers.js 的内部字段（processor.feature_extractor / model.config）不进公开类型，
    // 旧写法用两次双重断言把它们"变成"具体形状 —— 字段改名/缺失时静默变 NaN。
    // 现改为逐层读数值 + 显式判缺（fail-loud），缺失即抛错由外层 catch 汇报。
    const chunkLength = readNumberAt(
      transcriber.processor.feature_extractor,
      'config',
      'chunk_length',
    );
    const maxSourcePositions = readNumberAt(transcriber.model.config, 'max_source_positions');
    if (chunkLength === undefined || maxSourcePositions === undefined || maxSourcePositions <= 0) {
      throw new Error(
        `transcriber 配置缺失：chunk_length=${String(chunkLength)} / max_source_positions=${String(maxSourcePositions)}`,
      );
    }
    const timePrecision = chunkLength / maxSourcePositions;

    const chunks: TranscriptionChunk[] = [];
    let chunkCount = 0;
    let startTime: number | null = null;
    let numTokens = 0;
    let tps = 0;

    // 分块参数固定：原「distil 走 20s/3s、其余走 30s/5s」的按模型分支随可选清单一起删掉
    // —— 现在只有 whisper-tiny 一个模型（见 transcription-constants.ts）。
    const chunkLengthS = DEFAULT_CHUNK_LENGTH_SECONDS;
    const strideLengthS = DEFAULT_STRIDE_SECONDS;

    const WHISPER_SAMPLE_RATE = 16000;
    const audioDurationS = audio.length / WHISPER_SAMPLE_RATE;
    const stepS = chunkLengthS - strideLengthS;
    const estimatedTotalChunks = Math.max(1, Math.ceil(audioDurationS / stepS));

    let lastUpdateTime = 0;
    const UPDATE_THROTTLE_MS = 100;

    const tokenizer = transcriber.tokenizer as Parameters<
      typeof WhisperTextStreamer extends new (tok: infer T, ...args: unknown[]) => unknown
        ? T
        : never
    >;
    const streamer = new WhisperTextStreamer(tokenizer, {
      time_precision: timePrecision,
      on_chunk_start: (x: number) => {
        const offset = stepS * chunkCount;
        chunks.push({
          text: '',
          timestamp: [offset + x, null],
          finalised: false,
          offset,
        });
      },
      token_callback_function: () => {
        startTime ??= performance.now();
        numTokens++;
        if (numTokens > 1) {
          tps = (numTokens / (performance.now() - startTime)) * 1000;
        }
      },
      callback_function: (x: string) => {
        if (chunks.length === 0) return;
        const last = chunks[chunks.length - 1];
        if (last === undefined) return; // 上方已判空（不可达兜底）
        last.text += x;

        const now = performance.now();
        if (now - lastUpdateTime >= UPDATE_THROTTLE_MS) {
          lastUpdateTime = now;
          self.postMessage({
            type: 'transcribe-update',
            chunks: [...chunks],
            tps,
          } satisfies WorkerResponse);
        }
      },
      on_chunk_end: (x: number) => {
        const current = chunks[chunks.length - 1];
        if (current === undefined) return; // 无进行中的 chunk（事件乱序），忽略
        current.timestamp[1] = x + current.offset;
        current.finalised = true;
      },
      on_finalize: () => {
        startTime = null;
        numTokens = 0;
        chunkCount++;

        const progress = Math.min(99, Math.round((chunkCount / estimatedTotalChunks) * 100));
        self.postMessage({
          type: 'transcribe-progress',
          progress,
        } satisfies WorkerResponse);
      },
    });

    const output = await transcriber(audio, {
      top_k: 0,
      do_sample: false,
      chunk_length_s: chunkLengthS,
      stride_length_s: strideLengthS,
      ...(language !== 'auto' ? { language } : {}),
      task: subtask ?? 'transcribe',
      return_timestamps: true,
      force_full_sequences: false,
      streamer,
    });

    if (cancelled) return;

    // flush final streaming state
    if (chunks.length > 0) {
      self.postMessage({
        type: 'transcribe-update',
        chunks: [...chunks],
        tps,
      } satisfies WorkerResponse);
    }

    const result = Array.isArray(output) ? output[0] : output;

    const segments: TranscriptionSegment[] = [];
    if (result.chunks) {
      for (const chunk of result.chunks) {
        if (chunk.timestamp && chunk.timestamp.length >= 2) {
          segments.push({
            text: chunk.text,
            start: chunk.timestamp[0] ?? 0,
            end: chunk.timestamp[1] ?? chunk.timestamp[0] ?? 0,
          });
        }
      }
    }

    self.postMessage({
      type: 'transcribe-complete',
      text: result.text,
      segments,
      tps,
    } satisfies WorkerResponse);
  } catch (error) {
    if (cancelled) return;
    self.postMessage({
      type: 'transcribe-error',
      error: error instanceof Error ? error.message : 'Transcription failed',
    } satisfies WorkerResponse);
  }
}
