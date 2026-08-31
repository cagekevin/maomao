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
import type { RawModel } from '../providerModels.ts'
import { useStoreSelector } from '../../../hooks/useStoreSelector.ts'
import { providerApi } from '../localToolApi.ts'
import { contentSetAsync } from '../contentStore.ts'
import { generateId } from '../idGen.ts'
import { logger } from '../logger.ts'

// useSyncExternalStore 要求：数据变化时 getSnapshot 必须返回「新引用」，
// 否则 React 用 Object.is 判定无变化 → 不触发渲染（表现：按钮没反应、页面空白/卡）。
// 因此 setState 一律返回新对象，绝不原地修改。
/**
 * 供应商实体（前端 UI/编辑态）。
 * 【key 处理】key 只进后端 env，不回明文：GET 返回 has_key/key_preview；
 *  编辑新 key 存 `_apiKey`（UI 态）、清除存 `_clearKey`，save() 时才映射到 api_key/clear_key。
 */
export interface Provider extends Record<string, unknown> {
  id: string
  name: string
  base_url: string
  protocol: string
  image_request_mode: string
  image_mode: string
  chat_request_mode: string
  enabled: boolean
  primary: boolean
  readonly: boolean
  image_models: RawModel[]
  chat_models: RawModel[]
  video_models: RawModel[]
  model_names: Record<string, unknown>
  model_protocols: Record<string, unknown>
  /** UI 态：待保存的新 key（含掩码 '••' 时视为未修改） */
  _apiKey?: string
  /** UI 态：标记清除已存 key */
  _clearKey?: boolean
}

/** 拉取到的模型暂存（弹窗勾选后再 apply） */
export interface FetchedModels {
  id: string
  image_models: RawModel[]
  chat_models: RawModel[]
  video_models: RawModel[]
  warning?: string
}

/** providerStore 状态快照 */
export interface ProviderState {
  providers: Provider[]
  selectedId: string | null
  dirty: boolean
  loading: boolean
  saving: boolean
  testingId: string | null
  fetchingId: string | null
  fetchedModels: FetchedModels | null
  testResult: Record<string, unknown> | null
  /** save() 后回写 api.config.json 的结果标记 */
  configSynced?: boolean
  configSyncError?: string
}

let state: ProviderState = {
  providers: [],
  selectedId: null,
  dirty: false,
  loading: false,
  saving: false,
  testingId: null,
  fetchingId: null,
  fetchedModels: null,
  testResult: null,
}
const listeners = new Set<() => void>()

function setState(patch: Partial<ProviderState>): void {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

// ── 懒加载（P0-2-d）──
// 首次有消费者订阅（useProviders / useProvidersList）且列表尚未加载时，后台自动 load() 一次，
// 让节点/面板无需各自写「挂载 useEffect 里判断空则 load」样板。
// autoLoadStarted 状态位：只触发一次，避免多消费者并发订阅时重复请求；也避免失败后在订阅循环里反复请求。
let autoLoadStarted = false
function ensureAutoLoad() {
  if (autoLoadStarted) return
  autoLoadStarted = true
  if (state.providers.length === 0) {
    load().catch((e) => logger.warn('provider', 'auto-load-fail', { error: e?.message }))
  }
}
function subscribe(cb: () => void): () => void {
  ensureAutoLoad()
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}
function getSnapshot(): ProviderState {
  return state
}
export function useProviders(): ProviderState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/** 原子订阅：只订阅 providers 列表（P5）。只读供应商列表的消费方（useScriptBoxEngine 等）
 *  不随 dirty/loading/testResult 等 UI 态变更连坐重渲染。 */
export function useProvidersList(): Provider[] {
  return useStoreSelector(subscribe, getSnapshot, (s) => s.providers)
}

function emptyProvider(): Provider {
  return {
    id: generateId('p'),
    name: '新供应商',
    base_url: '',
    protocol: 'openai',
    image_request_mode: 'openai',
    image_mode: 'sync',
    chat_request_mode: 'chat',
    enabled: true,
    primary: false,
    readonly: false,
    image_models: [],
    chat_models: [],
    video_models: [],
    model_names: {},
    model_protocols: {},
  }
}

// ── 动作 ──
export async function load(): Promise<void> {
  setState({ loading: true, testResult: null })
  try {
    const data = await providerApi.getProviders()
    const list: Provider[] = data?.data?.providers || []
    const primary = list.find((p) => p.primary) || list[0]
    setState({ providers: list, selectedId: primary ? primary.id : null, dirty: false })
  } finally {
    setState({ loading: false })
  }
}

export function select(id: string | null): void {
  setState({ selectedId: id, testResult: null })
}

export function update(id: string, patch: Partial<Provider>): void {
  setState({
    providers: state.providers.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    dirty: true,
  })
}

export function setPrimary(id: string): void {
  setState({
    providers: state.providers.map((p) => ({ ...p, primary: p.id === id })),
    dirty: true,
  })
}

export function add(): Provider {
  const np = emptyProvider()
  setState({ providers: [...state.providers, np], selectedId: np.id, dirty: true, testResult: null })
  return np
}

export function remove(id: string): void {
  const target = state.providers.find((p) => p.id === id)
  if (!target) return
  let next = state.providers.filter((p) => p.id !== id)
  if (target.primary && next.length) next = next.map((p, i) => (i === 0 ? { ...p, primary: true } : p))
  setState({
    providers: next,
    selectedId: state.selectedId === id ? next[0]?.id || null : state.selectedId,
    dirty: true,
  })
}

export async function test(id: string): Promise<void> {
  const p = state.providers.find((x) => x.id === id)
  if (!p) return
  setState({ testingId: id, testResult: null })
  try {
    const key = p._apiKey && p._apiKey.trim() ? p._apiKey.trim() : undefined
    const payload = { id: p.id, base_url: p.base_url, key, protocol: p.protocol }
    // 1) 通用连通性探测（含 GET 健康/模型端点，失败时透传上游原始 body）
    let data = (await providerApi.testConnection(payload)) as Record<string, unknown>
    // 2) apimart 异步协议：额外用假 task_id 嗅探异步端点，能区分
    //    「key 无效(401/403) / 非 apimart(404) / 端点存在(400+invalid task id)」。
    //    若通用探测已成功则跳过，避免无谓请求；失败时用异步嗅探结果补全诊断。
    if (p.protocol === 'apimart' && !data?.ok) {
      try {
        const probe = await providerApi.probeAsync(payload)
        // 优先展示异步嗅探的更精确原始信息；status 若为 0 则回填
        data = probe.ok
          ? { ...data, ...probe, ok: true }
          : { ...data, ...probe, ok: false }
      } catch {
        // probe-async 本身失败时保留 test-connection 的原始信息
      }
    }
    setState({ testResult: data })
  } catch (e) {
    setState({ testResult: { ok: false, error: e.message } })
  } finally {
    setState({ testingId: null })
  }
}

export async function fetchModels(id: string): Promise<{ ok: boolean; pending?: boolean; total?: number; warning?: string; error?: string }> {
  const p = state.providers.find((x) => x.id === id)
  if (!p) return { ok: false }
  setState({ fetchingId: id })
  try {
    const data = await providerApi.fetchModels(id)
    const m = data?.data || {}
    if (Array.isArray(m.image_models) && Array.isArray(m.chat_models) && Array.isArray(m.video_models)) {
      // 不直接全量写入：把拉取结果暂存，由 UI 弹窗让用户勾选后再 apply。
      setState({
        fetchedModels: {
          id,
          image_models: m.image_models,
          chat_models: m.chat_models,
          video_models: m.video_models,
          warning: m.warning,
        },
      })
      return { ok: true, pending: true, total: m.image_models.length + m.chat_models.length + m.video_models.length, warning: m.warning }
    }
    return { ok: false, warning: m.warning }
  } catch (e) {
    return { ok: false, error: e.message }
  } finally {
    setState({ fetchingId: null })
  }
}

/** 用户弹窗勾选后，把选定模型写入 provider（合并已有 + 勾选的新拉项）。 */
export function applyFetchedModels(id: string, selected: { image_models?: RawModel[]; chat_models?: RawModel[]; video_models?: RawModel[] } | null): void {
  const p = state.providers.find((x) => x.id === id)
  if (!p || !selected) return
  setState({
    providers: state.providers.map((x) =>
      x.id === id
        ? {
            ...x,
            image_models: selected.image_models || [],
            chat_models: selected.chat_models || [],
            video_models: selected.video_models || [],
          }
        : x
    ),
    dirty: true,
    fetchedModels: null,
  })
}

/** 关闭拉取弹窗（取消，不写入）。 */
export function closeFetchedModels(): void {
  setState({ fetchedModels: null })
}

export async function save(): Promise<{ ok: boolean; error?: string }> {
  setState({ saving: true })
  try {
    const payload = state.providers.map((p) => {
      // 出站体含协议特有字段（volcengine_*）与 key 通道（api_key/clear_key），
      // 均按条件追加，故显式标注为可索引记录。
      const cleaned: Record<string, unknown> = {
        id: p.id,
        name: p.name,
        base_url: p.base_url,
        protocol: p.protocol,
        image_request_mode: p.image_request_mode || 'openai',
        image_mode: p.image_mode === 'async' ? 'async' : 'sync',
        enabled: p.enabled !== false,
        primary: !!p.primary,
        image_models: p.image_models || [],
        chat_models: p.chat_models || [],
        video_models: p.video_models || [],
        model_names: p.model_names || {},
        model_protocols: p.model_protocols || {},
        ms_loras: p.ms_loras || [],
      }
      if (p.protocol === 'volcengine') {
        cleaned.volcengine_project_name = p.volcengine_project_name
        cleaned.volcengine_region = p.volcengine_region
      }
      if (p._apiKey && p._apiKey.trim() && !p._apiKey.includes('••')) cleaned.api_key = p._apiKey.trim()
      if (p._clearKey === true) cleaned.clear_key = true
      return cleaned
    })
    const data = await providerApi.saveProviders(payload)
    const savedProviders = data?.data?.providers || state.providers
    setState({ providers: savedProviders, dirty: false })
    // 方案A：把保存后的结果回写 api.config.json，消除双源漂移。
    // 回写是辅助动作，失败不影响主保存（避免 json 写失败导致保存报错）。
    providerApi
      .syncConfigBase(savedProviders || payload)
      .then(() => setState({ configSynced: true }))
      .catch((e) => setState({ configSyncError: e.message }))
    // 对齐官方 active_api_endpoint（KV）：把主供应商写入 localTool KV，供跨端读取当前生效 endpoint
    const primary = savedProviders.find((p) => p.primary) || savedProviders[0]
    if (primary) {
      contentSetAsync('active_api_endpoint', {
        providerId: primary.id,
        name: primary.name,
        base_url: primary.base_url,
        protocol: primary.protocol,
        updatedAt: Date.now(),
      }).catch((e) => logger.warn('provider', 'endpoint-persist-fail', { providerId: primary.id, error: e?.message }))
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  } finally {
    setState({ saving: false })
  }
}
