// 模拟 group 折叠/展开/刷新 各场景，确认尺寸是否塌成默认 300x200
import { fileURLToPath } from 'node:url';
import { adoptUserNodes, getNodeDimensions } from '@xyflow/system';
// 扩展名无关：projectStore 已 TS 化（.js→.ts），写死后继后缀会直接 ENOENT（本脚本不在任何门禁里，坏了无人发现）
import { readSourceFile } from './check-targets.mjs';

// 读取真实 NODE_KEEP（正则兼容 TS 标注：`const NODE_KEEP: string[] = [...]`）
const src = readSourceFile(fileURLToPath(new URL('../src/components/base/projectStore', import.meta.url)));
const KEEP = src.match(/const NODE_KEEP(?:\s*:\s*string\[\])?\s*=\s*\[([^\]]+)\]/)[1].split(',').map((s) => s.trim().replace(/['"`]/g, '')).filter(Boolean);
const sanitize = (arr) => arr.map((n) => { const out = {}; for (const k of KEEP) if (n[k] !== undefined && n[k] !== null) out[k] = n[k]; return out; });

// 复刻 App.jsx applyNodeTypeDefaults 的 group 兜底
const GROUP_DEFAULT = { width: 300, height: 200, initialWidth: 300, initialHeight: 200, className: 'yimao-group-node', style: { width: 300, height: 200 } };
function applyDefaults(n) {
  const d = GROUP_DEFAULT;
  if (!d || n.type !== 'group') return n;
  const next = { ...n };
  for (const k of ['width', 'height', 'initialWidth', 'initialHeight', 'className']) {
    if (next[k] === undefined || next[k] === null) next[k] = d[k];
  }
  next.style = next.style ? { ...(d.style || {}), ...next.style } : (d.style || next.style);
  next.data = { ...n.data, name: n.data?.name || '编组' };
  return next;
}

function rebuild(snapshot) {
  const lookup = new Map();
  adoptUserNodes(sanitize(snapshot), lookup, new Map(), { nodeOrigin: [0, 0] });
  return lookup;
}

function report(label, snapshot) {
  // 先过 applyNodeTypeDefaults（模拟 App 加载侧）
  const fixed = snapshot.map(applyDefaults);
  const lookup = rebuild(fixed);
  const g = [...lookup.values()].find((n) => n.type === 'group');
  const dims = getNodeDimensions(g);
  const styleW = g.style?.width;
  console.log(`\n[${label}]`);
  console.log(`  落盘后字段: width=${g.width} height=${g.height} | style.width=${JSON.stringify(styleW)} | collapsed=${!!g.data?.collapsed} | expandedW=${g.data?.expandedWidth}`);
  console.log(`  加载后 getNodeDimensions = ${dims.width} x ${dims.height}`);
  const isDefault = dims.width === 300 && dims.height === 200;
  console.log(`  ${isDefault ? '❌ 塌成默认尺寸 300x200！' : dims.width > 0 ? '✅ 尺寸保真' : '❌ 塌成 0x0'}`);
}

// 场景1：新代码编组的 group（width/height/style 都在），未折叠 —— 应保真
report('新编组-未折叠', [{
  id: 'g', type: 'group', position: { x: 160, y: 160 }, width: 780, height: 530,
  style: { width: 780, height: 530 }, initialWidth: 780, initialHeight: 530, data: { name: '编组' },
}]);

// 场景2：折叠态保存（width=780 但 style 是胶囊 max-content/40）
report('新编组-折叠态保存', [{
  id: 'g', type: 'group', position: { x: 160, y: 160 }, width: 780, height: 530,
  style: { width: 'max-content', height: 40, backgroundColor: 'transparent', border: 'none' },
  initialWidth: 780, initialHeight: 530,
  data: { name: '编组', collapsed: true, expandedWidth: 780, expandedHeight: 530 },
}]);

// 场景3：旧快照（只含 position，无任何尺寸字段）—— 会被 applyNodeTypeDefaults 补 300x200
report('旧快照(仅position)', [{
  id: 'g', type: 'group', position: { x: 160, y: 160 }, data: { name: '编组' },
}]);

// 场景4：旧快照 + 折叠态（data 有 expandedWidth，但尺寸字段全丢）
// 模拟新版 applyNodeTypeDefaults 优先用 expandedWidth 兜底
function applyDefaultsV2(n) {
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
{
  const snapshot = [{ id: 'g', type: 'group', position: { x: 160, y: 160 }, data: { name: '编组', collapsed: false, expandedWidth: 900, expandedHeight: 600 } }];
  const fixed = snapshot.map(applyDefaultsV2);
  const lookup = rebuild(fixed);
  const g = [...lookup.values()].find((n) => n.type === 'group');
  const dims = getNodeDimensions(g);
  console.log(`\n[旧快照+expandedWidth兜底]`);
  console.log(`  加载后 getNodeDimensions = ${dims.width} x ${dims.height}`);
  console.log(dims.width === 900 && dims.height === 600 ? '  ✅ 用 expandedWidth 恢复真实尺寸' : '  ❌ 未生效');
}
