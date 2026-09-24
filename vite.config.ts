import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'node:url';
// 端口真源：src/components/base/core/config.ts（本文件只复用它导出的常量，不写第二个 18080）
import { LOCAL_TOOL_PORT } from './src/components/base/core/config.ts';

/**
 * Vite 构建配置唯一真源（别名 · 产物输出 · chunk 拆分）。
 *
 * 更新(2026-09-23)：显式关闭「构建前清空 outDir」—— `build.emptyOutDir: false`。
 *
 *   背景（实测复现）：`public/mj-styles/` 有 986 个静态文件，经 Vite 原样拷进 `dist/mj-styles`；
 *   而 Vite 每次 build 前都会 `emptyDir(outDir)`，于是**连续第二次构建**必然要删这 986 个文件，
 *   超过编辑器安全删除防护的批量阈值（500）⇒ 被拦死在清目录这一步：
 *     [safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED] {"count":987,"threshold":500,...}
 *   现象极具误导性：`3432 modules transformed` 全部完成，报错却来自「构建」——
 *   实为环境防护拦截 `fs.rmSync`，与源码无关。手动清空 `dist` 后可正常构建
 *   （`✓ built in 25.46s`），故根因只在「清空 outDir」这一动作。
 *
 *   代价（已知并接受）：`dist/` 不再自动清空 ⇒ `dist/assets/` 会残留旧 hash 产物
 *   （文件名带 hash，不影响加载，但会累积、且 `scripts/1mao-scripts/verify-chunks.cjs`
 *   会连旧 chunk 一起逐个 import）。需要干净产物时**手动**执行（走系统删除，不经 Node 防护）：
 *     PowerShell: `Remove-Item -Recurse -Force dist`
 *
 *   为什么不选别的路：改回 `emptyOutDir: true` 即回到被拦状态；只在脚本里删 dist 也是 Node 进程，
 *   同样会被防护拦（阈值 500 只看文件数）。故此开关是唯一不依赖环境的稳定解。
 */

// 更新(2026-09-02)：配置随全仓 TS 化，.js→.ts。__dirname 是 CJS 全局，在 ESM 配置里之所以能用，
// 靠的是 Vite 打包配置时注入的 esbuild define——换个加载器（或直接 node 跑）就会变 undefined。
// 改用标准 ESM 写法，不依赖任何打包器注入，tsc 也能真校验（此前 .js + checkJs:false = 零检查）。
const rootDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * 取 id 中「最内层 node_modules/ 之后的包名」（支持 @scope/name）。
 * 必须取最内层：同一个包可能有多个副本（实测 zustand 三份 —— 顶层 ·
 * `tunnel-rat/node_modules`（drei 依赖）· `@xyflow/react/node_modules`）。
 * 只有归到同一个包名，才可能把同一包的所有子模块判进同一 chunk。
 */
function packageName(id: string): string | null {
  const marker = 'node_modules/';
  const i = id.lastIndexOf(marker);
  if (i === -1) return null;
  const rest = id.slice(i + marker.length);
  const seg = rest.split('/');
  return rest.startsWith('@') ? `${seg[0]}/${seg[1]}` : seg[0];
}

/**
 * dev 代理目标 origin —— 与前端 `API_BASE` **同口径**（真源 `src/components/base/core/config.ts`：
 * `VITE_API_BASE` 优先、缺省回本机 `LOCAL_TOOL_PORT`）。
 * 代理目标若与页面实际调用的后端不一致，dev 下会出现「API 通、模型 404」的静默分叉，故按同一 env 取。
 */
const DEV_ENV = loadEnv('development', rootDir, '');
const LOCAL_TOOL_ORIGIN = (DEV_ENV.VITE_API_BASE || `http://127.0.0.1:${LOCAL_TOOL_PORT}`).replace(
  /\/+$/,
  '',
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
    },
  },
  base: './', // 相对路径：兼容 Chrome 插件（side panel 通过 chrome-extension:// 加载）
  build: {
    outDir: 'dist',
    // 见文件头「更新(2026-09-23)」：禁止清空 dist —— public/mj-styles 的 986 个文件会让
    // emptyDir 触发 IDE 批量删除防护（阈值 500），把构建拦在清目录这一步。代价：assets 残留旧 hash。
    emptyOutDir: false,
    // 插件 CSP（manifest content_security_policy: script-src 'self'）不允许内联，交给 vite 外部化
    cssCodeSplit: false,
    sourcemap: false,
    // 动态 import 预加载保持默认开启（modulepreload 预取对按需加载体验有益）。
    // 「__vitePreload helper 被塞进大 vendor、导致主 chunk 静态依赖它」的问题，
    // 由下方 manualChunks 的 `vite/preload-helper` 拦截解决（留在入口，见下）。
    // ⚠️ 认知纠正：manualChunks 只负责「拆文件」，不改变加载时机。
    // 只要对重依赖节点是静态 import，拆出来的 chunk 仍会在首屏被强制下载。
    // vendor-3d(1.06MB)/vendor-media(705KB) 此前就是这样白占首屏的，
    // 真正解决靠的是把静态 import 换成 React.lazy（见 src/components/canvas/shell/lazyNode.tsx）。
    // 故阈值回调到 800：它是「新增重依赖」的报警器，此前为压警告调到 1500 反而掩盖了真问题。
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // ⚠️ Vite 动态 import 的预加载 helper（__vitePreload）必须留在入口 chunk。
          // 它被所有含动态 import 的 chunk 共享，若被下面的规则分进某个 vendor chunk，
          // 入口就会为拿这个几行的 helper 而静态 import 整个 vendor → 该大 chunk 首屏必载
          // （实测：vendor-3d 1MB 就是这么被拖进首屏的，白做 lazy 优化）。
          // Vite 的 __vitePreload helper（id 为 'vite/preload-helper'）必须留入口 chunk：
          // 它被所有含动态 import 的 chunk 共享，若被 Rollup 放进某个大 vendor（实测 vendor-3d），
          // 主 chunk 就为调用它而静态 import 整个 1MB vendor → 按需加载失效、首屏依旧全下。
          // 这是官方推荐的 manualChunks 处理（务必保持精确匹配 'vite/preload-helper'）。
          // Vite 的 __vitePreload helper（id 形如 '\u0000vite/preload-helper.js'，带空字符前缀）必须留入口：
          // 它被所有含动态 import 的 chunk 共享，若被 Rollup 放进大 vendor（实测 vendor-3d），
          // 主 chunk 就为调用它而静态 import 整个 1MB vendor → 按需加载失效。用 includes 匹配
          // （不能用 ===，id 带不可见的前缀）。commonjsHelpers 同理。
          if (id.includes('vite/preload-helper') || id.includes('commonjsHelpers'))
            return undefined;
          // 按 node_modules 顶层包名归组，让各库独立成 chunk 并复用共享依赖
          // 顺序很重要：three/@react-three 必须在 react 判断之前匹配，否则含 'react' 的
          // @react-three/fiber 会被误吸进 vendor-react，且 three 体积巨大应独立成 vendor-3d。
          if (id.includes('node_modules')) {
            // ── 规则 0（必须最先判）：同一个包的所有子模块必须落进同一个 chunk ──
            // 反例成因（2026-09-19 实测）：下面各条判据都是「路径子串」，但同一个包的子模块路径
            // 有的含 'react'、有的不含 —— `zustand/esm/react.mjs` 含 → vendor-react；而
            // `zustand/esm/vanilla.mjs`、`use-sync-external-store/**` 不含 → 无归属 → 被折进
            // 别的 chunk。同一个包被劈成两半 ⇒ 两 chunk 互相 import ⇒ Rollup 报
            //   「Circular chunk: vendor-3d -> vendor-react -> vendor-3d」
            // ⇒ 运行期 `Cannot access 'HE' before initialization`（vendor-3d 读 vendor-react
            //    尚未初始化的导出，TDZ），且 1.06MB 的 vendor-3d 被入口 chunk 静态 import
            //    （首屏必载，lazy 优化整体失效）。
            // 处置：按**包名**整包归组，归入低层 vendor-react —— 3D 侧依赖它是**单向**边，不成环
            //       （与 2026-08-20 修 @xyflow 的手法同源：不让循环的一方独立成 chunk）。
            const pkg = packageName(id);
            if (pkg === 'zustand' || pkg === 'use-sync-external-store') return 'vendor-react';
            if (id.includes('@react-three') || id.includes('/three/') || id.includes('three/build'))
              return 'vendor-3d';
            // @xyflow 不再独立成 chunk：它强依赖 react（peerDeps react>=17，模块顶部大量
            // `import { useState } from 'react'`）。若拆成 vendor-flow 独立 chunk，会与
            // vendor-react 形成循环 chunk，导致 vendor-flow 在 vendor-react 初始化完成前执行
            // → 运行时 `reading 'useState'` 但 React 为 undefined 崩溃（2026-08-20 修复）。
            // 让它随 react 归入 vendor-react（同 chunk 保证 React 先定义），消除循环。
            if (id.includes('mediabunny')) return 'vendor-media';
            if (id.includes('gifenc')) return 'vendor-media';
            if (id.includes('lucide-react')) return 'vendor-ui';
            if (id.includes('dagre')) return 'vendor-layout';
            if (id.includes('react')) return 'vendor-react';
          }
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5180,
    open: true,
    /**
     * 本机模型资产代理（plan 147 §六）—— 让 dev 与 prod **同源口径一致**。
     *
     * 【为什么必须代理】dev 页面在 5180、模型在 localTool 18080 ⇒ 直连即跨源；而模型取件**要求与页面同源**：
     * `base/core/runtimeModelUrl.ts` 头注已记载实证 —— 用绝对 URL 会让 transformers.js 的处理器组装静默失败
     * （`this.processor is not a function`）。故把两个前缀转发到 18080，前端**始终**用根相对 URL：
     * prod 下页面本身由 18080 托管 `dist/`（天然同源，零配置），dev 下靠本代理补齐。
     * 这样就不存在「按环境切换绝对/相对地址」的第二套 URL 口径。
     *
     * 【为什么 /depth-video 也转发】它是历史别名（同一物理根）。一并转发 ⇒ depth-video 链路
     * 在 dev 下**零行为改动**（仍是根相对取件，不再依赖绝对 URL + CORS）。
     */
    proxy: {
      '/models': { target: LOCAL_TOOL_ORIGIN },
      '/depth-video': { target: LOCAL_TOOL_ORIGIN },
    },
  },
});
