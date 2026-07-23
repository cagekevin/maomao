/* Scope-aware rename + section-comment insertion for AB04 node components.
 * Only AudioTranscribeNodeComp and CustomNodeComp are touched (AudioPlayerNodeComp done manually).
 */
const fs = require('fs');
const parser = require('@babel/parser');
let traverse;
try { traverse = require('@babel/traverse').default || require('@babel/traverse'); }
catch (e) { traverse = require('@babel/core').traverse; }

const FILE = '/Users/kevin/Documents/maomao/src/App.js';
const src = fs.readFileSync(FILE, 'utf8');

const ast = parser.parse(src, {
  sourceType: 'module',
  plugins: ['jsx', 'objectRestSpread', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator', 'asyncGenerators', 'dynamicImport']
});

// mapping[componentName] = [[oldName, newName], ...]
const mapping = {
  AudioTranscribeNodeComp: [
    ['i', 'updateNodeData'],
    ['a', 'getNodes'],
    ['o', 'getEdges'],
    ['s', 'nodeData'],
    ['c', 'fileInputRef'],
    ['l', 'uploadedFile'],
    ['u', 'setUploadedFile'],
    ['d', 'isConfigOpen'],
    ['f', 'setConfigOpen'],
    ['p', 'prompt'],
    ['m', 'setPrompt'],
    ['h', 'maxDuration'],
    ['g', 'setMaxDuration'],
    ['_', 'pauseGap'],
    ['v', 'setPauseGap'],
    ['y', 'connectedSources'],
    ['b', 'lastAudioUrlRef'],
    ['x', 'handleFileSelect'],
    ['C', 'handleTranscribe']
  ],
  CustomNodeComp: [
    ['r', 'updateNodeData'],
    ['i', 'nodeData'],
    ['a', 'isConfigMode'],
    ['o', 'setConfigMode'],
    ['s', 'variables'],
    ['c', 'setVariables'],
    ['l', 'detectedVars'],
    ['u', 'setDetectedVars'],
    ['d', 'config'],
    ['f', 'setConfig'],
    ['p', 'aiPrompt'],
    ['m', 'setAiPrompt'],
    ['h', 'isAiLoading'],
    ['g', 'setAiLoading'],
    ['_', 'handleAiAssist'],
    ['v', 'handleApplyConfig'],
    ['y', 'handleSaveTemplate'],
    ['b', 'handleRun'],
    ['x', 'handleUrlifyAsset']
  ]
};

const replacements = []; // {start,end,name}

traverse(ast, {
  VariableDeclarator(path) {
    const name = path.node.id && path.node.id.name;
    if (!name || !mapping[name]) return;
    const init = path.node.init;
    if (!init || init.type !== 'CallExpression' || !init.arguments || !init.arguments.length) return;
    const arrowPath = path.get('init').get('arguments')[0];
    if (!arrowPath || !arrowPath.scope) return;
    const map = mapping[name];
    for (const [oldName, newName] of map) {
      const binding = arrowPath.scope.getBinding(oldName);
      if (!binding) { console.error(`WARN: ${name}: binding ${oldName} not found`); continue; }
      const decl = binding.identifier;
      if (typeof decl.start === 'number') replacements.push({ start: decl.start, end: decl.end, name: newName });
      for (const ref of binding.referencePaths) {
        const id = ref.node;
        if (typeof id.start === 'number') replacements.push({ start: id.start, end: id.end, name: newName });
      }
    }
  }
});

// sort descending so earlier slices don't shift later offsets
replacements.sort((a, b) => b.start - a.start);
let result = src;
for (const r of replacements) {
  result = result.slice(0, r.start) + r.name + result.slice(r.end);
}

// ---- section comment insertion (unique anchors in renamed code) ----
function insertOnce(text, anchor, comment) {
  const idx = text.indexOf(anchor);
  if (idx === -1) { console.error(`ANCHOR NOT FOUND: ${anchor.slice(0, 60)}`); return text; }
  if (text.indexOf(anchor, idx + 1) !== -1) { console.error(`ANCHOR NOT UNIQUE: ${anchor.slice(0, 60)}`); }
  return text.slice(0, idx) + comment + '\n' + text.slice(idx);
}

// AudioTranscribeNodeComp
result = insertOnce(result,
  '}) => {\n    let {\n        updateNodeData,\n        getNodes,\n        getEdges\n      } = Gt(),',
  '    // ── 状态 ──');
result = insertOnce(result,
  "    Y.useEffect(() => {\n      updateNodeData(e, {",
  '    // ── 副作用 ──');
result = insertOnce(result,
  '    let handleFileSelect = t => {',
  '    // ── 回调 ──');
result = insertOnce(result,
  "    return X.jsxs(`div`, {\n      className: `relative flex flex-col group/node transition-all w-[360px] ${r ? `z-50` : `z-10`}`,",
  '    // ── 渲染 ──');

// CustomNodeComp
result = insertOnce(result,
  '}) => {\n    let {\n        updateNodeData\n      } = Gt(),',
  '    // ── 状态 ──');
result = insertOnce(result,
  "    Y.useEffect(() => {\n      let e = (config.body ||",
  '    // ── 副作用 ──');
result = insertOnce(result,
  '    let handleAiAssist = async () => {',
  '    // ── 回调 ──');
result = insertOnce(result,
  "    return X.jsxs(`div`, {\n      className: `flex flex-col items-center group/node transition-all ${n ? `z-50` : `z-10`}`,",
  '    // ── 渲染 ──');

fs.writeFileSync(FILE, result, 'utf8');
console.log('Done. replacements:', replacements.length);
