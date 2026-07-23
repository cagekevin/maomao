// 画布模板数据层
// 替代 App.js 中的 LOCAL_TEMPLATES_KEY / _getLocalTemplates / _saveLocalTemplates / Qh / $h / eg / tg / ng / rg / ag
import { Q } from '../utils/storage/index.js';

const LOCAL_TEMPLATES_KEY = 'local_templates';

async function _getLocalTemplates() {
  let arr = await Q.getObject(LOCAL_TEMPLATES_KEY);
  return Array.isArray(arr) ? arr : [];
}

async function _saveLocalTemplates(arr) {
  await Q.setObject(LOCAL_TEMPLATES_KEY, arr);
}

// 创建模板
async function createTemplate(data) {
  let templates = await _getLocalTemplates();
  let item = { ...data, id: Date.now(), isPublic: false, reviewStatus: 'approved', createdAt: new Date().toISOString() };
  templates.unshift(item);
  await _saveLocalTemplates(templates);
  return item;
}

// 读取我的模板
async function getTemplates(filter = {}) {
  let templates = await _getLocalTemplates();
  if (filter.category) templates = templates.filter(t => t.category === filter.category);
  if (filter.keyword && filter.keyword.trim()) {
    let kw = filter.keyword.trim().toLowerCase();
    templates = templates.filter(t => (t.name || '').toLowerCase().includes(kw));
  }
  return templates;
}

// 广场模板（本地模式恒空）
async function getPublicTemplates(filter = {}) {
  return [];
}

// 公开/私有切换
async function togglePublic(id, value) {
  let templates = await _getLocalTemplates();
  let idx = templates.findIndex(t => t.id == id);
  if (idx === -1) return { ok: false, error: '模板不存在' };
  templates[idx].isPublic = value;
  await _saveLocalTemplates(templates);
  return { ok: true, data: templates[idx] };
}

// 删除模板
async function deleteTemplate(id) {
  let templates = await _getLocalTemplates();
  let idx = templates.findIndex(t => t.id == id);
  if (idx === -1) return false;
  templates.splice(idx, 1);
  await _saveLocalTemplates(templates);
  return true;
}

// 记录使用次数（本地模式 no-op）
function recordUsage(id) { }

// 分类选项
const CATEGORY_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'image', label: '图片' },
  { value: 'video', label: '视频' },
  { value: 'text', label: '文本' }
];

export {
  LOCAL_TEMPLATES_KEY,
  _getLocalTemplates,
  _saveLocalTemplates,
  createTemplate,
  getTemplates,
  getPublicTemplates,
  togglePublic,
  deleteTemplate,
  recordUsage,
  CATEGORY_OPTIONS
};
