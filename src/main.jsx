import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/base/ErrorBoundary.jsx'
import '@xyflow/react/dist/style.css'
import './index.css'
import { initStorage } from './components/base/storageAdapter.js'

// Chrome 插件环境：启动时从 chrome.storage.local 加载配置缓存；普通环境无副作用
initStorage()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
