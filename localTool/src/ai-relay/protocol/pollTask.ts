/**
 * protocol/pollTask — 通用异步任务轮询工具。
 * 统一各供应商的任务状态轮询逻辑，消除 while(true)+setTimeout 重复样板。
 * 对应 AI-Canvas-tauri 的 services/pollTask.ts。
 */

export interface PollTaskOptions<T> {
  fetchState: () => Promise<unknown>;
  isComplete: (payload: unknown) => T | null;
  isFailed?: (payload: unknown) => string | null;
  interval?: number;
  maxAttempts?: number;
  maxDuration?: number;
  onProgress?: (progress: number) => void;
  onFetchError?: 'throw' | 'continue';
  signal?: AbortSignal;
  timeoutMsg?: string;
}

function waitForPollInterval(interval: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(new Error('任务已被取消'));

  return new Promise((resolve, reject) => {
    const cleanup = () => signal?.removeEventListener('abort', onAbort);
    const finish = () => {
      cleanup();
      resolve();
    };
    const timer = setTimeout(finish, interval);
    const onAbort = () => {
      clearTimeout(timer);
      cleanup();
      reject(new Error('任务已被取消'));
    };

    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();
  });
}

export async function pollTask<T>(options: PollTaskOptions<T>): Promise<T> {
  const {
    fetchState,
    isComplete,
    isFailed,
    interval = 3000,
    maxAttempts = Infinity,
    maxDuration = Infinity,
    onProgress,
    onFetchError = 'throw',
    signal,
    timeoutMsg = '任务轮询超时',
  } = options;

  const startTime = Date.now();

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal?.aborted) {
      throw new Error('任务已被取消');
    }

    if (attempt > 0) {
      await waitForPollInterval(interval, signal);
    }

    if (Date.now() - startTime >= maxDuration) {
      throw new Error(timeoutMsg);
    }

    let state: unknown;
    try {
      state = await fetchState();
    } catch (err) {
      if (onFetchError === 'continue') continue;
      throw err;
    }

    if (isFailed) {
      const errorMsg = isFailed(state);
      if (errorMsg) throw new Error(errorMsg);
    }

    const result = isComplete(state);
    if (result !== null) {
      return result;
    }

    if (onProgress) {
      const raw = state as { progress?: unknown };
      const progress = typeof raw?.progress === 'number'
        ? raw.progress
        : Math.min(100, Math.round((attempt / maxAttempts) * 100));
      onProgress(progress);
    }
  }

  throw new Error(timeoutMsg);
}
