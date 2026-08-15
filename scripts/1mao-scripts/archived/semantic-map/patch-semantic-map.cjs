#!/usr/bin/env node
/**
 * patch-semantic-map.cjs — 用 T06B/T08B/hooks数据补全 semantic-map.json
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const MAP = path.join(ROOT, 'docs', 'semantic-map', 'semantic-map.json');

if (!fs.existsSync(MAP)) {
  console.error('先运行: node scripts/gen-semantic-map.cjs');
  process.exit(1);
}

const map = JSON.parse(fs.readFileSync(MAP, 'utf-8'));

// ── Hooks 数据（按 basename 匹配） ──
try {
  const hooksOut = execSync('node scripts/hooks-lookup.cjs --list', { cwd: ROOT, encoding: 'utf-8' });
  for (const [, name, type] of hooksOut.matchAll(/  (\S+\.jsx)\s+(\S+)/g)) {
    for (const [key] of Object.entries(map)) {
      if (key.endsWith('/' + name)) { map[key].hooks = type; break; }
    }
  }
} catch {}

// ── T08B 导出类型 ──
const T08B_PATH = path.join(ROOT, 'docs', 'agent 批量任务', 'out', 'T08B-export-map.md');
if (fs.existsSync(T08B_PATH)) {
  const T08B_MD = fs.readFileSync(T08B_PATH, 'utf-8');
  for (const [, , type, file] of T08B_MD.matchAll(/\| [A-Z]\d+ \| (?:[^(]+\(([^)]+)\)\/)?(\S+\.jsx) \| `[^`]+` \| (\S+)/g)) {
    if (!file) continue;
    // 按basename在map里找到对应键
    for (const [key] of Object.entries(map)) {
      if (key.endsWith('/' + file)) {
        const t = type;
        if (t.includes('组件')) map[key].exportType = 'component';
        else if (t.includes('类')) map[key].exportType = 'class';
        else if (t.includes('async') && t.includes('函数')) map[key].exportType = 'function-async';
        else if (t.includes('函数')) map[key].exportType = 'function';
        break;
      }
    }
  }
}

// ── T06B 角色描述（为未标注文件补领域） ──
const T06B = fs.readFileSync(path.join(ROOT, 'docs', 'agent 批量任务', 'out', 'T06B-inv-structure.md'), 'utf-8');

// T02B 手动精确映射（per-file 反查）
const T02B_MANUAL = {
  // §1.2 storage
  'ShareAppPage-BVCmVrHF.js': { storage: [] }, // 动态模板 workflow-app-license-${appId}
  'endpointConfig-Bt85xi8d.js': { storage: ['active_api_endpoint'] },
  'Xt.jsx': { storage: ['extension-update-dist-path'] },
  'mr.jsx': { storage: ['apiConfigId_text', 'apiConfigId_image', 'apiConfigId_video', 'apiConfigId_sd2Video', 'apiConfigId_audio', 'apiConfigId_discountVideo', 'localToolBaseUrl'], events: ['mutiwindow-task-completed', 'builtin-panel-switch-schedule', 'mutiwindow-rerun-task', 'import-project', 'export-project'] },
  'bo.jsx': { storage: ['mutiwindow_text_model'], events: ['mutiwindow-open-schedule-settings'] },
  '_o.jsx': { storage: ['mutiwindow_prompt_aspectRatio', 'mutiwindow_prompt_imageSize', 'mutiwindow_prompt_quality', 'mutiwindow_prompt_model'], events: ['mutiwindow-update-task-meta'] },
  'Jo.jsx': { storage: ['mutiwindow_video_aspectRatio'], events: ['mutiwindow-open-builtin-settings'] },
  'Es.jsx': { storage: ['mutiwindow_discountvideo_size', 'mutiwindow_discountvideo_resolution', 'mutiwindow_discountvideo_seconds', 'mutiwindow_discountvideo_model'] },
  'Zo.jsx': { storage: ['mutiwindow_sd2video_size', 'mutiwindow_sd2video_seconds', 'mutiwindow_sd2video_model'] },
  'Ps.jsx': { storage: ['mutiwindow_text_model'] },
  'i_.jsx': { storage: ['mutiwindow_text_model'], events: ['mutiwindow-open-schedule-settings', 'mutiwindow-open-builtin-settings', 'script-box-connect-shots', 'script-box-connect-shot'] },
  'R_.jsx': { storage: ['mutiwindow-clipboard'], events: ['canvas-run-workflow-done', 'canvas-force-save-done', 'rhwebapp-run-request', 'open-shortcuts-modal'] },
  'Xs.jsx': { storage: ['mutiwindow-clipboard'] },
  '_Component109.jsx': { storage: ['director_ai_model'], events: ['mutiwindow-open-schedule-settings', 'mutiwindow-open-builtin-settings'] },
  'kn.jsx': { events: ['mutiwindow-update-task-meta', 'script-box-connect-shots'] },
  'Un.jsx': { events: ['canvas-add-resource-request'] },
  'ql.jsx': { events: [] },
  '_Component40.jsx': { events: ['canvas-run-workflow-request'] },
};

// ── 给 _Component* 子组件自动按父组件 domain 归类 ──
function inferDomain(basename, exportType) {
  if (basename.startsWith('_Component')) return 'ui-subcomponents';
  if (exportType === 'function-async') return 'media-processing';
  if (exportType === 'function') return 'utility-functions';
  return '';
}

// 应用补丁
for (const [name, entry] of Object.entries(map)) {
  const basename = path.basename(name);

  // T02B 手动数据（按 basename 匹配）
  if (T02B_MANUAL[basename]) {
    const t = T02B_MANUAL[basename];
    if (t.storage) { entry.storage = t.storage; delete t.storage; }
    if (t.events) { entry.events = t.events; delete t.events; }
    Object.assign(entry, t);
  }

  // App-D5SRQxl shared.js storage keys
  if (name.includes('App-D5SRQxl') && name.includes('shared.js')) {
    const addK = ['device_id', 'extension-update-dismissed-version'];
    const addE = ['mutiwindow-task-completed', 'canvas-force-save-request'];
    for (const k of addK) if (!entry.storage.includes(k)) entry.storage.push(k);
    for (const e of addE) if (!entry.events.includes(e)) entry.events.push(e);
  }
  // httpClient shared.js storage keys
  if (name.includes('httpClient-Bqba_SHR') && name.includes('shared.js')) {
    const addK = ['modelSchedules', 'remembered_login_credentials', 'auth_token', 'yimao:promptRecent'];
    const addE = ['modelSchedules:change', 'yimao:openPromptSettings'];
    for (const k of addK) if (!entry.storage.includes(k)) entry.storage.push(k);
    for (const e of addE) if (!entry.events.includes(e)) entry.events.push(e);
  }

  // 按 exportType 二手分类（只在未标注时）
  if (entry.domain === 'infrastructure' || !entry.role) {
    // _Component* → ui-subcomponents
    if (basename.startsWith('_Component')) {
      entry.domain = 'ui-subcomponents';
      if (!entry.role) entry.role = `自动命名子组件（${entry.exportType}）`;
    }
    // async 函数 → media-processing
    else if (entry.exportType === 'function-async') {
      entry.domain = 'media-processing';
      if (!entry.role) entry.role = 'async 处理函数';
    }
    // 普通函数 → utility-functions
    else if (entry.exportType === 'function' && basename.endsWith('.jsx')) {
      entry.domain = 'utility-functions';
      if (!entry.role) entry.role = '工具函数';
    }
    // 组件 → ui-subcomponents（兜底）
    else if (entry.exportType === 'component' && basename.endsWith('.jsx') && !entry.role) {
      entry.domain = 'ui-subcomponents';
      entry.role = `UI 组件`;
    }
  }
}

// 尚未分类的 JSX 文件二次分类
const remaining = Object.entries(map).filter(([, v]) => v.domain === 'infrastructure' && v.role === '');
console.log(`未分类文件: ${remaining.length}`);
for (const [name] of remaining.slice(0, 20)) {
  console.log(`  - ${name}`);
}

fs.writeFileSync(MAP, JSON.stringify(map, null, 2));
const total = Object.keys(map).length;
const withRole = Object.values(map).filter(v => v.role).length;
const withStorage = Object.values(map).filter(v => v.storage.length > 0).length;
const withEvents = Object.values(map).filter(v => v.events.length > 0).length;
const withHooks = Object.values(map).filter(v => v.hooks).length;
console.log(`\n✅ 补丁完成: ${total} 条`);
console.log(`   角色: ${withRole}/${total} | 存储: ${withStorage} | 事件: ${withEvents} | hooks: ${withHooks}`);
