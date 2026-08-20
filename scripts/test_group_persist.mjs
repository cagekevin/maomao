// 真实复现：编组 -> 落盘(旧/新白名单) -> React Flow 重建 -> 对比 group 面积/位置 + 框选命中
import { adoptUserNodes, getNodeDimensions, getNodesInside } from '@xyflow/system';
import { createGroupFromNodes } from '../src/components/base/groupNodes.js';

// 构造几个普通节点（带 style 尺寸，模拟真实画布节点）
const baseNodes = [
  { id: 'a', type: 'image', position: { x: 200, y: 200 }, style: { width: 300, height: 200 }, data: {} },
  { id: 'b', type: 'image', position: { x: 600, y: 250 }, style: { width: 300, height: 200 }, data: {} },
  { id: 'c', type: 'text', position: { x: 250, y: 500 }, style: { width: 250, height: 150 }, data: {} },
];

const { ok, nodes: grouped, groupId } = createGroupFromNodes(baseNodes, ['a', 'b', 'c']);
if (!ok) { console.error('编组失败', grouped); process.exit(1); }

// 落盘白名单（旧 vs 新）
const OLD_KEEP = ['id', 'type', 'position', 'data', 'width', 'height'];
// 直接读取 projectStore.js 当前的真实 NODE_KEEP，验证最终代码
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../src/components/base/projectStore.js', import.meta.url), 'utf8');
const m = src.match(/const NODE_KEEP = \[([^\]]+)\]/);
const REAL_KEEP = m[1].split(',').map((s) => s.trim().replace(/['"`]/g, '')).filter(Boolean);
const NEW_KEEP = REAL_KEEP;
console.log('\n>>> projectStore.js 当前 NODE_KEEP =', JSON.stringify(NEW_KEEP));
function sanitize(nodes, keep) {
  return nodes.map((n) => {
    const out = {};
    for (const k of keep) if (n[k] !== undefined && n[k] !== null) out[k] = n[k];
    return out;
  });
}

function rebuild(snapshot) {
  const lookup = new Map();
  const parentLookup = new Map();
  adoptUserNodes(snapshot, lookup, parentLookup, { nodeOrigin: [0, 0] });
  return lookup;
}

function report(label, snapshot) {
  console.log(`\n===== ${label} =====`);
  console.log('落盘后的字段(关键):');
  const g = snapshot.find((n) => n.type === 'group');
  console.log('  group.style =', JSON.stringify(g.style), '| group.initialWidth =', g.initialWidth, '| group.extent =', g.extent);
  console.log('  group.position =', JSON.stringify(g.position));

  const lookup = rebuild(snapshot);
  const groupNode = lookup.get(g.id);
  const dims = getNodeDimensions(groupNode);
  console.log('\n刷新重建后:');
  console.log('  group 面积(width x height) =', dims.width, 'x', dims.height, '  位置positionAbsolute =', JSON.stringify(groupNode.internals.positionAbsolute));
  for (const id of ['a', 'b', 'c']) {
    const n = lookup.get(id);
    console.log(`  子节点 ${id}: positionAbsolute =`, JSON.stringify(n.internals.positionAbsolute), '| parentId =', n.parentId, '| dims =', JSON.stringify(getNodeDimensions(n)));
  }

  // 框选矩形：只框住原本 group 区域的一部分 (300,300)-(500,400) —— 应只命中 group 内节点
  const selRect = { x: 300, y: 300, width: 200, height: 100 };
  const hit = getNodesInside(lookup, selRect, [0, 0, 1], true, false);
  console.log('\n  框选矩形', JSON.stringify(selRect), '命中:', [...hit].map((n) => n.id));
}

report('旧白名单(无 style/initialWidth/parentId/extent)', sanitize(grouped, OLD_KEEP));
report('新白名单(有 parentId/extent, 但仍无 style/initialWidth!)', sanitize(grouped, NEW_KEEP));

// 额外：新白名单 + 补上 style / initialWidth / initialHeight，看是否完全保真
const FULL_KEEP = ['id', 'type', 'position', 'data', 'width', 'height', 'parentId', 'extent', 'style', 'initialWidth', 'initialHeight'];
report('新白名单 + 补 style/initialWidth/initialHeight(完整保真)', sanitize(grouped, FULL_KEEP));

// ===== 关键补充：模拟真实浏览器「已渲染」状态（measured + handleBounds 就绪）后的框选 =====
// 真实刷新后 React Flow 会用 ResizeObserver 测量节点，写入 measured 并解析 handleBounds。
// 这里手动给 group 和子节点补上 measured/width/height/handleBounds，复现「渲染完成后」的 nodeLookup。
function rebuildRendered(snapshot) {
  const lookup = new Map();
  const parentLookup = new Map();
  adoptUserNodes(snapshot, lookup, parentLookup, { nodeOrigin: [0, 0] });
  // 模拟测量：用真实尺寸填 measured（group 用 style 尺寸，子节点用 style 尺寸）
  for (const [id, node] of lookup) {
    const w = Number(node.style?.width) || node.initialWidth || node.width || 300;
    const h = Number(node.style?.height) || node.initialHeight || node.height || 200;
    node.measured = { width: w, height: h };
    node.width = w; node.height = h;
    node.internals.handleBounds = { source: [], target: [] }; // 已渲染
  }
  return lookup;
}
function reportRendered(label, snapshot) {
  console.log(`\n===== ${label} (已渲染/measured 就绪) =====`);
  const lookup = rebuildRendered(snapshot);
  const g = lookup.get(snapshot.find((n) => n.type === 'group').id);
  console.log('  group 面积 =', JSON.stringify(getNodeDimensions(g)), '位置 =', JSON.stringify(g.internals.positionAbsolute));
  // 框选只框住 group 区域的一部分：x 300~500, y 300~400 → 只覆盖 a(200~500,200~400) 的部分、b/c 在框外
  const selRect = { x: 300, y: 300, width: 200, height: 100 };
  const hit = getNodesInside(lookup, selRect, [0, 0, 1], true, false);
  console.log('  框选矩形', JSON.stringify(selRect), '命中:', [...hit].map((n) => n.id));
  console.log('  (期望：只命中框内节点，不应全选)');
}
reportRendered('已渲染 + 新白名单', sanitize(grouped, NEW_KEEP));
