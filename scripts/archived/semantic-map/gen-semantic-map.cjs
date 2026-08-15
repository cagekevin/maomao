#!/usr/bin/env node
/**
 * gen-semantic-map.cjs — 从 T02B/T06B/T08B/T12B 自动生成 semantic-map.json
 *
 * 用法: node scripts/gen-semantic-map.cjs
 * 产出: docs/semantic-map/semantic-map.json (190 条，7 必填字段)
 *       人工审核后重跑覆盖。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LEGACY = path.join(ROOT, 'src', 'legacy');
const T02B = path.join(ROOT, 'docs', 'agent 批量任务', 'out', 'T02B-inv-scatter.md');
const T06B = path.join(ROOT, 'docs', 'agent 批量任务', 'out', 'T06B-inv-structure.md');
const T08B = path.join(ROOT, 'docs', 'agent 批量任务', 'out', 'T08B-export-map.md');
const OUT = path.join(ROOT, 'docs', 'semantic-map', 'semantic-map.json');

// ── 1. 扫描所有 legacy 文件 ──
function scanLegacy(dir = LEGACY, prefix = '') {
  const result = {};
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    // 获取相对路径作为 chunk 推断
    const rel = path.relative(LEGACY, full).replace(/\\/g, '/');
    if (e.isDirectory()) {
      Object.assign(result, scanLegacy(full, prefix + e.name + '/'));
    } else if (e.name.endsWith('.jsx') || e.name.endsWith('.js')) {
      const key = prefix + e.name;
      const chunkDir = rel.split('/')[0];
      let chunk;
      if (chunkDir.includes('App-D5SRQxl')) chunk = 'App-D5SRQxl__components';
      else if (chunkDir.includes('httpClient-Bqba_SHR')) chunk = 'httpClient-Bqba_SHR_components';
      else if (chunkDir.includes('src--1UFFpRm')) chunk = 'src--1UFFpRm_components';
      else if (e.name.endsWith('.js')) chunk = 'root-entry';
      else chunk = 'unknown';
      result[key] = {
        chunk,
        role: '',
        domain: 'infrastructure',
        risk: 'low',
        exportType: e.name.endsWith('.jsx') ? 'component' : 'module',
        hooks: '',
        storage: [],
        events: [],
        api: [],
        deps: [],
        consumedBy: [],
      };
    }
  }
  // 加入 JSON 文件
  for (const e of entries) {
    if (e.name.endsWith('.json')) {
      const key = prefix + e.name;
      result[key] = {
        chunk: e.name.includes('App') ? 'App-D5SRQxl__components' :
               e.name.includes('httpClient') ? 'httpClient-Bqba_SHR_components' :
               e.name.includes('src') ? 'src--1UFFpRm_components' : 'root-entry',
        role: '混淆名→原名映射表',
        domain: 'infrastructure',
        risk: 'low',
        exportType: 'json',
        hooks: '',
        storage: [],
        events: [],
        api: [],
        deps: [],
        consumedBy: [],
      };
    }
  }
  return result;
}

// ── 2. T06B——提取文件行数和角色描述 ──
function parseT06B() {
  const md = fs.readFileSync(T06B, 'utf-8');
  const map = {};
  // 行数数据
  for (const [, file, lines] of md.matchAll(/\| `([^`]+)` \| (\d[\d,]*) \|/g)) {
    const name = file.split('/').pop();
    if (!map[name]) map[name] = {};
    map[name].lines = parseInt(lines.replace(/,/g, ''));
  }
  return map;
}

// ── 3. T02B——提取每文件的 storage/events/api ──
function parseT02B() {
  const md = fs.readFileSync(T02B, 'utf-8');
  const map = {}; // filename → {storage:[], events:[], api:[]}

  // Per-file 明细（§1.2/§2.2/§3.2）
  const sections = md.split(/\n## \d+\.\d+ per-file/);
  for (const sec of sections) {
    for (const [, file, keys] of sec.matchAll(/\*\*([^*]+?)\*\*.*?([^•]+)/g)) {
      const name = file.split('/').pop().replace('.jsx', '').replace('.js', '');
      // 提取存储键
      const storageKeys = [...keys.matchAll(/`([^`]+)`/g)].map(m => m[1]).filter(k => !k.startsWith('http'));
      if (!map[name]) map[name] = { storage: [], events: [], api: [] };
      map[name].storage.push(...storageKeys);
    }
  }

  // 汇总表（§1.1）
  for (const [, key, fileExpr] of md.matchAll(/\| `([^`]+)` \| \w+ \| \d+ \| (.+?) \|/g)) {
    const files = [...fileExpr.matchAll(/(\w+\.jsx?):/g)].map(m => m[1]);
    for (const f of files) {
      const name = f.replace('.jsx', '').replace('.js', '');
      if (!map[name]) map[name] = { storage: [], events: [], api: [] };
      if (!map[name].storage.includes(key)) map[name].storage.push(key);
    }
  }

  // 事件（§2.1）
  const evtTable = md.match(/### 2\.1 汇总表[\s\S]*?### 2\.2/);
  if (evtTable) {
    for (const [, evt, , , fileExpr] of evtTable[0].matchAll(/\| `([^`]+)` \| (\d+) \| (\S+) \| (.+?) \|/g)) {
      if (['change', 'input', 'resize'].includes(evt)) continue;
      const files = [...fileExpr.matchAll(/(\w+\.jsx?|\w+\/shared\.js):/g)].map(m => m[1]);
      for (const f of files) {
        const name = f.replace('.jsx', '').replace('.js', '').split('/').pop();
        if (!map[name]) map[name] = { storage: [], events: [], api: [] };
        if (!map[name].events.includes(evt)) map[name].events.push(evt);
      }
    }
  }

  // 变量事件（§2.3）
  const varEvt = md.match(/### 2\.3[\s\S]*?(?=### 3\.|## 3\.)/);
  if (varEvt) {
    for (const [, , val] of varEvt[0].matchAll(/\| `([^`]+)` \| `([^`]+)` \|/g)) {
      // 回查 §2.2 的 per-file 找关联文件
      const p2 = md.match(/### 2\.2 per-file 明细[\s\S]*?(?=### 3\.|## 3\.)/);
      if (p2) {
        for (const [, file] of p2[0].matchAll(new RegExp(`\`${val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\``, 'g'))) {
          // 找所在行
          const ctx = p2[0].split('\n').find(l => l.includes(val));
          if (ctx) {
            const files = [...ctx.matchAll(/(\w+\.jsx?):/g)].map(m => m[1]);
            for (const f of files) {
              const name = f.replace('.jsx', '').replace('.js', '');
              if (!map[name]) map[name] = { storage: [], events: [], api: [] };
              if (!map[name].events.includes(val)) map[name].events.push(val);
            }
          }
        }
      }
    }
  }

  return map;
}

// ── 4. T08B——提取每文件的 exportType ──
function parseT08B() {
  const md = fs.readFileSync(T08B, 'utf-8');
  const map = {};
  for (const [, file, , type] of md.matchAll(/\| [A-Z]\d+ \| [^(]+\(([^)]+)\)\/([^.]+\.jsx) \| `[^`]+` \| (\S+)/g)) {
    const name = file;
    const isAsync = type.includes('async');
    const isClass = type.includes('类');
    const isComponent = type.includes('组件');
    if (isClass) map[name] = 'class';
    else if (isAsync && isComponent) map[name] = 'component-async';
    else if (isAsync) map[name] = 'function-async';
    else if (isComponent) map[name] = 'component';
    else map[name] = 'function';
  }
  return map;
}

// ── 5. T12B——hooks 顺序（从 hooks-contract.md） ──
const HOOKS_CONTRACT = path.join(ROOT, 'scripts', 'hooks-contract.md');
function parseHooks() {
  const map = {};
  if (!fs.existsSync(HOOKS_CONTRACT)) return map;
  const md = fs.readFileSync(HOOKS_CONTRACT, 'utf-8');
  const sections = md.split('\n### ');
  for (const sec of sections) {
    const m = sec.match(/^(\S+\.jsx)/);
    if (!m) continue;
    const name = m[1];
    const hooksLine = sec.match(/hooks 顺序[：:]\s*(.+)/);
    const asyncLine = sec.match(/async 时序[：:]\s*(.+)/);
    if (hooksLine) map[name] = hooksLine[1].trim();
    else if (asyncLine) map[name] = `async: ${asyncLine[1].trim()}`;
  }
  return map;
}

// ── 6. 已知语义映射（从 T06B 角色 + T02B 触碰反推） ──
const KNOWN_ROLES = {
  // App 组件
  'mr.jsx': { role: '核心任务列表/调度主面板（4050行上帝组件）', domain: 'task-scheduler', risk: 'high' },
  'kn.jsx': { role: '任务元信息更新面板', domain: 'task-scheduler', risk: 'medium' },
  'Fn.jsx': { role: '任务列表/筛选视图', domain: 'task-scheduler', risk: 'medium' },
  'Qt.jsx': { role: '节点画布子面板', domain: 'canvas-editor', risk: 'medium' },
  'Sn.jsx': { role: '节点画布子面板', domain: 'canvas-editor', risk: 'medium' },
  'Zn.jsx': { role: '节点画布子面板', domain: 'canvas-editor', risk: 'low' },
  'Xt.jsx': { role: '扩展更新路径管理', domain: 'endpoint-share', risk: 'low' },
  'Qn.jsx': { role: '端点配置 UI 展示', domain: 'endpoint-share', risk: 'low' },
  // httpClient 组件
  'bo.jsx': { role: '多窗口文本模型选择面板（memoized）', domain: 'model-config', risk: 'low' },
  '_o.jsx': { role: '提示词模型/质量/尺寸配置面板（hub）', domain: 'prompt-management', risk: 'low' },
  'Es.jsx': { role: '特惠视频全量配置面板', domain: 'video-config', risk: 'low' },
  'Zo.jsx': { role: 'SD2 视频模型配置面板', domain: 'video-config', risk: 'low' },
  'Jo.jsx': { role: '视频宽高比配置面板', domain: 'video-config', risk: 'low' },
  'Ps.jsx': { role: '多窗口文本模型子配置', domain: 'model-config', risk: 'low' },
  'i_.jsx': { role: '脚本盒/镜头连接面板', domain: 'canvas-editor', risk: 'medium' },
  'R_.jsx': { role: '画布/编辑器/快捷键/脚本盒（11797行）', domain: 'canvas-editor', risk: 'high' },
  'Un.jsx': { role: '文件操作面板（open/dir）', domain: 'media-processing', risk: 'medium' },
  'Xs.jsx': { role: '剪贴板管理', domain: 'ui-subcomponents', risk: 'low' },
  '_Component109.jsx': { role: 'AI导演模型选择面板', domain: 'model-config', risk: 'low' },
  'Vc.jsx': { role: '编辑器子面板', domain: 'canvas-editor', risk: 'medium' },
  'Ys.jsx': { role: '编辑器/图层/设置面板', domain: 'canvas-editor', risk: 'medium' },
  'Bo_1.jsx': { role: '编排器面板', domain: 'canvas-editor', risk: 'medium' },
  'Po.jsx': { role: '编辑器工具面板', domain: 'canvas-editor', risk: 'medium' },
  'Pg.jsx': { role: '编辑器工具面板（hub）', domain: 'canvas-editor', risk: 'medium' },
  'Ko.jsx': { role: '编辑器工具面板（hub）', domain: 'canvas-editor', risk: 'medium' },
  // 工具函数
  'Df.jsx': { role: 'JSX/DOM 结构工具函数', domain: 'utility-functions', risk: 'low' },
  'Ol.jsx': { role: 'JSX/DOM 结构工具函数', domain: 'utility-functions', risk: 'low' },
  'mg.jsx': { role: 'JSX/DOM 结构工具函数', domain: 'utility-functions', risk: 'low' },
  'sl.jsx': { role: 'JSX/DOM 结构工具函数', domain: 'utility-functions', risk: 'low' },
  'L_.jsx': { role: 'JSX/DOM 结构工具函数（门面导出）', domain: 'utility-functions', risk: 'low' },
  't_.jsx': { role: 'JSX/DOM 结构工具函数', domain: 'utility-functions', risk: 'low' },
  'Tl.jsx': { role: 'JSX/DOM 结构工具函数', domain: 'utility-functions', risk: 'low' },
  'uc.jsx': { role: 'JSX/DOM 结构工具函数', domain: 'utility-functions', risk: 'low' },
  'Qs.jsx': { role: 'JSX/DOM 结构工具函数', domain: 'utility-functions', risk: 'low' },
  // async 函数族
  'ec.jsx': { role: 'async 媒体/HTTP 响应处理', domain: 'media-processing', risk: 'low' },
  'pl.jsx': { role: 'async 媒体响应处理', domain: 'media-processing', risk: 'low' },
  'Kc.jsx(H)': { role: 'async 媒体处理', domain: 'media-processing', risk: 'low' },
  'sh.jsx': { role: 'async 媒体响应处理', domain: 'media-processing', risk: 'low' },
  'xo.jsx': { role: 'async 媒体处理（被 So 调用）', domain: 'media-processing', risk: 'low' },
  'Er.jsx': { role: 'async 缩放处理', domain: 'media-processing', risk: 'low' },
  'No.jsx': { role: 'async 响应处理', domain: 'media-processing', risk: 'low' },
  'Ro.jsx': { role: 'async 响应处理', domain: 'media-processing', risk: 'low' },
  'Lo.jsx': { role: 'async 响应处理', domain: 'media-processing', risk: 'low' },
  'Tr.jsx': { role: 'async 后端处理（被 Component101-104 链调用）', domain: 'media-processing', risk: 'low' },
  'Al.jsx': { role: 'async 响应处理', domain: 'media-processing', risk: 'low' },
};

// ── 7. 合成 ──
const files = scanLegacy();
const t06b = parseT06B();
const t02b = parseT02B();
const t08b = parseT08B();
const hooks = parseHooks();

for (const [name, entry] of Object.entries(files)) {
  // T06B 行数→risk 提升
  const t06 = t06b[name];
  if (t06 && t06.lines > 1000) entry.risk = entry.risk === 'low' ? 'medium' : entry.risk;
  if (t06 && t06.lines > 5000) entry.risk = 'high';

  // T02B storage/events
  const base = name.replace('.jsx', '').replace('.js', '');
  if (t02b[base]) {
    entry.storage = t02b[base].storage || [];
    entry.events = t02b[base].events || [];
  }

  // T08B exportType
  if (t08b[name]) entry.exportType = t08b[name];

  // Hooks
  if (hooks[name]) entry.hooks = hooks[name];

  // 已知语义（用 basename 匹配）
  const basename = name.split('/').pop();
  if (KNOWN_ROLES[basename]) {
    entry.role = KNOWN_ROLES[basename].role;
    entry.domain = KNOWN_ROLES[basename].domain;
    if (KNOWN_ROLES[basename].risk) entry.risk = KNOWN_ROLES[basename].risk;
  }

  // _Component* 系列 → ui-subcomponents
  if (!entry.role && basename.startsWith('_Component')) {
    entry.domain = 'ui-subcomponents';
    entry.role = '自动命名子组件';
  }

  // shared.js 桶文件
  if (basename === 'shared.js') {
    entry.role = 'chunk 入口桶文件（集中导出全部公共符号）';
    if (name.includes('httpClient')) entry.role += ' — 含存储适配器 Kr/事件总线/认证';
    if (name.includes('App-D5SRQxl')) entry.role += ' — 含 Toast 单例 K/React 绑定 V/kt/G';
    entry.domain = 'infrastructure';
    entry.risk = 'high';
  }

  // 入口文件
  if (basename === 'main-1TOrc0Z5.js') { entry.role = 'side_panel 引导入口（接入点解析+RootErrorBoundary+bootstrap）'; entry.domain = 'infrastructure'; entry.risk = 'high'; }
  if (basename === 'share-CymbjOw4.js') { entry.role = '分享页引导入口'; entry.domain = 'infrastructure'; entry.risk = 'high'; }
  if (basename === 'App-D5SRQxl_.js') { entry.role = 'App chunk 入口（动态 import 子组件）'; entry.domain = 'infrastructure'; }
  if (basename === 'ShareAppPage-BVCmVrHF.js') { entry.role = '分享页独立入口'; entry.domain = 'endpoint-share'; }
  if (basename === 'httpClient-Bqba_SHR.js') { entry.role = 'httpClient facade 门面（67 双重命名导出）'; entry.domain = 'infrastructure'; }
  if (basename === 'endpointConfig-Bt85xi8d.js') { entry.role = '端点配置（18080/active_api_endpoint）'; entry.domain = 'endpoint-share'; entry.risk = 'high'; }
  if (basename === 'src--1UFFpRm.js') { entry.role = '共享逻辑兜底 chunk'; entry.domain = 'infrastructure'; }
  if (basename === 'src-CzHn9cDd.js') { entry.role = '引导依赖占位'; entry.domain = 'infrastructure'; }
  // 黑盒
  if (basename.includes('vendor-Z')) { entry.role = 'React+第三方运行时库（黑盒）'; entry.domain = 'infrastructure'; entry.risk = 'black-box'; }
  if (basename.includes('rolldown-runtime')) { entry.role = 'rolldown 运行时垫片（黑盒）'; entry.domain = 'infrastructure'; entry.risk = 'black-box'; }
  if (basename === '_react_shim.js') { entry.role = 'React 单例门面（黑盒）'; entry.domain = 'infrastructure'; entry.risk = 'black-box'; }
  if (basename === '_jsx_runtime.js') { entry.role = 'JSX 运行时（黑盒）'; entry.domain = 'infrastructure'; entry.risk = 'black-box'; }
  if (basename.includes('__vite-browser-external')) { entry.role = 'vite 浏览器 external 垫片（黑盒）'; entry.domain = 'infrastructure'; entry.risk = 'black-box'; }
  if (basename.includes('mediabunny')) { entry.role = '第三方音频编码库（黑盒）'; entry.domain = 'infrastructure'; entry.risk = 'black-box'; }
}

// ── 8. T02B 补全遗漏的 storage/event ──
// 汇总表中的键可能用了完整文件名（含 .jsx），需要匹配
for (const [base, info] of Object.entries(t02b)) {
  for (const [name, entry] of Object.entries(files)) {
    const fbase = name.replace('.jsx', '').replace('.js', '');
    if (fbase === base || fbase.includes(base)) {
      for (const s of info.storage) if (!entry.storage.includes(s)) entry.storage.push(s);
      for (const e of info.events) if (!entry.events.includes(e)) entry.events.push(e);
    }
  }
}

// ── 9. 写文件 ──
fs.writeFileSync(OUT, JSON.stringify(files, null, 2));
const total = Object.keys(files).length;
const withRole = Object.values(files).filter(v => v.role).length;
console.log(`✅ semantic-map.json 已生成: ${total} 条 (${withRole}/${total} 已标注角色)`);
