'use strict';
// Tier 2 冒烟测试检查库（仿源码 scripts/_smoke_checks.cjs 风格）。
// 每个 check 返回 { name, pass, details[] }。

const fs = require('fs');
const path = require('path');
// 扩展名无关：TS 化期间同一模块会在 .jsx→.tsx 间漂移。写死后继扩展名的检查会在改名那刻变红，
// 或更糟——只扫 .jsx/.js 会让 TS 化后的文件整体逃出校验（静默漏扫）。
const { SOURCE_EXTS, resolveSourceFile } = require('./ts-exts.cjs');

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

/** 递归收集源码文件（默认 .js/.jsx/.ts/.tsx 全收） */
function collectFiles(dir, acc = [], exts = SOURCE_EXTS) {
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
  const files = collectFiles(srcDir, [], [...SOURCE_EXTS, '.mjs']);
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

  // 从 '@xyflow/react' 具名导入的 API 必须存在（运行期导出集合校验）
  for (const f of files) {
    const content = read(f);
    const impRe = /import\s*\{([^}]+)\}\s*from\s*['"]@xyflow\/react['"]/g;
    let m;
    while ((m = impRe.exec(content)) !== null) {
      for (const name of m[1].split(',')) {
        const raw = name.trim();
        if (!raw) continue;
        // 类型导入（import { type Xxx } 或 import { type Xxx as Y }）仅编译期存在，
        // 不参与运行期导出集合校验（@xyflow/react 的类型通过 export type / export * 聚合，
        // 不在值导出块里，getReactFlowExports 抓不到）——TS 迁移期引入，跳过避免误报。
        if (raw.startsWith('type ')) continue;
        const api = raw.split(/\s+as\s+/)[0].trim();
        if (!api) continue;
        if (!exported.has(api)) {
          pass = false;
          details.push(`  ✖ ${path.relative(ROOT, f)}: import { ${api} } from '@xyflow/react' 不存在`);
        }
      }
    }
  }

  details.unshift(`  reactflow 导出 ${exported.size} 个 API，扫描 ${files.length} 个文件`);
  return { name: 'reactflow API 调用合法性', pass, details };
}

/** 检查 3：nodeTypes 单源（NodePalette component 字段）与组件文件对应。
 *  注：nodeTypes 已由 NodePalette.buildNodeTypeComponents 派生（ADR-002），不再从 App.jsx 提取平行表。
 *  这里改为校验派生源：NodePalette 的 component 字段 → 组件文件存在 + default 导出；
 *  例外（director3dNode/ghostTarget）由 App 派生后补充，另校验其组件文件。
 *  组件 2026-08-18 已归类 nodes/ 子目录，优先查 src/components/nodes/，平铺路径兜底。
 *  路径全部【扩展名无关】解析：节点组件转 .tsx 后写死 .jsx 会让整项检查变红。 */
function resolveCompFile(ROOT, comp) {
  const sub = resolveSourceFile(path.join(ROOT, 'src/components/nodes', comp));
  if (sub) return sub;
  const flat = resolveSourceFile(path.join(ROOT, 'src/components', comp));
  return flat || path.join(ROOT, 'src/components/nodes', comp + '.jsx');
}
function checkNodeTypes(ROOT) {
  const palette = read(resolveSourceFile(path.join(ROOT, 'src/components/base/NodePalette')) || '');
  // 常规 component 字段：裸组件标识符（`component: ImageNode`）。排除 lazyNode(...) 函数调用包装：
  // `component: lazyNode(HEAVY_NODE_LOADERS.panoramaNode, ...)` 会被 \w+Node 误抓成 lazyNode
  // （存量 bug：lazyNode.jsx 无 default 导出导致冒烟误红），用 (?!\s*\() 负向前瞻跳过调用形态。
  const comps = [...palette.matchAll(/component:\s*(\w+Node)(?!\s*\()/g)].map((x) => x[1]);
  // 重依赖懒加载节点：lazyNode 只是动态 import 包装，底层仍是必存在的节点组件（防漏校验）。
  // 从 lazyNode.jsx 的 HEAVY_NODE_LOADERS 动态 import 路径抽取真实文件名，随常规组件一并校验。
  const lazySrc = read(resolveSourceFile(path.join(ROOT, 'src/components/base/lazyNode')) || '');
  // 扩展名无关：动态 import 的后缀可能是 .jsx 也可能是 .tsx
  const lazyComps = [...lazySrc.matchAll(/import\(['"]\.\.\/nodes\/(\w+Node)\.(?:jsx|tsx|js|ts)['"]\)/g)].map((x) => x[1]);
  const compsAll = [...new Set([...comps, ...lazyComps])];
  let pass = true;
  const details = [];

  if (compsAll.length === 0) {
    return { name: 'nodeTypes 注册', pass: false, details: ['  NodePalette 未找到 component 字段'] };
  }

  // 1) 派生源：NodePalette component 字段 → 组件文件校验
  for (const comp of compsAll) {
    const compFile = resolveCompFile(ROOT, comp);
    if (!fs.existsSync(compFile)) {
      pass = false;
      details.push(`  ✖ palette component '${comp}' -> 组件文件不存在（nodes/${comp}.{jsx|tsx}）`);
    } else {
      details.push(`  ✔ palette ${path.basename(compFile)}`);
    }
    const content = read(compFile);
    if (!/export\s+default/.test(content)) {
      pass = false;
      details.push(`  ✖ ${path.basename(compFile)} 未导出 default`);
    }
  }

  // 2) 例外（App 派生后补充的 director3dNode/ghostTarget）
  const app = read(resolveSourceFile(path.join(ROOT, 'src/App')) || '');
  const extras = [...app.matchAll(/(director3dNode|ghostTarget)\s*:\s*(\w+Node)/g)].map((x) => [x[1], x[2]]);
  for (const [type, comp] of extras) {
    const compFile = resolveCompFile(ROOT, comp);
    if (!fs.existsSync(compFile) || !/export\s+default/.test(read(compFile))) {
      pass = false;
      details.push(`  ✖ 例外 '${type}' -> '${comp}' 组件文件缺失或未导出 default`);
    } else {
      details.push(`  ✔ 例外 ${type} -> ${path.basename(compFile)}`);
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
