/**
 * 02_split.cjs — 智能 React 组件拆分
 * 源头堵死三坑：A 悬空引用(scope.hasBinding 误杀模块级绑定) B JSXIdentifier 漏收集
 *             C 多 React 实例/命名空间错配(React 命名空间统一 import * as X from 'react')
 * run.cjs 会把 'react' vite-alias 到 vendor-Z 内联 React(Rr)，与入口 react-dom 同一实例。
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');
const prettier = require('prettier');

const inputFile = process.argv[2];
const outputDir = process.argv[3];
if (!inputFile || !outputDir) { console.error('用法: node 02_split.cjs <输入.js> <输出目录>'); process.exit(1); }

const GLOBALS = new Set([
  'undefined','console','Math','Date','JSON','Promise','Error','Object','Array','String','Number',
  'Boolean','parseInt','parseFloat','isNaN','RegExp','Set','Map','WeakMap','Symbol','Intl','Reflect',
  'Proxy','BigInt','NaN','Infinity','globalThis','arguments','this','super','new','target','import','meta',
  'document','window','chrome','location','navigator','history','fetch','XMLHttpRequest','localStorage',
  'sessionStorage','indexedDB','crypto','File','Blob','FileReader','URL','URLSearchParams','Image',
  'ImageBitmap','OffscreenCanvas','HTMLImageElement','HTMLVideoElement','HTMLCanvasElement','HTMLInputElement',
  'HTMLAnchorElement','SVGImageElement','VideoFrame','AudioData','MediaStream','MediaStreamTrack',
  'MediaStreamTrackProcessor','AbortController','AbortSignal','Event','CustomEvent','EventTarget',
  'MutationObserver','ResizeObserver','IntersectionObserver','PerformanceObserver','requestAnimationFrame',
  'cancelAnimationFrame','setTimeout','clearTimeout','setInterval','clearInterval','queueMicrotask',
  'structuredClone','performance','atob','btoa','TextEncoder','TextDecoder','WritableStream',
  'ReadableStream','TransformStream','DataTransfer','DataTransferItem','ClipboardItem','BroadcastChannel',
  'Worker','AudioContext','webkitAudioContext','VTTCue','ImageData','PromiseRejectionEvent','DOMParser',
  'XMLSerializer','Node','self','top','parent','frames','postMessage','addEventListener','removeEventListener',
  'dispatchEvent','getComputedStyle','matchMedia','Notification','Screen','WebSocket',
]);

const REACT_APIS = new Set([
  'forwardRef','useRef','useState','useEffect','useMemo','useCallback','useImperativeHandle','useContext',
  'useReducer','useLayoutEffect','useDebugValue','useDeferredValue','useTransition','useId','useSyncExternalStore',
  'useInsertionEffect','useOptimistic','useActionState','useFormStatus','use','createElement','createContext',
  'createFactory','createRef','Fragment','memo','lazy','Suspense','StrictMode','cloneElement','isValidElement',
  'Children','Component','PureComponent','Profiler','startTransition','flushSync','unstable_batchedUpdates','version',
]);

async function run() {
  fs.mkdirSync(outputDir, { recursive: true });
  const rawCode = fs.readFileSync(inputFile, 'utf-8');
  const ast = parser.parse(rawCode, { sourceType: 'module', plugins: ['jsx'] });

  const components = [];
  const sharedNodes = [];
  const sharedDeclared = new Set();
  const importedNames = new Set();
  const seenNames = new Set();

  traverse(ast, { Program(p) {
    p.get('body').forEach(s => { if (s.isImportDeclaration())
      for (const spec of s.node.specifiers) if (spec.local?.name) importedNames.add(spec.local.name); });
  }});

  // 在单条 statement 路径内收集引用（scope 完整）
  function collectRefsInPath(sp, selfName) {
    const freeIds = [], reactNS = [], jsxTags = [];
    sp.traverse({
      MemberExpression(ip) {
        if (ip.node.computed) return;
        const o = ip.node.object, pr = ip.node.property;
        if (t.isIdentifier(o) && t.isIdentifier(pr) && REACT_APIS.has(pr.name) && !GLOBALS.has(o.name) && !reactNS.includes(o.name)) reactNS.push(o.name);
      },
      JSXMemberExpression(ip) {
        const o = ip.node.object, pr = ip.node.property;
        if (t.isJSXIdentifier(o) && t.isJSXIdentifier(pr) && REACT_APIS.has(pr.name) && !GLOBALS.has(o.name) && !reactNS.includes(o.name)) reactNS.push(o.name);
      },
      JSXOpeningElement(ip) {
        const n = ip.node.name;
        if (t.isJSXIdentifier(n) && !/^[a-z]/.test(n.name) && !GLOBALS.has(n.name) && !jsxTags.includes(n.name)) jsxTags.push(n.name);
      },
      Identifier(ip) {
        if (ip.parent.type === 'MemberExpression' && ip.parent.property === ip.node && !ip.parent.computed) return;
        if (ip.parent.type === 'OptionalMemberExpression' && ip.parent.property === ip.node && !ip.parent.computed) return;
        if (ip.parent.type === 'JSXMemberExpression' && ip.parent.property === ip.node) return;
        if (ip.isBindingIdentifier()) return;
        const name = ip.node.name;
        if (GLOBALS.has(name) || name === selfName) return;
        if (!freeIds.includes(name)) freeIds.push(name);
      },
    });
    return { freeIds, reactNS, jsxTags };
  }

  traverse(ast, { Program(progPath) {
    progPath.get('body').forEach((sp) => {
      let isComponent = false, compName = '', nodeToStore = sp.node;
      sp.traverse({
        JSXElement() { isComponent = true; },
        JSXFragment() { isComponent = true; },
        CallExpression(cp) {
          const callee = cp.node.callee;
          if (t.isIdentifier(callee) && ['_jsx','_jsxs','jsx','jsxs'].includes(callee.name)) isComponent = true;
          if (t.isMemberExpression(callee) && ['createElement','jsx','jsxs'].includes(callee.property.name)) isComponent = true;
        },
      });
      if (isComponent) {
        if (sp.isFunctionDeclaration()) compName = sp.node.id?.name;
        else if (sp.isVariableDeclaration()) compName = sp.node.declarations[0]?.id?.name;
        else if (sp.isExpressionStatement()) { const e = sp.node.expression; if (t.isAssignmentExpression(e) && e.left.name) compName = e.left.name; }
      }
      if (isComponent && compName) {
        components.push({ name: compName, node: nodeToStore, ...collectRefsInPath(sp, compName) });
      } else {
        sharedNodes.push(nodeToStore);
        if (sp.isVariableDeclaration()) sp.node.declarations.forEach(d => { if (d.id?.name && !seenNames.has(d.id.name)) { sharedDeclared.add(d.id.name); seenNames.add(d.id.name); } });
        else if (sp.isFunctionDeclaration()) { if (sp.node.id?.name && !seenNames.has(sp.node.id.name)) { sharedDeclared.add(sp.node.id.name); seenNames.add(sp.node.id.name); } }
      }
    });
  }});

  const compNames = new Set(components.map(c => c.name));
  console.log(`  发现 ${components.length} 个组件, ${sharedNodes.length} 个共享声明`);

  const usedCase = new Map();
  const nameMap = {};
  function safeFilename(name) {
    const lower = name.toLowerCase(), ex = usedCase.get(lower);
    if (ex && ex !== name) {
      const c = (usedCase.get(lower + '_count') || 1);
      const withSuffix = name + '_' + c;
      usedCase.set(lower + '_count', c + 1); usedCase.set(lower, name); return withSuffix;
    }
    usedCase.set(lower, name); return name;
  }
  for (const comp of components) nameMap[comp.name] = safeFilename(comp.name);

  for (const comp of components) {
    const rn = new Set(comp.reactNS);
    comp.reactDeps = [...rn];
    comp.reactBare = [...new Set(comp.freeIds.filter(d => REACT_APIS.has(d) && !rn.has(d) && !compNames.has(d) && !(sharedDeclared.has(d) || importedNames.has(d))))];
    comp.compDeps = [...new Set([...comp.jsxTags, ...comp.freeIds].filter(d => compNames.has(d) && d !== comp.name))];
    comp.sharedDeps = [...new Set(comp.freeIds.filter(d => (sharedDeclared.has(d) || importedNames.has(d)) && !compNames.has(d) && !rn.has(d)))];
    comp.leftDeps = [...new Set(comp.freeIds.filter(d => !compNames.has(d) && !sharedDeclared.has(d) && !importedNames.has(d) && !rn.has(d) && !REACT_APIS.has(d)))];
  }

  const allSharedDeps = new Set();
  for (const comp of components) for (const d of comp.sharedDeps) allSharedDeps.add(d);

  function emitProgram(bodyNodes, label) {
    const prog = t.program(bodyNodes);
    // 剔除无本地绑定的非 sourceful 具名导出，避免 "Export X is not defined"
    const bound = new Set();
    for (const n of prog.body) {
      if (t.isImportDeclaration(n)) for (const s of n.specifiers) if (s.local?.name) bound.add(s.local.name);
      else if (t.isVariableDeclaration(n)) n.declarations.forEach(d => d.id?.name && bound.add(d.id.name));
      else if (t.isFunctionDeclaration(n) && n.id?.name) bound.add(n.id.name);
      else if (t.isClassDeclaration(n) && n.id?.name) bound.add(n.id.name);
    }
    for (const n of prog.body) {
      if (t.isExportNamedDeclaration(n) && !n.declaration && !n.source)
        n.specifiers = n.specifiers.filter(s => bound.has(s.local?.name || s.local?.value));
    }
    const code = generate(prog, { comments: true }).code;
    try { return parser.parse(code, { sourceType: 'module', plugins: ['jsx'] }); }
    catch (e) { fs.writeFileSync(path.join(outputDir, `fail_${label}.js`), code); throw new Error(`[${label}] ${e.message}`); }
  }
  function renameInAst(pa, renameMap) {
    traverse(pa, { Identifier(p) {
      const par = p.parent;
      // 导入/导出说明符一律不动：
      //   imported 名属于「对方模块的导出命名空间」，用本地 renameMap 改会造成
      //   `_cmp_Qt is not exported by vendor.js` 这类错误；
      //   local 名若需重命名，由下方通用分支配合 scope 判断处理。
      // shared.js 的 `X is not exported` 问题在「导出侧」解决（declaredBound 优先导出），不在此处。
      if (t.isImportSpecifier(par) || t.isExportSpecifier(par)) return;
      if (t.isImportDefaultSpecifier(par)||t.isImportNamespaceSpecifier(par)||t.isImportDeclaration(par)||t.isExportNamedDeclaration(par)||t.isExportDefaultDeclaration(par)) return;
      const name = p.node.name;
      if (renameMap[name] && !p.scope.hasBinding(name)) p.node.name = renameMap[name];
    }});
  }
  function rewriteSharedRefs(pa, depSet, ns) {
    traverse(pa, { Identifier(p) {
      const name = p.node.name;
      if (!depSet.has(name)) return;
      if (p.scope.hasBinding(name)) return; // 局部绑定（含闭包参数遮蔽）不重写
      const par = p.parent;
      if (par.type === 'MemberExpression' && par.property === p.node && !par.computed) return;
      if (par.type === 'OptionalMemberExpression' && par.property === p.node && !par.computed) return;
      if (par.type === 'JSXMemberExpression' && par.property === p.node) return;
      if (t.isImportSpecifier(par) || t.isExportSpecifier(par) || t.isImportDeclaration(par) || t.isExportNamedDeclaration(par)) return;
      if (par.type === 'ObjectProperty' && par.key === p.node && !par.computed) return;
      if ((par.type === 'ObjectMethod' || par.type === 'ClassProperty' || par.type === 'ClassMethod' || par.type === 'ClassPrivateProperty') && par.key === p.node && !par.computed) return;
      if (t.isLabeledStatement(par) || t.isBreakStatement(par) || t.isContinueStatement(par)) return;
      if (par.type === 'ObjectProperty' && par.shorthand) par.shorthand = false;
      p.replaceWith(t.memberExpression(t.identifier(ns), t.identifier(name)));
    }});
  }
  // 手动遍历（不依赖 babel scope）：收集被赋值/自增的共享名
  function collectWritten(node, sdSet, out) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const c of node) collectWritten(c, sdSet, out); return; }
    if (node.type === 'AssignmentExpression') {
      const l = node.left;
      if (l && l.type === 'Identifier' && sdSet.has(l.name)) out.add(l.name);
    } else if (node.type === 'UpdateExpression') {
      const a = node.argument;
      if (a && a.type === 'Identifier' && sdSet.has(a.name)) out.add(a.name);
    }
    for (const k of Object.keys(node)) {
      if (k === 'type' || k === 'start' || k === 'end' || k === 'loc' || k === 'range' || k === 'leadingComments' || k === 'trailingComments' || k === 'innerComments' || k === 'extra' || k === 'comments') continue;
      const v = node[k];
      if (v && typeof v === 'object') collectWritten(v, sdSet, out);
    }
  }

  for (const comp of components) {
    const importStmts = [], renameMap = {};
    const sdSet = new Set(comp.sharedDeps);
    const writtenSet = new Set();
    collectWritten(comp.node, sdSet, writtenSet);
    for (const c of comp.compDeps) {
      const safe = nameMap[c], alias = `_cmp_${safe}`; renameMap[c] = alias;
      importStmts.push(t.importDeclaration([t.importDefaultSpecifier(t.identifier(alias))], t.stringLiteral(`./${safe}.jsx`)));
    }
    // 修复 A：shared 引用
    //   - 仅被读取：命名导入 import { X }（安全，无需改写）
    //   - 被赋值/自增：命名空间导入 import * as _shared，引用改写为 _shared.X（ES 禁止给 import 绑定赋值）
    const namedShared = comp.sharedDeps.filter(d => !writtenSet.has(d));
    if (namedShared.length)
      importStmts.push(t.importDeclaration(namedShared.map(d => t.importSpecifier(t.identifier(d), t.identifier(d))), t.stringLiteral('./shared.js')));
    if (writtenSet.size)
      importStmts.push(t.importDeclaration([t.importNamespaceSpecifier(t.identifier('_shared'))], t.stringLiteral('./shared.js')));
    // 修复 C：React 命名空间统一 import * as X from 'react'（vite alias -> vendor 单实例）
    for (const X of comp.reactDeps) {
      importStmts.push(t.importDeclaration([t.importNamespaceSpecifier(t.identifier(X))], t.stringLiteral('react')));
    }
    if (comp.reactBare.length)
      importStmts.push(t.importDeclaration(comp.reactBare.map(n => t.importSpecifier(t.identifier(n), t.identifier(n))), t.stringLiteral('react')));

    const body = [...importStmts.map(n => t.cloneNode(n, true))];
    if (t.isFunctionDeclaration(comp.node)) body.push(t.exportDefaultDeclaration(t.cloneNode(comp.node, true)));
    else { body.push(t.cloneNode(comp.node, true)); body.push(t.exportDefaultDeclaration(t.identifier(comp.name))); }

    const progAst = emitProgram(body, comp.name);
    if (writtenSet.size) rewriteSharedRefs(progAst, writtenSet, '_shared');
    renameInAst(progAst, renameMap);
    let code = generate(progAst, { comments: true }).code;
    if (comp.leftDeps.length) code = `// TODO(全局, 无需 import): ${comp.leftDeps.join(', ')}\n` + code;
    let formatted;
    try { formatted = await prettier.format(code, { parser: 'babel', printWidth: 100, tabWidth: 2, singleQuote: true, semi: true }); }
    catch (e) { formatted = code; }
    fs.writeFileSync(path.join(outputDir, `${nameMap[comp.name]}.jsx`), formatted, 'utf-8');
  }

  // ========== 生成 shared.js ==========
  // 丢弃原始 export 节点，统一由下方计算导出列表（避免漏导出 / 重复导出）
  for (let i = sharedNodes.length - 1; i >= 0; i--) {
    if (t.isExportNamedDeclaration(sharedNodes[i])) sharedNodes.splice(i, 1);
  }
  const sharedCompDeps = new Set();
  {
    const scanAst = emitProgram(sharedNodes.map(n => t.cloneNode(n, true)));
    traverse(scanAst, { Identifier(p) { const n = p.node.name; if (compNames.has(n) && !p.scope.hasBinding(n)) sharedCompDeps.add(n); } });
  }
  const sharedImportStmts = [], sharedRename = {};
  for (const c of sharedCompDeps) {
    const safe = nameMap[c], alias = `_cmp_${safe}`; sharedRename[c] = alias;
    sharedImportStmts.push(t.importDeclaration([t.importDefaultSpecifier(t.identifier(alias))], t.stringLiteral(`./${safe}.jsx`)));
  }
  const originalExported = new Set();
  for (const node of sharedNodes) {
    if (t.isExportNamedDeclaration(node) && node.specifiers) for (const s of node.specifiers) originalExported.add(s.exported?.name || s.exported?.value);
    if (t.isExportNamedDeclaration(node) && node.declaration) {
      const d = node.declaration;
      if (t.isVariableDeclaration(d)) d.declarations.forEach(dd => originalExported.add(dd.id?.name));
      else if ((t.isFunctionDeclaration(d) || t.isClassDeclaration(d)) && d.id) originalExported.add(d.id.name);
    }
    if (t.isExportDefaultDeclaration(node)) originalExported.add('default');
  }
  const sharedBound = new Set();
  for (const node of sharedNodes) {
    if (t.isImportDeclaration(node)) for (const s of node.specifiers) if (s.local?.name) sharedBound.add(s.local.name);
    else if (t.isVariableDeclaration(node)) node.declarations.forEach(d => d.id?.name && sharedBound.add(d.id.name));
    else if (t.isFunctionDeclaration(node) && node.id?.name) sharedBound.add(node.id.name);
    else if (t.isClassDeclaration(node) && node.id?.name) sharedBound.add(node.id.name);
  }
  // 修复 B：直接从将要生成的 sharedBody 收集所有顶层声明/导入名并导出（非组件名），
  // 与 emitProgram 的 bound 计算同源，彻底杜绝 "X is not exported"。
  const sharedBody = [...sharedImportStmts.map(n => t.cloneNode(n, true)), ...sharedNodes.map(n => t.cloneNode(n, true))];
  const realBound = new Set();
  const declaredBound = new Set();
  for (const n of sharedBody) {
    if (t.isImportDeclaration(n)) for (const s of n.specifiers) if (s.local?.name) realBound.add(s.local.name);
    else if (t.isVariableDeclaration(n)) n.declarations.forEach(d => { if (d.id?.name) { realBound.add(d.id.name); declaredBound.add(d.id.name); } });
    else if (t.isFunctionDeclaration(n) && n.id?.name) { realBound.add(n.id.name); declaredBound.add(n.id.name); }
    else if (t.isClassDeclaration(n) && n.id?.name) { realBound.add(n.id.name); declaredBound.add(n.id.name); }
  }
  const exportSet = new Set();
  for (const n of realBound) {
    // 顶层声明（var/function/class）即使名字与某组件 orig 同名（如 vendor 别名 Fn 与本地 var Fn 冲突），
    // 也必须导出，否则引用它的组件 import 找不到；仅 import 进来的名沿用 compNames 排除逻辑。
    if (declaredBound.has(n) || !compNames.has(n)) exportSet.add(n);
  }
  const exportStmt = exportSet.size ? t.exportNamedDeclaration(null, [...exportSet].map(n => t.exportSpecifier(t.identifier(n), t.identifier(n)))) : null;
  if (exportStmt) sharedBody.push(t.cloneNode(exportStmt, true));
  const sharedAst = emitProgram(sharedBody, 'shared');
  renameInAst(sharedAst, sharedRename);
  let sharedCode = generate(sharedAst, { comments: true }).code;
  let sharedFormatted;
  try { sharedFormatted = await prettier.format(sharedCode, { parser: 'babel', printWidth: 100, tabWidth: 2, singleQuote: true, semi: true }); }
  catch (e) { sharedFormatted = sharedCode; }
  fs.writeFileSync(path.join(outputDir, 'shared.js'), sharedFormatted, 'utf-8');
  fs.writeFileSync(path.join(outputDir, 'component_map.json'), JSON.stringify(nameMap, null, 2), 'utf-8');
  console.log(`✅ 拆分完成 → ${outputDir}/component_map.json`);
}
run().catch(e => { console.error('❌', e.stack || e.message); process.exit(1); });
