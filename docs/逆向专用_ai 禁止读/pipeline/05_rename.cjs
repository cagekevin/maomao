/**
 * 05_rename.cjs — 可读化层（可选）
 *
 * 在 run.cjs 产出 output/project 后，对 src/bundle/*.js 做**作用域安全**的语义化重命名，
 * 把高置信的压缩符号点亮为可读名。直接改写参与构建的源码，因此交付物 dist/ 即带可读命名。
 *
 * 移植自 AI08 的 rename_bundle.cjs + name_rules.cjs，适配 minimal：
 *   - 版本无关：用 fs.readdirSync 自动收 src/bundle/ 下所有 *.js，不再写死 TARGETS
 *   - 自包含：mapping 文件可选（vendor-mapping/func-mapping/var-mapping.txt 若存在则加载，
 *     不存在则只用内置 9 条核心保底规则，无需外部依赖）
 *   - 安全护栏（保真优先）：跨文件导出名受保护；作用域树遍历 + 绑定类型分流；
 *     目标名被占用则跳过；第三方 chunk(vendor-/rolldown-runtime-)原样保留
 *
 * 用法: node pipeline/05_rename.cjs <output/project/src/bundle>
 *   node pipeline/05_rename.cjs output/project/src/bundle
 *
 * 改前建议先对 output/project/src 做 snapshot（rollback），构建失败可回退。
 */
const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

const BUNDLE_DIR = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(__dirname, '..', 'output', 'project', 'src', 'bundle');
if (!fs.existsSync(BUNDLE_DIR)) { console.error('❌ bundle 目录不存在:', BUNDLE_DIR); process.exit(1); }

// 第三方 chunk 原样保留
const SKIP_FILES = /vendor-|rolldown-runtime-/;

// ---- 可选映射表（位于 bundle 目录上层）----
const ROOT = path.resolve(BUNDLE_DIR, '..', '..');
const RESERVED = new Set([
  'true', 'false', 'null', 'undefined', 'this', 'var', 'let', 'const', 'function',
  'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break',
  'continue', 'new', 'class', 'extends', 'super', 'import', 'export', 'from', 'typeof',
  'instanceof', 'in', 'of', 'void', 'delete', 'throw', 'try', 'catch', 'finally', 'yield',
  'await', 'async', 'static', 'get', 'set',
]);
function sanitizeName(s) {
  let v = String(s).replace(/::/g, '_').replace(/[^A-Za-z0-9_$]/g, '');
  if (!v) return null;
  if (!/^[A-Za-z_$]/.test(v)) v = '_' + v;
  if (RESERVED.has(v)) return null;
  return v;
}
const BROAD_SKIP = /\(\?\)|\?\s|存疑|同名遮蔽|局部|cross-package|engine|非模块级|Shadow|⚠/;
const STRICT_SKIP = /\(\?\)|存疑|同名遮蔽|⚠/;
function parseFile(fp, skipRe) {
  if (!fs.existsSync(fp)) return {};
  const lines = fs.readFileSync(fp, 'utf8').split('\n');
  const atCount = {};
  for (const raw of lines) {
    if (!raw.includes('@')) continue;
    const m = raw.trim().match(/^([A-Za-z_$][\w$]*)\s*=/);
    if (m) atCount[m[1]] = (atCount[m[1]] || 0) + 1;
  }
  const rules = {};
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (raw.includes('@')) {
      const cm = line.match(/^([A-Za-z_$][\w$]*)\s*=/);
      const comp = cm ? cm[1] : null;
      if (comp && (atCount[comp] || 0) >= 2) continue;
    }
    const m = line.match(/^([A-Za-z_$][\w$]*)\s*=\s*(\S+)\s*#?(.*)$/);
    if (!m) continue;
    if (skipRe.test(m[3] || '')) continue;
    const target = sanitizeName(m[2]);
    if (!target || RESERVED.has(target) || rules[m[1]]) continue;
    rules[m[1]] = target;
  }
  return rules;
}
function getRules() {
  const merged = {};
  for (const [f, skipRe] of [
    ['vendor-mapping.txt', BROAD_SKIP],
    ['func-mapping.txt', STRICT_SKIP],
    ['var-mapping.txt', BROAD_SKIP],
  ]) {
    for (const [k, v] of Object.entries(parseFile(path.join(ROOT, f), skipRe))) {
      if (!merged[k]) merged[k] = v;
    }
  }
  const core = {
    X: 'JSX_RUNTIME', Y: 'REACT_HOOKS', Wn: 'LOCAL_ENGINE_PORT',
    lg: 'NODE_REGISTRY', Gn: 'sendToJianyingSingle', qn: 'sendToJianyingBatch',
    Jn: 'JianyingIcon', Yn: 'JianyingSendButton', Kn: 'getClipFileName',
  };
  for (const [k, v] of Object.entries(core)) if (!merged[k]) merged[k] = v;
  return merged;
}
const RULES = getRules();

// ---- 作用域安全重命名 ----
function collectBindings(scope, name, acc) {
  const b = scope.getBinding(name);
  if (b) acc.push(b);
  for (const c of scope.childScopes || []) collectBindings(c, name, acc);
}
function makeRenamePlugin(skipNames) {
  return {
    name: 'bundle-scope-rename',
    visitor: {
      Program: {
        exit(path) {
          const programScope = path.scope.getProgramParent();
          for (const orig of Object.keys(RULES)) {
            if (skipNames.has(orig) || skipNames.has(RULES[orig])) continue;
            const all = [];
            collectBindings(programScope, orig, all);
            if (all.length === 0) continue;
            for (const binding of all) {
              const isFuncDecl = binding.kind === 'function' ||
                (binding.path && binding.path.isFunctionDeclaration && binding.path.isFunctionDeclaration());
              if (!isFuncDecl && all.length !== 1) continue;
              const target = binding.scope.getBinding(RULES[orig]);
              if (target && target !== binding) continue;
              try { binding.scope.rename(orig, RULES[orig]); } catch (e) { /* ignore */ }
            }
          }
        },
      },
    },
  };
}
function collectExportedNames(code) {
  const exported = new Set();
  const ast = babel.parseSync(code, { parserOpts: { sourceType: 'module', plugins: ['jsx'] } });
  babel.traverse(ast, {
    ExportNamedDeclaration(p) {
      for (const spec of p.node.specifiers) if (spec.local) exported.add(spec.local.name);
      const d = p.node.declaration;
      if (d) {
        if (d.id) exported.add(d.id.name);
        else if (d.declarations) for (const decl of d.declarations) if (decl.id && decl.id.name) exported.add(decl.id.name);
      }
    },
    ExportDefaultDeclaration(p) {
      const d = p.node.declaration;
      if (d && d.type === 'Identifier') exported.add(d.name);
    },
  });
  return exported;
}

// 自动收所有 bundle js（排除第三方）
const targets = fs.readdirSync(BUNDLE_DIR)
  .filter((f) => f.endsWith('.js') && !SKIP_FILES.test(f) && !f.startsWith('_react_shim') && !f.startsWith('_jsx_runtime'));

let total = 0;
for (const f of targets) {
  const fp = path.join(BUNDLE_DIR, f);
  const code = fs.readFileSync(fp, 'utf8');
  const exported = collectExportedNames(code);
  const result = babel.transformSync(code, {
    parserOpts: { sourceType: 'module', plugins: ['jsx'] },
    generatorOpts: { retainLines: true, comments: true, compact: false, concise: false },
    plugins: [makeRenamePlugin(exported)],
    configFile: false, babelrc: false,
  });
  fs.writeFileSync(fp, result.code);
  console.log('  已点亮:', f, '| 受保护导出名:', exported.size ? [...exported].join(',') : '无');
  total++;
}
console.log(`\n✅ 语义化重命名完成（${total} 个文件），规则 ${Object.keys(RULES).length} 条（含内置保底 9 条）。`);
console.log('   若需要更多可读名，在 output/project/ 下放 vendor-mapping/func-mapping/var-mapping.txt 后重跑。');
