// ============================================================
// 一毛AI画布 - 资源库面板
// 功能：展示采集的素材、筛选、分页、拖入画布
// ============================================================
import { useState, useEffect, useCallback } from 'react';

export interface Resource {
  id: string;
  url: string;
  type: string;
  name: string;
  timestamp: number;
  folder?: string;
  isFavorite?: boolean;
  pageUrl?: string;
  pageTitle?: string;
  source?: string;
}

interface ResourcePanelProps {
  onSelectResource?: (resource: Resource) => void;
  onClose?: () => void;
  className?: string;
}

export default function ResourcePanel({
  onSelectResource,
  onClose,
  className = '',
}: ResourcePanelProps) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [filter, setFilter] = useState<'all' | 'favorite'>('all');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 16;

  // 从 chrome.storage.local 加载资源列表
  const loadResources = useCallback(async () => {
    setLoading(true);
    try {
      chrome.storage.local.get(['transitResources'], (result) => {
        const raw = result.transitResources;
        if (Array.isArray(raw)) {
          const items: Resource[] = raw.map((r: any) => ({
            id: r.id || Date.now().toString(),
            url: r.url || '',
            type: r.type || 'image',
            name: r.name || r.url?.split('/').pop() || '未知',
            timestamp: r.timestamp || Date.now(),
            pageUrl: r.pageUrl,
            pageTitle: r.pageTitle,
            source: r.source,
          }));
          setResources(items);
        } else {
          setResources([]);
        }
        setLoading(false);
      });
    } catch (e) {
      console.log('Failed to load resources:', e);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadResources();

    // 监听 background 推送的新资源
    const handler = (message: any) => {
      if (message.action === 'resourceAdded') {
        loadResources();
      }
    };
    if (chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(handler);
    }
    return () => {
      if (chrome.runtime?.onMessage) {
        chrome.runtime.onMessage.removeListener(handler);
      }
    };
  }, [loadResources]);

  // 过滤
  const filtered = resources.filter((r) => {
    if (filter === 'favorite' && !r.isFavorite) return false;
    return true;
  });

  // 按时间排序（最新的在前）
  filtered.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  // 分页
  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  // 判断是否为音频
  const isAudio = (url: string) => {
    return /\.(flac|mp3|wav|ogg|m4a|aac|opus|wma|aiff)(\?|$)/i.test(url);
  };

  // 获取媒体类型图标
  const getTypeIcon = (resource: Resource) => {
    const type = resource.type || '';
    if (type.startsWith('image') || /\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/i.test(resource.url)) {
      return '🖼️';
    }
    if (type.startsWith('video') || /\.(mp4|webm|mov|avi)(\?|$)/i.test(resource.url)) {
      return '🎬';
    }
    if (isAudio(resource.url)) {
      return '🎵';
    }
    return '📄';
  };

  return (
    <div
      className={`resource-panel ${className}`}
      style={{
        width: 280,
        background: '#1a1a2e',
        border: '1px solid #333',
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* 头部 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          borderBottom: '1px solid #333',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: '#e0e0e0' }}>
          📦 资源库
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => { setFilter('all'); setPage(1); }}
            style={{
              padding: '2px 8px', fontSize: 11,
              background: filter === 'all' ? '#333' : 'transparent',
              border: '1px solid #444', borderRadius: 4,
              color: filter === 'all' ? '#fff' : '#888',
              cursor: 'pointer',
            }}
          >
            全部
          </button>
          <button
            onClick={() => { setFilter('favorite'); setPage(1); }}
            style={{
              padding: '2px 8px', fontSize: 11,
              background: filter === 'favorite' ? '#333' : 'transparent',
              border: '1px solid #444', borderRadius: 4,
              color: filter === 'favorite' ? '#fff' : '#888',
              cursor: 'pointer',
            }}
          >
            ⭐ 收藏
          </button>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                padding: '2px 8px', fontSize: 11,
                background: 'transparent',
                border: '1px solid #444', borderRadius: 4,
                color: '#888', cursor: 'pointer',
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 刷新按钮 */}
      <div style={{ padding: '6px 12px', borderBottom: '1px solid #222' }}>
        <button
          onClick={loadResources}
          disabled={loading}
          style={{
            width: '100%', padding: '4px 0',
            background: '#222', border: '1px solid #444',
            borderRadius: 6, color: '#aaa', fontSize: 11,
            cursor: 'pointer',
          }}
        >
          {loading ? '刷新中...' : '🔄 刷新'}
        </button>
      </div>

      {/* 资源列表 */}
      <div
        className="custom-scrollbar"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 12px',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 6,
        }}
      >
        {paged.length === 0 && (
          <div
            style={{
              gridColumn: 'span 2',
              textAlign: 'center',
              color: '#555',
              fontSize: 12,
              padding: '20px 0',
            }}
          >
            {loading ? '加载中...' : '暂无资源'}
          </div>
        )}
        {paged.map((resource) => (
          <div
            key={resource.id}
            onClick={() => onSelectResource?.(resource)}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', resource.url);
              e.dataTransfer.setData('application/json', JSON.stringify(resource));
            }}
            style={{
              position: 'relative',
              aspectRatio: '1',
              background: '#0d0d1a',
              borderRadius: 8,
              overflow: 'hidden',
              cursor: 'pointer',
              border: '1px solid #333',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#555';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#333';
            }}
          >
            {resource.type?.startsWith('image') ||
            /\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(resource.url) ? (
              <img
                src={resource.url}
                alt={resource.name}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
                loading="lazy"
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                  color: '#555',
                }}
              >
                {getTypeIcon(resource)}
              </div>
            )}
            {/* 类型标签 */}
            <div
              style={{
                position: 'absolute',
                bottom: 2,
                right: 2,
                fontSize: 9,
                background: 'rgba(0,0,0,0.7)',
                color: '#aaa',
                padding: '1px 4px',
                borderRadius: 3,
              }}
            >
              {getTypeIcon(resource)} {resource.type || '未知'}
            </div>
          </div>
        ))}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 4,
            padding: '8px 12px',
            borderTop: '1px solid #333',
          }}
        >
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            style={{
              padding: '2px 8px', fontSize: 11,
              background: '#222', border: '1px solid #444',
              borderRadius: 4, color: page <= 1 ? '#444' : '#aaa',
              cursor: page <= 1 ? 'not-allowed' : 'pointer',
            }}
          >
            上一页
          </button>
          <span style={{ fontSize: 11, color: '#666', padding: '2px 6px' }}>
            {page}/{totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            style={{
              padding: '2px 8px', fontSize: 11,
              background: '#222', border: '1px solid #444',
              borderRadius: 4, color: page >= totalPages ? '#444' : '#aaa',
              cursor: page >= totalPages ? 'not-allowed' : 'pointer',
            }}
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}