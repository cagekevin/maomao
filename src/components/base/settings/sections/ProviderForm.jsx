import React from 'react'
import { Trash2, Eye, EyeOff, KeyRound, RefreshCw, CircleDot, Check, AlertCircle, Star } from 'lucide-react'
import ModelSection from './ModelSection.jsx'

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
 */
const PROTOCOLS = [
  { value: 'apimart', label: 'apimart（Lovart 网关）' },
  { value: 'openai', label: 'OpenAI 兼容' },
]
// 远程 HTTP 类：需 base_url + key + 请求形态；CLI 类（未来）无 base_url/key
const HTTP_PROTOCOLS = ['apimart', 'openai']
const CLI_PROTOCOLS = []
const isHttpProtocol = (protocol) => HTTP_PROTOCOLS.includes(protocol)
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
              {PROTOCOLS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          {isHttpProtocol(p.protocol) && (
            <Field label="请求地址" hint="OpenAI 兼容端点或 localTool 网关">
              <input value={p.base_url || ''} onChange={(e) => onUpdate({ base_url: e.target.value })} disabled={false} className={inputCls} placeholder="https://api.example.com 或 http://127.0.0.1:9004" />
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
        <button type="button" onClick={onRemove} className="inline-flex items-center gap-2 px-4 h-9 text-xs rounded-xl ml-auto text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer border-none bg-transparent">
          <Trash2 size={14} /> 删除此配置
        </button>
      </div>
    </div>
  )
}
