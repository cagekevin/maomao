'use strict';
// Tier 2 回归测试：SSR 渲染所有节点组件，断言关键结构 class 存在。
// 不启动浏览器，零新增运行时依赖（用 esbuild bundle + react-dom/server）。
// 目的：重构节点后，确保"能渲染不崩 + 关键结构没丢"（拦住结构级回归）。
// 用法：node scripts/regression_test.cjs   （或 npm run test:regression）
const fs = require('fs');
const path = require('path');
const esbuild = require(path.resolve(__dirname, '..', 'node_modules/esbuild'));

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '.regression-entry.cjs');
const SRC = ROOT.replace(/\\/g, '/');

// SSR 测试入口：渲染各节点并断言关键结构（esbuild bundle 保证单 React 实例）
const entry = `
import React from 'react'
import { renderToString } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import ImageNode from '${SRC}/src/components/ImageNode.jsx'
import TextNode from '${SRC}/src/components/TextNode.jsx'
import PromptNode from '${SRC}/src/components/PromptNode.jsx'
import DiscountVideoNode from '${SRC}/src/components/DiscountVideoNode.jsx'

// 每个节点的渲染参数（数据 + 关键结构 class 断言）
const cases = [
  {
    name: '图片节点 ImageNode',
    Comp: ImageNode,
    props: { id: 'image-1', data: { label: '图片节点', demoImage: true }, selected: false },
    expect: [
      'group/node',                // 节点根
      'bg-surface-raised',         // 主容器（统一 NodeShell 外壳）
      'rounded-xl',                // 圆角
      'border-edge',               // 边框
      'cust-handle',               // 端口
    ],
  },
  {
    name: '文本节点 TextNode',
    Comp: TextNode,
    props: { id: 'text-1', data: { label: '文本节点' }, selected: false },
    expect: ['group/node', 'bg-surface-raised', 'rounded-xl', 'border-edge', 'cust-handle'],
  },
  {
    name: '生图节点 PromptNode',
    Comp: PromptNode,
    props: { id: 'prompt-1', data: { label: '生图节点', expanded: true }, selected: false },
    expect: ['group/node', 'bg-surface-raised', 'rounded-xl', 'border-edge', 'cust-handle'],
  },
  {
    name: '特惠视频 DiscountVideoNode',
    Comp: DiscountVideoNode,
    props: { id: 'discount-1', data: { label: '特惠视频', expanded: true }, selected: false },
    expect: ['group/node', 'bg-surface-raised', 'rounded-xl', 'border-edge', 'cust-handle'],
  },
]

let failed = 0
for (const c of cases) {
  try {
    const html = renderToString(
      React.createElement(ReactFlowProvider, null,
        React.createElement(c.Comp, c.props)
      )
    )
    const missing = (c.expect || []).filter((cls) => !c.optional?.includes(cls) && !html.includes(cls))
    if (missing.length > 0) {
      failed++
      console.error('  ✖ ' + c.name + ' 缺少结构: ' + missing.join(', '))
    } else {
      console.log('  ✔ ' + c.name + ' 结构完整 (' + html.length + ' chars)')
    }
  } catch (e) {
    failed++
    console.error('  ✖ ' + c.name + ' 渲染失败: ' + e.message)
  }
}
console.log(failed === 0 ? '  ALL PASS' : '  FAILED')
process.exit(failed === 0 ? 0 : 1)
`;

try {
  esbuild.buildSync({
    stdin: { contents: entry, resolveDir: ROOT, loader: 'jsx' },
    bundle: true,
    format: 'cjs',
    platform: 'node',
    outfile: OUT,
  });

  const child = require('child_process').spawnSync(
    process.execPath,
    [OUT],
    { cwd: ROOT, encoding: 'utf8' }
  );

  console.log('=== SSR 回归测试（react-nodes 原型） ===');
  console.log(child.stdout || '');
  if (child.stderr) console.error(child.stderr);
  if (child.status !== 0) {
    console.error('  退出码: ' + child.status);
    process.exit(child.status ?? 1);
  }
  process.exit(0);
} catch (e) {
  console.error('  回归测试执行失败: ' + e.message);
  process.exit(1);
} finally {
  if (fs.existsSync(OUT)) fs.unlinkSync(OUT);
}
