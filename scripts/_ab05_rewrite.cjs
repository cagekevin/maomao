/* AB05 — 节点函数体重写 (rhWebappNode / videoExtractNode / videoToGifNode)
 * 在 App.js 内对 3 个组件做：局部变量语义化 + 段落注释。
 * 策略：在每个组件的 [start,end] 行范围内做“整词替换”，并插入段落注释。
 * 整词替换在 scope 内语义保持完全一致（含变量遮蔽），且脚本会做碰撞检测保证无标识符冲突。
 */
const fs = require('fs');
const path = require('path');

const APP = path.resolve(__dirname, '../src/App.js');
const AB05 = path.resolve(__dirname, '../docs/annotate-body-tasks/AB05.md');

const raw = fs.readFileSync(APP, 'utf8');
const lines = raw.split('\n');

// 每个组件：行范围(1-indexed, 闭区间) + 重命名映射 + 注释插入点(基于原始文本的子串匹配)
const components = [
  {
    name: 'RhWebappNodeComp',
    start: 12772,
    end: 14165,
    map: {
      a: 'updateNodeData', o: 'setNodes', s: 'setEdges', c: 'getNode',
      l: 'storeAction', d: 'nodeData', f: 'webappId', p: 'aiAppApiUrl', m: 'aiAppApiKey',
      h: 'openField', g: 'setOpenField', _: 'connections', v: 'valuesMemo',
      y: 'uploadStatusMemo', b: 'uploadErrorMemo', x: 'connectedEdges', S: 'sourceIds',
      C: 'imageFields', w: 'textFields', T: 'pollTimer', E: 'isPolling',
      D: 'currentTaskId', O: 'uploadSigCache', k: 'disconnectCache', j: 'apiKeyRef',
      A: 'onLoadSchema', M: 'onUploadFile', N: 'onDisconnectVar', P: 'onValueChange',
      F: 'allUploadsDone', I: 'onStop', ee: 'spawnResultNodes', R: 'pollTask',
      z: 'onRun', B: 'autoPollRef', te: 'getStepSize', ne: 'renderField', re: 'coverUrl',
      ie: 'marketOpen', ae: 'setMarketOpen', se: 'appList', ce: 'setAppList',
      le: 'appListLoading', ue: 'setAppListLoading', V: 'appListError', H: 'setAppListError',
      U: 'appSearch', de: 'setAppSearch', W: 'appPage', fe: 'setAppPage',
      me: 'filteredApps', G: 'pagedApps', he: 'hasMoreApps', ge: 'onSelectApp',
      _e: 'getAppTags', K: 'marketPortal'
    },
    comments: [
      { marker: '        updateNodeData: a,', text: '      // ── 状态 ──' },
      { marker: 'A = Y.useCallback(async (t, n) => {', text: '    // ── Schema 加载 ──' },
      { marker: 'M = Y.useCallback(async (t, n, r) => {', text: '    // ── 文件上传 ──' },
      { marker: 'z = Y.useCallback(async () => {', text: '    // ── 运行 / 轮询 ──' },
      { marker: '[ie, ae] = Y.useState(false),', text: '    // ── 应用市场 ──' },
      { marker: 'return X.jsxs(`div`, {', text: '    // ── 渲染 ──' }
    ]
  },
  {
    name: 'VideoExtractNodeComp',
    start: 14166,
    end: 14738,
    map: {
      i: 'updateNodeData', a: 'getNodes', o: 'getEdges', s: 'nodeData', c: 'fileInputRef',
      l: 'videoFile', u: 'setVideoFile', d: 'showConfig', f: 'setShowConfig',
      p: 'extractMode', m: 'setExtractMode', h: 'intervalSec', g: 'setIntervalSec',
      _: 'frameCount', v: 'setFrameCount', y: 'sensitivity', b: 'setSensitivity',
      x: 'hiddenIndices', S: 'videoRef', C: 'duration', w: 'setDuration',
      T: 'currentTime', E: 'setCurrentTime', O: 'connections', k: 'sourceIds',
      A: 'videoUrlRef', j: 'onFileUpload', M: 'onManualCapture', N: 'onExtractFrames', P: 'onCopy'
    },
    comments: [
      { marker: '        updateNodeData: i,', text: '      // ── 状态 ──' },
      { marker: 'j = t => {', text: '    // ── 回调 ──' },
      { marker: 'return X.jsxs(`div`, {', text: '    // ── 渲染 ──' }
    ]
  },
  {
    name: 'VideoToGifNodeComp',
    start: 14884,
    end: 15160,
    map: {
      i: 'updateNodeData', a: 'nodeData', o: 'fileInputRef', s: 'fps', c: 'setFps',
      l: 'maxSize', u: 'setMaxSize', d: 'colors', f: 'setColors', p: 'speed', m: 'setSpeed',
      h: 'videoDuration', g: 'setVideoDuration', _: 'cropStart', v: 'setCropStart',
      y: 'cropEnd', b: 'setCropEnd', x: 'connections', S: 'sourceIds', C: 'videoUrlRef',
      w: 'onFileUpload', T: 'onGenerate', E: 'isLoading', D: 'hasResult', O: 'hasVideoUrl'
    },
    comments: [
      { marker: '      updateNodeData: i', text: '      // ── 状态 ──' },
      { marker: 'w = t => {', text: '    // ── 回调 ──' },
      { marker: 'return X.jsxs(`div`, {', text: '    // ── 渲染 ──' }
    ]
  }
];

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

let collisions = [];
let applied = [];

for (const comp of components) {
  const slice0 = lines.slice(comp.start - 1, comp.end); // 0-indexed within file
  // 碰撞检测：新名若作为“真实独立标识符”出现才视为冲突。
  // 忽略：属性访问(obj.webappId)、对象键(webappId:)、字符串内('webappId')。
  for (const [oldN, newN] of Object.entries(comp.map)) {
    const re = new RegExp('\\b' + escapeRegex(newN) + '\\b', 'g');
    for (const line of slice0) {
      let m;
      while ((m = re.exec(line)) !== null) {
        const before = line[m.index - 1];
        const after = line[m.index + newN.length];
        if (before === '.' || after === ':' ||
            before === '"' || before === "'" || before === '`' ||
            after === '"' || after === "'" || after === '`' ||
            before === '-' || after === '-') continue;
        collisions.push(`${comp.name}: 新名「${newN}」已在原代码中作为标识符出现 -> 冲突`);
        break;
      }
    }
  }
}

if (collisions.length) {
  console.error('✗ 碰撞检测未通过，已中止（不写文件）：');
  for (const c of collisions) console.error('  - ' + c);
  process.exit(1);
}

// 开始改写：先插入注释（基于原始文本标记），再做整词替换
for (const comp of components) {
  // 1) 注释插入：在 slice 内按 marker 找到行，从大到小索引插入，避免位移影响
  const slice = lines.slice(comp.start - 1, comp.end);
  const inserts = [];
  for (const cm of comp.comments) {
    let idx = -1;
    for (let i = 0; i < slice.length; i++) {
      if (slice[i].includes(cm.marker)) { idx = i; break; }
    }
    if (idx === -1) {
      console.warn(`! ${comp.name}: 未找到注释锚点「${cm.marker}」，跳过该注释`);
      continue;
    }
    inserts.push({ idx, text: cm.text });
  }
  inserts.sort((a, b) => b.idx - a.idx);
  for (const ins of inserts) slice.splice(ins.idx, 0, ins.text);

  // 2) 整词替换
  const renameCount = {};
  for (let i = 0; i < slice.length; i++) {
    let line = slice[i];
    for (const [oldN, newN] of Object.entries(comp.map)) {
      const re = new RegExp('\\b' + escapeRegex(oldN) + '\\b', 'g');
      const hits = (line.match(re) || []).length;
      if (hits) {
        line = line.replace(re, newN);
        renameCount[oldN] = (renameCount[oldN] || 0) + hits;
      }
    }
    slice[i] = line;
  }
  applied.push({ name: comp.name, count: Object.keys(renameCount).length, detail: renameCount });

  // 写回 lines
  for (let i = 0; i < slice.length; i++) lines[comp.start - 1 + i] = slice[i];
}

fs.writeFileSync(APP, lines.join('\n'), 'utf8');

console.log('✓ App.js 已重写。各组件重命名变量数：');
for (const a of applied) console.log(`  - ${a.name}: ${a.count} 个变量`);

// 生成 AB05.md 的「重写后代码」表格（含注释 + 重命名后的完整代码）
const outSlices = components.map(comp => {
  const slice = lines.slice(comp.start - 1, comp.end);
  return { name: comp.name, text: slice.join('\n') };
});

let ab = fs.readFileSync(AB05, 'utf8');
// 幂等：移除已有的「## 重写后代码」段落
const cut = ab.indexOf('## 重写后代码');
if (cut !== -1) ab = ab.slice(0, cut).replace(/\s+$/, '') + '\n';

const labelMap = {
  RhWebappNodeComp: 'rhWebappNode',
  VideoExtractNodeComp: 'videoExtractNode',
  VideoToGifNodeComp: 'videoToGifNode'
};

let table = '\n## 重写后代码\n\n';
outSlices.forEach((o, i) => {
  table += `### ${i + 1}. ${labelMap[o.name]} (\`${o.name}\`)\n\n`;
  table += `| ${labelMap[o.name]} | ${o.name} |\n`;
  table += '```js\n' + o.text + '\n```\n|\n\n';
});

fs.writeFileSync(AB05, ab + table, 'utf8');
console.log('✓ AB05.md 已写入「重写后代码」表格。');
