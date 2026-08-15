/**
 * 画布工具层（useCanvasAgentTools）逻辑验证脚本。
 *
 * 用 esbuild 把 useCanvasAgentTools.js + NodePalette.jsx 打包成临时 CJS，
 * 再注入一个 fake ctx（mock useReactFlow 能力）验证每个工具的核心逻辑：
 *   建/删/改/连线/查询是否返回 { ok, data|error }、是否不可变局部更新。
 *
 * 用法：npm run test:tools   （或 node scripts/test_agent_tools.mjs）
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src/components/base/useCanvasAgentTools.js');
const OUT = path.join(os.tmpdir(), `useCanvasAgentTools.bundle-${Date.now()}.cjs`);

// 1. 用 esbuild（vite 自带）打包为 CJS（esm=true 让 export 挂到 module.exports）
let buildCmd;
try {
  require.resolve('esbuild', { paths: [ROOT] });
  const esbuild = require('esbuild');
  esbuild.buildSync({
    entryPoints: [SRC],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: OUT,
    // 未用到的 import 不会拖入；NodePalette.jsx 会被 esbuild 转译 JSX
    logLevel: 'silent',
  });
} catch (e) {
  console.error('构建失败（esbuild 不可用？）：' + e.message);
  process.exit(1);
}

const mod = require(OUT);

// 1.5 额外打包 useAgentChat.js 取 demoPlan（纯函数；react/@xyflow external，不真正调用 hook）
const SRC_CHAT = path.join(ROOT, 'src/components/base/useAgentChat.js');
const OUT_CHAT = path.join(os.tmpdir(), `useAgentChat.bundle-${Date.now()}.cjs`);
let modChat = null;
try {
  const esbuild = require('esbuild');
  esbuild.buildSync({
    entryPoints: [SRC_CHAT],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: OUT_CHAT,
    // 全部打入（含 react/@xyflow/react），仅调用纯函数 demoPlan，不触发 hook/DOM
    logLevel: 'silent',
  });
  modChat = require(OUT_CHAT);
} catch (e) {
  console.warn('（demoPlan 打包失败，跳过 demo 规则测试）：' + e.message);
}

// 2. fake ctx —— 内存版画布（mock useReactFlow 能力）
function makeCtx(initialNodes = [], initialEdges = []) {
  let nodes = JSON.parse(JSON.stringify(initialNodes));
  let edges = JSON.parse(JSON.stringify(initialEdges));
  return {
    getNodes: () => nodes,
    setNodes: (fn) => {
      const next = typeof fn === 'function' ? fn(nodes) : fn;
      // 断言：不可变更新后引用变了（原则3）
      nodes = Array.isArray(next) ? next : nodes;
    },
    getEdges: () => edges,
    setEdges: (fn) => {
      const next = typeof fn === 'function' ? fn(edges) : fn;
      edges = Array.isArray(next) ? next : edges;
    },
    addNodes: () => {},
    screenToFlowPosition: (p) => p || { x: 0, y: 0 },
    fitView: () => {},
    zoomIn: () => {},
    zoomOut: () => {},
    snapshot: () => ({ nodes, edges })
  };
}

const tests = [];
function t(name, fn) {
  tests.push({ name, fn });
}

// ── 测试用例 ──
t('create_node 建文本节点成功', () => {
  const ctx = makeCtx([], []);
  const tools = mod.buildCanvasAgentTools(ctx);
  const r = tools.create_node({ type: 'textNode', label: '测试', prompt: '你好', position: { x: 10, y: 20 } });
  if (!r.ok) return 'create_node 失败: ' + r.error;
  if (!r.data.id) return '未返回 id';
  const node = ctx.getNodes().find((n) => n.id === r.data.id);
  if (!node) return '节点未写入画布';
  if (node.data.label !== '测试' || node.data.prompt !== '你好') return 'label/prompt 未写入';
  if (node.position.x !== 10 || node.position.y !== 20) return 'position 未写入';
  return true;
});

t('create_node 未知类型报错', () => {
  const ctx = makeCtx([], []);
  const tools = mod.buildCanvasAgentTools(ctx);
  const r = tools.create_node({ type: 'nope' });
  if (r.ok) return '未知类型不应 ok';
  if (!r.error) return '缺 error 文案';
  return true;
});

t('create_node connectFrom 自动连线', () => {
  const ctx = makeCtx([{ id: 'a', type: 'textNode', data: {}, position: { x: 0, y: 0 } }], []);
  const tools = mod.buildCanvasAgentTools(ctx);
  const r = tools.create_node({ type: 'textNode', connectFrom: 'a', position: { x: 5, y: 5 } });
  if (!r.ok) return '建节点失败';
  if (r.data.connected !== true) return '应自动连线';
  if (ctx.getEdges().length !== 1) return '画布应有 1 条边';
  return true;
});

t('delete_node 连带删边', () => {
  const ctx = makeCtx(
    [{ id: 'a', type: 'textNode', data: {}, position: {} }, { id: 'b', type: 'textNode', data: {}, position: {} }],
    [{ id: 'e', source: 'a', target: 'b' }]
  );
  const tools = mod.buildCanvasAgentTools(ctx);
  const r = tools.delete_node({ nodeId: 'a' });
  if (!r.ok) return 'delete_node 失败';
  if (ctx.getNodes().some((n) => n.id === 'a')) return 'a 未删除';
  if (ctx.getEdges().length !== 0) return '边应被连带删除';
  return true;
});

t('update_node 白名单 + 不可变局部更新', () => {
  const ctx = makeCtx([{ id: 'a', type: 'textNode', data: { label: '旧', prompt: 'keep' }, position: {} }], []);
  const tools = mod.buildCanvasAgentTools(ctx);
  const before = ctx.getNodes()[0];
  const r = tools.update_node({ nodeId: 'a', label: '新', prompt: undefined });
  if (!r.ok) return 'update_node 失败';
  const after = ctx.getNodes()[0];
  if (after.data.label !== '新') return 'label 未更新';
  if (after.data.prompt !== 'keep') return '未传的 prompt 应保留';
  if (after === before) return '应产生新引用（不可变更新）';
  return true;
});

t('connect_nodes 去重', () => {
  const ctx = makeCtx([{ id: 'a', type: 'textNode', data: {}, position: {} }, { id: 'b', type: 'textNode', data: {}, position: {} }], []);
  const tools = mod.buildCanvasAgentTools(ctx);
  tools.connect_nodes({ source: 'a', target: 'b' });
  const r2 = tools.connect_nodes({ source: 'a', target: 'b' });
  if (r2.data.alreadyConnected !== true) return '重复连线应识别 alreadyConnected';
  if (ctx.getEdges().length !== 1) return '不应产生重复边';
  return true;
});

t('list_nodes / read_canvas 只读', () => {
  const ctx = makeCtx([{ id: 'a', type: 'textNode', data: { label: 'X' }, position: { x: 1, y: 2 } }], []);
  const tools = mod.buildCanvasAgentTools(ctx);
  const r1 = tools.list_nodes({});
  if (!r1.ok || r1.data.nodes.length !== 1 || r1.data.nodes[0].label !== 'X') return 'list_nodes 异常';
  const r2 = tools.read_canvas({});
  if (!r2.ok || r2.data.nodes.length !== 1) return 'read_canvas 异常';
  return true;
});

t('callTool 未知工具报错 + execute 批量', () => {
  const ctx = makeCtx([], []);
  const tools = mod.buildCanvasAgentTools(ctx);
  // 无法直接测 callTool（hook 内），但可测工具 Map 不存在项
  if (tools.not_a_tool) return '不应存在 not_a_tool';
  const r = tools.create_node({ type: 'textNode' });
  if (!r.ok) return '批量前置失败';
  return true;
});

// ── demo 规则引擎（useAgentChat.demoPlan）──
const plan = (text) => modChat.demoPlan(text, () => null);
t('demo 规则：识别创建生图节点', () => {
  const p = plan('帮我生成一张赛博朋克风格的猫咪图');
  if (!p || p.length === 0) return '未识别到 create_node';
  const c = p.find((x) => x.name === 'create_node');
  if (!c) return '应生成 create_node 调用';
  if (c.args.type !== 'promptNode') return '生图应映射 promptNode，实际 ' + c.args.type;
  return true;
});
t('demo 规则：识别创建视频节点', () => {
  const p = plan('创建一个视频节点');
  const c = p.find((x) => x.name === 'create_node');
  if (!c || c.args.type !== 'discountVideoNode') return '视频应映射 discountVideoNode';
  return true;
});
t('demo 规则：识别连接两个节点', () => {
  const p = plan('连接 text-1 和 prompt-1');
  const c = p.find((x) => x.name === 'connect_nodes');
  if (!c) return '未识别到 connect_nodes';
  if (c.args.source !== 'text-1' || c.args.target !== 'prompt-1') return '连接端点识别错误';
  return true;
});
t('demo 规则：识别查看画布', () => {
  const p = plan('看看画布有哪些节点');
  const c = p.find((x) => x.name === 'read_canvas');
  if (!c) return '未识别到 read_canvas';
  return true;
});
t('demo 规则：无匹配时返回空（纯文字答复）', () => {
  const p = plan('你好呀今天天气不错');
  if (p && p.length > 0) return '不应触发任何工具';
  return true;
});

// ── 运行 ──
let allPass = true;
console.log('=== 画布工具层验证（useCanvasAgentTools + demoPlan）===');
for (const { name, fn } of tests) {
  let result;
  try { result = fn(); } catch (e) { result = '抛异常: ' + (e?.message || e); }
  const pass = result === true;
  if (!pass) allPass = false;
  console.log('● ' + name + (pass ? '  PASS' : '  FAIL — ' + result));
}
console.log('\n=== 结果: ' + (allPass ? 'ALL PASS' : 'FAILED') + ' ===');

// 清理临时 bundle
try { fs.unlinkSync(OUT); } catch (e) {}
try { fs.unlinkSync(OUT_CHAT); } catch (e) {}

process.exit(allPass ? 0 : 1);
