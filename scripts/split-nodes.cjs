/**
 * 一毛AI画布 - 节点组件拆分脚本 v2
 * 输入：reference/decompiled/App-B9jVCs-a.decompiled.js（反编译后的 App.js）
 * 输出：reference/decompiled/nodes/<NodeType>.raw.js（27个节点独立文件）
 *
 * 策略：
 * 1. 用 AST 深度遍历找到每个目标函数名的定义位置（VariableDeclarator / AssignmentExpression）
 * 2. 对于 Y.memo() / Y.forwardRef() 包裹的组件，找到 memo 调用表达式的精确结束位置
 * 3. 用行号从源文件切片提取代码
 * 4. 注入 vendor-map.json 变量映射注释
 * 5. 生成 index.json 汇总
 */

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const t = require('@babel/types');

const ROOT = __dirname.replace(/[\\/]scripts$/, '');
const DECOMPILED = path.join(ROOT, 'reference/decompiled');
const APP_FILE = path.join(DECOMPILED, 'App-B9jVCs-a.decompiled.js');
const MAP_FILE = path.join(DECOMPILED, 'vendor-map.json');
const OUT_DIR = path.join(DECOMPILED, 'nodes');

// ── nodeType → 组件函数名映射（从 App.js L31044-31072 nodeTypes 注册表提取）──
const NODE_TYPE_MAP = {
  group: 'Eh',
  imageNode: 'li',
  promptNode: 'Ya',
  textNode: 'Qa',
  cropNode: 'eo',
  gridSplitNode: 'po',
  gridMergeNode: 'To',
  videoNode: 'Do',
  sd2VideoNode: 'Ao',
  discountVideoNode: 'os',
  audioNode: 'cs',
  audioPlayerNode: 'ps',
  customNode: 'ms',
  rhWebappNode: 'Ms',
  videoExtractNode: 'Ns',
  videoToGifNode: 'Gs',
  imageCompressNode: 'nc',
  faceMosaicNode: 'Cc',
  compareNode: 'Lc',
  textConcatNode: 'Rc',
  urlToImageNode: 'Wc',
  fileToUrlNode: 'qc',
  panoramaNode: 'Yc',
  director3dNode: 'Th',
  imageBoxNode: 'Ih',
  stickyNoteNode: 'Uh',
  ghostTarget: 'Nh',
};

// ── 加载 vendor-map.json ──
let vendorMap = {};
if (fs.existsSync(MAP_FILE)) {
  vendorMap = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));
}

// ── 解析 App.js ──
const raw = fs.readFileSync(APP_FILE, 'utf8');
const lines = raw.split('\n');

const ast = parser.parse(raw, {
  sourceType: 'module',
  plugins: ['jsx'],
});

// ── 收集目标函数名集合 ──
const targetFuncNames = new Set(Object.values(NODE_TYPE_MAP));

// ── 深度遍历：找到每个目标函数名的定义位置 ──
// 记录所有匹配的声明，后面取行号最大的（最精确的）
const declarations = {}; // funcName -> [{ start, end }]

traverse(ast, {
  // 匹配 function Xxx({ ... }) { ... } 或 function Xxx() { ... }
  FunctionDeclaration(path) {
    const name = path.node.id && t.isIdentifier(path.node.id) ? path.node.id.name : null;
    if (!name || !targetFuncNames.has(name)) return;
    if (!path.node.loc) return;

    if (!declarations[name]) declarations[name] = [];
    declarations[name].push({
      start: path.node.loc.start.line,
      end: path.node.loc.end.line,
    });
  },

  // 匹配 var Xxx = ... 或 let Xxx = ... 或 const Xxx = ...
  VariableDeclarator(path) {
    const name = path.node.id && t.isIdentifier(path.node.id) ? path.node.id.name : null;
    if (!name || !targetFuncNames.has(name)) return;

    const init = path.node.init;
    if (!init) return;

    // 确定结束位置
    let endLine;
    if (init.loc) {
      endLine = init.loc.end.line;
    } else {
      // fallback: 使用父 VariableDeclaration 的结束位置
      const parentDecl = path.findParent(p => p.isVariableDeclaration());
      endLine = parentDecl ? parentDecl.node.loc.end.line : 0;
    }

    const startLine = init.loc ? init.loc.start.line : path.node.loc.start.line;

    if (!declarations[name]) declarations[name] = [];
    declarations[name].push({ start: startLine, end: endLine });
  },

  // 匹配 Xxx = ...（赋值表达式，非 var 声明）
  AssignmentExpression(path) {
    const left = path.node.left;
    const name = t.isIdentifier(left) ? left.name : null;
    if (!name || !targetFuncNames.has(name)) return;

    const right = path.node.right;
    if (!right || !right.loc) return;

    if (!declarations[name]) declarations[name] = [];
    declarations[name].push({
      start: right.loc.start.line,
      end: right.loc.end.line,
    });
  },
});

// ── 对于每个函数名，取最合理的声明（行号范围最大的）──
const funcLocations = {};

for (const [name, locs] of Object.entries(declarations)) {
  // 取行数最多的声明（通常是完整的 memo 包裹）
  const best = locs.reduce((a, b) => (b.end - b.start) > (a.end - a.start) ? b : a);
  funcLocations[name] = best;
}

// ── 创建输出目录 ──
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// ── 拆分每个节点 ──
const results = [];
const missing = [];

for (const [nodeType, funcName] of Object.entries(NODE_TYPE_MAP)) {
  const loc = funcLocations[funcName];
  if (!loc) {
    missing.push({ nodeType, funcName });
    continue;
  }

  // 提取源码行（行号是1-based）
  const startIdx = loc.start - 1;  // 0-indexed
  const endIdx = loc.end;          // exclusive for slice
  const code = lines.slice(startIdx, endIdx).join('\n');

  // 构建变量映射注释
  const usedVars = new Set();
  const varPattern = /\b([a-z_$][a-z0-9_$]{0,2})\b/g;
  let match;
  while ((match = varPattern.exec(code)) !== null) {
    const v = match[1];
    if (vendorMap[v] && v !== vendorMap[v]) {
      usedVars.add(v);
    }
  }

  const varComments = [...usedVars]
    .sort()
    .map(v => `// ${v} → ${vendorMap[v]}`)
    .join('\n');

  const header = `/**
 * 节点类型: ${nodeType}
 * 原版函数名: ${funcName}
 * 原版行号: L${loc.start}-L${loc.end}
 * 来源: App-B9jVCs-a.decompiled.js
 *
 * 变量映射（vendor-map.json）:
${varComments}
 */

`;

  const outPath = path.join(OUT_DIR, `${nodeType}.raw.js`);
  fs.writeFileSync(outPath, header + code, 'utf8');

  results.push({
    nodeType,
    funcName,
    start: loc.start,
    end: loc.end,
    lines: loc.end - loc.start + 1,
    file: `${nodeType}.raw.js`,
  });
}

// ── 生成 index.json ──
const index = {
  generated: new Date().toISOString(),
  source: APP_FILE,
  total: NODE_TYPE_MAP.length,
  extracted: results.length,
  missing,
  nodes: results,
};

fs.writeFileSync(path.join(OUT_DIR, 'index.json'), JSON.stringify(index, null, 2), 'utf8');

// ── 输出报告 ──
console.log('=== 节点组件拆分报告 v2 ===');
console.log(`总计: ${NODE_TYPE_MAP.length} 个节点类型`);
console.log(`成功: ${results.length} 个`);
console.log(`缺失: ${missing.length} 个`);
console.log('');
for (const r of results) {
  console.log(`  ✅ ${r.nodeType.padEnd(20)} ${r.funcName.padEnd(5)} L${String(r.start).padStart(5)}-L${String(r.end).padStart(5)} (${String(r.lines).padStart(5)} 行) → ${r.file}`);
}
if (missing.length > 0) {
  console.log('');
  console.log('缺失:');
  for (const m of missing) {
    console.log(`  ❌ ${m.nodeType.padEnd(20)} ${m.funcName}`);
  }
}
console.log('');
console.log(`输出目录: ${OUT_DIR}`);
console.log('=== 完成 ===');
