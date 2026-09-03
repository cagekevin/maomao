/**
 * Tier 2 SSR 结构回归测试（原 scripts/regression_test.cjs 的 vitest 移植版）。
 *
 * 用 react-dom/server 的 renderToString 在 Node 环境下渲染各节点组件，
 * 断言关键结构（统一外壳 + 端口 + 独有标识）存在，拦住重构导致的结构级回归。
 *
 * 为什么迁到 vitest：
 *  - 原脚本用 esbuild 把前端（Vite）组件打成 CJS 再跑，触发 "import.meta is not available
 *    with cjs" 警告（director3d/log.ts 等源码侧隐患被暴露）。
 *  - vitest 原生支持 import.meta.env / ESM，无需 esbuild CJS 黑魔法，warning 从源头消失。
 *  - 节点组件依赖浏览器 API（ResizeObserver/matchMedia 等）已由 tests/setup.mjs 在 node 环境垫好。
 *
 * 不覆盖 director3dNode：它依赖 WebGL + import.meta.glob，无法在 Node SSR 下运行，
 * 由 L4（Playwright，有 WebGL）覆盖。
 */
import React from 'react'
import { renderToString } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import { describe, test, expect } from 'vitest'

import ImageNode from '@/components/nodes/ImageNode'
import TextNode from '@/components/nodes/TextNode'
import PromptNode from '@/components/nodes/PromptNode'
import DiscountVideoNode from '@/components/nodes/DiscountVideoNode'
import VideoExtractNode from '@/components/nodes/VideoExtractNode'
import ImageBoxNode from '@/components/nodes/ImageBoxNode'
import GridSplitNode from '@/components/nodes/GridSplitNode'
import GridMergeNode from '@/components/nodes/GridMergeNode'
import VideoProcessNode from '@/components/nodes/VideoProcessNode'
import FaceMosaicNode from '@/components/nodes/FaceMosaicNode'
import PanoramaNode from '@/components/nodes/PanoramaNode'
import GroupNode from '@/components/nodes/GroupNode'
import ScriptBoxNode from '@/components/nodes/ScriptBoxNode'
import { defaultNodeData } from '@/components/base/canvas/NodePalette'

// 每个节点的渲染参数（数据 + 关键结构断言）。
// expect：该节点真实且稳定的结构标记（统一外壳 NodeShell + 端口 + 独有标识）。
// 注：VideoProcessNode 是老式节点（无 bg-surface-raised/rounded-xl 外壳，但有 data-node-id）；
//     group / scriptBoxNode 作为容器/动态端口节点，shots=[] 时无 react-flow__handle，故不强制。
const cases = [
  { name: '图片视频素材 ImageNode', Comp: ImageNode, type: 'imageNode', expect: ['group/node', 'bg-surface-raised', 'rounded-xl', 'border-edge', 'react-flow__handle', '图片'] },
  { name: '文本 TextNode', Comp: TextNode, type: 'textNode', expect: ['group/node', 'bg-surface-raised', 'rounded-xl', 'border-edge', 'react-flow__handle', '文本'] },
  { name: '生图 PromptNode', Comp: PromptNode, type: 'promptNode', expect: ['group/node', 'bg-surface-raised', 'rounded-xl', 'border-edge', 'react-flow__handle', '生图节点'] },
  // 标题断言跟随 NodePalette 的 label（'特惠视频' 已改名 '视频生成'）。
  { name: '视频生成 DiscountVideoNode', Comp: DiscountVideoNode, type: 'discountVideoNode', expect: ['group/node', 'bg-surface-raised', 'rounded-xl', 'border-edge', 'react-flow__handle', '视频生成'] },
  { name: '视频抽帧 VideoExtractNode', Comp: VideoExtractNode, type: 'videoExtractNode', expect: ['group/node', 'bg-surface-raised', 'rounded-xl', 'border-edge', 'react-flow__handle', '视频抽帧'] },
  { name: '图片盒子 ImageBoxNode', Comp: ImageBoxNode, type: 'imageBoxNode', expect: ['group/node', 'bg-surface-raised', 'rounded-xl', 'border-edge', 'react-flow__handle', '图片盒子'] },
  { name: '图片切分 GridSplitNode', Comp: GridSplitNode, type: 'gridSplitNode', expect: ['group/node', 'bg-surface-raised', 'rounded-xl', 'border-edge', 'react-flow__handle', '图像切分'] },
  { name: '图片拼图 GridMergeNode', Comp: GridMergeNode, type: 'gridMergeNode', expect: ['group/node', 'bg-surface-raised', 'rounded-xl', 'border-edge', 'react-flow__handle', '图像拼图'] },
  { name: '视频处理 VideoProcessNode', Comp: VideoProcessNode, type: 'videoProcessNode', expect: ['group/node', 'react-flow__handle', '视频处理'] },
  { name: '人脸打码 FaceMosaicNode', Comp: FaceMosaicNode, type: 'faceMosaicNode', expect: ['group/node', 'bg-surface-raised', 'rounded-xl', 'border-edge', 'react-flow__handle', '人脸打码'] },
  { name: '全景图 PanoramaNode', Comp: PanoramaNode, type: 'panoramaNode', expect: ['group/node', 'bg-surface-raised', 'rounded-xl', 'border-edge', 'react-flow__handle', '720全景图'] },
  { name: '编组 GroupNode', Comp: GroupNode, type: 'group', expect: ['group/node', 'bg-surface-raised', 'rounded-xl', 'border-edge', '编组'] },
  { name: '剧本盒子 ScriptBoxNode', Comp: ScriptBoxNode, type: 'scriptBoxNode', expect: ['group/node', 'bg-surface-raised', 'rounded-xl', 'border-edge', '剧本盒子'] },
]

describe('SSR 结构回归（react-nodes 节点组件）', () => {
  for (const c of cases) {
    test(`${c.name} 结构完整`, () => {
      const html = renderToString(
        React.createElement(
          ReactFlowProvider,
          null,
          React.createElement(c.Comp as React.ComponentType<{ id: string; data: unknown; selected: boolean }>, {
            id: c.type + '-1',
            data: defaultNodeData(c.type),
            selected: false,
          })
        )
      )
      const missing = c.expect.filter((cls) => !html.includes(cls))
      expect(missing, `节点 ${c.name} 缺少结构: ${missing.join(', ')}`).toEqual([])
    })
  }
})
