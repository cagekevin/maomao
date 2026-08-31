'use strict';
// Tier 2 回归测试：SSR 渲染所有节点组件，断言关键结构 class 存在。
// 不启动浏览器，零新增运行时依赖（用 esbuild bundle + react-dom/server）。
// 目的：重构节点后，确保"能渲染不崩 + 关键结构没丢"（拦住结构级回归）。
// 用法：node scripts/regression_test.cjs   （或 npm run test:regression）
const fs = require('fs');
const path = require('path');
const esbuild = require(path.resolve(__dirname, '..', 'node_modules/esbuild'));
// 扩展名无关解析：节点组件转 .tsx 后，写死 .jsx 的 import 路径会直接让整轮 SSR 回归挂掉
const { resolveSourceFile } = require('./ts-exts.cjs');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '.regression-entry.cjs');

/**
 * 逻辑路径（不带扩展名）→ esbuild 可直接 import 的 posix 绝对路径。
 * 扩展名无关：组件转 .tsx 后这里无需改动。
 */
const P = (rel) => (resolveSourceFile(path.join(ROOT, rel)) || rel).replace(/\\/g, '/');

// ── 需要渲染的节点组件清单（16 个可 SSR 的纯 DOM 节点：14 paletteNodes + 3 QWE 隐藏节点，
//    去掉 director3dNode —— 它是 §2.13 定义的 3D 子工程入口，依赖 WebGL + Vite import.meta.glob，
//    无法在 Node SSR 下运行，由 L4（Playwright，有 WebGL）覆盖。GhostTarget/ConnectionLine/
//    CustomEdge 不是节点，不在此列。）──
const entry = `
import React from 'react'
import { renderToString } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import ImageNode from '${P('src/components/nodes/ImageNode')}'
import TextNode from '${P('src/components/nodes/TextNode')}'
import PromptNode from '${P('src/components/nodes/PromptNode')}'
import DiscountVideoNode from '${P('src/components/nodes/DiscountVideoNode')}'
import VideoExtractNode from '${P('src/components/nodes/VideoExtractNode')}'
import ImageBoxNode from '${P('src/components/nodes/ImageBoxNode')}'
import GridSplitNode from '${P('src/components/nodes/GridSplitNode')}'
import GridMergeNode from '${P('src/components/nodes/GridMergeNode')}'
import VideoProcessNode from '${P('src/components/nodes/VideoProcessNode')}'
import FaceMosaicNode from '${P('src/components/nodes/FaceMosaicNode')}'
import PanoramaNode from '${P('src/components/nodes/PanoramaNode')}'
import GroupNode from '${P('src/components/nodes/GroupNode')}'
import ScriptBoxNode from '${P('src/components/nodes/ScriptBoxNode')}'
import { defaultNodeData } from '${P('src/components/base/NodePalette')}'

// 每个节点的渲染参数（数据 + 关键结构断言）
// expect：该节点真实且稳定的结构标记（统一外壳 NodeShell + 端口 + 独有标识）。
// 注：VideoProcessNode 是老式节点（无 bg-surface-raised/rounded-xl 外壳，但有 data-node-id）；
//     group / scriptBoxNode 作为容器/动态端口节点，shots=[] 时无 react-flow__handle，故不强制。
const cases = [
  { name: '图片视频素材 ImageNode', Comp: ImageNode, type: 'imageNode', expect: ['group/node','bg-surface-raised','rounded-xl','border-edge','react-flow__handle','图片'] },
  { name: '文本 TextNode', Comp: TextNode, type: 'textNode', expect: ['group/node','bg-surface-raised','rounded-xl','border-edge','react-flow__handle','文本'] },
  { name: '生图 PromptNode', Comp: PromptNode, type: 'promptNode', expect: ['group/node','bg-surface-raised','rounded-xl','border-edge','react-flow__handle','生图节点'] },
  // 标题断言跟随 NodePalette 的 label（2026-08-31：'特惠视频' 已改名 '视频生成'）。
  // ⚠️ 此前被 import.meta.env 崩溃掩盖（SSR 打包后第一步就挂），修复后才暴露。
  { name: '视频生成 DiscountVideoNode', Comp: DiscountVideoNode, type: 'discountVideoNode', expect: ['group/node','bg-surface-raised','rounded-xl','border-edge','react-flow__handle','视频生成'] },
  { name: '视频抽帧 VideoExtractNode', Comp: VideoExtractNode, type: 'videoExtractNode', expect: ['group/node','bg-surface-raised','rounded-xl','border-edge','react-flow__handle','视频抽帧'] },
  { name: '图片盒子 ImageBoxNode', Comp: ImageBoxNode, type: 'imageBoxNode', expect: ['group/node','bg-surface-raised','rounded-xl','border-edge','react-flow__handle','图片盒子'] },
  { name: '图片切分 GridSplitNode', Comp: GridSplitNode, type: 'gridSplitNode', expect: ['group/node','bg-surface-raised','rounded-xl','border-edge','react-flow__handle','图像切分'] },
  { name: '图片拼图 GridMergeNode', Comp: GridMergeNode, type: 'gridMergeNode', expect: ['group/node','bg-surface-raised','rounded-xl','border-edge','react-flow__handle','图像拼图'] },
  { name: '视频处理 VideoProcessNode', Comp: VideoProcessNode, type: 'videoProcessNode', expect: ['group/node','react-flow__handle','视频处理'] },
  { name: '人脸打码 FaceMosaicNode', Comp: FaceMosaicNode, type: 'faceMosaicNode', expect: ['group/node','bg-surface-raised','rounded-xl','border-edge','react-flow__handle','人脸打码'] },
  { name: '全景图 PanoramaNode', Comp: PanoramaNode, type: 'panoramaNode', expect: ['group/node','bg-surface-raised','rounded-xl','border-edge','react-flow__handle','720全景图'] },
  { name: '编组 GroupNode', Comp: GroupNode, type: 'group', expect: ['group/node','bg-surface-raised','rounded-xl','border-edge','编组'] },
  { name: '剧本盒子 ScriptBoxNode', Comp: ScriptBoxNode, type: 'scriptBoxNode', expect: ['group/node','bg-surface-raised','rounded-xl','border-edge','剧本盒子'] },
]

let failed = 0
for (const c of cases) {
  try {
    const html = renderToString(
      React.createElement(ReactFlowProvider, null,
        React.createElement(c.Comp, { id: c.type + '-1', data: defaultNodeData(c.type), selected: false })
      )
    )
    const missing = c.expect.filter((cls) => !html.includes(cls))
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
console.log('共 SSR 渲染 ' + cases.length + ' 个节点（director3dNode 依赖 WebGL，由 L4 覆盖）')
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
    // Node 下没有 Vite 的 import.meta.env，CJS 里它会被编译成空对象 → 读 .DEV 直接崩。
    // 打包期兜成空对象，保证 SSR 回归可跑（仅影响本测试产物，不改源码行为）。
    // ⚠️ 源码侧隐患：src/hooks/useConnectedInputs.ts 用的是 `import.meta.env.DEV`（无可选链），
    //    与 config.js「env 读取集中且一律用 ?.」的约定不一致。
    define: { 'import.meta.env': '{}' },
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
