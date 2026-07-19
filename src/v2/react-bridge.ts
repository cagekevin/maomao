/**
 * React 实例统一桥接
 * 将项目 React 挂载到 window.React，让 engine 代码使用同一实例
 * 消除双 React 实例导致的 #306/#300 冲突
 *
 * 必须在所有其他 import 之前执行
 */

import React from 'react';
import ReactDOM from 'react-dom';

// 挂载到全局
(window as unknown as Record<string, unknown>).React = React;
(window as unknown as Record<string, unknown>).ReactDOM = ReactDOM;

export { React, ReactDOM };
