/**
 * Tauri 原生流式传输层。
 *
 * WebView 里发 fetch 会被 CORS 拦住，桌面端因此把请求交给 Rust 侧执行：
 * 请求体 Base64 编码后经 `proxy_stream_fetch` 命令发出，Rust 通过 Channel 回传
 * `meta / chunk / done` 三种事件，前端再组装成一个标准 Response（支持流式读取）。
 *
 * 这里不直接 import `@tauri-apps/api/core`，而是由调用方注入 invoke 与 Channel，
 * 让模块本身保持零依赖。
 */
import type { RelayTransport } from './transport';

export type ProxyFetchStreamEvent =
  | { event: 'meta'; status: number; headers: [string, string][] }
  | { event: 'chunk'; body: string }
  | { event: 'done' };

/** 宿主注入的 Tauri 桥接能力（`@tauri-apps/api/core` 的 invoke 与 Channel）。 */
export interface TauriBridge {
  invoke: <T = unknown>(command: string, args?: Record<string, unknown>) => Promise<T>;
  createChannel: <T = unknown>() => {
    onmessage?: ((message: T) => void) | null;
  };
}

function createRequestId(): string {
  return `proxy-${Date.now().toString(36)}-${crypto.randomUUID()}`;
}

function createAbortError(): DOMException {
  return new DOMException('请求已取消', 'AbortError');
}

function encodeBytesBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

interface EncodedRequestBody {
  body: string | null;
  contentType?: string;
}

async function encodeRequestBody(
  body: BodyInit | null | undefined,
): Promise<EncodedRequestBody> {
  if (body === undefined || body === null) return { body: null };
  if (typeof body === 'string') {
    return { body: encodeBytesBase64(new TextEncoder().encode(body)) };
  }
  if (body instanceof URLSearchParams) {
    return { body: encodeBytesBase64(new TextEncoder().encode(body.toString())) };
  }
  if (body instanceof Blob) {
    return { body: encodeBytesBase64(new Uint8Array(await body.arrayBuffer())) };
  }
  if (body instanceof ArrayBuffer) {
    return { body: encodeBytesBase64(new Uint8Array(body)) };
  }
  if (ArrayBuffer.isView(body)) {
    return {
      body: encodeBytesBase64(new Uint8Array(body.buffer, body.byteOffset, body.byteLength)),
    };
  }
  if (body instanceof FormData) {
    const request = new Request('http://localhost', { method: 'POST', body });
    return {
      body: encodeBytesBase64(new Uint8Array(await request.arrayBuffer())),
      contentType: request.headers.get('Content-Type') || undefined,
    };
  }
  throw new Error('原生协议传输不支持流式请求体');
}

function decodeBase64Body(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function normalizeTransportError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(typeof error === 'string' && error ? error : '原生 HTTP 请求失败');
}

/** 判断当前是否运行在 Tauri WebView 中。 */
export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined'
    && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
}

/**
 * 构造走 Rust 原生通道的传输层。
 * 非 Tauri 环境请不要使用（会因为没有 invoke 而直接失败），可用 `isTauriRuntime` 判断。
 */
export function createTauriTransport(bridge: TauriBridge): RelayTransport {
  return {
    fetch(url: string, init: RequestInit = {}): Promise<Response> {
      const signal = init.signal ?? undefined;
      if (signal?.aborted) throw createAbortError();

      return (async () => {
        const requestHeaders = new Headers(init.headers);
        const encodedBody = await encodeRequestBody(init.body);
        if (encodedBody.contentType && !requestHeaders.has('Content-Type')) {
          requestHeaders.set('Content-Type', encodedBody.contentType);
        }
        const headers = Array.from(requestHeaders.entries());
        if (signal?.aborted) throw createAbortError();
        const requestId = createRequestId();

        return new Promise<Response>((resolve, reject) => {
          let controller: ReadableStreamDefaultController<Uint8Array>;
          let responseResolved = false;
          let finished = false;

          const cleanup = () => {
            signal?.removeEventListener('abort', handleAbort);
          };
          const cancelNativeRequest = () => {
            void bridge.invoke('cancel_proxy_fetch', { requestId }).catch((error) => {
              console.warn('[relay/tauri] cancel_proxy_fetch failed:', error);
            });
          };
          const fail = (error: Error) => {
            if (finished) return;
            finished = true;
            cleanup();
            try {
              controller.error(error);
            } catch {
              // The consumer may already have canceled the stream.
            }
            if (!responseResolved) reject(error);
          };
          const finish = () => {
            if (finished) return;
            if (!responseResolved) {
              fail(new Error('原生 HTTP 响应缺少状态信息'));
              return;
            }
            finished = true;
            cleanup();
            controller.close();
          };
          const handleAbort = () => {
            cancelNativeRequest();
            fail(createAbortError());
          };
          const stream = new ReadableStream<Uint8Array>({
            start(nextController) {
              controller = nextController;
            },
            cancel() {
              if (finished) return;
              finished = true;
              cleanup();
              cancelNativeRequest();
            },
          });
          const channel = bridge.createChannel<ProxyFetchStreamEvent>();
          channel.onmessage = (event: ProxyFetchStreamEvent) => {
            try {
              if (finished) return;
              if (event.event === 'meta') {
                if (responseResolved) {
                  cancelNativeRequest();
                  fail(new Error('原生 HTTP 响应重复返回状态信息'));
                  return;
                }
                responseResolved = true;
                resolve(new Response(stream, {
                  status: event.status,
                  headers: new Headers(event.headers),
                }));
                return;
              }
              if (event.event === 'chunk') {
                controller.enqueue(decodeBase64Body(event.body));
                return;
              }
              finish();
            } catch (error) {
              cancelNativeRequest();
              fail(normalizeTransportError(error));
            }
          };

          signal?.addEventListener('abort', handleAbort, { once: true });
          if (signal?.aborted) {
            handleAbort();
            return;
          }

          void bridge.invoke<void>('proxy_stream_fetch', {
            req: {
              requestId,
              url,
              method: init.method || 'GET',
              headers,
              body: encodedBody.body,
            },
            onEvent: channel,
          }).catch((error) => fail(normalizeTransportError(error)));
        });
      })();
    },
  };
}
