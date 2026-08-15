'use strict';
// Tier 2 冒烟测试检查库（仿源码 scripts/_smoke_checks.cjs 风格）。
// 每个 check 返回 { name, pass, details[] }。

const fs = require('fs');
const path = require('path');

// esbuild 通过 JS API 调用（比 shell 调二进制更稳，兼容 Windows）
let esbuild = null;
function getEsbuild(ROOT) {
  if (esbuild) return esbuild;
  try {
    esbuild = require(path.join(ROOT, 'node_modules/esbuild'));
  } catch {
    esbuild = require('esbuild');
  }
  return esbuild;
}

/** 递归收集 .jsx/.js 文件 */
function collectFiles(dir, acc = [], exts = ['.jsx', '.js']) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) collectFiles(full, acc, exts);
    else if (exts.includes(path.extname(name))) acc.push(full);
  }
  return acc;
}

const read = (p) => {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return '';
  }
};

// 从 @xyflow/react（v12，主包已内置 NodeResizer 等）的 export 行提取导出的 API 名集合
function getReactFlowExports(ROOT) {
  const sources = [
    path.join(ROOT, 'node_modules/@xyflow/react/dist/esm/index.js'),
  ];
  const set = new Set();
  for (const src of sources) {
    const content = read(src);
    // 收集所有 export { ... }; 块（v12 的 index.js 有多处，分别来自 system 与主包）
    const re = /export\s*\{([\s\S]*?)\};/g;
    let m;
    while ((m = re.exec(content)) !== null) {
      for (const s of m[1].split(',')) {
        const t = s.trim();
        if (!t) continue;
        const as = t.match(/\sas\s+(\w+)$/);
        set.add(as ? as[1] : t.replace(/[^A-Za-z0-9_$]/g, ''));
      }
    }
  }
  return set;
}

/** 检查 1：esbuild 批量校验 jsx/js 语法（用 JS API） */
function checkJsxSyntax(ROOT) {
  const srcDir = path.join(ROOT, 'src');
  const files = collectFiles(srcDir);
  const eb = getEsbuild(ROOT);
  let pass = true;
  const details = [];

  for (const f of files) {
    try {
      eb.buildSync({
        entryPoints: [f],
        bundle: false,
        write: false,
        format: 'esm',
        loader: { '.jsx': 'jsx', '.js': 'jsx' },
        jsx: 'automatic',
        logLevel: 'silent',
      });
    } catch (e) {
      pass = false;
      const loc = e.errors?.[0]?.location;
      const msg = e.errors?.[0]?.text || e.message || 'unknown';
      details.push(
        `  ✖ ${path.relative(ROOT, f)}${loc ? `  ${loc.line}:${loc.column}` : ''}: ${msg}`
      );
    }
  }
  details.unshift(`  扫描 ${files.length} 个文件`);
  return { name: 'JSX 语法（esbuild）', pass, details };
}

/** 检查 2：reactflow API 调用合法性（核心避坑：updateNodeInternals 类错误） */
function checkReactFlowApis(ROOT) {
  const srcDir = path.join(ROOT, 'src');
  const files = collectFiles(srcDir, [], ['.jsx', '.js', '.mjs']);
  const exported = getReactFlowExports(ROOT);
  let pass = true;
  const details = [];

  if (exported.size === 0) {
    return { name: 'reactflow API 检查', pass: false, details: ['  无法读取 reactflow 导出列表'] };
  }

  // 从 useReactFlow() 解构出来的函数名，也必须在导出的 API 集合里（或用 useXxx hook 获取）
  for (const f of files) {
    const content = read(f);
    // 捕获: const { a, b, c } = useReactFlow()
    const destrRe = /(?:const|let)\s*\{([^}]+)\}\s*=\s*useReactFlow\s*\(/g;
    let m;
    while ((m = destrRe.exec(content)) !== null) {
      for (const name of m[1].split(',')) {
        const fn = name.trim().split(':')[0].trim();
        if (!fn) continue;
        // useReactFlow() 官方返回：setNodes/getNodes/setEdges/getEdges/... 但 updateNodeInternals 不在其中
        const allowedFromUseReactFlow = new Set([
          'getNodes', 'setNodes', 'getNode', 'addNodes', 'setNodes',
          'getEdges', 'setEdges', 'addEdges', 'deleteElements',
          'getViewport', 'setViewport',
          'fitView', 'fitBounds', 'zoomIn', 'zoomOut', 'getZoom', 'setCenter',
          'getIntersectingNodes', 'isNodeIntersecting', 'screenToFlowPosition',
          'flowToScreenPoint', 'getTransformInstance', 'project', 'getViewport'
        ]);
        if (allowedFromUseReactFlow.has(fn)) continue;
        if (fn === 'updateNodeInternals') {
          pass = false;
          details.push(`  ✖ ${path.relative(ROOT, f)}: useReactFlow() 解构出 '${fn}' —— 应改用 useUpdateNodeInternals() hook`);
          continue;
        }
        if (!exported.has(fn)) {
          // 可能是本文件定义或从别处导入，跳过误报；只对明显的 reactflow 内部函数提示
          details.push(`  ? ${path.relative(ROOT, f)}: useReactFlow() 解构出 '${fn}'（不在 useReactFlow 返回值白名单）`);
        }
      }
    }
  }

  // 从 'reactflow' 具名导入的 API 必须存在
  for (const f of files) {
    const content = read(f);
    const impRe = /import\s*\{([^}]+)\}\s*from\s*['"]@xyflow\/react['"]/g;
    let m;
    while ((m = impRe.exec(content)) !== null) {
      for (const name of m[1].split(',')) {
        const api = name.trim().split(/\s+as\s+/)[0].trim();
        if (!api) continue;
        if (!exported.has(api)) {
          pass = false;
          details.push(`  ✖ ${path.relative(ROOT, f)}: import { ${api} } from 'reactflow' 不存在`);
        }
      }
    }
  }

  details.unshift(`  reactflow 导出 ${exported.size} 个 API，扫描 ${files.length} 个文件`);
  return { name: 'reactflow API 调用合法性', pass, details };
}

/** 检查 3：App.jsx 注册的 nodeTypes 与组件文件对应 */
function checkNodeTypes(ROOT) {
  const app = read(path.join(ROOT, 'src/App.jsx'));
  const nodeTypesRe = /nodeTypes\s*=\s*\{([\s\S]*?)\}/;
  const m = app.match(nodeTypesRe);
  let pass = true;
  const details = [];

  if (!m) {
    return { name: 'nodeTypes 注册', pass: false, details: ['  未找到 nodeTypes 定义'] };
  }

  // 提取 "textNode: TextNode" 键值
  const entries = [...m[1].matchAll(/(\w+Node)\s*:\s*(\w+)/g)].map((x) => [x[1], x[2]]);
  for (const [type, comp] of entries) {
    // 组件文件应存在且被 import
    const compFile = path.join(ROOT, 'src/components', comp + '.jsx');
    if (!fs.existsSync(compFile)) {
      pass = false;
      details.push(`  ✖ 节点类型 '${type}' -> 组件 '${comp}.jsx' 不存在`);
    } else {
      details.push(`  ✔ ${type} -> ${comp}.jsx`);
    }
    // 组件里应导出 default
    const content = read(compFile);
    if (!/export\s+default/.test(content)) {
      pass = false;
      details.push(`  ✖ ${comp}.jsx 未导出 default`);
    }
  }
  return { name: 'nodeTypes 注册', pass, details };
}

/** 检查 4：关键依赖存在（@xyflow/react / lucide-react） */
function checkDeps(ROOT) {
  const pkg = JSON.parse(read(path.join(ROOT, 'package.json')) || '{}');
  const needed = ['@xyflow/react', 'lucide-react'];
  const pass = needed.every((d) => (pkg.dependencies || {})[d] || (pkg.devDependencies || {})[d]);
  const details = needed.map((d) => `  ${(pkg.dependencies || {})[d] || (pkg.devDependencies || {})[d] ? '✔' : '✖'} ${d}`);
  return { name: '关键依赖', pass, details };
}

module.exports = {
  checkJsxSyntax,
  checkReactFlowApis,
  checkNodeTypes,
  checkDeps,
  getReactFlowExports,
};
