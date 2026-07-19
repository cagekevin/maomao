// ============================================================
// 一毛AI画布 - 文本生成节点（TextNode）
// 功能：文本生成、模型选择、上下文输入、@素材选择
// 严格复刻原版 App.js L5270-5911 结构
// ============================================================
import { memo, useState, useCallback, useRef, useEffect, useMemo, type ReactNode } from 'react';
import { NodeProps, Position, useReactFlow, useHandleConnections, useNodes } from '@xyflow/react';
import type { NodeData, AppNode, TransitResource } from '../types';
import CustomHandle from './CustomHandle';
import NodeTitle from './NodeTitle';

// ====== Helpers ======

function isBuiltinModel(modelId: string): boolean {
  return !modelId.includes('/') && !modelId.includes('.');
}

async function resizeImage(file: File, maxWidth: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = ev.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const VISUAL_NODE_TYPES = new Set([
  'promptNode', 'imageNode', 'imageBoxNode', 'videoNode',
  'sd2VideoNode', 'discountVideoNode', 'gridSplitNode', 'gridMergeNode',
  'cropNode', 'urlToImageNode', 'fileToUrlNode', 'panoramaNode', 'videoExtractNode',
]);

// ====== Inline SVG Icons ======

function FileTextIcon({ size = 11, className = '', strokeWidth = 2 }: { size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

function LoaderIcon({ size = 12, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`animate-spin ${className}`}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function UploadIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function CopyIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function ChevronUpIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

function ChevronDownIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function AlertCircleIcon({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function SquareIcon({ size = 10, fill = 'none' }: { size?: number; fill?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    </svg>
  );
}

function ArrowRightIcon({ size = 14, strokeWidth = 3 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function ZapIcon({ size = 10, strokeWidth = 2.5, className = '' }: { size?: number; strokeWidth?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function FileTextSmallIcon({ size = 10, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

// ====== Sub-components ======

function LoadingSpinner({ category }: { category: string }) {
  const color = category === 'text' ? 'text-blue-400' : 'text-purple-400';
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className="relative w-8 h-8">
        <div className={`absolute inset-0 rounded-full border-2 border-transparent border-t-current ${color} animate-spin`} />
        <div className={`absolute inset-1 rounded-full border-2 border-transparent border-b-current ${color} animate-spin [animation-direction:reverse] [animation-duration:1.5s]`} />
      </div>
    </div>
  );
}

function LoadingIndicator({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1a1a1a]/80 rounded-xl z-10">
      {children}
      <span className="text-xs text-gray-500 mt-2">{label}</span>
    </div>
  );
}

function ResourcePicker({ resources, onSelect, onClose }: {
  resources: TransitResource[];
  onSelect: (resource: TransitResource) => void;
  onClose: () => void;
}) {
  if (resources.length === 0) return null;
  return (
    <div
      className="absolute bottom-full left-0 mb-1 z-[100] min-w-[200px] max-h-[240px] overflow-y-auto bg-[#222] border border-[#333] rounded-lg shadow-xl p-1.5 nowheel nopan nodrag custom-scrollbar"
      onWheel={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      <div className="text-[10px] text-gray-500 px-1 mb-1">素材库</div>
      {resources.map((r) => (
        <div
          key={r.id}
          className="flex items-center gap-2 px-2 py-1.5 text-[11px] text-gray-300 hover:bg-[#2a2a2a] rounded cursor-pointer transition-colors"
          onClick={() => onSelect(r)}
        >
          {r.type.startsWith('image') ? (
            <img src={r.url} alt="" className="w-6 h-6 rounded object-cover" />
          ) : (
            <FileTextSmallIcon size={12} className="text-gray-400" />
          )}
          <span className="truncate">{r.name || r.pageTitle || r.url.slice(0, 30)}</span>
        </div>
      ))}
    </div>
  );
}

function PresetPromptButton({ category, presetPrompts, onApply, onToast }: {
  category: string;
  presetPrompts: Array<{ id: string; title: string; prompt: string; category: string }>;
  onApply: (prompt: string) => void;
  onToast?: (msg: string) => void;
}) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const filtered = presetPrompts.filter(p => p.category === category);

  useEffect(() => {
    if (!show) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShow(false);
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [show]);

  if (filtered.length === 0) return null;

  return (
    <div ref={ref} className="relative nodrag">
      <div className="w-[1px] h-3 bg-[#444] mr-1.5" />
      <button
        className="flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer"
        onClick={(e) => { e.stopPropagation(); setShow(!show); }}
      >
        <span>预设</span>
      </button>
      {show && (
        <div
          className="absolute bottom-full left-0 mb-1 min-w-[200px] max-h-[240px] overflow-y-auto bg-[#222] border border-[#333] rounded-lg shadow-xl p-1.5 z-50 nowheel nopan nodrag custom-scrollbar"
          onWheel={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
        >
          {filtered.map(p => (
            <div
              key={p.id}
              className="px-2 py-1.5 text-[11px] text-gray-300 hover:bg-[#2a2a2a] hover:text-white rounded cursor-pointer transition-colors"
              onClick={() => { onApply(p.prompt); setShow(false); onToast?.(`已应用预设: ${p.title}`); }}
            >
              <div className="text-gray-400 text-[10px]">{p.title}</div>
              <div className="truncate">{p.prompt}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FullscreenDialog({ open, title, onClose, children }: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#1c1c1c] rounded-xl border border-[#333] shadow-2xl w-[90vw] h-[80vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2 border-b border-[#333]">
          <span className="text-sm text-gray-300">{title}</span>
          <button
            className="p-1 text-gray-400 hover:text-white hover:bg-[#333] rounded transition-colors"
            onClick={onClose}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}

// ====== Main Component ======

function TextNode({ id, data, selected }: NodeProps<AppNode>) {
  const { setNodes, setEdges } = useReactFlow();
  const targetConnections = useHandleConnections({ type: 'target' });

  // --- State (13 variables) ---
  const [prompt, setPrompt] = useState(data.prompt || '');
  const [text, setText] = useState((data.text as string) || '');
  const [autoSplit, setAutoSplit] = useState(!!data.autoSplit);
  const [expanded, setExpanded] = useState(data.expanded === undefined ? true : !!data.expanded);
  const [fullscreenText, setFullscreenText] = useState(false);
  const [editing, setEditing] = useState(false);
  const [fullscreenPrompt, setFullscreenPrompt] = useState(false);
  const [selectedContextResources, setSelectedContextResources] = useState<Array<TransitResource & { type: string; url: string }>>(data.selectedContextResources as any || []);
  const [selectedModel, setSelectedModel] = useState(
    (data.selectedModel as string) ||
    localStorage.getItem('mutiwindow_text_model') ||
    (data.textModel ? (data.textModel as string).split('\n')[0].trim() : '')
  );
  const [textSchedules, setTextSchedules] = useState<Array<{ id: string; name: string; enabled: boolean; category: string; steps: Array<{ id: string }> }>>([]);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showResourcePicker, setShowResourcePicker] = useState(false);
  const [transitResources, setTransitResources] = useState<TransitResource[]>([]);

  // --- Refs ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // --- Derived ---
  const presetPrompts = (data.presetPrompts as Array<{ id: string; title: string; prompt: string; category: string }>) || [];
  const loading = data.loading as boolean | undefined;
  const errorMessage = data.errorMessage as string | undefined;

  // --- Connected nodes ---
  const connectedNodeIds = useMemo(
    () => [...new Set(targetConnections.map(c => c.source))],
    [targetConnections]
  );
  const connectedNodes = useNodes<AppNode>(
    useMemo(() => {
      const idSet = new Set(connectedNodeIds);
      return (nodes: AppNode[]) => nodes.filter(n => idSet.has(n.id));
    }, [connectedNodeIds])
  );

  // --- Connected resources (images + texts from connected nodes) ---
  const connectedResources = useMemo(() => {
    if (connectedNodes.length === 0) return { images: [] as Array<{ id: string; url: string }>, texts: [] as Array<{ id: string; label: string; text: string }> };

    const images: Array<{ id: string; url: string }> = [];
    const texts: Array<{ id: string; label: string; text: string }> = [];

    connectedNodes.forEach((node) => {
      const conn = targetConnections.find(c => c.source === node.id);

      // Image from imageUrl
      if (node.data?.imageUrl && typeof node.data.imageUrl === 'string' &&
          (node.data.imageUrl.startsWith('http') || node.data.imageUrl.startsWith('data:'))) {
        images.push({ id: node.id, url: node.data.imageUrl as string });
      }

      // Video extract node images
      if (node.type === 'videoExtractNode' && (node.data as any).extractedImages) {
        if (conn && conn.sourceHandle && conn.sourceHandle.startsWith('frame-')) {
          const idx = parseInt(conn.sourceHandle.replace('frame-', ''), 10);
          if (!( (node.data as any).hiddenIndices || []).includes(idx)) {
            const allImages = (node.data as any).allExtractedImages;
            if (allImages && allImages[idx]) {
              images.push({ id: `${node.id}-ext-${idx}`, url: allImages[idx] });
            }
          }
        } else {
          (node.data as any).extractedImages.forEach((url: string, i: number) => {
            images.push({ id: `${node.id}-ext-${i}`, url });
          });
        }
      }

      // ImageBox node images
      if (node.type === 'imageBoxNode' && Array.isArray((node.data as any).images)) {
        const imgs = (node.data as any).images;
        const selectedIds: string[] = (node.data as any).selectedIds || [];
        if (selectedIds.length > 0) {
          const idSet = new Set(selectedIds);
          imgs.forEach((img: any, i: number) => {
            if (img?.url && idSet.has(img.id)) {
              images.push({ id: `${node.id}-box-${i}`, url: img.url });
            }
          });
        } else {
          const activeIdx = typeof (node.data as any).activeIndex === 'number' ? (node.data as any).activeIndex : 0;
          const url = imgs[activeIdx]?.url;
          if (url) images.push({ id: `${node.id}-box-active`, url });
        }
      }

      // Text from non-visual nodes
      if ((node.data as any).text && !VISUAL_NODE_TYPES.has(node.type || '')) {
        texts.push({
          id: node.id,
          label: node.type === 'audioNode' ? '听音断句结果' : ((node.data as any).label || '文本节点'),
          text: (node.data as any).text as string,
        });
      }
    });

    return { images, texts };
  }, [connectedNodes, targetConnections]);

  // --- Text model list ---
  const textModelLines = ((data.textModel as string) || '').split('\n').map(s => s.trim()).filter(Boolean);
  const builtinModels = textModelLines.filter(isBuiltinModel).sort((a, b) => a.localeCompare(b));
  const thirdPartyModels = textModelLines.filter(m => !isBuiltinModel(m)).sort((a, b) => a.localeCompare(b));
  const hasModels = textModelLines.length > 0 || textSchedules.length > 0;

  // --- Effects ---
  useEffect(() => {
    if (data.expanded !== undefined) setExpanded(!!data.expanded);
  }, [data.expanded]);

  useEffect(() => {
    setPrompt(data.prompt || '');
    if (data.text !== undefined) setText(data.text as string);
    if (data.selectedModel) setSelectedModel(data.selectedModel as string);
    if (data.selectedContextResources) setSelectedContextResources(data.selectedContextResources as any);
  }, [data.prompt, data.text, data.selectedModel, data.selectedContextResources]);

  useEffect(() => {
    if ((data.textModel as string) && !selectedModel) {
      const first = (data.textModel as string).split('\n')[0].trim();
      setSelectedModel(first);
      setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, selectedModel: first } } : n));
    }
  }, [data.textModel, selectedModel, id, setNodes]);

  useEffect(() => {
    if (showResourcePicker) {
      try {
        const raw = localStorage.getItem('transitResources');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) setTransitResources(parsed);
        }
      } catch (e) {
        console.error('Failed to fetch transitResources from storage', e);
      }
    }
  }, [showResourcePicker]);

  useEffect(() => {
    if (!showModelDropdown) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowModelDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [showModelDropdown]);

  // --- updateNodeData helper ---
  const updateNodeData = useCallback((nodeId: string, partial: Record<string, unknown>) => {
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...partial } } : n));
  }, [setNodes]);

  // --- Handlers ---
  const handleCopyText = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    data.onShowToast?.('已复制文本');
  }, [text, data]);

  const handleGenerate = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    data.onGenerateText?.(id, prompt, autoSplit, selectedModel);
  }, [id, prompt, autoSplit, selectedModel, data]);

  const handlePromptChange = useCallback((value: string) => {
    setPrompt(value);
    updateNodeData(id, { prompt: value });

    if (value.endsWith('@')) {
      setShowResourcePicker(true);
    } else if (value.includes('@')) {
      // keep open if @ is still present
    } else {
      setShowResourcePicker(false);
    }

    // Auto-resize textarea
    const el = textareaRef.current;
    if (el) {
      requestAnimationFrame(() => {
        if (el) {
          el.style.height = 'auto';
          const h = Math.max(80, Math.min(el.scrollHeight, 200));
          el.style.height = h + 'px';
          updateNodeData(id, { inputHeight: h });
        }
      });
    }
  }, [id, updateNodeData]);

  const handleResourceSelect = useCallback((resource: TransitResource & { type: string; url: string }) => {
    const atIdx = prompt.lastIndexOf('@');
    const base = atIdx >= 0 ? prompt.substring(0, atIdx) + prompt.substring(atIdx + 1) : prompt;

    if (resource.type === 'text') {
      const newPrompt = base + (resource.url || '');
      setPrompt(newPrompt);
      updateNodeData(id, { prompt: newPrompt });
    } else {
      const newResources = [...selectedContextResources, resource];
      setSelectedContextResources(newResources);
      updateNodeData(id, { selectedContextResources: newResources });
      setPrompt(base);
      updateNodeData(id, { prompt: base });
    }
    setShowResourcePicker(false);
  }, [prompt, selectedContextResources, id, updateNodeData]);

  const handleSelectModel = useCallback((model: string) => {
    setSelectedModel(model);
    updateNodeData(id, { selectedModel: model });
    localStorage.setItem('mutiwindow_text_model', model);
    setShowModelDropdown(false);
  }, [id, updateNodeData]);

  const handleToggleExpanded = useCallback(() => {
    setExpanded(prev => !prev);
    updateNodeData(id, { expanded: !expanded });
  }, [expanded, id, updateNodeData]);

  // --- Model dropdown item renderer ---
  const renderModelItem = (modelId: string, index: number, isBuiltin: boolean) => {
    const isSelected = selectedModel === modelId;
    return (
      <div
        key={`${isBuiltin ? 'b' : 'o'}-${index}`}
        role="button"
        className={`w-full flex items-center gap-1.5 mb-1 last:mb-0 text-left px-2 py-1.5 text-[11px] rounded-md transition-colors cursor-pointer ${isSelected ? 'bg-[#333] text-white' : 'text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200'}`}
        onClick={() => handleSelectModel(modelId)}
        title={modelId}
      >
        <span className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border ${isBuiltin ? 'bg-white/10 text-white/90 border-white/30' : 'bg-gray-500/15 text-gray-400 border-gray-500/40'}`}>
          {isBuiltin ? '内置' : '三方'}
        </span>
        <span className="flex-1 whitespace-nowrap">{modelId}</span>
      </div>
    );
  };

  // --- Expanded panel content (shared between inline and fullscreen) ---
  const expandedPanelContent = (
    <div className="space-y-3">
      <div className="flex flex-col gap-2">
        {/* Context resources display */}
        {(connectedResources.images.length > 0 || connectedResources.texts.length > 0 || selectedContextResources.length > 0) && (
          <div className="flex flex-wrap gap-2 mb-1">
            {/* Connected image thumbnails */}
            {connectedResources.images.map((img, idx) => (
              <div key={`img-${idx}`} className="w-8 h-8 rounded overflow-hidden border border-[#444] relative group bg-black" title="连线图片">
                <img src={img.url} alt="Ref" className="w-full h-full object-cover" />
                <div
                  className="absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEdges(edges => edges.filter(edge => !(edge.target === id && edge.source === img.id)));
                  }}
                >
                  <span className="text-white text-[8px]">&times;</span>
                </div>
              </div>
            ))}

            {/* @ selected resources (blue border) */}
            {selectedContextResources.map((res, idx) => (
              <div key={`ctx-${idx}`} className="w-8 h-8 rounded overflow-hidden border border-blue-500/50 relative group bg-black" title="通过 @ 选中的素材">
                {res.type.startsWith('image') ? (
                  <img src={res.url} className="w-full h-full object-cover opacity-80" />
                ) : res.type.startsWith('video') ? (
                  <video src={res.url} className="w-full h-full object-cover opacity-80" />
                ) : (
                  <div className="w-full h-full bg-[#222] flex items-center justify-center p-1">
                    <FileTextSmallIcon size={10} className="text-gray-400" />
                  </div>
                )}
                <div className="absolute inset-0 bg-blue-500/10 pointer-events-none" />
                <div
                  className="absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = selectedContextResources.filter((_, i) => i !== idx);
                    setSelectedContextResources(next);
                    updateNodeData(id, { selectedContextResources: next });
                  }}
                >
                  <span className="text-white text-[8px]">&times;</span>
                </div>
              </div>
            ))}

            {/* Connected text labels */}
            {connectedResources.texts.map((t, idx) => (
              <div key={`txt-${idx}`} className="h-8 px-2 bg-[#2a2a2a] border border-[#444] rounded flex items-center gap-1 text-[10px] text-gray-300 hover:bg-[#333] hover:border-blue-500 hover:text-blue-400 transition-colors cursor-help group/text" title={t.text}>
                <FileTextSmallIcon size={10} />
                <span className="max-w-[60px] truncate">{t.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Prompt textarea area */}
        <div className="flex items-start gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              className="w-full min-h-[80px] bg-transparent text-[15px] text-gray-200 outline-none leading-relaxed placeholder-gray-600 font-sans custom-scrollbar nodrag nowheel nopan overflow-auto"
              placeholder="输入提示词 (输入 @ 调出素材)..."
              value={prompt}
              onChange={(e) => handlePromptChange(e.target.value)}
              onWheel={e => e.stopPropagation()}
            />
            {showResourcePicker && (
              <ResourcePicker
                resources={transitResources}
                onSelect={handleResourceSelect}
                onClose={() => setShowResourcePicker(false)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Bottom toolbar */}
      <div className="flex items-center justify-between pt-2 border-t border-[#2a2a2a] nodrag">
        {/* Left side */}
        <div className="flex items-center gap-1.5">
          {/* Auto split checkbox */}
          <label className="flex items-center gap-1.5 cursor-pointer h-6 px-2 text-[11px] text-gray-400 hover:text-gray-200 select-none bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded transition-colors">
            <input
              type="checkbox"
              checked={autoSplit}
              onChange={(e) => {
                setAutoSplit(e.target.checked);
                updateNodeData(id, { autoSplit: e.target.checked });
              }}
              className="accent-blue-500 rounded sm:w-3 sm:h-3"
            />
            自动拆分
          </label>

          {/* Model selector */}
          {hasModels && (
            <div className="relative nodrag flex items-center" ref={dropdownRef}>
              <div className="w-[1px] h-3 bg-[#444] mr-1.5" />
              <button
                className="flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer"
                onClick={(e) => { e.stopPropagation(); setShowModelDropdown(!showModelDropdown); }}
                title={selectedModel || '选择模型'}
              >
                {selectedModel && (
                  <span className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border ${isBuiltinModel(selectedModel) ? 'bg-white/10 text-white/90 border-white/30' : 'bg-gray-500/15 text-gray-400 border-gray-500/40'}`}>
                    {isBuiltinModel(selectedModel) ? '内置' : '三方'}
                  </span>
                )}
                <span className="whitespace-nowrap">{selectedModel || '选择模型'}</span>
              </button>

              {/* Model dropdown */}
              {showModelDropdown && (
                <div
                  className="absolute bottom-full left-0 mb-1 min-w-[17rem] w-max max-w-[29rem] bg-[#222] border border-[#333] rounded-lg shadow-xl p-2 z-50 block max-h-60 overflow-y-auto custom-scrollbar nowheel nopan nodrag"
                  onWheel={e => e.stopPropagation()}
                  onClick={e => e.stopPropagation()}
                >
                  {(() => {
                    return (
                      <>
                        {/* Schedule models section */}
                        {textSchedules.length > 0 && (
                          <>
                            <div className="text-[10px] text-blue-300 mb-1 px-1 flex items-center justify-between">
                              <span className="flex items-center gap-1">
                                <ZapIcon size={10} strokeWidth={2.5} />
                                <span>模型调度</span>
                              </span>
                              <span
                                className="ml-auto text-white/90 hover:text-white cursor-pointer transition-colors"
                                onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('mutiwindow-open-schedule-settings')); }}
                              >
                                配置 &rsaquo;
                              </span>
                            </div>
                            {textSchedules.map(schedule => (
                              <div
                                key={schedule.id}
                                role="button"
                                className="w-full flex items-center gap-1.5 mb-1 last:mb-0 text-left px-2 py-1.5 text-[11px] rounded-md transition-colors cursor-pointer text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200"
                                onClick={() => handleSelectModel(schedule.id)}
                                title={`${schedule.name}（${schedule.steps.length} 个模型按序重试）`}
                              >
                                <span className="shrink-0 px-1 rounded text-[9px] leading-[14px] border bg-blue-500/20 text-blue-200 border-blue-400/40">
                                  调度
                                </span>
                                <span className="flex-1 whitespace-nowrap">{schedule.name}</span>
                                <span className="shrink-0 text-[10px] text-gray-500">{schedule.steps.length} 模型</span>
                              </div>
                            ))}
                            {(builtinModels.length > 0 || thirdPartyModels.length > 0) && (
                              <div className="h-px bg-[#333] my-1.5" />
                            )}
                          </>
                        )}

                        {/* Builtin models section */}
                        {builtinModels.length > 0 && (
                          <>
                            <div className="text-[10px] text-blue-300 mb-1 px-1 flex items-center gap-1">
                              <span>内置模型</span>
                              <span
                                className="ml-auto text-white/90 hover:text-white cursor-pointer whitespace-nowrap"
                                onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('mutiwindow-open-builtin-settings')); setShowModelDropdown(false); }}
                                title="查看内置模型详情"
                              >
                                详情 &rsaquo;
                              </span>
                            </div>
                            {builtinModels.map((m, i) => renderModelItem(m, i, true))}
                          </>
                        )}

                        {/* Third-party models section */}
                        {thirdPartyModels.length > 0 && (
                          <>
                            {builtinModels.length > 0 && <div className="h-px bg-[#333] my-1.5" />}
                            <div className="text-[10px] text-gray-500 mb-1 px-1">第三方 API</div>
                            {thirdPartyModels.map((m, i) => renderModelItem(m, i, false))}
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Preset prompts */}
          <PresetPromptButton
            category="text"
            presetPrompts={presetPrompts}
            onApply={(p) => {
              const newPrompt = prompt ? `${prompt}, ${p}` : p;
              setPrompt(newPrompt);
              updateNodeData(id, { prompt: newPrompt });
            }}
            onToast={(msg) => data.onShowToast?.(msg)}
          />
        </div>

        {/* Right side: Generate / Stop button */}
        {loading ? (
          <div
            className="flex items-center bg-red-500/10 rounded-full p-1 pl-3 border border-red-500/30 hover:border-red-500/50 transition-colors cursor-pointer group/btn flex-shrink-0 ml-2"
            onClick={(e) => { e.stopPropagation(); data.onStop?.(id); }}
          >
            <div className="flex items-center gap-1 mr-3 text-xs text-red-400 group-hover/btn:text-red-300">
              停止
            </div>
            <button className="bg-red-500/20 text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-red-500/30 transition-colors">
              <SquareIcon size={10} fill="currentColor" />
            </button>
          </div>
        ) : (
          <div
            className="flex items-center bg-[#2a2a2a] rounded-full p-1 pl-3 border border-[#333] hover:border-gray-500 transition-colors cursor-pointer group/btn flex-shrink-0 ml-2"
            onClick={handleGenerate}
          >
            <div className="flex items-center gap-1 mr-3 text-xs text-gray-300 group-hover/btn:text-white">
              生成
            </div>
            <button className="bg-white text-black w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors">
              <ArrowRightIcon size={14} strokeWidth={3} />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // --- Render ---
  return (
    <>
      <div className={`relative flex flex-col items-center group/node transition-all ${selected ? 'z-50' : 'z-10'}`}>
        {/* NodeTitle */}
        <NodeTitle
          id={id}
          data={data}
          defaultTitle="文本生成"
          icon={<FileTextIcon size={11} className="text-gray-500" />}
        />

        {/* Hover toolbar */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none group-hover/node:pointer-events-auto nodrag pb-4">
          <div className="flex items-center gap-1 px-3 py-2 bg-[#1c1c1c]/90 backdrop-blur-md border border-[#333] rounded-full shadow-lg">
            {/* Loading indicator (red spinning) */}
            {loading && (
              <LoaderIcon size={12} className="animate-spin flex-shrink-0 text-red-600" />
            )}
            {/* Upload image (only when no connections) */}
            {targetConnections.length === 0 && (
              <button
                className="p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md"
                onClick={() => fileInputRef.current?.click()}
                title="上传图片"
              >
                <UploadIcon size={12} />
              </button>
            )}
            {/* Copy text */}
            <button
              className="p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md"
              onClick={handleCopyText}
              title="复制文本"
            >
              <CopyIcon size={12} />
            </button>
            {/* Expand / Collapse input */}
            <button
              className="p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md"
              onClick={handleToggleExpanded}
              title={expanded ? '收起输入' : '展开输入'}
            >
              {expanded ? <ChevronUpIcon size={12} /> : <ChevronDownIcon size={12} />}
            </button>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) {
              try {
                const dataUrl = await resizeImage(file, 2048, 0.85);
                data.onAddImage?.(id, dataUrl);
              } catch (err) {
                console.error('Image resize failed:', err);
              }
              e.target.value = '';
            }
          }}
        />

        {/* Main content card */}
        <div
          ref={cardRef}
          className={`relative bg-[#1c1c1c] rounded-xl border shadow-xl transition-[border-color] duration-200 flex flex-col w-[420px] h-[240px] ${selected ? 'border-[#555]' : 'border-[#333] hover:border-[#444]'}`}
          onClick={(e) => {
            if (!editing && !(e.target instanceof HTMLButtonElement) && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
              handleToggleExpanded();
            }
          }}
        >
          <div
            className={`flex-1 min-h-0 p-3 overflow-hidden bg-[#1a1a1a] relative rounded-xl ${editing ? 'nopan nowheel nodrag' : 'drag-handle cursor-move'}`}
            onWheel={e => e.stopPropagation()}
            onDoubleClick={() => {
              if (!editing) {
                setEditing(true);
                setTimeout(() => editorRef.current?.focus(), 0);
              }
            }}
          >
            {/* Loading state */}
            {loading ? (
              <LoadingIndicator label="生成中...">
                <LoadingSpinner category="text" />
              </LoadingIndicator>
            ) : null}

            {/* Error state */}
            {errorMessage ? (
              <div className="text-red-400 text-xs p-2 border border-red-500/30 rounded bg-red-500/10 flex items-start gap-2">
                <AlertCircleIcon size={14} className="mt-0.5 flex-shrink-0" />
                <span className="break-all">{errorMessage}</span>
              </div>
            ) : (
              <>
                {/* Empty state */}
                {!text && !loading && !editing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
                    <FileTextIcon size={72} className="text-gray-700" strokeWidth={1.2} />
                    <span className="text-xs text-gray-600">双击编辑内容或AI生成</span>
                  </div>
                )}

                {/* Text editor */}
                <textarea
                  ref={editorRef}
                  className={`w-full h-full bg-transparent outline-none font-sans leading-relaxed custom-scrollbar nowheel text-[#a1a1aa] ${editing ? 'nodrag nopan' : 'pointer-events-none'}`}
                  placeholder=""
                  value={text}
                  readOnly={!editing}
                  onChange={(e) => {
                    const val = e.target.value;
                    setText(val);
                    updateNodeData(id, { text: val });
                  }}
                  onBlur={() => setEditing(false)}
                  onWheel={e => e.stopPropagation()}
                />
              </>
            )}
          </div>

          {/* Handles */}
          <CustomHandle type="target" position={Position.Left} />
          <CustomHandle type="source" position={Position.Right} />
        </div>

        {/* Expanded panel (IIFE pattern - absolute below node) */}
        <div
          className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-[#1c1c1c] rounded-2xl border border-[#333] shadow-2xl min-w-[420px] w-max max-w-[920px] transition-all duration-300 origin-top z-50
            ${expanded ? 'opacity-100 scale-100 p-4 overflow-visible' : 'opacity-0 scale-95 pointer-events-none h-0 p-0 border-0 overflow-hidden'}
          `}
          onClick={e => e.stopPropagation()}
        >
          {!fullscreenPrompt && expandedPanelContent}
        </div>
      </div>

      {/* Fullscreen prompt dialog */}
      <FullscreenDialog
        open={fullscreenPrompt}
        title="编辑提示词 - 文本"
        onClose={() => setFullscreenPrompt(false)}
      >
        <div className="p-4 h-full overflow-auto custom-scrollbar">
          {expandedPanelContent}
        </div>
      </FullscreenDialog>

      {/* Fullscreen text editor dialog */}
      <FullscreenDialog
        open={fullscreenText}
        title="编辑文本内容"
        onClose={() => setFullscreenText(false)}
      >
        <textarea
          autoFocus
          className="w-full h-full bg-[#0d0c0c] text-gray-100 outline-none custom-scrollbar resize-none p-4 rounded text-sm leading-[1.7]"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            updateNodeData(id, { text: e.target.value });
          }}
        />
      </FullscreenDialog>
    </>
  );
}

export default memo(TextNode);