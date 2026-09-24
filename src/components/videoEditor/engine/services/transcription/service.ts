import type {
  TranscriptionLanguage,
  TranscriptionSubtask,
  TranscriptionResult,
  TranscriptionProgress,
  TranscriptionChunk,
} from '@/components/videoEditor/types/transcription';
import { TRANSCRIPTION_MODEL } from '@/components/videoEditor/constants/transcription-constants';
import type { WorkerMessage, WorkerResponse } from './worker';

type ProgressCallback = (progress: TranscriptionProgress) => void;

type StreamingCallback = (data: { chunks: TranscriptionChunk[]; tps: number }) => void;

class TranscriptionService {
  private worker: Worker | null = null;
  private isInitialized = false;
  private isInitializing = false;

  async transcribe({
    audioData,
    language = 'auto',
    subtask = 'transcribe',
    onProgress,
    onStreamingUpdate,
  }: {
    audioData: Float32Array;
    language?: TranscriptionLanguage;
    subtask?: TranscriptionSubtask;
    onProgress?: ProgressCallback;
    onStreamingUpdate?: StreamingCallback;
  }): Promise<TranscriptionResult> {
    await this.ensureWorker({ onProgress });

    onProgress?.({ status: 'transcribing', progress: 0 });

    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const handleMessage = (event: MessageEvent<WorkerResponse>) => {
        const response = event.data;

        switch (response.type) {
          case 'transcribe-update':
            onStreamingUpdate?.({
              chunks: response.chunks,
              tps: response.tps,
            });
            break;

          case 'transcribe-progress':
            onProgress?.({
              status: 'transcribing',
              progress: response.progress,
            });
            break;

          case 'transcribe-complete':
            this.worker?.removeEventListener('message', handleMessage);
            resolve({
              text: response.text,
              segments: response.segments,
              language,
              tps: response.tps,
            });
            break;

          case 'transcribe-error':
            this.worker?.removeEventListener('message', handleMessage);
            reject(new Error(response.error));
            break;

          case 'cancelled':
            this.worker?.removeEventListener('message', handleMessage);
            reject(new Error('Transcription cancelled'));
            break;
        }
      };

      this.worker.addEventListener('message', handleMessage);

      const message: WorkerMessage = {
        type: 'transcribe',
        audio: audioData,
        language,
        subtask: subtask === 'transcribe' ? null : subtask,
      };
      this.worker.postMessage(message, [audioData.buffer]);
    });
  }

  cancel() {
    this.worker?.postMessage({ type: 'cancel' } satisfies WorkerMessage);
  }

  private async ensureWorker({ onProgress }: { onProgress?: ProgressCallback }): Promise<void> {
    // 单模型（见 transcription-constants.ts）：已初始化即复用。
    // 原「换模型 ⇒ needsNewModel ⇒ 重建 worker」分支随可选清单一起删掉，不再保留。
    if (this.worker && this.isInitialized) return;

    if (this.isInitializing) {
      await this.waitForInit();
      return;
    }

    this.terminate();
    this.isInitializing = true;
    this.isInitialized = false;

    this.worker = new Worker(new URL('./worker.ts', import.meta.url), {
      type: 'module',
    });

    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Failed to create worker'));
        return;
      }

      const handleMessage = (event: MessageEvent<WorkerResponse>) => {
        const response = event.data;

        switch (response.type) {
          case 'init-progress':
            onProgress?.({
              status: 'loading-model',
              progress: response.progress,
              message: `Loading ${TRANSCRIPTION_MODEL.name} model...`,
            });
            break;

          case 'init-complete':
            this.worker?.removeEventListener('message', handleMessage);
            this.isInitialized = true;
            this.isInitializing = false;
            resolve();
            break;

          case 'init-error':
            this.worker?.removeEventListener('message', handleMessage);
            this.isInitializing = false;
            this.terminate();
            reject(new Error(response.error));
            break;
        }
      };

      this.worker.addEventListener('message', handleMessage);

      this.worker.postMessage({
        type: 'init',
        modelId: TRANSCRIPTION_MODEL.modelId,
        encoderDtype: TRANSCRIPTION_MODEL.encoderDtype,
      } satisfies WorkerMessage);
    });
  }

  private waitForInit(): Promise<void> {
    return new Promise((resolve) => {
      const checkInit = () => {
        if (this.isInitialized) {
          resolve();
        } else if (!this.isInitializing) {
          resolve();
        } else {
          setTimeout(checkInit, 100);
        }
      };
      checkInit();
    });
  }

  terminate() {
    this.worker?.terminate();
    this.worker = null;
    this.isInitialized = false;
    this.isInitializing = false;
  }
}

export const transcriptionService = new TranscriptionService();
