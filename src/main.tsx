import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/base/ui/feedback/ErrorBoundary.tsx';
import '@xyflow/react/dist/style.css';
import './index.css';
// cutia 编辑器主题（作用域隔离，全部规则限定在 .ve-scope 内）。
// 必须在 index.css 之后：Vite 保序，确保 .ve-scope 变量晚于 @tailwind base 生效。
// 见 docs/130-cutia搬迁计划书-2026-09-14.md。
import './components/videoEditor/videoEditorTheme.css';
import { initStorage } from './components/base/storage';
import { logger } from './components/base/core/log/logger.ts';
import { subscribeBackendLogStream } from './components/base/core/log/backendLogStream.ts';

// Chrome 插件环境：启动时从 chrome.storage.local 加载配置缓存；普通环境无副作用
initStorage();

// 启动即镜像后端 localTool 实时日志到浏览器 console（带 [localTool] 前缀，F12 可看）
// 失败静默重连，不影响主链路；见 backendLogStream.ts 文件头
subscribeBackendLogStream();

// ── 全局异常兜底（P0-5）────────────────────────────────────────────
// window error / unhandledrejection 统一定向 logger.error（→ localTool /api/logs 落盘），
// 让「异步回调/定时器/非渲染期 JS 异常」从"隐形"变"可排查"——这类异常 ErrorBoundary 罩不到。
// 设计要点：
//  ① 只记不可还原的运行时异常，符合 logger 头注释"高价值"原则；
//  ② 相同 (type+name+message) 5s 内合并，避免同一错误连续触发刷爆日志文件；
//  ③ 自身用朴素 try/catch 兜底，防兜底逻辑再抛导致无限递归。
const _globalErrThrottle = { key: '', ts: 0, suppressed: 0 };
/** 已知无害告警的累计次数（只计数、不写错误日志；首次出现时 warn 一次 → 过滤 ≠ 静默丢）。 */
const _harmlessSeen = new Map<string, number>();
// 【已知无害告警过滤】ReactFlow（@xyflow/react）内部 useResizeObserver 在「新建节点挂载瞬间」
// 对节点 wrapper 注册观察 + 回调内调 updateNodeInternals，会偶发触发浏览器原生
// `ResizeObserver loop completed with undelivered notifications`：
//  - 所有节点类型新建都会偶发（已用 e2e 复现验证，非业务代码问题）；
//  - 发生在挂载瞬间的一次性竞态，节点尺寸稳定后不再触发，功能不受影响；
//  - 无 stack（非应用 JS 抛错），是浏览器派发的 error 事件。
// 第三方库内部行为项目代码无法根治，故在此过滤，避免污染错误日志。
const _HARMLESS_GLOBAL_ERROR_MSGS = ['ResizeObserver loop', 'ResizeObserver loop completed'];
function reportGlobalError(type: string, e: unknown) {
  try {
    const message =
      e instanceof Error
        ? e.message
        : typeof e === 'string'
          ? e
          : e && typeof e === 'object' && 'message' in e
            ? String(e.message)
            : '';
    // 已知无害的浏览器/库内部告警：不写错误日志（避免污染），但**必须可观测** ——
    // 首次出现 warn 一次 + 累计计数；否则「过滤」退化成「静默丢」（2026-09-17 TD-16-33④）。
    if (_HARMLESS_GLOBAL_ERROR_MSGS.some((m) => message.includes(m))) {
      const seen = (_harmlessSeen.get(message) ?? 0) + 1;
      _harmlessSeen.set(message, seen);
      // 首次 + 每 100 次各留一条：**计数必须有出口** —— 否则「累计次数」只活在内存里、谁也读不到，
      // 那是「过滤」退化成「静默丢」的另一种写法（TD-16-33③ 残留，2026-09-17 补）。
      if (seen === 1 || seen % 100 === 0)
        logger.warn('运行时', '已知无害告警，已过滤（累计）', { message, seen });
      return;
    }
    const isError = e instanceof Error;
    const name = isError ? e.name : 'Error';
    const stack = isError && e.stack ? e.stack : '';
    const key = `${type}:${name}:${message}`;
    const now = Date.now();
    if (key === _globalErrThrottle.key && now - _globalErrThrottle.ts < 5000) {
      // 节流只限**日志频率**：被压掉的次数必须带出去，否则「降噪」变「静默丢」（TD-16-33④）
      _globalErrThrottle.suppressed += 1;
      return;
    }
    const suppressed = _globalErrThrottle.suppressed;
    _globalErrThrottle.key = key;
    _globalErrThrottle.ts = now;
    _globalErrThrottle.suppressed = 0;
    logger.error('运行时', type, {
      name,
      message,
      error: String(e),
      stack,
      ...(suppressed ? { suppressedInWindow: suppressed } : {}),
    });
  } catch {
    // catch-ok: RECURSION_GUARD
    /* 防递归：全局兜底自身异常不再上报 */
  }
}
window.addEventListener('error', (e) => reportGlobalError('windowError', e.error || e));
window.addEventListener('unhandledrejection', (e) =>
  reportGlobalError('unhandledRejection', e.reason),
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
