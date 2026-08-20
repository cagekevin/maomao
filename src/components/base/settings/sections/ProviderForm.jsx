import React from 'react'
import { Trash2, Eye, EyeOff, KeyRound, RefreshCw, CircleDot, Check, AlertCircle, Star } from 'lucide-react'
import ModelSection from './ModelSection.jsx'
import { PROVIDER_PROTOCOLS, PROVIDER_PROTOCOL_LABELS, CLI_PROTOCOLS } from '../../providerProtocols.js'

/**
 * 供应商编辑面板（ApiSettings 右侧主内容，样式对齐 SkillSettings 的 zinc 黑白系）。
 * 正规后台风格：连接配置 / 密钥认证 / 连接测试 / 模型清单 四分区 + 底部操作条。
 * 逻辑不变，仅样式统一到 Skill 面板风格。
 *
 * ⚠️⚠️⚠️ 字段防护（历史踩坑，禁止删）⚠️⚠️⚠️
 * 连接配置区的「协议」「图片请求形态」「生图请求方式」这三个字段，每个都对应一个
 * provider 契约字段，后端 localTool 和 apimart-gateway 会真实读取它们做协议分派。
 * 任何字段看似「当前没用到」都只是某个平台/模式暂时没激活，不代表后端不需要——
 * 一旦删掉，配别的平台时后端就不知道用哪种协议发请求。
 *
 * 协议下拉由 providerProtocols.js 的 PROVIDER_PROTOCOLS 单源驱动（M5-1），
 * 加协议只需改后端 protocolAdapters.ts + 前端 providerProtocols.js，两处注册即可。
 */
// 远程 HTTP 类：需 base_url + key + 请求形态；CLI 类无 base_url/key（本机登录态）
const isHttpProtocol = (protocol) => !CLI_PROTOCOLS.includes(protocol)
// 图片请求形态白名单：对应后端 SUPPORTED_IMAGE_REQUEST_MODES（4 选 1），禁止删
const REQUEST_MODES = ['openai', 'openai-json', 'openai-video-proxy', 'openai-responses']
const inputCls = 'w-full bg-canvas border border-edge rounded-xl px-3 py-2 text-sm text-zinc-200 focus:border-blue-500 focus:outline-none transition-colors placeholder:text-zinc-600 disabled:opacity-50'
const selectCls = 'bg-canvas border border-edge text-zinc-300 text-sm px-3 py-2 rounded-xl outline-none focus:border-blue-500 transition-colors disabled:opacity-50'

function Section({ title, desc, children }) {
  return (
    <section className="bg-surface border border-edge-subtle rounded-xl overflow-hidden">
      <div className="px-6 py-3.5 border-b border-edge-subtle flex items-baseline justify-between">
        <h3 className="text-sm text-zinc-200">{title}</h3>
        {desc && <p className="text-xs text-zinc-500">{desc}</p>}
      </div>
      <div className="px-6 py-4">{children}</div>
    </section>
  )
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="block text-xs text-zinc-400 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-zinc-600 mt-1">{hint}</span>}
    </label>
  )
}

/**
 * 魔搭 ModelScope 专属 Lora 编辑面板（M5-2）。
 * 由 provider id === 'modelscope' 触发，配置写在 ms_loras（后端 normalizeMsLoras 已逐项归一）。
 * 每项：id / name / target_model / strength(0-2) / enabled。空 id 项新增行。
 */
function ModelscopeLoraSection({ p, onUpdate }) {
  const list = Array.isArray(p.ms_loras) ? p.ms_loras : []
  const patchLora = (i, patch) =>
    onUpdate({ ms_loras: list.map((x, j) => (j === i ? { ...x, ...patch } : x)) })
  const setStrength = (i, v) => {
    let n = Number(v)
    if (Number.isNaN(n)) n = 1
    patchLora(i, { strength: Math.min(2, Math.max(0, n)) })
  }
  return (
    <Section title="Lora 编辑" desc="魔搭模型微调 LoRA 参数（strength 0~2）">
      <div className="flex flex-col gap-2">
        {list.length === 0 && (
          <div className="text-xs text-zinc-600 px-3 py-2 bg-canvas border border-dashed border-edge rounded-xl">暂无 LoRA，点击「添加 LoRA」</div>
        )}
        {list.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_1fr_64px_56px_auto] gap-2 items-center bg-canvas border border-edge rounded-xl px-3 py-2 text-xs">
            <input value={l.target_model || ''} onChange={(e) => patchLora(i, { target_model: e.target.value })} className="bg-transparent outline-none placeholder:text-zinc-600 text-zinc-200" placeholder="目标模型" />
            <input value={l.name || ''} onChange={(e) => patchLora(i, { name: e.target.value })} className="bg-transparent outline-none placeholder:text-zinc-600 text-zinc-200" placeholder="名称" />
            <input value={l.id || ''} onChange={(e) => patchLora(i, { id: e.target.value })} className="bg-transparent outline-none placeholder:text-zinc-600 text-zinc-200" placeholder="LoRA id" />
            <input type="number" min="0" max="2" step="0.1" value={l.strength} onChange={(e) => setStrength(i, e.target.value)} className="bg-transparent outline-none text-right text-zinc-200 w-full" />
            <label className="flex items-center justify-center gap-1 text-zinc-500 cursor-pointer">
              <input type="checkbox" checked={l.enabled !== false} onChange={(e) => patchLora(i, { enabled: e.target.checked })} className="accent-blue-500" />
              <span className="text-[10px]">启用</span>
            </label>
            <button type="button" onClick={() => onUpdate({ ms_loras: list.filter((_, j) => j !== i) })} className="text-zinc-600 hover:text-red-500 border-none bg-transparent cursor-pointer p-1" title="删除 LoRA">
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => onUpdate({ ms_loras: [...list, { id: '', name: '', target_model: '', strength: 1, enabled: true, note: '' }] })} className="self-start inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white hover:bg-surface-hover px-2 py-1 rounded-md transition-colors cursor-pointer border-none bg-transparent">
          添加 LoRA
        </button>
      </div>
    </Section>
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
            <input value={p.name || ''} onChange={(e) => onUpdate({ name: e.target.value })} disabled={false} className={inputCls} placeholder="如：Lovart" />
          </Field>
          <Field label="协议">
            <select value={p.protocol} onChange={(e) => onUpdate({ protocol: e.target.value })} disabled={false} className={selectCls}>
              {PROVIDER_PROTOCOLS.map((v) => <option key={v} value={v}>{PROVIDER_PROTOCOL_LABELS[v] || v}</option>)}
            </select>
          </Field>
          {isHttpProtocol(p.protocol) ? (
            <Field label="请求地址" hint="OpenAI 兼容端点或 localTool 网关">
              <input value={p.base_url || ''} onChange={(e) => onUpdate({ base_url: e.target.value })} disabled={false} className={inputCls} placeholder="https://api.example.com 或 http://127.0.0.1:9004" />
            </Field>
          ) : (
            <Field label="请求地址" hint="CLI 本地协议：使用本机登录态，无需填写地址">
              <input value={p.base_url || ''} onChange={(e) => onUpdate({ base_url: e.target.value })} disabled className={`${inputCls} opacity-60`} placeholder="CLI 协议无需请求地址" />
            </Field>
          )}
          {p.protocol === 'volcengine' && (
            <Field label="平台信息" hint="火山方舟独立部署参数">
              <div className="grid grid-cols-2 gap-2">
                <input value={p.volcengine_project_name || ''} onChange={(e) => onUpdate({ volcengine_project_name: e.target.value })} className={inputCls} placeholder="project_name（默认 default）" />
                <input value={p.volcengine_region || ''} onChange={(e) => onUpdate({ volcengine_region: e.target.value })} className={inputCls} placeholder="region（默认 cn-beijing）" />
              </div>
            </Field>
          )}
          {isHttpProtocol(p.protocol) && (
            <>
              <Field label="图片请求形态">
                <select value={p.image_request_mode || 'openai'} onChange={(e) => onUpdate({ image_request_mode: e.target.value })} disabled={false} className={selectCls}>
                  {REQUEST_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
              <Field label="生图请求方式" hint="同步=等待结果返回；异步=先提交再轮询结果">
                <select value={p.image_mode === 'async' ? 'async' : 'sync'} onChange={(e) => onUpdate({ image_mode: e.target.value })} disabled={false} className={selectCls}>
                  <option value="sync">同步（等待结果）</option>
                  <option value="async">异步（轮询任务）</option>
                </select>
              </Field>
              <Field label="聊天请求形态" hint="gpt-5.6 等需选 responses 才能用工具调用">
                <select value={p.chat_request_mode || 'chat'} onChange={(e) => onUpdate({ chat_request_mode: e.target.value })} disabled={false} className={selectCls}>
                  <option value="chat">chat/completions（默认）</option>
                  <option value="responses">responses</option>
                </select>
              </Field>
            </>
          )}
        </div>
      </Section>

      {isHttpProtocol(p.protocol) && (
        <Section title="密钥与认证" desc="Key 仅存 localTool .env，不回显明文">
          <div className="flex items-center gap-2 max-w-xl">
            <div className="relative flex-1">
              <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input type={showKey ? 'text' : 'password'} value={keyValue} onChange={handleKeyChange} disabled={false} placeholder={hasSavedKey ? '已保存（输入新值覆盖）' : 'sk-...'} className={`${inputCls} pl-9`} />
            </div>
            <button type="button" onClick={() => setShowKey((v) => !v)} className="p-2.5 text-zinc-400 hover:text-white hover:bg-surface-hover rounded-xl transition-colors cursor-pointer border-none bg-transparent" title={showKey ? '隐藏' : '显示'}>
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            {hasSavedKey && (
              <button type="button" onClick={handleClearKey} className="p-2.5 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer border-none bg-transparent" title="清除 Key">
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </Section>
      )}

      {p.id === 'modelscope' && <ModelscopeLoraSection p={p} onUpdate={onUpdate} />}

      <Section title="连接测试" desc="验证连通性 / 拉取远端模型">
        <div className="flex items-center gap-3 flex-wrap">
          <button type="button" onClick={onTest} disabled={testing} className="inline-flex items-center gap-2 px-4 h-9 text-xs rounded-xl bg-surface-1 text-zinc-300 hover:bg-surface-hover hover:text-blue-400 transition-colors cursor-pointer border-none disabled:opacity-50">
            <RefreshCw size={14} className={testing ? 'animate-spin' : ''} /> {testing ? '测试中…' : '测试连接'}
          </button>
          <button type="button" onClick={onFetchModels} disabled={fetching} className="inline-flex items-center gap-2 px-4 h-9 text-xs rounded-xl bg-surface-1 text-zinc-300 hover:bg-surface-hover hover:text-blue-400 transition-colors cursor-pointer border-none disabled:opacity-50">
            <CircleDot size={14} className={fetching ? 'animate-spin' : ''} /> {fetching ? '拉取中…' : '拉取模型'}
          </button>
          {testResult && (
            <div className={`flex flex-col gap-1 text-xs px-3 py-2 rounded-xl ${testResult.ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
              <div className="flex items-center gap-2">
                {testResult.ok ? <Check size={14} /> : <AlertCircle size={14} />}
                {testResult.ok ? `连接成功（${testResult.detectedProtocol || testResult.protocol || ''} · ${testResult.status ?? ''}${testResult.stage ? ' · ' + testResult.stage : ''}）` : `连接失败：${testResult.error || testResult.status || '未知'}`}
              </div>
              {testResult.detail && (
                <div className="text-[11px] opacity-80 pl-6 break-all whitespace-pre-wrap">{testResult.detail}</div>
              )}
            </div>
          )}
        </div>
      </Section>

      <ModelSection p={p} onUpdate={onUpdate} />

      <div className="flex items-center gap-2 flex-wrap bg-surface border border-edge-subtle rounded-xl px-6 py-4">
        {!p.primary && (
          <button type="button" onClick={onSetPrimary} className="inline-flex items-center gap-2 px-4 h-9 text-xs rounded-xl text-yellow-300 hover:bg-yellow-500/10 border border-yellow-500/40 transition-colors cursor-pointer">
            <Star size={14} /> 设为主供应商
          </button>
        )}
        {p.primary && (
          <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400"><Star size={14} className="fill-zinc-400" /> 当前主供应商</span>
        )}
        {readonly ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500 ml-auto bg-surface-1 px-2 py-1 rounded-xl">内置平台，仅可改配置不可删除</span>
        ) : (
          <button type="button" onClick={onRemove} className="inline-flex items-center gap-2 px-4 h-9 text-xs rounded-xl ml-auto text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer border-none bg-transparent">
            <Trash2 size={14} /> 删除此配置
          </button>
        )}
      </div>
    </div>
  )
}
