// 根治性验证：group 在「展开态/折叠态」下保存 -> 加载 -> 最终渲染尺寸（useNodeSize: n.width ?? n.style.width）
import { readFileSync } from 'node:fs';
import { adoptUserNodes, getNodeDimensions } from '@xyflow/system';

const src = readFileSync(new URL('../src/components/base/projectStore.js', import.meta.url), 'utf8');
const KEEP = src.match(/const NODE_KEEP = \[([^\]]+)\]/)[1].split(',').map((s) => s.trim().replace(/['"`]/g, '')).filter(Boolean);
const sanitize = (arr) => arr.map((n) => { const out = {}; for (const k of KEEP) if (n[k] !== undefined && n[k] !== null) out[k] = n[k]; return out; });

// 复刻 App.applyNodeTypeDefaults 的 group 兜底
const GROUP_DEFAULT = { width: 300, height: 200, initialWidth: 300, initialHeight: 200, className: 'yimao-group-node', style: { width: 300, height: 200 } };
function applyDefaults(n) {
  if (n.type !== 'group') return n;
  const d = GROUP_DEFAULT;
  const next = { ...n };
  const hasExpanded = (n.data?.expandedWidth ?? n.data?.expandedHeight) ? true : false;
  const fw = hasExpanded ? (n.data.expandedWidth || d.width) : d.width;
  const fh = hasExpanded ? (n.data.expandedHeight || d.height) : d.height;
  for (const k of ['width', 'height', 'initialWidth', 'initialHeight', 'className']) {
    if (next[k] === undefined || next[k] === null) next[k] = k === 'width' ? fw : k === 'height' ? fh : d[k];
  }
  next.style = next.style ? { ...(d.style || {}), ...next.style } : (d.style || next.style);
  next.data = { ...n.data, name: n.data?.name || '编组' };
  return next;
}
// 复刻 NodeShell.useNodeSize 的最终渲染尺寸判定
function renderSize(node) {
  const w = node.width ?? node.style?.width;
  const h = node.height ?? node.style?.height;
  return { w: Number(w) || 0, h: Number(h) || 0 };
}

function test(label, group, expectW, expectH) {
  const fixed = applyDefaults(group);
  const lookup = new Map();
  adoptUserNodes(sanitize([fixed]), lookup, new Map(), { nodeOrigin: [0, 0] });
  const g = lookup.get(group.id);
  const dims = getNodeDimensions(g);
  const render = renderSize(g);
  const ok = render.w === expectW && render.h === expectH;
  console.log(`\n[${label}]`);
  console.log(`  保存字段: width=${group.width} style.width=${JSON.stringify(group.style?.width)} collapsed=${!!group.data?.collapsed} expandedW=${group.data?.expandedWidth}`);
  console.log(`  加载后:  getNodeDimensions=${dims.width}x${dims.height} | 渲染尺寸 useNodeSize=${render.w}x${render.h} (期望 ${expectW}x${expectH})`);
  console.log(`  ${ok ? '✅ 保真' : '❌ 变小/变默认'}`);
}

// 场景1：展开态直接保存（编组后没折叠过）—— 期望 780x530
test('展开态直接保存', {
  id: 'g', type: 'group', position: { x: 160, y: 160 }, width: 780, height: 530,
  style: { width: 780, height: 530 }, initialWidth: 780, initialHeight: 530, data: { name: '编组' },
}, 780, 530);

// 场景2：折叠过，然后展开保存 —— 期望 780x530（data.expandedWidth 兜底）
test('折叠->展开后保存', {
  id: 'g', type: 'group', position: { x: 160, y: 160 }, width: 780, height: 530,
  style: { width: 780, height: 530 }, initialWidth: 780, initialHeight: 530,
  data: { name: '编组', collapsed: false, expandedWidth: 780, expandedHeight: 530 },
}, 780, 530);

// 场景3：折叠态保存（样式是胶囊 max-content/40）—— 期望？折叠态视觉是胶囊，但这里测展开后逻辑
test('折叠态保存(style为胶囊)', {
  id: 'g', type: 'group', position: { x: 160, y: 160 }, width: 780, height: 530,
  style: { width: 'max-content', height: 40, backgroundColor: 'transparent', border: 'none' },
  initialWidth: 780, initialHeight: 530,
  data: { name: '编组', collapsed: true, expandedWidth: 780, expandedHeight: 530 },
}, 780, 530);

// 场景4：最坏情况 —— 编组只写 style（无 width 字段）+ 折叠后 data.expandedWidth 也丢，旧数据
test('最坏: 无width/无style,仅position', {
  id: 'g', type: 'group', position: { x: 160, y: 160 }, data: { name: '编组' },
}, 300, 200);
