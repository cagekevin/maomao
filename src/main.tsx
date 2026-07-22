// ============================================================
// 一毛AI画布 - 入口文件（当前运行 V1 原版引擎）
// 引擎位于 src/App.js（原 src/_engine/App.js，2026-07-22 扁平化到 src/ 根）
// V2 重写已暂停并删除，不参与运行
// ============================================================

// ── React 实例统一 ──
import './react-bridge.ts';

// ── CSS 加载（沿用原版预编译 CSS）──
import './styles/tailwind.css';
import './styles/vendor.css';
import './styles/app.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from './ErrorBoundary';

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
const App = React.lazy(() => import('./App.js'));

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