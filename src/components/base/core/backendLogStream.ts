/**
 * 后端 localTool 日志实时镜像到浏览器 console（F12 排查用，不建 UI）。
 *
 * 背景：localTool（:18080）是独立 Node 进程，其 console 日志不会出现在浏览器 F12，
 * 只能看启动终端 / localTool/logs/localtool_18080_*.log 文件。为在 F12 直接看后端日志，
 * 本模块用 EventSource 订阅后端已注册的 SSE 端点 `GET ${API_BASE}/api/logs/stream`
 * （见 localTool/src/routes/logs.ts + utils/logWriter.ts 的 broadcastLog），
 * 把每条经 logWriter 的日志行以 `[localTool]` 前缀实时镜像到浏览器 console。
 *
 * 定位与边界：
 *  - 这是「调试/排查镜像」，非业务日志，故不调 logger 自身（避免误触上报递归）。
 *  - 原生 console 按后端日志 level（error/warn/info/…）映射到 console.error/warn/log，
 *    便于 F12 按级别过滤、按 `[localTool]` 前缀一键只看后端。
 *  - SSE 无历史回放：连接建立前的后端日志看不到，需查 localTool/logs/*.log 或启动终端。
 *  - EventSource 依赖后端 `retry: 3000` 自动断线重连；后端不可达时静默待重连，绝不抛错干扰主链路。
 */
import { API_BASE } from './config.ts';

const STREAM_URL = `${API_BASE}/api/logs/stream`;
const LOG_PREFIX = '[localTool]';

let _subscribed = false;

/** 根据后端日志行首的 level 标签选择 console 方法（error/warn → 高亮，便于 F12 过滤） */
function consoleForLevel(line: string): (...args: unknown[]) => void {
  if (line.includes('[error]')) return console.error;
  if (line.includes('[warn]')) return console.warn;
  return console.log;
}

/**
 * 订阅一次后端日志 SSE 流并镜像到 console（幂等：重复调用仅首次生效）。
 * 在应用启动早期调用即可持续看到后端实时日志。
 */
export function subscribeBackendLogStream(): void {
  if (_subscribed) return;
  _subscribed = true;
  // 非浏览器环境（SSR/测试/构建）直接跳过，避免 EventSource 不存在报错
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;

  try {
    const es = new EventSource(STREAM_URL);
    es.onmessage = (ev: MessageEvent) => {
      // 每行是完整日志行（含 level 标签），追加 [localTool] 前缀并映射到对应 console 级别
      const line = String(ev.data || '');
      if (!line.trim()) return;
      consoleForLevel(line)(`${LOG_PREFIX} ${line}`);
    };
    es.onerror = () => {
      // 断线/后端不可达：EventSource 按服务端 retry 自动重连，这里不额外动作、不抛错
    };
  } catch {
    // 订阅失败静默，绝不影响主链路
  }
}
