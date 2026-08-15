import React from 'react'
import { Trash2, Eye, EyeOff, KeyRound, RefreshCw, CircleDot, Check, AlertCircle, Star } from 'lucide-react'
import ModelSection from './ModelSection.jsx'

/**
 * 供应商编辑面板（ApiSettings 右侧主内容）。
 * 正规后台风格：连接配置 / 密钥认证 / 连接测试 / 模型清单 四分区 + 底部操作条。
 * 功能完整：协议/请求形态/Key/测试/拉取模型/模型三栏增删改/设主/删除。
 *
 * ⚠️⚠️⚠️ 字段防护（历史踩坑，禁止删）⚠️⚠️⚠️
 * 连接配置区的「协议」「图片请求形态」「生图请求方式」这三个字段，每个都对应一个
 * provider 契约字段，后端 localTool 和 apimart-gateway 会真实读取它们做协议分派。
 * 任何字段看似「当前没用到」都只是某个平台/模式暂时没激活，不代表后端不需要——
 * 一旦删掉，配别的平台时后端就不知道用哪种协议发请求。
 *
 *  ┌────────────────┬──────────────┬────────────────────────────────────────────┐
 *  │  UI 字段        │  契约字段     │  用途 / 后端依赖                             │
 *  ├────────────────┼──────────────┼────────────────────────────────────────────┤
 *  │ 协议            │ protocol     │ 8 选 1 接口风格：openai/apimart/gemini/      │
 *  │                │              │ volcengine/runninghub/jimeng/codex…          │
 *  │                │              │ 后端 effective_protocol / resolveProviderTarget│
 *  ├────────────────┼──────────────┼────────────────────────────────────────────┤
 *  │ 图片请求形态     │ image_      │ 4 选 1（SUPPORTED_IMAGE_REQUEST_MODES）：     │
 *  │                │ request_mode │ openai / openai-json / openai-video-proxy /  │
 *  │                │              │ openai-responses。不同平台支持的请求格式不同， │
 *  │                │              │ 后端 generate_ai_image 按它决定发什么 body。   │
 *  │                │              │ 有的站会 detect_image_request_mode 自动嗅探     │
 *  │                │              │ （如 agnes→openai-json）。契约字段必填，不可删。│
 *  ├────────────────┼──────────────┼────────────────────────────────────────────┤
 *  │ 生图请求方式     │ image_mode   │ sync/async：前端 imageApi 据此决定生图走       │
 *  │（同步/异步）     │              │ SSE 等待(?wait=1) 还是 task_id 轮询。         │
 *  │                │              │ 本项目扩展字段（官方没有），localTool 透传。     │
 *  └────────────────┴──────────────┴────────────────────────────────────────────┘
 *
 * 参考契约文档：prototypes/react-nodes/api-接入/02-provider字段契约.md
 * 字段名对齐 localTool/src/routes/providers.ts 的 ApiProvider 接口。
 */
const PROTOCOLS = [
  { value: 'apimart', label: 'apimart（Lovart 网关）' },
  { value: 'openai', label: 'OpenAI 兼容' },
]
// ⚠️ 图片请求形态白名单：对应后端 SUPPORTED_IMAGE_REQUEST_MODES（4 选 1）。
// 后端 generate_ai_image 按 effective_image_request_mode 分派发什么 body；删任一选项，
// 配对应平台（如用 openai-json 的 agnes）时后端无法正确发请求。禁止删，见文件头契约表。
const REQUEST_MODES = ['openai', 'openai-json', 'openai-video-proxy', 'openai-responses']
const inputCls = 'w-full bg-canvas border border-edge rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none transition-colors placeholder-gray-600 disabled:opacity-50'
const selectCls = 'bg-canvas border border-edge text-gray-300 text-sm px-3 py-2 rounded-lg outline-none focus:border-blue-500 transition-colors disabled:opacity-50'

function Section({ title, desc, children }) {
  return (
    <section className="bg-surface border border-edge-subtle rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-edge-subtle flex items-baseline justify-between">
        <h3 className="text-sm text-gray-200">{title}</h3>
        {desc && <p className="text-xs text-gray-500">{desc}</p>}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="block text-xs text-gray-400 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-caption-sm text-gray-600 mt-1">{hint}</span>}
    </label>
  )
}

export default function ProviderForm({ p, testing, fetching, testResult, onUpdate, onSetPrimary, onRemove, onTest, onFetchModels }) {
  const [showKey, setShowKey] = React.useState(false)
  const readonly = !!p.readonly
  const hasSavedKey = !!p.has_key
  const preview = p.key_preview || (hasSavedKey ? '••••••••' : '')
  const keyValue = p._apiKey ?? (hasSavedKey ? preview : '')
  const handleKeyChange = (e) => {
    const v = e.target.value
    if (v && (v.includes('••') || v === preview)) return
    onUpdate({ _apiKey: v, _clearKey: false })
  }
  const handleClearKey = () => onUpdate({ _apiKey: '', _clearKey: true })

  return (
    <div className="flex flex-col gap-4">
      <Section title="连接配置" desc="基础连接参数">
        <div className="grid grid-cols-2 gap-4">
          <Field label="平台名称">
            {/* 平台名称是环境个性化字段，内置 provider 也可改（readonly 只锁核心结构字段） */}
            <input value={p.name || ''} onChange={(e) => onUpdate({ name: e.target.value })} disabled={false} className={inputCls} placeholder="如：Lovart" />
          </Field>
          {/* protocol：接口风格。后端 resolveProviderTarget / effective_protocol 按它分派。禁止删 */}
          <Field label="协议">
            <select value={p.protocol} onChange={(e) => onUpdate({ protocol: e.target.value })} disabled={false} className={selectCls}>
              {PROTOCOLS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="请求地址" hint="OpenAI 兼容端点或 localTool 网关">
            {/* base_url 是环境部署地址，内置 provider 也应始终可改（readonly 只锁核心结构字段） */}
            <input value={p.base_url || ''} onChange={(e) => onUpdate({ base_url: e.target.value })} disabled={false} className={inputCls} placeholder="https://api.example.com 或 http://127.0.0.1:9004" />
          </Field>
          {/* image_request_mode：图片请求形态（4 选 1），后端 generate_ai_image 据此发 body。
              不同平台支持的格式不同（agnes 会被嗅探成 openai-json）。契约必填字段，禁止删！ */}
          <Field label="图片请求形态">
            <select value={p.image_request_mode || 'openai'} onChange={(e) => onUpdate({ image_request_mode: e.target.value })} disabled={false} className={selectCls}>
              {REQUEST_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          {/* image_mode：生图同步/异步。前端 imageApi.js 据此决定走 SSE 等待还是 task_id 轮询。
             本项目扩展字段（官方没有），localTool 透传，与协议无关。禁止删 */}
          <Field label="生图请求方式" hint="同步=等待结果返回；异步=先提交再轮询结果">
            <select value={p.image_mode === 'async' ? 'async' : 'sync'} onChange={(e) => onUpdate({ image_mode: e.target.value })} disabled={false} className={selectCls}>
              <option value="sync">同步（等待结果）</option>
              <option value="async">异步（轮询任务）</option>
            </select>
          </Field>
        </div>
      </Section>

      <Section title="密钥与认证" desc="Key 仅存 localTool .env，不回显明文">
        <div className="flex items-center gap-2 max-w-xl">
          <div className="relative flex-1">
            <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
            {/* key 是每个用户独立的敏感信息(存 env)，即使内置 readonly provider 也应始终可填/改；readonly 只禁核心结构字段 */}
            <input type={showKey ? 'text' : 'password'} value={keyValue} onChange={handleKeyChange} disabled={false} placeholder={hasSavedKey ? '已保存（输入新值覆盖）' : 'sk-...'} className={`${inputCls} pl-9`} />
          </div>
          <button type="button" onClick={() => setShowKey((v) => !v)} className="p-2.5 text-gray-400 hover:text-white hover:bg-surface-hover rounded-lg transition-colors cursor-pointer border-none bg-transparent" title={showKey ? '隐藏' : '显示'}>
            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          {hasSavedKey && (
            <button type="button" onClick={handleClearKey} className="p-2.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer border-none bg-transparent" title="清除 Key">
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </Section>

      <Section title="连接测试" desc="验证连通性 / 拉取远端模型">
        <div className="flex items-center gap-3 flex-wrap">
          <button type="button" onClick={onTest} disabled={testing} className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-surface-1 text-gray-300 hover:bg-surface-hover hover:text-blue-400 transition-colors cursor-pointer border-none disabled:opacity-50">
            <RefreshCw size={14} className={testing ? 'animate-spin' : ''} /> {testing ? '测试中…' : '测试连接'}
          </button>
          <button type="button" onClick={onFetchModels} disabled={fetching} className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-surface-1 text-gray-300 hover:bg-surface-hover hover:text-blue-400 transition-colors cursor-pointer border-none disabled:opacity-50">
            <CircleDot size={14} className={fetching ? 'animate-spin' : ''} /> {fetching ? '拉取中…' : '拉取模型'}
          </button>
          {testResult && (
            <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${testResult.ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
              {testResult.ok ? <Check size={14} /> : <AlertCircle size={14} />}
              {testResult.ok ? `连接成功（${testResult.detectedProtocol || testResult.protocol || ''} · ${testResult.status ?? ''}）` : `连接失败：${testResult.error || testResult.status || '未知'}`}
            </div>
          )}
        </div>
      </Section>

      <ModelSection p={p} onUpdate={onUpdate} />

      <div className="flex items-center gap-2 flex-wrap bg-surface border border-edge-subtle rounded-xl px-5 py-4">
        {!p.isPrimary && (
          <button type="button" onClick={onSetPrimary} className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg text-yellow-300 hover:bg-yellow-500/10 border border-yellow-500/40 transition-colors cursor-pointer">
            <Star size={14} /> 设为主供应商
          </button>
        )}
        {p.isPrimary && (
          <span className="inline-flex items-center gap-1.5 text-sm text-gray-400"><Star size={14} className="fill-gray-400" /> 当前主供应商</span>
        )}
        <button type="button" onClick={onRemove} className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg ml-auto text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer border-none bg-transparent">
          <Trash2 size={14} /> 删除此配置
        </button>
      </div>
    </div>
  )
}
