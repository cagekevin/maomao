import _cmp_H_ from './H_.jsx';
import { e, Ie } from './shared.js';
export default function V_(e) {
  const Component2909 = `style`;
  return <Ie>
      <Component2909>{`
        .react-flow__attribution { display: none !important; visibility: hidden !important; opacity: 0 !important; }
        .xyflow__attribution { display: none !important; visibility: hidden !important; opacity: 0 !important; }
        .react-flow__pane { pointer-events: auto !important; }
        .nopan { cursor: auto; }
        .nodrag { cursor: auto; }
        .react-flow__node { overflow: visible !important; }

        /* Level of Detail (LOD) — 分级渲染降级，缓解 100+ 节点 + 大图/视频时的卡顿 */
        /* lod-1（zoom <= 0.5）：视频解码代价最高，先隐藏 */
        .lod-1 .react-flow__node video { display: none; }
        /* lod-2（zoom <= 0.3）：再隐藏图片，节点保留外形与 handle 用于连线 */
        .lod-2 .react-flow__node img { visibility: hidden; }
        /* lod-3（zoom <= 0.2）：兜底全局降级（保持原有行为） */
        .lod-3 .react-flow__node iframe { display: none; }
        .lod-3 .react-flow__node textarea { visibility: hidden; }
        .lod-3 .react-flow__node input { visibility: hidden; }
        .lod-3 .react-flow__node button { visibility: hidden; }
        .lod-3 .react-flow__node .nodrag { opacity: 0; pointer-events: none; }
        .lod-3 .react-flow__node .node-content { display: none; }
        .lod-3 .react-flow__node { opacity: 0.8; transition: opacity 0.2s; }

        /* Pan/zoom 热路径性能模式：移动视口时避免边动画参与每帧合成；不改节点子树，避免 ReactFlow 测量抖动 */
        .viewport-moving.pan-performance-mode.is-large-canvas .react-flow__edges,
        .viewport-moving.pan-performance-mode.is-large-canvas .react-flow__connectionline {
          opacity: 0 !important;
          pointer-events: none !important;
        }
        .viewport-moving .react-flow__edge,
        .viewport-moving .react-flow__edge * {
          transition: none !important;
          animation: none !important;
          box-shadow: none !important;
          filter: none !important;
        }
        .viewport-moving.pan-performance-mode .cust-edge-glow,
        .viewport-moving.pan-performance-mode .cust-edge-comet {
          display: none !important;
        }
        .viewport-moving.pan-performance-mode .react-flow__edge-text,
        .viewport-moving.pan-performance-mode .react-flow__edge-label,
        .viewport-moving.pan-performance-mode .react-flow__edgeupdater {
          opacity: 0 !important;
          pointer-events: none !important;
        }
        .viewport-moving.pan-performance-mode .react-flow__background {
          opacity: 0 !important;
        }

        /* 大画布轻量模式：仅收窄 hit 区降低命中测试成本。
           连线彗星/辉光的开关已下放到 CustomEdge：按「是否在可视区 + 是否处于低 LOD 性能模式」
           逐边决定，而不是大画布就全局关掉——这样放大画布后可视区内的边仍能正常显示流星效果。 */
        .react-flow.performance-large-canvas .cust-edge-hit {
          stroke-width: 16 !important;
        }
      `}</Component2909>
      <_cmp_H_ {...e} />
    </Ie>;
}