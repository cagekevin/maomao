// 系统性验证：所有节点（普通 + 编组子节点）落盘->加载后 position 是否与落盘前一致
import { fileURLToPath } from 'node:url';
import { adoptUserNodes } from '@xyflow/system';
// 扩展名无关：projectStore / groupNodes 已 TS 化（.js→.ts），写死后继后缀会直接 ENOENT
// （本脚本不在任何门禁里，坏了长期无人发现）。groupNodes 按项目惯例显式指 .ts（Node 原生类型剥离可直跑）。
import { readSourceFile } from './check-targets.mjs';
import { createGroupFromNodes } from '../src/components/base/groupNodes.ts';

// 读取真实 NODE_KEEP（正则兼容 TS 标注：`const NODE_KEEP: string[] = [...]`）
const src = readSourceFile(fileURLToPath(new URL('../src/components/base/projectStore', import.meta.url)));
const KEEP = src.match(/const NODE_KEEP(?:\s*:\s*string\[\])?\s*=\s*\[([^\]]+)\]/)[1].split(',').map((s) => s.trim().replace(/['"`]/g, '')).filter(Boolean);

function sanitize(nodes) {
  return nodes.map((n) => {
    const out = {};
    for (const k of KEEP) if (n[k] !== undefined && n[k] !== null) out[k] = n[k];
    return out;
  });
}

// 构造：3 个普通节点（带小数坐标，测试精度）+ 编组 a/b/c
const normals = [
  { id: 'n1', type: 'image', position: { x: 123.456, y: 789.012 }, style: { width: 300, height: 200 }, data: {} },
  { id: 'n2', type: 'text', position: { x: 999.5, y: 12.25 }, style: { width: 250, height: 150 }, data: {} },
  { id: 'n3', type: 'image', position: { x: -50.75, y: -200.3 }, style: { width: 300, height: 200 }, data: {} },
];
const { ok, nodes: grouped } = createGroupFromNodes(
  [{ id: 'a', type: 'image', position: { x: 200, y: 200 }, style: { width: 300, height: 200 }, data: {} },
   { id: 'b', type: 'image', position: { x: 600, y: 250 }, style: { width: 300, height: 200 }, data: {} },
   { id: 'c', type: 'text', position: { x: 250, y: 500 }, style: { width: 250, height: 150 }, data: {} }],
  ['a', 'b', 'c']
);

// 保存前的原始 flow position（用户视觉上的位置）
const before = {};
for (const n of [...normals, ...grouped]) {
  before[n.id] = { x: n.position.x, y: n.position.y, parentId: n.parentId };
}

// 模拟「保存」：白名单过滤
const snapshot = sanitize([...normals, ...grouped]);

// 模拟「加载」：adoptUserNodes 重建（与 App 侧 nodeOrigin=[0,0] 一致）
const lookup = new Map();
const parentLookup = new Map();
adoptUserNodes(snapshot, lookup, parentLookup, { nodeOrigin: [0, 0] });

// React Flow 渲染使用的绝对位置 = positionAbsolute
const after = {};
for (const [id, node] of lookup) {
  after[id] = { x: node.internals.positionAbsolute.x, y: node.internals.positionAbsolute.y, parentId: node.parentId };
}

// 对比：普通节点应 positionAbsolute == 落盘前 position；编组子节点 positionAbsolute 应 == (200,200)/(600,250)/(250,500)
console.log('NODE_KEEP =', JSON.stringify(KEEP));
console.log('\nid        | 保存前(flow)          | 加载后(positionAbsolute) | 是否一致');
console.log('----------|----------------------|--------------------------|--------');
let allOk = true;
for (const id of Object.keys(before)) {
  const b = before[id];
  const a = after[id];
  // 普通节点：positionAbsolute 应等于保存前 position
  // 编组子节点：positionAbsolute 应等于编组中设定的绝对位置 (a:200,200 b:600,250 c:250,500)
  const expect = id === 'a' ? { x: 200, y: 200 }
    : id === 'b' ? { x: 600, y: 250 }
    : id === 'c' ? { x: 250, y: 500 }
    : b; // 普通节点期望等于保存前
  const same = Math.abs(a.x - expect.x) < 1e-6 && Math.abs(a.y - expect.y) < 1e-6;
  if (!same) allOk = false;
  console.log(
    `${id.padEnd(10)} | (${b.x}, ${b.y})`.padEnd(22),
    `| (${a.x}, ${a.y})`.padEnd(24),
    `| ${same ? '✅' : '❌ 期望(' + expect.x + ',' + expect.y + ')'}`
  );
}
console.log('\n结论:', allOk ? '所有节点位置落盘->加载完全一致，无系统性偏移' : '存在系统性位置偏移！');
