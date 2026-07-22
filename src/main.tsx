// ============================================================
// 一毛AI画布 - 入口文件（当前运行原版引擎）
// 新版前端代码已移至 src/v2/，恢复时切换 import 路径即可
// ============================================================

// ── React 实例统一 ──
import './v2/react-bridge.ts';

// ── CSS 加载（沿用原版预编译 CSS）──
import './_engine/styles/index-bBckPAG7.css';
import './_engine/styles/vendor-Qkhkn02K.css';
import './_engine/styles/App-DFxwm5B3.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from './v2/components/ErrorBoundary';

// ── ResizeObserver 错误抑制（从 entry.js 提取）──
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  const msg = args.map(String).join(' ');
  if (
    msg.includes('ResizeObserver loop') ||
    msg.includes('ResizeObserver') ||
    msg.includes('Non-Error promise rejection')
  ) {
    return;
  }
  originalConsoleError.apply(console, args);
};

window.addEventListener('error', (event) => {
  const msg = event.message || '';
  if (msg.includes('ResizeObserver')) {
    event.stopImmediatePropagation();
    event.preventDefault();
  }
});

// ── App：原版引擎 ──
const App = React.lazy(() => import('./_engine/App.js'));

async function bootstrap(): Promise<void> {
  const rootEl = document.getElementById('root');
  if (!rootEl) {
    console.error('[main] 找不到 #root 元素');
    return;
  }

  const root = createRoot(rootEl);

  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  );
}

bootstrap();