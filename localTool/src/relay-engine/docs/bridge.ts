/**
 * docs/bridge — 文档读取的原生桥接。
 *
 * 为什么必须走原生侧：
 * 1. 浏览器 / WebView 里 fetch 第三方文档站会被 CORS 拦住；
 * 2. 只做前端 URL 形状校验挡不住 DNS rebinding（校验时是公网 IP、连接时变成内网 IP），
 *    必须在解析出 IP 之后再校验一次才能连——这只有原生侧做得到。
 *
 * 原生实现见本模块的 `rust/provider_docs.rs`（原样取自 AI-Canvas-tauri），
 * 它已经包含 IP 黑名单、DNS pinning、重定向同站校验与响应体积上限。
 * 这里只定义契约，让 reader.ts 本身保持零依赖。
 */

export interface NativeDocResponse {
  /** 最终地址（可能经过重定向），调用方需再次校验同站。 */
  url: string;
  status: number;
  contentType: string;
  body: string;
  fetchedAt: number;
}

export interface DocBridge {
  /** 受限读取：原生侧完成 DNS pinning 与 SSRF 防护后取回正文。 */
  readDoc(url: string): Promise<NativeDocResponse>;
  /** 动态渲染：SPA 文档站首屏没有正文时，用它拿到渲染后的 DOM。 */
  render(url: string): Promise<NativeDocResponse>;
}

let activeBridge: DocBridge | null = null;

/** 配置桥接；传 null 解除。返回还原函数。 */
export function setDocBridge(bridge: DocBridge | null): () => void {
  const previous = activeBridge;
  activeBridge = bridge;
  return () => {
    if (activeBridge === bridge) activeBridge = previous;
  };
}

export function getDocBridge(): DocBridge | null {
  return activeBridge;
}

export function isDocBridgeReady(): boolean {
  return activeBridge !== null;
}

async function requireBridge(): Promise<DocBridge> {
  if (!activeBridge) {
    throw new Error('厂商文档读取需要宿主配置原生桥接（Tauri 用 createTauriDocBridge）');
  }
  return activeBridge;
}

export async function readDocWithBridge(url: string): Promise<NativeDocResponse> {
  const bridge = await requireBridge();
  return bridge.readDoc(url);
}

export async function renderDocWithBridge(url: string): Promise<NativeDocResponse> {
  const bridge = await requireBridge();
  return bridge.render(url);
}

/** 用 Tauri 的 invoke 构造桥接（命令名与 rust/provider_docs.rs 对齐）。 */
export function createTauriDocBridge(invoke: <T = unknown>(
  command: string,
  args?: Record<string, unknown>,
) => Promise<T>): DocBridge {
  return {
    readDoc: (url) => invoke<NativeDocResponse>('provider_docs_read', { url }),
    render: (url) => invoke<NativeDocResponse>('assistant_web_render', { url }),
  };
}

/** Node / 测试用：直接把响应喂进去，不走网络。 */
export function createStaticDocBridge(
  responses: Record<string, Partial<NativeDocResponse>>,
): DocBridge {
  const resolve = (url: string): NativeDocResponse => {
    const matched = responses[url];
    if (!matched) throw new Error(`未预置该地址的响应：${url}`);
    return {
      url: matched.url ?? url,
      status: matched.status ?? 200,
      contentType: matched.contentType ?? 'text/html',
      body: matched.body ?? '',
      fetchedAt: matched.fetchedAt ?? Date.now(),
    };
  };
  return {
    readDoc: async (url) => resolve(url),
    render: async (url) => resolve(url),
  };
}
