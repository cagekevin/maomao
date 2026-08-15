/**
 * 供应商数据层（对齐 taskStore 范式：模块级 state + useSyncExternalStore）。
 * 所有网络请求收敛在 providerApi，组件只消费快照 + 调动作。
 *
 * key 处理（契约：key 只进后端 env，不回明文）：
 *  - GET 返回 has_key / key_preview，无明文
 *  - 编辑新 key 存 provider._apiKey（UI 态）；清除存 provider._clearKey
 *  - save() 时：_apiKey 非空 → api_key；_clearKey → clear_key；否则不传（沿用）
 */
import { useSyncExternalStore } from 'react'
import { providerApi } from './settingsApi.js'
import { kvSet } from '../kvStore.js'

// useSyncExternalStore 要求：数据变化时 getSnapshot 必须返回「新引用」，
// 否则 React 用 Object.is 判定无变化 → 不触发渲染（表现：按钮没反应、页面空白/卡）。
// 因此 setState 一律返回新对象，绝不原地修改。
let state = {
  providers: [],
  selectedId: null,
  dirty: false,
  loading: false,
  saving: false,
  testingId: null,
  fetchingId: null,
  testResult: null,
}
const listeners = new Set()

function setState(patch) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}
function subscribe(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
function getSnapshot() {
  return state
}
export function useProviders() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

function genId() {
  return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7)
}
function emptyProvider() {
  return {
    id: genId(),
    name: '新供应商',
    base_url: '',
    protocol: 'openai',
    image_request_mode: 'openai',
    image_mode: 'sync',
    enabled: true,
    isPrimary: false,
    readonly: false,
    image_models: [],
    chat_models: [],
    video_models: [],
    model_names: {},
  }
}

// ── 动作 ──
export async function load() {
  setState({ loading: true, testResult: null })
  try {
    const data = await providerApi.getProviders()
    const list = data.providers || []
    const primary = list.find((p) => p.isPrimary) || list[0]
    setState({ providers: list, selectedId: primary ? primary.id : null, dirty: false })
  } finally {
    setState({ loading: false })
  }
}

export function select(id) {
  setState({ selectedId: id, testResult: null })
}

export function update(id, patch) {
  setState({
    providers: state.providers.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    dirty: true,
  })
}

export function setPrimary(id) {
  setState({
    providers: state.providers.map((p) => ({ ...p, isPrimary: p.id === id })),
    dirty: true,
  })
}

export function add() {
  const np = emptyProvider()
  setState({ providers: [...state.providers, np], selectedId: np.id, dirty: true, testResult: null })
}

export function remove(id) {
  const target = state.providers.find((p) => p.id === id)
  if (!target) return
  let next = state.providers.filter((p) => p.id !== id)
  if (target.isPrimary && next.length) next = next.map((p, i) => (i === 0 ? { ...p, isPrimary: true } : p))
  setState({
    providers: next,
    selectedId: state.selectedId === id ? next[0]?.id || null : state.selectedId,
    dirty: true,
  })
}

export async function test(id) {
  const p = state.providers.find((x) => x.id === id)
  if (!p) return
  setState({ testingId: id, testResult: null })
  try {
    const key = p._apiKey && p._apiKey.trim() ? p._apiKey.trim() : undefined
    const data = await providerApi.testConnection({ id: p.id, base_url: p.base_url, key, protocol: p.protocol })
    setState({ testResult: data })
  } catch (e) {
    setState({ testResult: { ok: false, error: e.message } })
  } finally {
    setState({ testingId: null })
  }
}

export async function fetchModels(id) {
  const p = state.providers.find((x) => x.id === id)
  if (!p) return { ok: false }
  setState({ fetchingId: id })
  try {
    const data = await providerApi.fetchModels(id)
    if (Array.isArray(data.image_models) && Array.isArray(data.chat_models) && Array.isArray(data.video_models)) {
      update(id, {
        image_models: data.image_models,
        chat_models: data.chat_models,
        video_models: data.video_models,
      })
      return { ok: true, total: data.image_models.length + data.chat_models.length + data.video_models.length, warning: data.warning }
    }
    return { ok: false, warning: data.warning }
  } catch (e) {
    return { ok: false, error: e.message }
  } finally {
    setState({ fetchingId: null })
  }
}

export async function save() {
  setState({ saving: true })
  try {
    const payload = state.providers.map((p) => {
      const cleaned = {
        id: p.id,
        name: p.name,
        base_url: p.base_url,
        protocol: p.protocol,
        image_request_mode: p.image_request_mode || 'openai',
        image_mode: p.image_mode === 'async' ? 'async' : 'sync',
        enabled: p.enabled !== false,
        isPrimary: !!p.isPrimary,
        image_models: p.image_models || [],
        chat_models: p.chat_models || [],
        video_models: p.video_models || [],
        model_names: p.model_names || {},
      }
      if (p._apiKey && p._apiKey.trim() && !p._apiKey.includes('••')) cleaned.api_key = p._apiKey.trim()
      if (p._clearKey === true) cleaned.clear_key = true
      return cleaned
    })
    const data = await providerApi.saveProviders(payload)
    setState({ providers: data.providers || state.providers, dirty: false })
    // 方案A：把保存后的结果回写 api.config.json，消除双源漂移。
    // 回写是辅助动作，失败不影响主保存（避免 json 写失败导致保存报错）。
    providerApi
      .syncConfigBase(data.providers || payload)
      .then(() => setState({ configSynced: true }))
      .catch((e) => setState({ configSyncError: e.message }))
    // 对齐官方 active_api_endpoint（KV）：把主供应商写入 localTool KV，供跨端读取当前生效 endpoint
    const primary = (data.providers || state.providers).find((p) => p.isPrimary) || (data.providers || state.providers)[0]
    if (primary) {
      kvSet('active_api_endpoint', {
        providerId: primary.id,
        name: primary.name,
        base_url: primary.base_url,
        protocol: primary.protocol,
        updatedAt: Date.now(),
      }).catch(() => {})
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  } finally {
    setState({ saving: false })
  }
}
