/**
 * JSX Runtime 桥接
 * React 由 main.tsx 统一解包后挂 window，避免双实例。
 */
const React: any = (window as any).__React;

export const jsx = React.jsx ?? React.createElement;
export const jsxs = React.jsxs ?? React.createElement;
export const jsxDEV = React.jsxDEV ?? React.createElement;
export const Fragment = React.Fragment;

export default React;
