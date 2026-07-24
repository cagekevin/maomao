/**
 * React 全量桥接
 * React/ReactDOM 由 src/entry.js 统一解包后挂 window.__React/window.__ReactDOM，保证单实例。
 * 本文件供 vite alias 使用，使业务代码可安全使用 import { useState } from "react"。
 */

const React: any = (window as any).__React;
const ReactDOM: any = (window as any).__ReactDOM;

// JSX Runtime（供 @vitejs/plugin-react 编译产物使用）
export const jsx = React.jsx ?? React.createElement;
export const jsxs = React.jsxs ?? React.createElement;
export const jsxDEV = React.jsxDEV ?? React.createElement;
export const Fragment = React.Fragment;

// Hooks
export const useState = React.useState;
export const useEffect = React.useEffect;
export const useCallback = React.useCallback;
export const useMemo = React.useMemo;
export const useRef = React.useRef;
export const useLayoutEffect = React.useLayoutEffect;
export const useContext = React.useContext;
export const useReducer = React.useReducer;
export const useId = React.useId;
export const useImperativeHandle = React.useImperativeHandle;
export const useTransition = React.useTransition;
export const useDeferredValue = React.useDeferredValue;

// Component APIs
export const memo = React.memo;
export const forwardRef = React.forwardRef;
export const createElement = React.createElement;
export const createContext = React.createContext;
export const createRef = React.createRef;
export const cloneElement = React.cloneElement;
export const isValidElement = React.isValidElement;
export const Children = React.Children;
export const Component = React.Component;
export const PureComponent = React.PureComponent;

// ReactDOM
export const createPortal = ReactDOM?.createPortal ?? React.createPortal;
export const flushSync = ReactDOM?.flushSync;

export default React;
