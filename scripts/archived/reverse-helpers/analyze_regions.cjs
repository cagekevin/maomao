// 逆向辅助：把 1.4.0 主程序 chunk（App-D5SRQxl_.js）的顶层符号分区域
// （节点画布 / 资源库 / 多账号 / 提示词库 / 本地引擎 / 剪映 / 分享页 等），
// 输出 regions.json + panels.json，供 MODULE_MAP.md 依据。不修改源码。

const fs = require('fs');
const path = require('path');

const BUNDLE = path.join(__dirname, '..', '..', '..', 'src', 'bundle', 'App-D5SRQxl_.js');
const OUT_REGIONS = path.join(__dirname, 'regions.json');
const OUT_PANELS = path.join(__dirname, 'panels.json');

if (!fs.existsSync(BUNDLE)) {
  console.error('未找到主程序 chunk：', BUNDLE, '请先运行 scripts/beautify.cjs');
  process.exit(1);
}

const lines = fs.readFileSync(BUNDLE, 'utf8').split('\n');
const declRe = /^(?:async\s+function|function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/;

const RULES = [
  { region: 'jianying', re: /jianying|剪映/ },
  { region: 'localEngine', re: /127\.0\.0\.1|localTool|\/api\/status|\/api\/kv|\/api\/files|\/api\/proxy/ },
  { region: 'nodes', re: /nodeTypes|groupNode|textNode|promptNode|imageBoxNode|imageNode|cropNode|videoNode|audioNode|customNode|ghostTarget|stickyNoteNode|compareNode|gridSplit|gridMerge|textConcat|panoramaNode|director3dNode|rhWebappNode|videoExtractNode|videoToGifNode|imageCompressNode|faceMosaicNode|audioPlayerNode|discountVideoNode|sd2VideoNode|urlToImageNode|fileToUrlNode/ },
  { region: 'canvas', re: /ReactFlow|useNodes|useEdges|onConnect|addEdge|MiniMap|Background|Controls|xyflow|reactflow/ },
  { region: 'storage', re: /localforage|chrome\.storage|canvas-state-v1|app_settings|setItem|getItem/ },
  { region: 'account', re: /cookie|users|auth|token|login/ },
  { region: 'prompts', re: /promptLibrary|在线提示词库|PromptLibrary/ },
  { region: 'resources', re: /transitResources|素材|资源库/ },
  { region: 'capture', re: /captureVideoFrame/ },
  { region: 'settings', re: /设置|settings|appSettings/ },
  { region: 'share', re: /share|分享|ShareAppPage/ },
];

const syms = [];
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(declRe);
  if (m) syms.push({ name: m[1], line: i + 1, kind: /^(?:async\s+function|function|class)\b/.test(lines[i]) ? 'func' : 'binding' });
}
const nameSet = new Set(syms.map((s) => s.name));
const nameRe = new RegExp('\\b(' + [...nameSet].join('|') + ')\\b', 'g');

function bodyOf(idx) {
  const start = syms[idx].line - 1;
  const end = idx + 1 < syms.length ? syms[idx + 1].line - 1 : lines.length;
  return lines.slice(start, end).join('\n');
}

const bodies = syms.map((_, i) => (syms[i].kind === 'func' ? bodyOf(i) : lines[syms[i].line - 1]));

const compRefs = syms.map(() => new Set());
const callRefs = syms.map(() => new Set());
const jsxPattern = /\.jsx[s]?\)\(\s*([A-Za-z_$][\w$]*)/g;

for (let i = 0; i < syms.length; i++) {
  const body = bodies[i];
  let m;
  jsxPattern.lastIndex = 0;
  while ((m = jsxPattern.exec(body))) {
    if (nameSet.has(m[1])) compRefs[i].add(m[1]);
  }
  nameRe.lastIndex = 0;
  while ((m = nameRe.exec(body))) {
    if (m[1] !== syms[i].name) callRefs[i].add(m[1]);
  }
}

const invComp = syms.map(() => new Set());
for (let i = 0; i < syms.length; i++) {
  for (const c of compRefs[i]) {
    const ci = syms.findIndex((s) => s.name === c);
    if (ci >= 0) invComp[ci].add(syms[i].name);
  }
}

const rootPanels = [];
for (let i = 0; i < syms.length; i++) {
  if (syms[i].kind !== 'func') continue;
  if (compRefs[i].size >= 2) rootPanels.push(syms[i].name);
}

const panelOf = {};
const panelSize = {};
for (const root of rootPanels) {
  const visited = new Set([root]);
  const queue = [root];
  while (queue.length) {
    const cur = queue.shift();
    const ci = syms.findIndex((s) => s.name === cur);
    for (const child of compRefs[ci]) {
      if (visited.has(child)) continue;
      if (rootPanels.includes(child) && child !== root) continue;
      visited.add(child);
      queue.push(child);
    }
  }
  visited.delete(root);
  for (const v of visited) panelOf[v] = root;
  panelOf[root] = root;
  panelSize[root] = visited.size + 1;
}
const covered = new Set(Object.keys(panelOf));

const result = [];
const regionCount = {};
for (let i = 0; i < syms.length; i++) {
  const s = syms[i];
  let region;
  if (s.kind === 'binding') region = 'shared';
  else if (panelOf[s.name]) region = 'panel:' + panelOf[s.name];
  else {
    region = 'ui-misc';
    for (const r of RULES) {
      if (r.re.test(bodies[i])) { region = 'core:' + r.region; break; }
    }
  }
  if (region.startsWith('panel:') && !RULES.every((r) => !r.re.test(bodies[i]))) {
    for (const r of RULES) {
      if (r.re.test(bodies[i])) { region = 'core:' + r.region; break; }
    }
  }
  regionCount[region] = (regionCount[region] || 0) + 1;
  result.push({ name: s.name, line: s.line, kind: s.kind, region, compRefs: [...compRefs[i]], signals: pickSignals(bodies[i]) });
}

function pickSignals(body) {
  const keys = ['jianying/send', '127.0.0.1', 'localTool', 'nodeTypes', 'ReactFlow',
    'localforage', 'chrome.storage', 'canvas-state-v1', 'captureVideoFrame', 'cookie',
    'promptLibrary', 'transitResources', '/api/status', '/api/kv', '/api/files', '/api/proxy', 'share', '分享'];
  return keys.filter((k) => body.includes(k));
}

fs.writeFileSync(OUT_REGIONS, JSON.stringify(result, null, 2));
fs.writeFileSync(OUT_PANELS, JSON.stringify({ rootPanels, panelSize }, null, 2));

console.log('总顶层符号:', result.length);
console.log('根面板数:', rootPanels.length);
console.log('被面板覆盖:', covered.size);
console.log('\n区域分布(按数量):');
Object.entries(regionCount).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
