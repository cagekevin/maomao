import { API_BASE } from '@/components/base/core/config';

/**
 * 转写模型（huggingface）**唯一出站口**（TD-22-57 收口）。
 *
 * 【为什么有它】`@huggingface/transformers` 默认 `env.remoteHost = 'https://huggingface.co/'`
 * —— 转写 worker 会**直连公网**拉模型（120MB~1.6GB）。与 iconify 直连同母体：无唯一出站口、
 * 「无外网 / 必须走代理」环境下整体不可用、失败只表现为"转写转不动"。
 *
 * 【做法】把库的 `env.remoteHost` 指向 localTool 代理 `/api/hf/`：
 *   库请求 `<remoteHost><model>/resolve/<rev>/<file>` → `<API_BASE>/api/hf/<model>/resolve/<rev>/<file>`
 *   → 后端转发到 `https://huggingface.co/<model>/resolve/<rev>/<file>`（见 `localTool/src/routes/hf.ts`）。
 *
 * 【调用时机】必须在**创建 pipeline 之前**调用（worker 首件事），否则库已用默认 host 发请求。
 *
 * 【诚实边界】库另会从 `cdn.jsdelivr.net` 取 onnxruntime-web 的 wasm —— 那一路是静态 CDN、
 * 非模型仓库，**不在本代理内**（如需离线另收口；勿混为一谈）。
 */
export const HF_PROXY_BASE = `${API_BASE}/api/hf/`;

/**
 * 把 transformers.js 的模型出站指向 localTool 代理（幂等：重复调用无副作用）。
 * @param env transformers.js 的 `env` 对象（由调用方从库 import，避免主包静态依赖）
 */
export function applyHfProxyHost(env: { remoteHost?: string; remotePathTemplate?: string }): void {
  env.remoteHost = HF_PROXY_BASE;
  // 路径模板是库默认值，显式写死以防上版本漂移（`{model}/resolve/{revision}/`）。
  env.remotePathTemplate = '{model}/resolve/{revision}/';
}
