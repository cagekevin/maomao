/**
 * 供应商数据层（对齐 taskStore 范式：模块级 state + useSyncExternalStore）。
 * 所有网络请求收敛在 providerApi，组件只消费快照 + 调动作。
 *
 * 【新时代配置型（docs/96、docs/101，2026-09-03）】厂商数据源已切到配置型：GET /api/providers
 * 返回「13 个平台 JSON（config/providers/<id>.json）+ 内置目录」合并的厂商列表，含各自模型清单。
 * 前端设置页语义 = 「切哪个用哪个」：所有已配置厂商都能用，用户挑当前想用的（= primary，仅作
 * 回退默认；节点仍可经 providerId::modelId 独立选任意厂商模型）。已删除新时代不再支持的 CRUD：
 * add / update / remove（厂商配置只能改 JSON 文件，不在设置页增删改）。
 *
 * key 处理（契约：key 只进后端 env，不回明文）：
 *  - GET 返回 has_key / key_preview，无明文
 *  - save() 时对整组透传；key 通道（api_key/clear_key）仅在有编辑态时映射（配置型下无编辑入口）
 */
import { useSyncExternalStore } from 'react';
import type { RawModel } from '../utils/providerModels.ts';
import { useStoreSelector } from '../../../hooks/useStoreSelector.ts';
import { providerApi } from '../api/localToolApi.ts';
import { contentSetAsync } from '../core/contentStore.ts';
import { logger } from '../core/logger.ts';

// useSyncExternalStore 要求：数据变化时 getSnapshot 必须返回「新引用」，
// 否则 React 用 Object.is 判定无变化 → 不触发渲染（表现：按钮没反应、页面空白/卡）。
// 因此 setState 一律返回新对象，绝不原地修改。
/**
 * 供应商实体（前端 UI/编辑态）。
 * 【key 处理】key 只进后端 env，不回明文：GET 返回 has_key/key_preview；
 *  编辑新 key 存 `_apiKey`（UI 态）、清除存 `_clearKey`，save() 时才映射到 api_key/clear_key。
 */
export interface Provider extends Record<string, unknown> {
  id: string;
  name: string;
  base_url: string;
  protocol: string;
  image_request_mode: string;
  image_mode: string;
  chat_request_mode: string;
  enabled: boolean;
  primary: boolean;
  readonly: boolean;
  image_models: RawModel[];
  chat_models: RawModel[];
  video_models: RawModel[];
  model_names: Record<string, unknown>;
  model_protocols: Record<string, unknown>;
  /** UI 态：待保存的新 key（含掩码 '••' 时视为未修改） */
  _apiKey?: string;
  /** UI 态：标记清除已存 key */
  _clearKey?: boolean;
}

/** 拉取到的模型暂存（弹窗勾选后再 apply） */
export interface FetchedModels {
  id: string;
  image_models: RawModel[];
  chat_models: RawModel[];
  video_models: RawModel[];
  warning?: string;
}

/** providerStore 状态快照 */
export interface ProviderState {
  providers: Provider[];
  selectedId: string | null;
  dirty: boolean;
  loading: boolean;
  saving: boolean;
  testingId: string | null;
  fetchingId: string | null;
  fetchedModels: FetchedModels | null;
  testResult: Record<string, unknown> | null;
  /** save() 后回写 api.config.json 的结果标记 */
  configSynced?: boolean;
  configSyncError?: string;
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
};
const listeners = new Set<() => void>();

function setState(patch: Partial<ProviderState>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

// ── 懒加载（P0-2-d）──
// 首次有消费者订阅（useProviders / useProvidersList）且列表尚未加载时，后台自动 load() 一次，
// 让节点/面板无需各自写「挂载 useEffect 里判断空则 load」样板。
// autoLoadStarted 状态位：只触发一次，避免多消费者并发订阅时重复请求；也避免失败后在订阅循环里反复请求。
let autoLoadStarted = false;
function ensureAutoLoad() {
  if (autoLoadStarted) return;
  autoLoadStarted = true;
  if (state.providers.length === 0) {
    load().catch((e) => logger.warn('provider', 'auto-load-fail', { error: e?.message }));
  }
}
function subscribe(cb: () => void): () => void {
  ensureAutoLoad();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
function getSnapshot(): ProviderState {
  return state;
}
export function useProviders(): ProviderState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** 原子订阅：只订阅 providers 列表（P5）。只读供应商列表的消费方（useScriptBoxEngine 等）
 *  不随 dirty/loading/testResult 等 UI 态变更连坐重渲染。 */
export function useProvidersList(): Provider[] {
  return useStoreSelector(subscribe, getSnapshot, (s) => s.providers);
}

function emptyProvider(): Provider {
  return {
    // 兜底空 provider：不再造随机 p_ id（用户分不清）。真实厂商 id 一律来自后端/候选内置；
    // 只有 normalize 遇到空/非对象返回时才用可读占位，正常生效厂商不受影响（会用自身 id）。
    id: '__unknown__',
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
  };
}

/**
 * 校验并补默认地把外部/API 来源的 provider 收窄为 `Provider`（防假收窄）。
 * 只对已知字段做运行时校验；未知扩展字段（如 volcengine_* / ms_loras / api_key）经 `...p` 原样保留，
 * 避免白名单丢弃导致 round-trip 丢数据。空/非对象 → emptyProvider 兜底。
 */
function normalizeProvider(raw: unknown): Provider {
  if (!raw || typeof raw !== 'object') return emptyProvider();
  const p = raw as Partial<Provider>;
  const base = emptyProvider();
  return {
    ...base,
    ...p,
    id: typeof p.id === 'string' ? p.id : base.id,
    name: typeof p.name === 'string' ? p.name : base.name,
    base_url: typeof p.base_url === 'string' ? p.base_url : base.base_url,
    protocol: typeof p.protocol === 'string' ? p.protocol : base.protocol,
    image_request_mode:
      typeof p.image_request_mode === 'string' ? p.image_request_mode : base.image_request_mode,
    image_mode: typeof p.image_mode === 'string' ? p.image_mode : base.image_mode,
    chat_request_mode:
      typeof p.chat_request_mode === 'string' ? p.chat_request_mode : base.chat_request_mode,
    enabled: typeof p.enabled === 'boolean' ? p.enabled : base.enabled,
    primary: p.primary === true,
    readonly: p.readonly === true,
    image_models: toRawModelList(p.image_models, base.image_models),
    chat_models: toRawModelList(p.chat_models, base.chat_models),
    video_models: toRawModelList(p.video_models, base.video_models),
    model_names:
      p.model_names && typeof p.model_names === 'object' ? p.model_names : base.model_names,
    model_protocols:
      p.model_protocols && typeof p.model_protocols === 'object'
        ? p.model_protocols
        : base.model_protocols,
  };
}

/**
 * 把 unknown 数组收窄成 RawModel[]。
 * 兼容两种元素形态（后端契约返回对象数组 `{id,label,...}`；部分来源/旧测试可能为字符串 id）：
 *  - 对象元素：原样保留（RawModel 为 `{id?,label?,[k]:unknown}` 松记录，仅需对象形态校验）；
 *  - 字符串元素：转成 `{ id: str }`（视作模型 id），避免被误丢弃导致模型列表为空；
 *  - 其余非对象/非字符串（null、数字等）：丢弃。
 */
function toRawModelList(raw: unknown, fallback: RawModel[]): RawModel[] {
  if (!Array.isArray(raw)) return fallback;
  return raw.flatMap((x): RawModel[] => {
    if (x && typeof x === 'object') return [x as RawModel];
    if (typeof x === 'string' && x.trim()) return [{ id: x }];
    return [];
  });
}

// ── 动作 ──
export async function load(): Promise<void> {
  setState({ loading: true, testResult: null });
  try {
    const data = await providerApi.getProviders();
    const list: Provider[] = Array.isArray(data?.data?.providers)
      ? data.data.providers.map(normalizeProvider)
      : [];
    const primary = list.find((p) => p.primary) || list[0];
    setState({ providers: list, selectedId: primary ? primary.id : null, dirty: false });
  } finally {
    setState({ loading: false });
  }
}

export function select(id: string | null): void {
  setState({ selectedId: id, testResult: null });
}

/** 已启用（用户已加进来）的厂商列表 —— 设置页「已用厂商」展示源；未启用的作候选。 */
export function enabledProviders(providers: Provider[]): Provider[] {
  return providers.filter((p) => p.enabled === true);
}

/** 候选（未启用/未配置，enabled 非 true）厂商 —— 「增加厂商」弹窗的选项源。 */
export function candidateProviders(providers: Provider[]): Provider[] {
  return providers.filter((p) => p.enabled !== true);
}

/**
 * 启用/移出某厂商（用户配置层，save() 后写回后端 config JSON）。
 * 启用会把该厂商加入已用列表；移出（置 enabled=false）从列表隐藏（内置厂商 revert 出厂，不删文件）。
 */
export function toggleProviderEnabled(id: string, on: boolean): void {
  setState({
    providers: state.providers.map((p) => (p.id === id ? { ...p, enabled: on } : p)),
    dirty: true,
    // 移出当前选中 → 清空选择；启用时保住现有选择
    selectedId: !on && state.selectedId === id ? null : state.selectedId,
  });
}

/**
 * 合并两批模型（按 id 去重），用于「拉取勾选」与「手动新增」的合并去重：
 * 以 id/label 为主键，后出现的覆盖同主键（拉取项可补全手输项的 label），保序、去重、不覆盖手输已加项。
 */
function mergeModelLists(
  existing: RawModel[] | undefined,
  incoming: RawModel[] | undefined,
): RawModel[] {
  const map = new Map<string, RawModel>();
  for (const m of existing || []) {
    const k = (m?.id ?? m?.label) || '';
    if (!k) continue;
    map.set(k, m);
  }
  for (const m of incoming || []) {
    const k = (m?.id ?? m?.label) || '';
    if (!k) continue;
    map.set(k, { ...m, id: m?.id || k });
  }
  return Array.from(map.values());
}

/** 给某厂商某能力（image_models/chat_models/video_models）新增一个模型（用户配置层；同 id 去重不重复加）。 */
export function addModel(
  providerId: string,
  cap: 'image_models' | 'chat_models' | 'video_models',
  model: RawModel,
): void {
  setState({
    providers: state.providers.map((p) =>
      p.id === providerId ? { ...p, [cap]: mergeModelLists(p[cap], [model]) } : p,
    ),
    dirty: true,
  });
}

/** 从某厂商某能力移除指定模型 id。 */
export function removeModel(
  providerId: string,
  cap: 'image_models' | 'chat_models' | 'video_models',
  modelId: string,
): void {
  setState({
    providers: state.providers.map((p) =>
      p.id === providerId
        ? { ...p, [cap]: (p[cap] || []).filter((m) => (m?.id ?? '') !== modelId) }
        : p,
    ),
    dirty: true,
  });
}

export function setPrimary(id: string): void {
  setState({
    providers: state.providers.map((p) => ({ ...p, primary: p.id === id })),
    dirty: true,
  });
}

/** 更新某厂商的单个字段（用户配置层，如 base_url/协议等），标记 dirty，save() 写回后端。 */
export function updateProviderField(id: string, field: string, value: unknown): void {
  setState({
    providers: state.providers.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
    dirty: true,
  });
}

export async function test(id: string): Promise<void> {
  const p = state.providers.find((x) => x.id === id);
  if (!p) return;
  setState({ testingId: id, testResult: null });
  try {
    const key = p._apiKey && p._apiKey.trim() ? p._apiKey.trim() : undefined;
    const payload = { id: p.id, base_url: p.base_url, key, protocol: p.protocol };
    // 1) 通用连通性探测（含 GET 健康/模型端点，失败时透传上游原始 body）。
    //    后端返回 {code,data:{ok,...}}：先解包 data 再读 ok（信封错位会导致 ok=undefined → 误判失败）。
    const raw = (await providerApi.testConnection(payload)) as {
      code?: number;
      data?: Record<string, unknown>;
    };
    let data = (raw?.data && typeof raw.data === 'object' ? raw.data : raw) as Record<
      string,
      unknown
    >;
    // 2) apimart 异步协议：额外用假 task_id 嗅探异步端点，能区分
    //    「key 无效(401/403) / 非 apimart(404) / 端点存在(400+invalid task id)」。
    //    若通用探测已成功则跳过，避免无谓请求；失败时用异步嗅探结果补全诊断。
    if (p.protocol === 'apimart' && !data?.ok) {
      try {
        const rawProbe = (await providerApi.probeAsync(payload)) as {
          code?: number;
          data?: Record<string, unknown>;
        };
        const probe = (
          rawProbe?.data && typeof rawProbe.data === 'object' ? rawProbe.data : rawProbe
        ) as Record<string, unknown>;
        // 优先展示异步嗅探的更精确原始信息；status 若为 0 则回填
        data = probe.ok ? { ...data, ...probe, ok: true } : { ...data, ...probe, ok: false };
      } catch {
        // probe-async 本身失败时保留 test-connection 的原始信息
      }
    }
    setState({ testResult: data });
  } catch (e) {
    setState({ testResult: { ok: false, error: e.message } });
  } finally {
    setState({ testingId: null });
  }
}

export async function fetchModels(
  id: string,
): Promise<{ ok: boolean; pending?: boolean; total?: number; warning?: string; error?: string }> {
  const p = state.providers.find((x) => x.id === id);
  if (!p) return { ok: false };
  setState({ fetchingId: id });
  try {
    const data = await providerApi.fetchModels(id);
    const m = data?.data;
    if (
      Array.isArray(m.image_models) &&
      Array.isArray(m.chat_models) &&
      Array.isArray(m.video_models)
    ) {
      // 不直接全量写入：把拉取结果暂存，由 UI 弹窗让用户勾选后再 apply。
      setState({
        fetchedModels: {
          id,
          image_models: toRawModelList(m.image_models, []),
          chat_models: toRawModelList(m.chat_models, []),
          video_models: toRawModelList(m.video_models, []),
          warning: m.warning,
        },
      });
      return {
        ok: true,
        pending: true,
        total: m.image_models.length + m.chat_models.length + m.video_models.length,
        warning: m.warning,
      };
    }
    return { ok: false, warning: m.warning };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    setState({ fetchingId: null });
  }
}

/** 用户弹窗勾选后，把选定模型写入 provider（合并已有 + 勾选的新拉项）。 */
export function applyFetchedModels(
  id: string,
  selected: {
    image_models?: RawModel[];
    chat_models?: RawModel[];
    video_models?: RawModel[];
  } | null,
): void {
  const p = state.providers.find((x) => x.id === id);
  if (!p || !selected) return;
  setState({
    providers: state.providers.map((x) =>
      x.id === id
        ? {
            ...x,
            // 拉取勾选 → 与已有（手输/先前的）模型【合并去重】，不覆盖手输新增项
            image_models: mergeModelLists(x.image_models, selected.image_models),
            chat_models: mergeModelLists(x.chat_models, selected.chat_models),
            video_models: mergeModelLists(x.video_models, selected.video_models),
          }
        : x,
    ),
    dirty: true,
    fetchedModels: null,
  });
}

/** 关闭拉取弹窗（取消，不写入）。 */
export function closeFetchedModels(): void {
  setState({ fetchedModels: null });
}

export async function save(): Promise<{ ok: boolean; error?: string }> {
  setState({ saving: true });
  try {
    // 【新时代配置型】payload = 整组 provider 透传（保留模型/平台专属参数/协议字段），仅剥离
    // key 通道（_apiKey/_clearKey/api_key → 后端已从 config 剔除，key 只进 .env）。前端不重造白名单，
    // 避免重写 config 时丢失后端返回的扩展字段；配置型下无编辑入口（_apiKey 恒定为空）。
    const payload = state.providers.map((p) => {
      const cleaned: Record<string, unknown> = { ...p };
      delete cleaned._apiKey;
      delete cleaned._clearKey;
      delete cleaned.api_key;
      return cleaned;
    });
    const data = await providerApi.saveProviders(payload);
    const savedProviders = Array.isArray(data?.data?.providers)
      ? data.data.providers.map(normalizeProvider)
      : state.providers;
    setState({ providers: savedProviders, dirty: false });
    // 方案A：把保存后的结果回写 api.config.json，消除双源漂移。
    // 回写是辅助动作，失败不影响主保存（避免 json 写失败导致保存报错）。
    providerApi
      .syncConfigBase(savedProviders || payload)
      .then(() => setState({ configSynced: true }))
      .catch((e) => setState({ configSyncError: e.message }));
    // 对齐官方 active_api_endpoint（KV）：把主供应商写入 localTool KV，供跨端读取当前生效 endpoint
    const primary = savedProviders.find((p) => p.primary) || savedProviders[0];
    if (primary) {
      contentSetAsync('active_api_endpoint', {
        providerId: primary.id,
        name: primary.name,
        base_url: primary.base_url,
        protocol: primary.protocol,
        updatedAt: Date.now(),
      }).catch((e) =>
        logger.warn('provider', 'endpoint-persist-fail', {
          providerId: primary.id,
          error: e?.message,
        }),
      );
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    setState({ saving: false });
  }
}
