// 真实调用 @xyflow/system 的 getNodesInside 复现「编组后移动子节点 -> shift 框选选到框外」场景
import { getNodesInside } from '@xyflow/system';

// 构造 React Flow 内部节点。measured 必须存在（React Flow 内部永远是对象）。
// handleBounds: undefined 表示该节点尚未完成初始渲染(forceInitialRender=true，强制可见/选中)
//                {} 表示已渲染，按真实矩形判定
function mkNode(id, absX, absY, w, h, opts = {}) {
  return {
    id,
    measured: { width: w, height: h }, // 必须有对象，即使宽高可能 undefined
    width: w,
    height: h,
    selectable: true,
    hidden: false,
    internals: {
      positionAbsolute: { x: absX, y: absY },
      handleBounds: opts.handleBounds, // undefined | {}
    },
    ...opts.rest,
  };
}

const transform = [0, 0, 1]; // 无缩放无平移
// 用户的 shift 框选矩形：只框住 (300,300)-(400,400)
const selRect = { x: 300, y: 300, width: 100, height: 100 };

function run(label, lookup, partially) {
  const hit = getNodesInside(lookup, selRect, transform, partially, false);
  console.log(`\n[${label}] partially=${partially}`);
  console.log('  命中:', [...hit].map((n) => n.id));
}

// ===== 场景1：正常会话内，编组后移动子节点（同一次会话，未刷新）=====
// 组 GROUP 绝对(100,100) 200x200；childA 移动到绝对(350,350)；childB 在(130,130)；far 在(600,600)
// 所有节点都已渲染 handleBounds={}
{
  const group = mkNode('GROUP', 100, 100, 200, 200, { handleBounds: {} });
  const childA = mkNode('childA', 350, 350, 100, 100, { handleBounds: {}, rest: { parentId: 'GROUP' } });
  const childB = mkNode('childB', 130, 130, 100, 100, { handleBounds: {}, rest: { parentId: 'GROUP' } });
  const far = mkNode('far', 600, 600, 80, 80, { handleBounds: {} });
  const lookup = new Map([['GROUP', group], ['childA', childA], ['childB', childB], ['far', far]]);
  run('正常-编组移动子节点(已渲染)', lookup, true);
}

// ===== 场景2：旧白名单 bug —— 刷新后 parentId/measured 丢失 =====
// 子节点 position 是相对坐标，被当绝对。且 handleBounds=undefined（未渲染 -> forceInitialRender=true 强制选中）
// childA 存的相对坐标 (250,250) 被当绝对；childB 相对(30,30)；GROUP(100,100)
{
  const group = mkNode('GROUP', 100, 100, 200, 200, { handleBounds: undefined });
  const childA = mkNode('childA', 250, 250, undefined, undefined, { handleBounds: undefined }); // 缺 measured/width
  const childB = mkNode('childB', 30, 30, undefined, undefined, { handleBounds: undefined });
  const far = mkNode('far', 600, 600, 80, 80, { handleBounds: undefined });
  const lookup = new Map([['GROUP', group], ['childA', childA], ['childB', childB], ['far', far]]);
  run('旧bug-刷新后(parentId/measured丢失,未渲染)', lookup, true);
}

// ===== 场景3：修复后白名单 —— parentId+extent 保留，刷新后 React Flow 重新测量 handleBounds={} =====
// childA 正确绝对(350,350)；childB(130,130)；都已渲染
{
  const group = mkNode('GROUP', 100, 100, 200, 200, { handleBounds: {} });
  const childA = mkNode('childA', 350, 350, 100, 100, { handleBounds: {}, rest: { parentId: 'GROUP' } });
  const childB = mkNode('childB', 130, 130, 100, 100, { handleBounds: {}, rest: { parentId: 'GROUP' } });
  const far = mkNode('far', 600, 600, 80, 80, { handleBounds: {} });
  const lookup = new Map([['GROUP', group], ['childA', childA], ['childB', childB], ['far', far]]);
  run('修复后-刷新(parentId保留,已渲染)', lookup, true);
}
