'use strict';
// 给 src/bundle 下每个 1.4.0 chunk 顶部插入「角色注释」（可重跑，已加则跳过）。
// 任务书强制交付物（§交付可读性门槛 / §交付物 line 286）：每个 chunk 顶部一段注释，
// 写明「本文件角色 / 主要导出 / 对接后端或模块 / 接手 AI 改动时注意」，
// 供接手 AI 一眼定位、不用 grep 半天。注释是纯注解、不改变运行时行为，Vite 重建会重新压缩剥离。
//
// 注意：此处按 1.4.0 实际 chunk 名（铁律 #1 锁定证据）建映射，不是 1.3.5 名（铁律 #2）。
// 重跑 beautify.cjs 会覆盖 src/bundle，此时再跑本脚本即可重新补注释（幂等）。

const fs = require('fs');
const path = require('path');

const BUNDLE = path.resolve(__dirname, '../src/bundle').replace(/\\/g, '/');
if (!fs.existsSync(BUNDLE)) {
  console.error('未找到 src/bundle：', BUNDLE);
  process.exit(1);
}

// chunk 文件名 -> 角色注释块（1.4.0 实测名）
const HEADERS = {
  'main-1TOrc0Z5.js': {
    role: '侧边栏入口（side_panel bootstrap）',
    exports: 'export { j as _ }（preload 助手）',
    dep: '引用 endpointConfig（接入点引导）、App（动态 import 主程序）',
    note: '勿改 ES module 加载顺序；引导/RootErrorBoundary 在此。改端点只走 endpointConfig。',
  },
  'App-D5SRQxl_.js': {
    role: '主程序：节点画布 / 资源库 / 多账号 / 提示词库 / 本地引擎对接',
    exports: 'export { mr as default }（主组件 mr）',
    dep: '引用 vendor / endpointConfig / httpClient / src-- 共享 chunk',
    note: '业务核心，可改功能但勿重构、勿重排初始化；运行时字符串契约（API 路径/存储键/端口）一个字都不能动（见 MODULE_MAP §4）。',
  },
  'share-CymbjOw4.js': {
    role: '分享页入口（独立页面，非 side_panel）',
    exports: '动态 import ShareAppPage 主程序',
    dep: '设置 window.__CANVAS_RUNTIME__={disableLocalTool:true}；引用 ShareAppPage',
    note: '分享/预览链接页面。改前确认这是独立入口，不影响侧边栏。',
  },
  'ShareAppPage-BVCmVrHF.js': {
    role: '分享页主程序（只读预览渲染）',
    exports: 'default 导出（分享页主组件）',
    dep: '引用 vendor / httpClient（只读拉取）',
    note: '只读渲染分享内容，勿引入写操作或本地引擎调用。',
  },
  'endpointConfig-Bt85xi8d.js': {
    role: '接入点配置（host 重写 / Chrome 扩展检测 / 端口 18080 / 默认端点）',
    exports: 'export { i as a, t as c, v as i, _ as n, n as o, g as r, r as s, c as t }',
    dep: '被 main / App / httpClient 引用；含存储键 active_api_endpoint',
    note: '改后端端点地址的唯一安全入口（只改 host/端口这类可切换项）。API 路径与存储键字符串契约不可动（MODULE_MAP §4）。',
  },
  'httpClient-Bqba_SHR.js': {
    role: 'HTTP 客户端（/api/* 本地引擎 + /v1/* AI 网关全路由）',
    exports: '导出全部 HTTP 函数（KV/文件/任务/资源/代理/剪映 + apimart /v1/* 生成）',
    dep: '引用 endpointConfig（基础 URL）；被 App / endpointConfig 等引用',
    note: '对接两后端：localTool(127.0.0.1:18080) 与 apimart-gateway(:8000/:9004)。路径与请求体形状必须与契约一致，一个字都不能动。',
  },
  'src--1UFFpRm.js': {
    role: '共享业务 chunk（公共依赖，被 App 等引用）',
    exports: '导出公共业务符号（见 MODULE_MAP §2）',
    dep: '被 App 等引用',
    note: '共享代码，改动需全树 grep 引用确认同步。',
  },
  'src-CzHn9cDd.js': {
    role: 'Vite modulepreload polyfill（纯副作用，无导出）',
    exports: '无导出（仅注入 modulepreload 助手）',
    dep: '被各 chunk 作为副作用 import',
    note: '运行时代码，勿改；构建已设 modulePreload:false，此垫片实际无副作用。',
  },
  'mediabunny-mp3-encoder-1kfWdaog.js': {
    role: '音频 MP3 编码（第三方包装）',
    exports: 'export { v as registerMp3Encoder }',
    dep: '被业务 chunk 引用',
    note: '原样携带，勿反编译、勿改导出名 registerMp3Encoder。',
  },
  'vendor-Z-adA07W.js': {
    role: '第三方依赖（React / ReactDOM / @xyflow/react / localforage / lucide 等）',
    exports: '以压缩别名暴露（Fr=React、Ir=ReactDOM、Pr=preload 助手…）',
    dep: '被全部业务 chunk 引用',
    note: '禁止反编译、禁止改导出别名（会破坏所有 import 源名）。详见 MODULE_MAP §2。',
  },
  'rolldown-runtime-aKtaBQYM.js': {
    role: 'rolldown 运行时节（内部运行时符号）',
    exports: '导出运行时内部符号（e/t/n/r/i/a/o/s 等）',
    dep: '被全部 chunk 引用',
    note: '禁止改动；运行时代码。',
  },
  '__vite-browser-external-JD6iV1p1.js': {
    role: 'Vite 浏览器外置垫片（external 模块桩）',
    exports: '垫片导出（如 node 内置模块 stub）',
    dep: '被业务 chunk 引用',
    note: '原样携带，勿改。',
  },
};

// 每个 chunk 的「功能分区 / 区域」速览（供接手 AI 看注释即知要不要读此文件，不必先翻 MODULE_MAP）。
// App 含全部 6 大区域；其余 chunk 标注各自职责范围。依据见 scripts/region_labels.json。
const REGION_NOTES = {
  'main-1TOrc0Z5.js':          '引导层：侧边栏 bootstrap / 接入点引导 / RootErrorBoundary（不含业务区域）',
  'App-D5SRQxl_.js':           '含全部 6 大区域：core:account(账号) / core:localEngine(本地引擎) / core:storage(存储) / panel:mr(主面板·8 子组件) / shared(共享·18) / ui-misc(UI·41) —— 详见 MODULE_MAP §3',
  'share-CymbjOw4.js':         '分享页入口：独立页面，disableLocalTool=true，不含侧边栏业务区域',
  'ShareAppPage-BVCmVrHF.js':  '分享页主程序：只读渲染，对应 panel:mr 的只读子集',
  'endpointConfig-Bt85xi8d.js':'接入点配置层：host 重写 / 端口 18080 / 存储键（对应 core:localEngine 的端点侧）',
  'httpClient-Bqba_SHR.js':    '网络层：localTool(/api/*) + apimart-gateway(/v1/*) 全路由封装（被各业务区域调用）',
  'src--1UFFpRm.js':           '共享业务依赖层（被 App 的多个区域引用）',
  'src-CzHn9cDd.js':           '运行时节（modulepreload polyfill，无业务区域）',
  'mediabunny-mp3-encoder-1kfWdaog.js': '第三方音频编码（原样携带）',
  'vendor-Z-adA07W.js':        '第三方依赖层（React/@xyflow/localforage 等，无业务区域）',
  'rolldown-runtime-aKtaBQYM.js': '运行时节（无业务区域）',
  '__vite-browser-external-JD6iV1p1.js': '运行时节（无业务区域）',
};

const MARKER = '[A22 chunk header]';
let added = 0, skipped = 0, upgraded = 0;

// 去除已存在的本工程注释块（幂等升级：旧注释缺「本文件功能分区」行时重建）
function stripHeader(src) {
  const m = '/**\n * ' + MARKER;
  if (!src.startsWith(m)) return src;
  const end = src.indexOf('*/');
  if (end === -1) return src;
  let rest = src.slice(end + 2);
  if (rest.startsWith('\n')) rest = rest.slice(1);
  return rest;
}

for (const f of fs.readdirSync(BUNDLE)) {
  if (!f.endsWith('.js')) continue;
  const file = path.join(BUNDLE, f).replace(/\\/g, '/');
  let src = fs.readFileSync(file, 'utf8');
  const hadHeader = src.startsWith('/**\n * ' + MARKER);
  if (hadHeader) src = stripHeader(src); // 先剥旧注释，下面统一重加（含新行）
  const meta = HEADERS[f];
  if (!meta) {
    if (hadHeader) { fs.writeFileSync(file, src); } // 还原（极少见：已登记丢失）
    console.warn('跳过未登记 chunk（无角色信息）：', f);
    continue;
  }
  const block = [
    '/**',
    ` * ${MARKER}`,
    ` * 逆向还原工程 A22 · 1.4.0 · chunk: ${f}`,
    ` * 角色：${meta.role}`,
    ` * 主要导出：${meta.exports}`,
    ` * 对接后端/模块：${meta.dep}`,
    ` * 本文件功能分区：${REGION_NOTES[f] || '—'}`,
    ` * 接手 AI 改动注意：${meta.note}`,
    ' */',
    '',
  ].join('\n');
  fs.writeFileSync(file, block + src);
  if (hadHeader) { upgraded++; console.log('已升级注释：', f); }
  else { added++; console.log('已加注释：', f); }
}

console.log(`\n完成：新增 ${added} 个，升级(旧注释重加) ${upgraded} 个，跳过(未登记) ${skipped} 个。`);
