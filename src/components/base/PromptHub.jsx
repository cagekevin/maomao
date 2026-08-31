import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  X, Search, ChevronLeft, ImageOff, RefreshCw,
} from 'lucide-react'
import {
  getCachedPromptHub, loadPromptHub, getPromptHubErrors, getPromptHubSources,
} from './promptHubStore.ts'
import { toastWarning } from './toastStore.ts'
import LazyImage from './LazyImage.tsx'
import { createImeInput } from './utils.ts'

const fmtDate = (s) => {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const getSrc = (it) => {
  if (it.coverUrl) return it.coverUrl
  if (Array.isArray(it.referenceImageUrls) && it.referenceImageUrls[0]) return it.referenceImageUrls[0]
  return ''
}
const getName = (it) => it.title || it.name || '未命名'

const getSources = () => ['all', ...getPromptHubSources().map((s) => s.name)]

const HubCard = React.memo(function HubCard({ it, onOpen }) {
  const src = getSrc(it)
  return (
    <div
      className="group relative rounded-lg overflow-hidden border border-edge-subtle bg-surface-1 hover:border-blue-500 cursor-pointer transition-colors"
      style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 220px' }}
      onClick={() => onOpen(it)}
    >
      <div className="relative aspect-[4/3] bg-surface-2">
        <LazyImage src={src} alt={getName(it)} className="w-full h-full" />
        {it.category && (
          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-caption-sm text-white backdrop-blur-sm max-w-[80%] truncate">
            {it.category}
          </span>
        )}
      </div>
      <div className="p-2">
        <div className="text-body-sm font-medium truncate" title={getName(it)}>
          {getName(it)}
        </div>
        {it.category && (
          <div className="text-caption-sm text-muted mt-0.5 truncate">{it.category}</div>
        )}
      </div>
    </div>
  )
})

const DetailRow = React.memo(function DetailRow({ label, children }) {
  return (
    <div className="flex gap-2 text-meta">
      <span className="text-muted w-12 shrink-0">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
})

const HubDetail = React.memo(function HubDetail({ it, onClose }) {
  const refs = Array.isArray(it.referenceImageUrls) ? it.referenceImageUrls : []
  return (
    <div className="absolute inset-0 z-20 bg-input flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-edge-subtle shrink-0">
        <span className="text-body font-medium truncate pr-2" title={getName(it)}>
          {getName(it)}
        </span>
        <button onClick={onClose} className="p-1 rounded hover:bg-surface-faint" title="返回">
          <ChevronLeft size={18} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div className="aspect-[4/3] rounded-lg overflow-hidden bg-surface-2">
          <LazyImage src={getSrc(it)} alt={getName(it)} className="w-full h-full" />
        </div>

        {refs.length > 0 && (
          <div>
            <div className="text-meta text-muted mb-1">参考图</div>
            <div className="grid grid-cols-4 gap-1.5">
              {refs.map((r, i) => (
                <div key={i} className="aspect-square rounded overflow-hidden bg-surface-2">
                  <LazyImage src={r} alt={`ref-${i}`} className="w-full h-full" />
                </div>
              ))}
            </div>
          </div>
        )}

        {it.preview && (
          <div>
            <div className="text-meta text-muted mb-1">预览</div>
            <pre className="text-caption-sm bg-surface-2 rounded-md p-2 overflow-x-auto whitespace-pre-wrap break-words">
              {it.preview}
            </pre>
          </div>
        )}

        <DetailRow label="来源">
          <span>{it.category || '—'}</span>
          {it.sourceUrl ? (
            <a className="text-muted hover:text-blue-400 ml-1" href={it.sourceUrl} target="_blank" rel="noreferrer">↗</a>
          ) : null}
        </DetailRow>
        <DetailRow label="创建">{fmtDate(it.createdAt)}</DetailRow>
        <DetailRow label="更新">{fmtDate(it.updatedAt)}</DetailRow>

        {it.description && (
          <div>
            <div className="text-meta text-muted mb-1">描述</div>
            <p className="text-body-sm whitespace-pre-wrap break-words">{it.description}</p>
          </div>
        )}

        {Array.isArray(it.tags) && it.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {it.tags.map((t, i) => (
              <span key={i} className="px-1.5 py-0.5 rounded bg-surface-2 text-caption-sm">
                {t}
              </span>
            ))}
          </div>
        )}

        {it.prompt && (
          <div>
            <div className="text-meta text-muted mb-1">提示词</div>
            <pre className="text-caption-sm bg-surface-2 rounded-md p-2 overflow-x-auto whitespace-pre-wrap break-words">
              {it.prompt}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
})

const HubLoading = React.memo(function HubLoading() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted">
      <RefreshCw size={22} className="animate-spin" />
      <span className="text-body-sm">加载中…</span>
    </div>
  )
})

const HubEmpty = React.memo(function HubEmpty({ keyword, source }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted px-6 text-center">
      <ImageOff size={28} />
      <span className="text-body-sm">
        {keyword || source !== 'all' ? '没有找到匹配的提示词' : '暂无提示词'}
      </span>
      <span className="text-caption-sm">换个关键词或来源试试</span>
    </div>
  )
})

function PromptHub() {
  const [items, setItems] = useState([])
  const [status, setStatus] = useState('idle') // idle | loading | ready | error
  const [error, setError] = useState('')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [keyword, setKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [openId, setOpenId] = useState(null)

  const sources = useMemo(() => getSources(), [])
  const [expanded, setExpanded] = useState(false)
  const warnedRef = useRef(false)

  // P2/P12：搜索输入防抖 + IME 门控（替代原手写 setTimeout；组字中不触发过滤，组字结束补提交一次）
  const searchIme = useRef(null)
  if (searchIme.current == null) {
    searchIme.current = createImeInput((v) => setDebouncedKeyword(v), 200)
  }

  // 注：历史上曾用 visibleCount 做分页，已移除（列表全量渲染 filtered）。勿再引入 setVisibleCount 类未声明状态。
  // 首屏：先秒显缓存，再静默拉取最新
  useEffect(() => {
    const cached = getCachedPromptHub()
    if (cached.hasCache) {
      setItems(cached.items)
      setStatus('ready')
    } else {
      setStatus('loading')
    }
    let alive = true
    loadPromptHub()
      .then((res) => {
        if (!alive) return
        setItems(res.items)
        setStatus(res.items.length ? 'ready' : 'error')
        setError(res.items.length ? '' : '未加载到任何提示词')
        const errs = getPromptHubErrors()
        if (errs.length && !warnedRef.current) {
          warnedRef.current = true
          toastWarning(`${errs.length} 个源加载失败，其余正常显示`)
        }
      })
      .catch((err) => {
        if (!alive) return
        setStatus('error')
        setError(err instanceof Error ? err.message : String(err))
      })
    return () => { alive = false }
  }, [])

  const retry = useCallback(() => {
    setStatus('loading')
    setError('')
    loadPromptHub()
      .then((res) => {
        setItems(res.items)
        setStatus(res.items.length ? 'ready' : 'error')
        setError(res.items.length ? '' : '未加载到任何提示词')
        const errs = getPromptHubErrors()
        if (errs.length && !warnedRef.current) {
          warnedRef.current = true
          toastWarning(`${errs.length} 个源加载失败，其余正常显示`)
        }
      })
      .catch((err) => {
        setStatus('error')
        setError(err instanceof Error ? err.message : String(err))
      })
  }, [])

  const filtered = useMemo(() => {
    const kw = (debouncedKeyword || '').trim().toLowerCase()
    return items.filter((it) => {
      if (sourceFilter !== 'all' && it.category !== sourceFilter) return false
      if (!kw) return true
      const hay = `${getName(it)} ${it.prompt || ''} ${it.description || ''} ${
        Array.isArray(it.tags) ? it.tags.join(' ') : ''
      }`.toLowerCase()
      return hay.includes(kw)
    })
  }, [items, sourceFilter, debouncedKeyword])

  const openItem = useMemo(() => items.find((it) => it.id === openId) || null, [items, openId])
  const handleOpen = useCallback((it) => setOpenId(it.id), [])

  return (
    <div className="relative flex flex-col h-full w-full bg-input text-primary">
      {/* 来源筛选（横向，适配窄面板，可折叠） */}
      <div className="px-3 pt-2 pb-1 shrink-0">
        <div className="flex flex-wrap gap-1 items-center">
          {(expanded ? sources : sources.slice(0, 3)).map((s) => (
            <button
              key={s}
              onClick={() => setSourceFilter(s)}
              className={`px-2 py-1 rounded text-caption-sm transition-colors border ${
                sourceFilter === s
                  ? 'bg-blue-500/15 border-blue-500/40 text-blue-400'
                  : 'border-edge-subtle text-muted hover:bg-surface-faint'
              }`}
            >
              {s === 'all' ? '全部' : s}
            </button>
          ))}
          {sources.length > 3 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="px-2 py-1 rounded text-caption-sm border border-edge-subtle text-muted hover:bg-surface-faint"
            >
              {expanded ? '收起' : '更多'}
            </button>
          )}
        </div>
      </div>

      {/* 搜索 + 统计 */}
      <div className="px-3 py-2 border-b border-edge-subtle space-y-2 shrink-0">
        <div className="relative">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value)
              searchIme.current?.onChange(e.target.value, e.nativeEvent.isComposing)
            }}
            onCompositionEnd={(e) => searchIme.current?.onCompositionEnd(e.target.value)}
            onBlur={() => searchIme.current?.cancel()}
            placeholder="搜索提示词…"
            className="w-full pl-8 pr-2 py-1.5 rounded bg-surface-2 text-body-sm outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="text-caption-sm text-muted">
          {status === 'loading' ? '加载中…' : `共 ${filtered.length} 条提示词`}
        </div>
      </div>

      {status === 'loading' ? (
        <HubLoading />
      ) : filtered.length === 0 ? (
        <HubEmpty keyword={keyword} source={sourceFilter} />
      ) : (
        <div
          className="flex-1 overflow-y-auto p-3"
        >
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((it) => (
              <HubCard key={it.id} it={it} onOpen={handleOpen} />
            ))}
          </div>
        </div>
      )}

      {openItem && (
        <HubDetail
          it={openItem}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  )
}

export default React.memo(PromptHub)
