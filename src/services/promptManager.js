// 提示词管理数据层
// 纯本地模式，不调远程 API
import { Q } from '../utils/storage/index.js';
import { Z } from '../config/storageKeys.js';
import { Wa, Ga, Ka } from './auth.js';

// 生成短 uuid
function generateId() {
  return 'pp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// 补 id：旧数据可能没 id，迁移时自动补
export function ensureIds(presets) {
  if (!Array.isArray(presets)) return [];
  return presets.map(p => (p.id ? p : { ...p, id: generateId() }));
}

// 加载预设列表
export async function loadPresets() {
  const data = await Q.getObject(Z.PRESET_PROMPTS);
  if (!data || !Array.isArray(data)) return [];
  const withIds = ensureIds(data);
  // 如果有新增 id，回写
  if (withIds.some((p, i) => !data[i]?.id)) {
    await savePresets(withIds);
  }
  return withIds;
}

// 保存预设列表（全量覆盖）
export function savePresets(presets) {
  return Q.setObject(Z.PRESET_PROMPTS, presets);
}

// 创建新预设模板
export function createPreset() {
  return {
    id: generateId(),
    title: '',
    type: 'all',
    prompt: '',
    enabled: true
  };
}

// 将预设数组映射为弹窗卡片格式
export function mapToLibraryCards(presets) {
  return presets
    .filter(p => p.enabled !== false)
    .map(p => ({
      id: p.id,
      title: p.title,
      content: p.prompt,
      category: p.type === 'all' ? '' : p.type,
      isLocal: true
    }));
}

// 获取最近使用的 preset id 列表
export function getRecent() {
  return Ga();
}

// 记录一次使用（去重 + 上限 50）
export function recordRecent(id) {
  Ka(id);
}

// 根据卡片列表和最近使用 id 列表，提取最近使用的卡片
export function getRecentCards(allCards, recentIds) {
  const cardMap = new Map(allCards.map(c => [c.id, c]));
  return recentIds.map(id => cardMap.get(id)).filter(Boolean);
}

// 按类型筛选 + 排序（匹配类别的在前）
export function getFilteredSorted(presets, category) {
  const enabled = presets.filter(p => p.enabled !== false);
  const match = p => p.type === category || p.type === 'all' || !p.type;
  return [...enabled.filter(match), ...enabled.filter(p => !match(p))];
}

// 搜索过滤（弹窗卡片版）
export function searchCards(cards, keyword) {
  if (!keyword || !keyword.trim()) return cards;
  const kw = keyword.trim().toLowerCase();
  return cards.filter(c =>
    c.title.toLowerCase().includes(kw) ||
    c.content.toLowerCase().includes(kw)
  );
}

export { generateId };
