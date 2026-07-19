// App.tsx — 桥接文件
// 当前 main.tsx 仍 lazy import 引擎 App.js
// 新的 AppShell 在 src/AppShell.tsx，完成后切换 main.tsx 入口
export { default } from './AppShell';