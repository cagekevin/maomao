/**
 * JSX Runtime 桥接
 * 从 vendor/vendor.js 导入 React，提供 JSX 编译所需的 jsx/jsxs/jsxDEV/Fragment。
 */
import { Nr as VendorReact } from './vendor/vendor.js';

const React: any = VendorReact;

export const jsx = React.jsx ?? React.createElement;
export const jsxs = React.jsxs ?? React.createElement;
export const jsxDEV = React.jsxDEV ?? React.createElement;
export const Fragment = React.Fragment;

export default React;
