#!/usr/bin/env node
const m = require('../docs/semantic-map/semantic-map.json');
const fs = require('fs');
const d = {};
Object.entries(m).forEach(([k, v]) => {
  if (!d[v.domain]) d[v.domain] = [];
  d[v.domain].push({ file: k, role: v.role, risk: v.risk, storage: v.storage, events: v.events });
});

const out = [];
out.push('# FEATURE_GROUPS · gougou 功能域导航');
out.push('');
out.push('> 自动生成自 semantic-map.json | ' + Object.keys(m).length + ' 文件 · ' + Object.keys(d).length + ' 功能域');
out.push('');

const DESC = {
  'model-config': '模型选择 / 参数配置面板',
  'task-scheduler': '任务列表 / 调度主面板 / 筛选 / 元信息',
  'canvas-editor': '画布 / 编辑器 / 快捷键 / 脚本盒',
  'media-processing': 'async 媒体处理链 / 上传 / 缩放',
  'prompt-management': '提示词库 / 最近使用 / 设置',
  'video-config': '视频参数配置面板',
  'ui-subcomponents': '自动命名子组件 _Component* 系列',
  'utility-functions': '普通工具函数族',
  'endpoint-share': '端点配置 / 分享页 / 引导入口',
  'infrastructure': '入口引导 / shared.js 桶 / 黑盒 / JSON 映射表',
};

for (const dom of Object.keys(d).sort((a, b) => d[b].length - d[a].length)) {
  out.push('## ' + dom);
  out.push('');
  out.push('> ' + (DESC[dom] || '') + ' | ' + d[dom].length + ' 文件');
  out.push('');

  const allS = [...new Set(d[dom].flatMap(f => f.storage))].sort();
  if (allS.length > 0) out.push('**触碰存储键**: ' + allS.map(s => '`' + s + '`').join(', '));
  const allE = [...new Set(d[dom].flatMap(f => f.events))].sort();
  if (allE.length > 0) out.push('**触碰事件频道**: ' + allE.map(e => '`' + e + '`').join(', '));
  out.push('');

  out.push('| 文件 | 角色 | 风险 | 存储 | 事件 |');
  out.push('|---|---|---|---|---|');
  for (const f of d[dom]) {
    const storage = f.storage.length > 0 ? f.storage.slice(0, 3).join(', ') + (f.storage.length > 3 ? '…' : '') : '—';
    const events = f.events.length > 0 ? f.events.slice(0, 3).join(', ') + (f.events.length > 3 ? '…' : '') : '—';
    const risk = { low: '🟢', medium: '🟡', high: '🔴', 'black-box': '⚫' }[f.risk] || f.risk;
    out.push('| `' + f.file + '` | ' + f.role + ' | ' + risk + ' | ' + storage + ' | ' + events + ' |');
  }
  out.push('');
}

fs.writeFileSync('docs/semantic-map/FEATURE_GROUPS.md', out.join('\n'));
console.log('✅ FEATURE_GROUPS.md: ' + Object.keys(d).length + ' 功能域');
