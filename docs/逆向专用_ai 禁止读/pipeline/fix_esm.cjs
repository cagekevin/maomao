/**
 * 后处理：根治逆向产物两类 ESM 错误（无需重跑整条流水线）
 *   A. shared.js 漏导出顶层声明（"X is not exported"）
 *   B. 组件给 import 绑定赋值（"X is an import" / ASSIGN_TO_IMPORT）
 *   C. 清理 webcrack [native code] 伪迹
 *   D. 还原被错写的 constructor 伪迹
 *   E. 悬空引用补全 + E2. 抽出组件引用名改写（用 component_map.json）
 * 用法：node fix_esm.cjs <工程根目录>
 *
 * 来源：docs/成功复盘SOP.md 附录 A（已真机验证版本，勿擅自泛化）
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

const ROOT = process.argv[2];
if (!ROOT) { console.error('用法: node fix_esm.cjs <工程根目录>'); process.exit(1); }

const PARSE_PLUGINS = ['jsx', 'typescript', 'classProperties', 'objectRestSpread',
  'optionalChaining', 'nullishCoalescingOperator', 'dynamicImport', 'topLevelAwait', 'decorators-legacy'];
function parseCode(code) {
  return parser.parse(code, { sourceType: 'module', plugins: PARSE_PLUGINS, errorRecovery: true });
}

function walk(dir, cb) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.vite' || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, cb);
    else if (/\.(jsx?|mjs|cjs)$/.test(e.name)) cb(p);
  }
}

function isSharedFile(p) { return /(^|[\\/])shared\.jsx?$/.test(p); }

// ---------- C. 清理 webcrack [native code] 伪迹（兼容空格/内嵌形式）----------
function cleanArtifacts(code) {
  return code.replace(/function\s+([A-Za-z_$][\w$]*)\s*\(\s*\)\s*\{\s*\[\s*native code\s*\]\s*\}/g, '$1');
}

// ---------- D. 还原被错写的 constructor 伪迹 ----------
function fixConstructorArtifact(code) {
  const ast = parseCode(code);
  let changed = false;
  traverse(ast, {
    ClassMethod(p) {
      const key = p.node.key;
      if (p.node.kind === 'method' && key && t.isIdentifier(key) && key.name === 'Object') {
        let hasSuper = false;
        p.traverse({ Super() { hasSuper = true; } });
        if (hasSuper) {
          p.node.key = t.identifier('constructor');
          p.node.kind = 'constructor';
          changed = true;
        }
      }
    },
  });
  if (!changed) return code;
  return generate(ast, {}, code).code;
}

// ---------- A. 导出同步 ----------
function exportSync(code) {
  const ast = parseCode(code);
  const topNames = new Set();
  for (const stmt of ast.program.body) {
    if (t.isVariableDeclaration(stmt)) {
      for (const d of stmt.declarations) if (d.id && t.isIdentifier(d.id)) topNames.add(d.id.name);
    } else if (t.isFunctionDeclaration(stmt) && stmt.id) topNames.add(stmt.id.name);
    else if (t.isClassDeclaration(stmt) && stmt.id) topNames.add(stmt.id.name);
    else if (t.isImportDeclaration(stmt)) {
      for (const s of stmt.specifiers) if (s.local && t.isIdentifier(s.local)) topNames.add(s.local.name);
    }
  }
  const existing = new Set();
  for (const stmt of ast.program.body) {
    if (t.isExportNamedDeclaration(stmt)) {
      if (stmt.specifiers) for (const s of stmt.specifiers) existing.add(s.exported.name);
      if (stmt.declaration) {
        if (t.isFunctionDeclaration(stmt.declaration) && stmt.declaration.id) existing.add(stmt.declaration.id.name);
        else if (t.isClassDeclaration(stmt.declaration) && stmt.declaration.id) existing.add(stmt.declaration.id.name);
        else if (t.isVariableDeclaration(stmt.declaration)) for (const d of stmt.declaration.declarations) if (d.id && t.isIdentifier(d.id)) existing.add(d.id.name);
      }
    }
    if (t.isExportDefaultDeclaration(stmt)) existing.add('default');
  }
  const toAdd = [...topNames].filter(n => !existing.has(n) && n !== 'default');
  if (toAdd.length === 0) return code;

  let keep = null;
  for (const stmt of ast.program.body) {
    if (t.isExportNamedDeclaration(stmt) && !stmt.declaration && stmt.specifiers) { keep = stmt; break; }
  }
  if (!keep) {
    const gen = generate(t.exportNamedDeclaration(null, toAdd.map(n => t.exportSpecifier(t.identifier(n), t.identifier(n))))).code;
    return code + '\n' + gen + '\n';
  }
  for (const n of toAdd) keep.specifiers.push(t.exportSpecifier(t.identifier(n), t.identifier(n)));
  const seen = new Set();
  keep.specifiers = keep.specifiers.filter(s => { const n = s.exported.name; if (seen.has(n)) return false; seen.add(n); return true; });
  const gen = generate(keep).code;
  return code.slice(0, keep.start) + gen + code.slice(keep.end);
}

// ---------- B. import 赋值改写 ----------
function topLevelBindings(ast) {
  const set = new Set();
  for (const stmt of ast.program.body) {
    if (t.isVariableDeclaration(stmt)) for (const d of stmt.declarations) if (d.id && t.isIdentifier(d.id)) set.add(d.id.name);
    else if (t.isFunctionDeclaration(stmt) && stmt.id) set.add(stmt.id.name);
    else if (t.isClassDeclaration(stmt) && stmt.id) set.add(stmt.id.name);
    else if (t.isImportDeclaration(stmt)) for (const s of stmt.specifiers) if (s.local && t.isIdentifier(s.local)) set.add(s.local.name);
  }
  return set;
}

function fixImportAssignments(code) {
  const ast = parseCode(code);
  const sharedImports = ast.program.body.filter(s => t.isImportDeclaration(s) && /shared\.jsx?$/.test(s.source.value));
  if (sharedImports.length === 0) return code;

  const assigned = new Set();
  traverse(ast, {
    AssignmentExpression(p) { const l = p.node.left; if (t.isIdentifier(l)) assigned.add(l.name); },
    UpdateExpression(p) { const a = p.node.argument; if (t.isIdentifier(a)) assigned.add(a.name); },
  });

  let changed = false;
  for (const imp of sharedImports) {
    const toNs = imp.specifiers.filter(s => t.isImportSpecifier(s) && assigned.has(s.local.name));
    if (toNs.length === 0) continue;
    changed = true;
    const nsNames = new Set(toNs.map(s => s.local.name));

    let nsLocal = null;
    // 注意：namespace specifier 在 declaration.specifiers 里，不能直接对 declaration 判断
    const existingNs = ast.program.body.find(s =>
      t.isImportDeclaration(s) && s.source.value === imp.source.value &&
      s.specifiers.some(sp => t.isImportNamespaceSpecifier(sp)));
    if (existingNs) {
      nsLocal = existingNs.specifiers.find(sp => t.isImportNamespaceSpecifier(sp)).local.name;
    } else {
      const taken = topLevelBindings(ast);
      nsLocal = '_shared'; let i = 1;
      while (taken.has(nsLocal)) nsLocal = '_shared' + (i++);
      ast.program.body.unshift(t.importDeclaration([t.importNamespaceSpecifier(t.identifier(nsLocal))], t.stringLiteral(imp.source.value)));
    }

    imp.specifiers = imp.specifiers.filter(s => !(t.isImportSpecifier(s) && nsNames.has(s.local.name)));
    if (imp.specifiers.length === 0) {
      const idx = ast.program.body.indexOf(imp);
      if (idx >= 0) ast.program.body.splice(idx, 1);
    }

    traverse(ast, {
      Identifier(p) {
        const name = p.node.name;
        if (!nsNames.has(name)) return;
        if (p.isReferencedIdentifier()) { p.replaceWith(t.memberExpression(t.identifier(nsLocal), t.identifier(name))); return; }
        const par = p.parentPath;
        if (par.isAssignmentExpression() && par.node.left === p.node) { p.replaceWith(t.memberExpression(t.identifier(nsLocal), t.identifier(name))); return; }
        if (par.isUpdateExpression() && par.node.argument === p.node) { p.replaceWith(t.memberExpression(t.identifier(nsLocal), t.identifier(name))); return; }
      },
      JSXIdentifier(p) {
        const name = p.node.name;
        if (!nsNames.has(name)) return;
        if (p.parentPath.isJSXAttribute()) return;
        if (p.parentPath.isJSXMemberExpression() && p.parentPath.node.property === p.node) return;
        if (p.parentPath.isJSXOpeningElement() || p.parentPath.isJSXClosingElement()) {
          p.replaceWith(t.jsxMemberExpression(t.jsxIdentifier(nsLocal), t.jsxIdentifier(name)));
        }
      },
    });
  }
  if (!changed) return code;
  return generate(ast, {}, code).code;
}

// ---------- E. 悬空引用补全 ----------
function getSharedExports(sharedPath) {
  try {
    const code = fs.readFileSync(sharedPath, 'utf8');
    const ast = parseCode(code);
    const names = new Set();
    for (const stmt of ast.program.body) {
      if (t.isExportNamedDeclaration(stmt)) {
        if (stmt.specifiers) for (const s of stmt.specifiers) names.add(s.exported.name);
        if (stmt.declaration) {
          if (t.isFunctionDeclaration(stmt.declaration) && stmt.declaration.id) names.add(stmt.declaration.id.name);
          else if (t.isClassDeclaration(stmt.declaration) && stmt.declaration.id) names.add(stmt.declaration.id.name);
          else if (t.isVariableDeclaration(stmt.declaration)) for (const d of stmt.declaration.declarations) if (d.id && t.isIdentifier(d.id)) names.add(d.id.name);
        }
      }
      if (t.isExportDefaultDeclaration(stmt)) names.add('default');
      if (t.isVariableDeclaration(stmt)) for (const d of stmt.declarations) if (d.id && t.isIdentifier(d.id)) names.add(d.id.name);
      else if (t.isFunctionDeclaration(stmt) && stmt.id) names.add(stmt.id.name);
      else if (t.isClassDeclaration(stmt) && stmt.id) names.add(stmt.id.name);
      else if (t.isImportDeclaration(stmt)) for (const s of stmt.specifiers) if (s.local && t.isIdentifier(s.local)) names.add(s.local.name);
    }
    return names;
  } catch (e) { return null; }
}

function fixDanglingImports(code, sharedExports, dir) {
  const ast = parseCode(code);
  let compKeys = new Set();
  try {
    const mp = path.join(dir, 'component_map.json');
    if (fs.existsSync(mp)) { const m = JSON.parse(fs.readFileSync(mp, 'utf8')); compKeys = new Set(Object.keys(m)); }
  } catch (e) {}
  const missing = new Set();
  traverse(ast, {
    Identifier(p) {
      const name = p.node.name;
      if (!sharedExports.has(name)) return;
      if (p.isReferencedIdentifier()) {
        if (!p.scope.getBinding(name)) missing.add(name);
      }
    },
    JSXIdentifier(p) {
      const name = p.node.name;
      if (!sharedExports.has(name)) return;
      if (p.parentPath.isJSXAttribute()) return;
      if (p.parentPath.isJSXMemberExpression() && p.parentPath.node.property === p.node) return;
      if (p.parentPath.isJSXMemberExpression() && p.parentPath.node.object === p.node) {
        if (!p.scope.getBinding(name)) missing.add(name);
        return;
      }
      if (p.parentPath.isJSXOpeningElement() || p.parentPath.isJSXClosingElement()) {
        if (!p.scope.getBinding(name)) missing.add(name);
      }
    },
  });
  if (missing.size === 0) return code;
  for (const n of [...missing]) {
    if (compKeys.has(n)) { missing.delete(n); continue; }
    if (fs.existsSync(path.join(dir, n + '.jsx')) || fs.existsSync(path.join(dir, n + '.js'))) missing.delete(n);
  }
  if (missing.size === 0) return code;
  let imp = ast.program.body.find(s => t.isImportDeclaration(s) && /shared\.jsx?$/.test(s.source.value));
  if (imp) {
    const have = new Set(imp.specifiers.filter(s => t.isImportSpecifier(s)).map(s => s.imported.name));
    for (const n of missing) if (!have.has(n)) imp.specifiers.push(t.importSpecifier(t.identifier(n), t.identifier(n)));
  } else {
    const specs = [...missing].map(n => t.importSpecifier(t.identifier(n), t.identifier(n)));
    ast.program.body.unshift(t.importDeclaration(specs, t.stringLiteral('./shared.js')));
  }
  return generate(ast, {}, code).code;
}

// ---------- E2. 抽出组件引用名改写（用 component_map.json：原始名→文件名）----------
function fixExtractedComponentRefs(code, fp) {
  const ast = parseCode(code);
  const dir = path.dirname(fp);
  const selfBase = path.basename(fp).replace(/\.jsx?$/, '');
  const mapPath = path.join(dir, 'component_map.json');
  if (!fs.existsSync(mapPath)) return code;
  let cmap;
  try { cmap = JSON.parse(fs.readFileSync(mapPath, 'utf8')); } catch (e) { return code; }
  const targets = [];
  for (const [orig, file] of Object.entries(cmap)) {
    if (orig === selfBase) continue;
    targets.push({ orig, file, local: '_cmp_' + file });
  }
  if (targets.length === 0) return code;
  const origToTarget = new Map(targets.map(x => [x.orig, x]));

  const refs = new Map();
  const collect = (p, name) => { if (!refs.has(name)) refs.set(name, []); refs.get(name).push(p); };
  traverse(ast, {
    JSXIdentifier(p) {
      const name = p.node.name;
      if (!origToTarget.has(name)) return;
      if (p.parentPath.isJSXAttribute()) return;
      if (p.parentPath.isJSXMemberExpression() && p.parentPath.node.property === p.node) return;
      if (p.parentPath.isJSXMemberExpression() && p.parentPath.node.object === p.node) { collect(p, name); return; }
      if (p.parentPath.isJSXOpeningElement() || p.parentPath.isJSXClosingElement()) collect(p, name);
    },
    Identifier(p) {
      const name = p.node.name;
      if (!origToTarget.has(name)) return;
      if (p.isReferencedIdentifier() && !p.scope.getBinding(name)) collect(p, name);
    },
  });
  if (refs.size === 0) return code;

  let sawWrongShared = false;
  for (const stmt of ast.program.body) {
    if (t.isImportDeclaration(stmt) && /shared\.jsx?$/.test(stmt.source.value)) {
      const filtered = stmt.specifiers.filter(s => !(t.isImportSpecifier(s) && refs.has(s.imported.name)));
      if (filtered.length !== stmt.specifiers.length) { stmt.specifiers = filtered; sawWrongShared = true; }
      if (stmt.specifiers.length === 0) { const i = ast.program.body.indexOf(stmt); if (i >= 0) ast.program.body.splice(i, 1); }
    }
  }

  const need = new Set();
  for (const name of refs.keys()) {
    const tg = origToTarget.get(name);
    const exist = ast.program.body.some(s =>
      t.isImportDeclaration(s) && s.specifiers.some(sp => t.isImportDefaultSpecifier(sp) && sp.local.name === tg.local));
    if (!exist) {
      let insAt = ast.program.body.findIndex(s => !t.isImportDeclaration(s));
      if (insAt < 0) insAt = ast.program.body.length;
      ast.program.body.splice(insAt, 0, t.importDeclaration([t.importDefaultSpecifier(t.identifier(tg.local))], t.stringLiteral('./' + tg.file + '.jsx')));
    }
    need.add(name);
  }

  let changed = false;
  traverse(ast, {
    JSXIdentifier(p) {
      const name = p.node.name;
      if (!need.has(name)) return;
      if (p.parentPath.isJSXAttribute()) return;
      if (p.parentPath.isJSXMemberExpression() && p.parentPath.node.property === p.node) return;
      if (p.parentPath.isJSXMemberExpression() && p.parentPath.node.object === p.node) {
        p.node.name = origToTarget.get(name).local; changed = true; return;
      }
      if (p.parentPath.isJSXOpeningElement() || p.parentPath.isJSXClosingElement()) {
        p.node.name = origToTarget.get(name).local; changed = true;
      }
    },
    Identifier(p) {
      const name = p.node.name;
      if (!need.has(name)) return;
      if (p.isReferencedIdentifier() && !p.scope.getBinding(name)) {
        p.node.name = origToTarget.get(name).local; changed = true;
      }
    },
  });
  if (!changed && !sawWrongShared) return code;
  return generate(ast, {}, code).code;
}

// ---------- 主流程 ----------
const sharedCache = new Map();
function getSharedFor(dir) {
  if (sharedCache.has(dir)) return sharedCache.get(dir);
  let res = null;
  for (const nm of ['shared.js', 'shared.jsx']) {
    const p = path.join(dir, nm);
    if (fs.existsSync(p)) { res = getSharedExports(p); break; }
  }
  sharedCache.set(dir, res);
  return res;
}

let syncCount = 0, fixCount = 0, danglingCount = 0;
walk(ROOT, (fp) => {
  let code = fs.readFileSync(fp, 'utf8');
  const before = code;
  const isShared = isSharedFile(fp);
  code = cleanArtifacts(code);
  try { code = fixConstructorArtifact(code); } catch (e) { console.log(`  ⚠️ constructor 还原跳过: ${fp} (${e.message.split('\n')[0]})`); }
  if (isShared) {
    try { code = exportSync(code); } catch (e) { console.log(`  ⚠️ 导出同步跳过: ${fp} (${e.message.split('\n')[0]})`); }
  } else {
    try { code = fixExtractedComponentRefs(code, fp); } catch (e) { console.log(`  ⚠️ 组件引用改写跳过: ${fp} (${e.message.split('\n')[0]})`); }
    const se = getSharedFor(path.dirname(fp));
    if (se) {
      try {
        const beforeD = code;
        code = fixDanglingImports(code, se, path.dirname(fp));
        if (code !== beforeD) danglingCount++;
      } catch (e) { console.log(`  ⚠️ 悬空补全跳过: ${fp} (${e.message.split('\n')[0]})`); }
    }
  }
  try { code = fixImportAssignments(code); } catch (e) { console.log(`  ⚠️ 改写跳过: ${fp} (${e.message.split('\n')[0]})`); }
  if (code !== before) {
    fs.writeFileSync(fp, code);
    if (isShared) syncCount++; else fixCount++;
  }
});

console.log(`✅ 导出同步 shared.js: ${syncCount} 个`);
console.log(`✅ import 赋值改写: ${fixCount} 个文件`);
console.log(`✅ 悬空引用补全: ${danglingCount} 处`);
