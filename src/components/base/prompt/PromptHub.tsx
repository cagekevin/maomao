import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ImageOff, RefreshCw } from 'lucide-react';
import {
  getCachedPromptHub,
  loadPromptHub,
  getPromptHubErrors,
  getPromptHubSources,
} from './promptHubStore.ts';
import type { Prompt } from './promptHubStore.ts';
import { toastWarning } from '../core/toastStore.ts';
import LazyImage from '../ui/LazyImage.tsx';
import { PanelSubBar, PanelPills, PanelListFoot } from '../panels/PanelBar.tsx';

const fmtDate = (s: string): string => {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const getSrc = (it: Prompt): string => {
  if (it.coverUrl) return it.coverUrl;
  if (Array.isArray(it.referenceImageUrls) && it.referenceImageUrls[0])
    return it.referenceImageUrls[0];
  return '';
};
// 注：原名 `it.title || it.name || '未命名'` 中 `it.name` 恒为 undefined ——
// normalizeItems 是白名单构造（不拷贝 name），且空 title 已在入库前被过滤，故安全去除该回退。
const getName = (it: Prompt): string => it.title || '未命名';

const getSources = (): string[] => ['all', ...getPromptHubSources().map((s) => s.name)];

interface HubCardProps {
  it: Prompt;
  onOpen: (it: Prompt) => void;
}

const HubCard = React.memo(function HubCard({ it, onOpen }: HubCardProps) {
  const src = getSrc(it);
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
  );
});

interface DetailRowProps {
  label: string;
  children: React.ReactNode;
}

const DetailRow = React.memo(function DetailRow({ label, children }: DetailRowProps) {
  return (
    <div className="flex gap-2 text-meta">
      <span className="text-muted w-12 shrink-0">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
});

interface HubDetailProps {
  it: Prompt;
  onClose: () => void;
}

const HubDetail = React.memo(function HubDetail({ it, onClose }: HubDetailProps) {
  const refs = Array.isArray(it.referenceImageUrls) ? it.referenceImageUrls : [];
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
            <a
              className="text-muted hover:text-blue-400 ml-1"
              href={it.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              ↗
            </a>
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
  );
});

const HubLoading = React.memo(function HubLoading() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted">
      <RefreshCw size={22} className="animate-spin" />
      <span className="text-body-sm">加载中…</span>
    </div>
  );
});

interface HubEmptyProps {
  source: string;
}

const HubEmpty = React.memo(function HubEmpty({ source }: HubEmptyProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted px-6 text-center">
      <ImageOff size={28} />
      <span className="text-body-sm">
        {source !== 'all' ? '这个来源还没有提示词' : '暂无提示词'}
      </span>
      <span className="text-caption-sm">换个来源试试</span>
    </div>
  );
});

type HubStatus = 'idle' | 'loading' | 'ready' | 'error';

function PromptHub() {
  const [items, setItems] = useState<Prompt[]>([]);
  const [status, setStatus] = useState<HubStatus>('idle');
  const [_error, setError] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const sources = useMemo(() => getSources(), []);
  const warnedRef = useRef(false);

  // 注：历史上曾用 visibleCount 做分页，已移除（列表全量渲染 filtered）。勿再引入 setVisibleCount 类未声明状态。
  // 首屏：先秒显缓存，再静默拉取最新
  useEffect(() => {
    const cached = getCachedPromptHub();
    if (cached.hasCache) {
      setItems(cached.items);
      setStatus('ready');
    } else {
      setStatus('loading');
    }
    let alive = true;
    loadPromptHub()
      .then((res) => {
        if (!alive) return;
        setItems(res.items);
        setStatus(res.items.length ? 'ready' : 'error');
        setError(res.items.length ? '' : '未加载到任何提示词');
        const errs = getPromptHubErrors();
        if (errs.length && !warnedRef.current) {
          warnedRef.current = true;
          toastWarning(`${errs.length} 个源加载失败，其余正常显示`);
        }
      })
      .catch((err) => {
        if (!alive) return;
        setStatus('error');
        setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      alive = false;
    };
  }, []);

  useCallback(() => {
    setStatus('loading');
    setError('');
    loadPromptHub()
      .then((res) => {
        setItems(res.items);
        setStatus(res.items.length ? 'ready' : 'error');
        setError(res.items.length ? '' : '未加载到任何提示词');
        const errs = getPromptHubErrors();
        if (errs.length && !warnedRef.current) {
          warnedRef.current = true;
          toastWarning(`${errs.length} 个源加载失败，其余正常显示`);
        }
      })
      .catch((err) => {
        setStatus('error');
        setError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (sourceFilter !== 'all' && it.category !== sourceFilter) return false;
      return true;
    });
  }, [items, sourceFilter]);

  const openItem = useMemo(() => items.find((it) => it.id === openId) || null, [items, openId]);
  const handleOpen = useCallback((it: Prompt) => setOpenId(it.id), []);

  return (
    <div className="relative flex flex-col h-full w-full bg-input text-primary">
      {/* 副工具条：来源 pill（可横滚，无搜索 —— 按用户裁定去掉） */}
      <PanelSubBar>
        <PanelPills
          items={sources.map((s) => ({ key: s, label: s === 'all' ? '全部' : s }))}
          value={sourceFilter}
          onChange={setSourceFilter}
        />
      </PanelSubBar>

      {status === 'loading' ? (
        <HubLoading />
      ) : filtered.length === 0 ? (
        <HubEmpty source={sourceFilter} />
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-2 gap-3">
              {filtered.map((it) => (
                <HubCard key={it.id} it={it} onOpen={handleOpen} />
              ))}
            </div>
          </div>
          <PanelListFoot>{`共 ${filtered.length} 条提示词`}</PanelListFoot>
        </div>
      )}

      {openItem && <HubDetail it={openItem} onClose={() => setOpenId(null)} />}
    </div>
  );
}

export default React.memo(PromptHub);
