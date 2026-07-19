// ============================================================
// 一毛AI画布 · API 通信层（模块 2）
// 统一收口两类后端：远程网关 (127.0.0.1:9004) + 本地 tool (127.0.0.1:18080)
// 所有请求必须经此文件，禁止散落 fetch
// ============================================================

// ── 2.1 基础设施 ──

/** 统一 API 错误类型 */
export class ApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string = 'unknown', status: number = 0) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

/** 带超时的 fetch，超时抛 ApiError('timeout') */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 5000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new ApiError(`请求超时 (${timeoutMs}ms)`, 'timeout', 0);
    }
    if (e instanceof TypeError) {
      throw new ApiError(`网络错误: ${(e as Error).message}`, 'network_error', 0);
    }
    throw e;
  }
}

/** 获取当前远程网关基址 */
export function getBaseUrl(): string {
  try {
    const stored = sessionStorage.getItem('active_api_endpoint');
    if (stored) {
      return stored.replace(/[`\s]/g, '').trim().replace(/\/$/, '');
    }
  } catch { /* ignore */ }
  return 'http://127.0.0.1:9004';
}

/** 获取鉴权 token */
function getAuthToken(): string | null {
  try {
    return localStorage.getItem('auth_token');
  } catch { /* ignore */ }
  return null;
}

/** 注入鉴权 header */
function authHeaders(headers: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/** 本地 tool 基址（固定） */
const LOCAL_TOOL_BASE = 'http://127.0.0.1:18080';

// ── 2.2 gateway 函数族（远程网关 127.0.0.1:9004）──

export const gateway = {
  // 文本生成
  async chatCompletion(params: {
    model: string;
    messages: { role: string; content: string | unknown }[];
    stream?: boolean;
    temperature?: number;
    max_tokens?: number;
  }): Promise<unknown> {
    const base = getBaseUrl();
    const res = await fetchWithTimeout(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        stream: params.stream ?? false,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.max_tokens ?? 2048,
      }),
    });
    if (!res.ok) throw new ApiError(`Chat completion 失败: ${res.status}`, 'gateway_error', res.status);
    return res.json();
  },

  // 图片生成
  async imageGeneration(params: {
    model: string;
    prompt: string;
    size?: string;
    n?: number;
    image_size?: string;
  }): Promise<{ data: { url?: string; b64_json?: string }[] }> {
    const base = getBaseUrl();
    const res = await fetchWithTimeout(`${base}/v1/images/generations`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        model: params.model,
        prompt: params.prompt,
        n: params.n ?? 1,
        size: params.size,
        image_size: params.image_size,
      }),
    }, 30000); // 图片生成 30s 超时
    if (!res.ok) throw new ApiError(`图片生成失败: ${res.status}`, 'gateway_error', res.status);
    return res.json();
  },

  // 图片编辑
  async imageEdit(params: {
    model: string;
    image: Blob;
    prompt: string;
    mask?: Blob;
    size?: string;
    n?: number;
  }): Promise<{ data: { url?: string; b64_json?: string }[] }> {
    const base = getBaseUrl();
    const formData = new FormData();
    formData.append('model', params.model);
    formData.append('image', params.image, 'image.png');
    if (params.mask) formData.append('mask', params.mask, 'mask.png');
    formData.append('prompt', params.prompt);
    formData.append('n', String(params.n ?? 1));
    if (params.size && params.size !== 'Auto') {
      formData.append('size', params.size);
    }
    const res = await fetchWithTimeout(`${base}/v1/images/edits`, {
      method: 'POST',
      body: formData,
    }, 30000);
    if (!res.ok) throw new ApiError(`图片编辑失败: ${res.status}`, 'gateway_error', res.status);
    return res.json();
  },

  // 视频生成
  async videoGeneration(params: {
    model: string;
    prompt: string;
    image_url?: string;
    size?: string;
    duration?: number;
  }): Promise<{ data: { id: string }[] }> {
    const base = getBaseUrl();
    const res = await fetchWithTimeout(`${base}/v1/video/generations`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        model: params.model,
        prompt: params.prompt,
        image_url: params.image_url,
        size: params.size,
        duration: params.duration,
      }),
    }, 60000); // 视频生成 60s 超时
    if (!res.ok) throw new ApiError(`视频生成失败: ${res.status}`, 'gateway_error', res.status);
    return res.json();
  },

  // 视频结果查询
  async videoResult(model: string, id: string): Promise<{ data: { url?: string; status?: string } }> {
    const base = getBaseUrl();
    const res = await fetchWithTimeout(`${base}/v1/video/generations/${id}`, {
      headers: authHeaders({ 'Content-Type': 'application/json' }),
    });
    if (!res.ok) throw new ApiError(`视频结果查询失败: ${res.status}`, 'gateway_error', res.status);
    return res.json();
  },

  // 文件上传到网关
  async uploadFile(file: Blob, filename: string): Promise<{ url: string }> {
    const base = getBaseUrl();
    const formData = new FormData();
    formData.append('file', file, filename);
    const res = await fetchWithTimeout(`${base}/v1/gateway/upload`, {
      method: 'POST',
      body: formData,
    }, 15000);
    if (!res.ok) throw new ApiError(`文件上传失败: ${res.status}`, 'gateway_error', res.status);
    return res.json();
  },

  // 任务查询
  async queryTask(taskId: string): Promise<{ status: string; result?: unknown; progress?: number }> {
    const base = getBaseUrl();
    const res = await fetchWithTimeout(`${base}/v1/gateway/task/${taskId}`, {
      headers: authHeaders({ 'Content-Type': 'application/json' }),
    });
    if (!res.ok) throw new ApiError(`任务查询失败: ${res.status}`, 'gateway_error', res.status);
    return res.json();
  },

  // 通用生成
  async generate(payload: unknown): Promise<{ taskId?: string; data?: unknown }> {
    const base = getBaseUrl();
    const res = await fetchWithTimeout(`${base}/v1/gateway/generate`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    }, 30000);
    if (!res.ok) throw new ApiError(`生成请求失败: ${res.status}`, 'gateway_error', res.status);
    return res.json();
  },

  // 余额查询
  async getBalance(): Promise<unknown> {
    const base = getBaseUrl();
    const res = await fetchWithTimeout(`${base}/v1/dashboard/balance`, {
      headers: authHeaders({ 'Content-Type': 'application/json' }),
    });
    if (!res.ok) throw new ApiError(`余额查询失败: ${res.status}`, 'gateway_error', res.status);
    return res.json();
  },

  // 通用网关请求
  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const base = getBaseUrl();
    const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
    const res = await fetchWithTimeout(url, {
      headers: authHeaders({ 'Content-Type': 'application/json', ...(options.headers as Record<string, string>) }),
      ...options,
    });
    if (!res.ok) throw new ApiError(`API ${res.status}: ${res.statusText}`, 'gateway_error', res.status);
    return res.json();
  },

  // 轮询任务直到完成
  async pollTask(
    taskId: string,
    options: {
      intervalMs?: number;
      maxAttempts?: number;
      onProgress?: (progress: number) => void;
    } = {},
  ): Promise<{ status: string; result?: unknown }> {
    const { intervalMs = 2000, maxAttempts = 60, onProgress } = options;
    for (let i = 0; i < maxAttempts; i++) {
      const res = await this.queryTask(taskId);
      if (onProgress && typeof res.progress === 'number') {
        onProgress(res.progress);
      }
      if (res.status === 'completed' || res.status === 'done') {
        return res;
      }
      if (res.status === 'failed' || res.status === 'error') {
        throw new ApiError(`任务失败: ${taskId}`, 'task_failed', 0);
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new ApiError(`任务超时: ${taskId}（已轮询 ${maxAttempts} 次）`, 'task_timeout', 0);
  },
};

// ── 2.3 localTool 函数族（本地 127.0.0.1:18080）──

export const localTool = {
  // GET /api/status
  async getStatus(): Promise<{
    status: string;
    version: string;
    message: string;
    ffmpeg?: boolean;
    port: number;
  }> {
    const res = await fetchWithTimeout(`${LOCAL_TOOL_BASE}/api/status`, {}, 3000);
    if (!res.ok) throw new ApiError('localTool 状态检查失败', 'localtool_error', res.status);
    return res.json();
  },

  // GET /api/kv/get?key=
  async kvGet(key: string): Promise<unknown> {
    try {
      const res = await fetchWithTimeout(`${LOCAL_TOOL_BASE}/api/kv/get?key=${encodeURIComponent(key)}`, {}, 5000);
      if (!res.ok) throw new ApiError('KV 读取失败', 'localtool_error', res.status);
      return res.json();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'network_error') {
        // 2.4 降级：localTool 不可达时降级到 chrome.storage
        return fallbackStorageGet(key);
      }
      throw e;
    }
  },

  // POST /api/kv/set
  async kvSet(key: string, value: unknown): Promise<void> {
    const res = await fetchWithTimeout(`${LOCAL_TOOL_BASE}/api/kv/set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: JSON.stringify(value) }),
    }, 5000);
    if (!res.ok) throw new ApiError('KV 写入失败', 'localtool_error', res.status);
  },

  // POST /api/files/upload
  async upload(params: {
    file?: Blob;
    fileUrl?: string;
    subfolder?: string;
    filename?: string;
  }): Promise<{ url: string; thumbnailUrl?: string; path: string }> {
    if (params.file) {
      // FormData 形态
      const formData = new FormData();
      formData.append('file', params.file, params.filename || 'upload');
      if (params.subfolder) formData.append('subfolder', params.subfolder);
      if (params.filename) formData.append('filename', params.filename);

      const res = await fetchWithTimeout(`${LOCAL_TOOL_BASE}/api/files/upload`, {
        method: 'POST',
        body: formData,
      }, 15000);
      if (!res.ok) throw new ApiError('文件上传失败', 'localtool_error', res.status);
      return res.json();
    } else if (params.fileUrl) {
      // JSON 形态（fileUrl 下载）
      const res = await fetchWithTimeout(`${LOCAL_TOOL_BASE}/api/files/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileUrl: params.fileUrl,
          subfolder: params.subfolder || 'canvas',
          filename: params.filename,
        }),
      }, 15000);
      if (!res.ok) throw new ApiError('文件上传失败', 'localtool_error', res.status);
      return res.json();
    } else {
      throw new ApiError('缺少 file 或 fileUrl 参数', 'invalid_params', 400);
    }
  },

  // GET /api/files/read?path=
  async readFile(path: string): Promise<Blob> {
    const res = await fetchWithTimeout(`${LOCAL_TOOL_BASE}/api/files/read?path=${encodeURIComponent(path)}`, {}, 10000);
    if (!res.ok) throw new ApiError('文件读取失败', 'localtool_error', res.status);
    return res.blob();
  },

  // GET /api/files/thumbnail?url=&maxDim=&quality=
  async thumbnail(url: string, maxDim?: number, quality?: number): Promise<{ thumbnailUrl: string }> {
    const params = new URLSearchParams({ url });
    if (maxDim) params.set('maxDim', String(maxDim));
    if (quality) params.set('quality', String(quality));
    const res = await fetchWithTimeout(`${LOCAL_TOOL_BASE}/api/files/thumbnail?${params}`, {}, 5000);
    if (!res.ok) throw new ApiError('缩略图生成失败', 'localtool_error', res.status);
    return res.json();
  },

  // POST /api/files/mkdir
  async mkdir(folder: string): Promise<void> {
    const res = await fetchWithTimeout(`${LOCAL_TOOL_BASE}/api/files/mkdir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder }),
    }, 5000);
    if (!res.ok) throw new ApiError('创建目录失败', 'localtool_error', res.status);
  },

  // POST /api/files/move
  async move(src: string, dst: string): Promise<void> {
    const res = await fetchWithTimeout(`${LOCAL_TOOL_BASE}/api/files/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ src, dst }),
    }, 5000);
    if (!res.ok) throw new ApiError('文件移动失败', 'localtool_error', res.status);
  },

  // GET /api/files/open?subfolder=
  async open(subfolder?: string): Promise<{ path: string }> {
    const res = await fetchWithTimeout(
      `${LOCAL_TOOL_BASE}/api/files/open?subfolder=${encodeURIComponent(subfolder || 'canvas')}`,
      {},
      5000,
    );
    if (!res.ok) throw new ApiError('打开目录失败', 'localtool_error', res.status);
    return res.json();
  },

  // GET /api/files/open-dir?filepath=
  async openDir(filepath: string): Promise<{ path: string }> {
    const res = await fetchWithTimeout(
      `${LOCAL_TOOL_BASE}/api/files/open-dir?filepath=${encodeURIComponent(filepath)}`,
      {},
      5000,
    );
    if (!res.ok) throw new ApiError('打开目录失败', 'localtool_error', res.status);
    return res.json();
  },

  // GET /api/files/list?subfolder=
  async list(subfolder?: string): Promise<{ files: string[]; folders: string[] }> {
    const res = await fetchWithTimeout(
      `${LOCAL_TOOL_BASE}/api/files/list?subfolder=${encodeURIComponent(subfolder || '')}`,
      {},
      5000,
    );
    if (!res.ok) throw new ApiError('文件列表获取失败', 'localtool_error', res.status);
    return res.json();
  },

  // ── Tasks ──

  // GET /api/tasks
  async getTasks(params?: {
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortDir?: 'ASC' | 'DESC';
    search?: string;
    filters?: Record<string, unknown>;
  }): Promise<{ items: unknown[]; total: number; page: number; pageSize: number; totalPages: number }> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    if (params?.sortBy) query.set('sortBy', params.sortBy);
    if (params?.sortDir) query.set('sortDir', params.sortDir);
    if (params?.search) query.set('search', params.search);
    if (params?.filters) query.set('filters', JSON.stringify(params.filters));

    const res = await fetchWithTimeout(`${LOCAL_TOOL_BASE}/api/tasks?${query}`, {}, 5000);
    if (!res.ok) throw new ApiError('任务列表获取失败', 'localtool_error', res.status);
    return res.json();
  },

  // POST /api/tasks/save
  async saveTask(task: Record<string, unknown>): Promise<void> {
    const res = await fetchWithTimeout(`${LOCAL_TOOL_BASE}/api/tasks/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    }, 5000);
    if (!res.ok) throw new ApiError('任务保存失败', 'localtool_error', res.status);
  },

  // POST /api/tasks/batch-save
  async batchSaveTasks(tasks: Record<string, unknown>[]): Promise<void> {
    const res = await fetchWithTimeout(`${LOCAL_TOOL_BASE}/api/tasks/batch-save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tasks),
    }, 5000);
    if (!res.ok) throw new ApiError('批量任务保存失败', 'localtool_error', res.status);
  },

  // POST /api/tasks/delete?id=
  async deleteTask(id: string): Promise<void> {
    const res = await fetchWithTimeout(`${LOCAL_TOOL_BASE}/api/tasks/delete?id=${encodeURIComponent(id)}`, {
      method: 'POST',
    }, 5000);
    if (!res.ok) throw new ApiError('任务删除失败', 'localtool_error', res.status);
  },

  // POST /api/tasks/batch-delete
  async batchDeleteTasks(ids: string[]): Promise<{ deleted: number }> {
    const res = await fetchWithTimeout(`${LOCAL_TOOL_BASE}/api/tasks/batch-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    }, 5000);
    if (!res.ok) throw new ApiError('批量任务删除失败', 'localtool_error', res.status);
    return res.json();
  },

  // POST /api/tasks/clear
  async clearTasks(statuses?: string[]): Promise<{ deleted: number }> {
    const res = await fetchWithTimeout(`${LOCAL_TOOL_BASE}/api/tasks/clear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statuses: statuses || [] }),
    }, 5000);
    if (!res.ok) throw new ApiError('任务清空失败', 'localtool_error', res.status);
    return res.json();
  },

  // ── Resources ──

  // GET /api/resources
  async getResources(params?: {
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortDir?: 'ASC' | 'DESC';
    search?: string;
    filters?: Record<string, unknown>;
  }): Promise<{ items: unknown[]; total: number; page: number; pageSize: number; totalPages: number }> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    if (params?.sortBy) query.set('sortBy', params.sortBy);
    if (params?.sortDir) query.set('sortDir', params.sortDir);
    if (params?.search) query.set('search', params.search);
    if (params?.filters) query.set('filters', JSON.stringify(params.filters));

    const res = await fetchWithTimeout(`${LOCAL_TOOL_BASE}/api/resources?${query}`, {}, 5000);
    if (!res.ok) throw new ApiError('资源列表获取失败', 'localtool_error', res.status);
    return res.json();
  },

  // POST /api/resources/save
  async saveResource(resource: Record<string, unknown>): Promise<void> {
    const res = await fetchWithTimeout(`${LOCAL_TOOL_BASE}/api/resources/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resource),
    }, 5000);
    if (!res.ok) throw new ApiError('资源保存失败', 'localtool_error', res.status);
  },

  // POST /api/resources/batch-save
  async batchSaveResources(resources: Record<string, unknown>[]): Promise<void> {
    const res = await fetchWithTimeout(`${LOCAL_TOOL_BASE}/api/resources/batch-save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resources),
    }, 5000);
    if (!res.ok) throw new ApiError('批量资源保存失败', 'localtool_error', res.status);
  },

  // POST /api/resources/delete?id=
  async deleteResource(id: string): Promise<void> {
    const res = await fetchWithTimeout(`${LOCAL_TOOL_BASE}/api/resources/delete?id=${encodeURIComponent(id)}`, {
      method: 'POST',
    }, 5000);
    if (!res.ok) throw new ApiError('资源删除失败', 'localtool_error', res.status);
  },

  // POST /api/resources/clear
  async clearResources(params?: { folder?: string; deleteFiles?: boolean }): Promise<{ deleted: number }> {
    const res = await fetchWithTimeout(`${LOCAL_TOOL_BASE}/api/resources/clear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params || {}),
    }, 5000);
    if (!res.ok) throw new ApiError('资源清空失败', 'localtool_error', res.status);
    return res.json();
  },

  // ── 代理 ──

  // POST /api/proxy（形态② JSON body）
  async proxy(params: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
    cookie?: string;
  }): Promise<Response> {
    const headers: Record<string, string> = { ...params.headers };
    if (params.cookie) headers['Cookie'] = params.cookie;

    const fetchBody = params.body ? JSON.stringify(params.body) : undefined;
    if (fetchBody) headers['Content-Type'] = 'application/json';

    const res = await fetchWithTimeout(`${LOCAL_TOOL_BASE}/api/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: params.url,
        method: params.method || 'POST',
        headers,
        body: params.body,
        cookie: params.cookie,
      }),
    }, 15000);
    return res;
  },

  // POST /api/proxy（形态① FormData + X-Proxy-* 头）
  async proxyRaw(params: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    cookie?: string;
    body?: Blob | ArrayBuffer | null;
  }): Promise<Response> {
    const proxyHeaders: Record<string, string> = {
      'X-Proxy-Url': params.url,
      'X-Proxy-Method': params.method || 'POST',
      ...(params.headers ? { 'X-Proxy-Headers': JSON.stringify(params.headers) } : {}),
      ...(params.cookie ? { 'X-Proxy-Cookie': params.cookie } : {}),
    };

    const res = await fetchWithTimeout(`${LOCAL_TOOL_BASE}/api/proxy`, {
      method: 'POST',
      headers: proxyHeaders,
      body: params.body || undefined,
    }, 15000);
    return res;
  },

  // ── 剪映 ──

  // POST /api/jianying/send（形态① 单个）
  async jianyingSend(params: {
    fileUrl?: string;
    localPath?: string;
    fileName?: string;
  }): Promise<{ status: string; message: string }> {
    const res = await fetchWithTimeout(`${LOCAL_TOOL_BASE}/api/jianying/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }, 5000);
    if (!res.ok) throw new ApiError('剪映发送失败', 'localtool_error', res.status);
    return res.json();
  },

  // POST /api/jianying/send（形态② 批量）
  async jianyingSendBatch(items: Array<{ fileUrl?: string; localPath?: string }>): Promise<{ status: string; count: number; message: string }> {
    const res = await fetchWithTimeout(`${LOCAL_TOOL_BASE}/api/jianying/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    }, 5000);
    if (!res.ok) throw new ApiError('剪映批量发送失败', 'localtool_error', res.status);
    return res.json();
  },
};

// ── 2.4 降级与兜底 ──

/** localTool 不可达时，kvGet 降级到 chrome.storage.local */
async function fallbackStorageGet(key: string): Promise<unknown> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      const result = await chrome.storage.local.get(key);
      const value = result[key];
      if (value !== undefined) {
        console.warn(`[api] localTool 不可达，从 chrome.storage 读取 key="${key}"`);
        return typeof value === 'string' ? JSON.parse(value) : value;
      }
    } catch {
      // chrome.storage 也不可用，返回 null
    }
  }
  return null;
}

// ── 兼容别名（供现有节点组件引用，逐步迁移后移除）──

/** @deprecated 使用 gateway.chatCompletion */
export const chatCompletion = gateway.chatCompletion.bind(gateway);

/** @deprecated 使用 gateway.imageGeneration */
export async function generateImage(model: string, prompt: string, options?: { size?: string; n?: number; image_size?: string }): Promise<{ data: { url?: string; b64_json?: string }[] }> {
  return gateway.imageGeneration({ model, prompt, ...options });
}

/** @deprecated 使用 gateway.imageEdit */
export const imageEdit = gateway.imageEdit.bind(gateway);

/** @deprecated 使用 gateway.videoGeneration */
export const videoGeneration = gateway.videoGeneration.bind(gateway);

/** @deprecated 使用 gateway.videoResult */
export const videoResult = gateway.videoResult.bind(gateway);

/** @deprecated 使用 gateway.uploadFile */
export const uploadFile = gateway.uploadFile.bind(gateway);

/** @deprecated 使用 gateway.queryTask */
export const queryTask = gateway.queryTask.bind(gateway);

/** @deprecated 使用 gateway.generate */
export const gatewayGenerate = gateway.generate.bind(gateway);

/** @deprecated 使用 gateway.pollTask */
export const pollTask = gateway.pollTask.bind(gateway);

/** @deprecated 使用 gateway.request */
export const gatewayRequest = gateway.request.bind(gateway);

/** @deprecated 使用 gateway.getBalance */
export const getBalance = gateway.getBalance.bind(gateway);

/** @deprecated 使用 localTool.upload */
export const downloadFile = async (url: string, _filename?: string): Promise<Blob> => {
  const res = await fetch(url);
  if (!res.ok) throw new ApiError(`下载失败: ${res.status}`, 'download_error', res.status);
  return res.blob();
};
