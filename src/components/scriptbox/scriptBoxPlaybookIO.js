/**
 * 剧本盒子 · Playbook 导出/导入 IO 层（纯函数，无副作用，供管理面板吃单）。
 *
 * 定位：把「单个 playbook」序列化成 JSON 文本（导出给外部/AI 改）与把 JSON 文本解析回
 * playbook（导入）。只管「对象 ↔ 文本」，不落盘——持久化走 store，文件读写走 UI。
 * - exportText(pb)：导出单个 playbook → { text, filename }（含 __meta 标记，导入时忽略）。
 * - parseImport(text)：解析导入文本 → { ok:true, playbook } | { ok:false, error }（builtin 强制 false）。
 *
 * 【安全约定】导入一律落为「我的」自定义，绝不覆盖内置；id/label 去重由调用方（Manager）做。
 */
const FILE_META = { type: 'scriptbox-playbook' }

function sanitize(name) {
  return String(name || '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '') || 'playbook'
}

/** 导出单个 playbook → { text, filename }。pb 需含 label/id（至少其一）。 */
export function exportText(pb) {
  const { __meta, ...rest } = pb || {}
  // __meta 每持最新时间戳 + 版本标记（不持久化在 store，仅导出文件识别用）
  const text = JSON.stringify({ __meta: { ...FILE_META, exportedAt: Date.now() }, ...rest }, null, 2)
  const label = String(pb?.label || pb?.id || 'playbook')
  return { text, filename: `playbook-${sanitize(label)}.json` }
}

/** 把导入文本解析/校验/归一化为一个可写入「我的」的 playbook（不含 id——由调用方分配并去重 label）。 */
export function parseImport(text) {
  let obj
  try {
    obj = JSON.parse(String(text || ''))
  } catch {
    return { ok: false, error: '不是有效的 JSON 文件' }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, error: '文件内容不是一个对象' }
  }
  // 去掉 __meta（导出时打的识别标记），只取 playbook 字段
  const { __meta, script, shot, audit, qg, assetTemplates, imageGenTemplates, constraints, negative, label, id: _id } = obj
  const hasContent = [script, shot, audit, qg, assetTemplates, imageGenTemplates].some((v) => Boolean(v))
  if (!hasContent && !label) {
    return { ok: false, error: '缺少可识别的 playbook 字段（label/script/…）' }
  }
  const playbook = {
    label: String(label || '导入工作流').trim() || '导入工作流',
    script: String(script || ''),
    shot: String(shot || ''),
    audit: String(audit || ''),
    qg: String(qg || ''),
    assetTemplates: (typeof assetTemplates === 'object' && !Array.isArray(assetTemplates) ? assetTemplates : {}),
    imageGenTemplates: (typeof imageGenTemplates === 'object' && !Array.isArray(imageGenTemplates) ? imageGenTemplates : {}),
    constraints: { image: '', video: '', ...(typeof constraints === 'object' && constraints ? constraints : {}) },
    negative: { common: '', image: '', video: '', ...(typeof negative === 'object' && negative ? negative : {}) },
    builtin: false, // 导入一律落为「我的」自定义
  }
  return { ok: true, playbook }
}