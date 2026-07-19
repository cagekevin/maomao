// ============================================================
// VideoNode - 普通视频生成节点
// 原版函数名: Do (L8617-L9589)
// ============================================================
import { memo, useState, useRef, useEffect, useMemo, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { Position, useReactFlow, useHandleConnections } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import {
  Video,
  Upload,
  Maximize2,
  Download,
  X,
  Play,
  Loader2,
  Square,
  FileText,
  Settings,
  Send,
  Zap,
  AlertCircle,
} from 'lucide-react';
import NodeTitle from './NodeTitle';
import CustomHandle from './CustomHandle';
import ResizeController from './ResizeController';

// ====== External dependency stubs ======

// TODO: implement pr - useThumbnail hook
function useThumbnail(): { useThumbnail: boolean } {
  // TODO: implement
  return { useThumbnail: true };
}

// TODO: implement oi - compute thumbnail dimension from node width
function computeThumbDim(width: number): number {
  // TODO: implement
  return 480;
}

// TODO: implement ai - check if URL is accessible (returns truthy on success)
async function checkUrlAccessible(_url: string): Promise<boolean> {
  // TODO: implement
  return false;
}

// TODO: implement ii - urlifyAsset (upload file, return { url, ... })
async function urlifyAsset(
  _file: File,
  _options: { subfolder: string; preferThumbnail: boolean; thumbMaxDim: number; thumbQuality: number }
): Promise<{ url: string }> {
  // TODO: implement
  return { url: '' };
}

// TODO: implement Br - build thumbnail URL from video URL
function buildThumbnailUrl(_videoUrl: string, _dim: number): string {
  // TODO: implement
  return '';
}

// TODO: implement zr - get video poster URL from video URL
function getVideoPosterUrl(_videoUrl: string): string | null {
  // TODO: implement
  return null;
}

// TODO: implement Q - config storage utility
const Q = {
  getConfig: async (_key: string): Promise<string | null> => {
    // TODO: implement
    return null;
  },
  setConfig: async (_key: string, _value: string): Promise<void> => {
    // TODO: implement
  },
  getObject: async (_key: string): Promise<unknown> => {
    // TODO: implement
    return null;
  },
};

// TODO: implement Z - config keys enum
const Z = {
  VIDEO_SIZE: 'VIDEO_SIZE',
  VIDEO_SECONDS: 'VIDEO_SECONDS',
  VIDEO_MODEL: 'VIDEO_MODEL',
  TRANSIT_RESOURCES: 'TRANSIT_RESOURCES',
};

// TODO: implement Eo - aspect ratio options array
const Eo: { value: string; label: string; defaultSize: string }[] = [
  { value: '16:9', label: '16:9', defaultSize: '1280x720' },
  { value: '9:16', label: '9:16', defaultSize: '720x1280' },
  { value: '1:1', label: '1:1', defaultSize: '720x720' },
  { value: '4:3', label: '4:3', defaultSize: '1280x960' },
  { value: '3:4', label: '3:4', defaultSize: '960x1280' },
  { value: '21:9', label: '21:9', defaultSize: '1920x824' },
  { value: 'custom', label: '自定义', defaultSize: '1280x720' },
];

// TODO: implement Yn - download URL button component
function DownloadUrlButton({ url, fallbackExt, onToast }: { url: string; fallbackExt: string; onToast: (msg: string) => void }) {
  // TODO: implement
  return null;
}

// TODO: implement Za - resource picker popup component
function ResourcePickerPopup({
  resources,
  onSelect,
  onClose,
}: {
  resources: unknown[];
  onSelect: (resource: any) => void;
  onClose: () => void;
}) {
  // TODO: implement
  return null;
}

// TODO: implement gi - prompt textarea component
function PromptTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: React.Ref<HTMLTextAreaElement> }) {
  // TODO: implement
  return <textarea {...props} />;
}

// TODO: implement Ja - preset prompts component
function PresetPromptsButton({
  category,
  presetPrompts,
  onApply,
  onToast,
}: {
  category: string;
  presetPrompts: unknown[];
  onApply: (prompt: string) => void;
  onToast: (msg: string) => void;
}) {
  // TODO: implement
  return null;
}

// TODO: implement _i - resize handle component
function InputResizeHandle({
  targetRef,
  onRequestFullscreen,
  onResizeEnd,
}: {
  targetRef: React.RefObject<HTMLTextAreaElement | null>;
  onRequestFullscreen: () => void;
  onResizeEnd: (width: number, height: number) => void;
}) {
  // TODO: implement
  return null;
}

// TODO: implement vi - fullscreen editor modal
function FullscreenEditorModal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // TODO: implement
  if (!open) return null;
  return (
    <div>
      <div>{title}</div>
      {children}
    </div>
  );
}

// TODO: implement ui - loading spinner icon
function LoadingSpinner({ size }: { size: number }) {
  // TODO: implement
  return <Loader2 size={size} className="animate-spin text-gray-400" />;
}

// TODO: implement Xi - check if model is built-in
function isBuiltinModel(_model: string): boolean {
  // TODO: implement
  return false;
}

// TODO: implement Ui - get model input token cost
function getModelInputCost(_model: string): number | null {
  // TODO: implement
  return null;
}

// TODO: implement Wi - get model output token cost
function getModelOutputCost(_model: string): number | null {
  // TODO: implement
  return null;
}

// TODO: implement ea - get model button class/style
function getModelButtonStyle(_model: string, _isSelected: boolean): { className: string; disabled: boolean; title: string } {
  // TODO: implement
  return { className: '', disabled: false, title: '' };
}

// TODO: implement Zi - format token cost
function formatTokenCost(_cost: number | null): string {
  // TODO: implement
  return '';
}

// ====== Node Data Interface ======

interface VideoNodeData {
  prompt?: string;
  aspectRatio?: string;
  customSize?: string;
  size?: string;
  selectedSeconds?: string;
  selectedModel?: string;
  videoModel?: string;
  videoDurations?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  imageAvailable?: boolean;
  loading?: boolean;
  progress?: number;
  errorMessage?: string;
  expanded?: boolean;
  inputWidth?: number;
  inputHeight?: number;
  selectedContextResources?: any[];
  apiFormat?: string;
  presetPrompts?: unknown[];
  onGenerateVideo?: (nodeId: string, prompt: string, aspectRatio: string, size: string, model: string, seconds: string, apiFormat: string) => void;
  onShowToast?: (msg: string) => void;
  onAddImage?: (nodeId: string, url: string) => void;
  onDelete?: () => void;
  onStop?: (nodeId: string) => void;
  [key: string]: unknown;
}

interface AppNode {
  id: string;
  data: Record<string, unknown>;
}

// ====== Component ======

function VideoNode({ id, data, selected, width }: NodeProps<AppNode>) {
  const { updateNodeData, setEdges, setNodes, getNode } = useReactFlow();
  const l = data as unknown as VideoNodeData;
  const { useThumbnail: u } = useThumbnail();
  const d = computeThumbDim(width ?? 420);

  const [f, p] = useState(l.prompt || ``);
  const [m, h] = useState(() => {
    const e = localStorage.getItem(`mutiwindow_video_aspectRatio`);
    const t = l.aspectRatio || e || l.size || `16:9`;
    return t.includes(`x`) ? `custom` : t;
  });
  const [g, _] = useState((l.aspectRatio, `16:9`));
  const [v, y] = useState(() => l.customSize ? l.customSize : l.size || `1280x720`);
  const b = useMemo(() => {
    if (m === `custom`) return v;
    const e = Eo.find(e => e.value === m);
    return e ? e.defaultSize : `1280x720`;
  }, [m, v]);
  const x = useMemo(() => m === `custom` ? g : m, [m, g]);
  const [C, w] = useState(l.selectedSeconds || l.videoDurations && l.videoDurations.split(`
`)[0].trim() || `10`);
  const [T, E] = useState(l.selectedModel || l.videoModel && l.videoModel.split(`
`)[0].trim() || ``);
  const [D, O] = useState(false);
  const [k, A] = useState(false);
  const j = useRef<HTMLInputElement>(null);
  const M = useRef<HTMLTextAreaElement>(null);
  const [N, P] = useState(false);
  const F = useRef<HTMLDivElement>(null);
  const [I, L] = useState(false);
  const ee = useRef<HTMLDivElement>(null);
  const [R, z] = useState(false);
  const B = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      if (!l.aspectRatio && !l.size) {
        const e = await Q.getConfig(Z.VIDEO_SIZE);
        e && h(e);
      }
      if (!l.selectedSeconds) {
        const e = await Q.getConfig(Z.VIDEO_SECONDS);
        e && w(e);
      }
      if (!l.selectedModel) {
        const e = await Q.getConfig(Z.VIDEO_MODEL);
        e && E(e);
      }
    })();
  }, [l.size, l.selectedSeconds, l.selectedModel]);

  const te = useRef<string | null>(null);
  useEffect(() => {
    const t = l.videoUrl;
    if (!t || l.imageAvailable || l.loading || !t.includes(`/files/`) || te.current === t) return;
    te.current = t;
    let n = false;
    (async () => {
      const r = await checkUrlAccessible(t);
      !n && r && updateNodeData(id, {
        imageAvailable: true
      });
    })();
    return () => {
      n = true;
    };
  }, [id, l.videoUrl, l.imageAvailable, l.loading, updateNodeData]);

  const [ne, re] = useState(false);
  const [ie, ae] = useState<unknown[]>([]);
  const [se, ce] = useState(l.selectedContextResources || []);
  const [le, ue] = useState(l.apiFormat || `auto`);

  useEffect(() => {
    l.selectedContextResources && ce(l.selectedContextResources);
  }, [l.selectedContextResources]);

  useEffect(() => {
    ne && Q.getObject(Z.TRANSIT_RESOURCES).then(e => {
      e && Array.isArray(e) && e.length > 0 && ae(e);
    }).catch(e => {
      console.error(`Failed to fetch transitResources from storage`, e);
    });
  }, [ne]);

  useEffect(() => {
    const e = (e: MouseEvent) => {
      F.current && !F.current.contains(e.target as Node) && P(false);
      ee.current && !ee.current.contains(e.target as Node) && L(false);
      B.current && !B.current.contains(e.target as Node) && z(false);
    };
    (N || I || R) && document.addEventListener(`mousedown`, e, true);
    return () => {
      document.removeEventListener(`mousedown`, e, true);
    };
  }, [N, I, R]);

  const [V, H] = useState(l.expanded === undefined ? true : l.expanded);
  useEffect(() => {
    l.expanded !== undefined && H(l.expanded);
  }, [l.expanded]);

  const U = useHandleConnections({ type: 'target' });
  const de = useMemo(() => U.map(e => e.source), [U]);

  const W = (() => {
    if (!de) return {
      images: [] as { id: string; url: string }[],
      texts: [] as { id: string; label: string; text: string }[]
    };
    const e = Array.isArray(de) ? de : [de];
    const t: { id: string; url: string }[] = [];
    const n: { id: string; label: string; text: string }[] = [];
    e.forEach(e => {
      const r = U.find(t => t.source === e?.id);
      if (e?.data?.imageUrl && t.push({
        id: e.id,
        url: (e.data as any).imageUrl
      }));
      if (e?.type === `videoExtractNode` && (e.data as any)?.extractedImages) {
        if (r && r.sourceHandle && r.sourceHandle.startsWith(`frame-`)) {
          const n = parseInt(r.sourceHandle.replace(`frame-`, ``), 10);
          if (!(e.data as any).hiddenIndices?.includes(n)) {
            const r = (e.data as any).allExtractedImages;
            r && r[n] && t.push({
              id: `${e.id}-ext-${n}`,
              url: r[n]
            });
          }
        } else {
          (e.data as any).extractedImages.forEach((n: string, r: number) => {
            t.push({
              id: `${e.id}-ext-${r}`,
              url: n
            });
          });
        }
      }
      if (e?.type === `imageBoxNode` && Array.isArray((e.data as any)?.images)) {
        const n = (e.data as any).images;
        const r = (e.data as any).selectedIds || [];
        if (r.length > 0) {
          const i = new Set(r);
          n.forEach((n: any, r: number) => {
            n?.url && i.has(n.id) && t.push({
              id: `${e.id}-box-${r}`,
              url: n.url
            });
          });
        } else {
          const r = n[typeof (e.data as any).activeIndex == `number` ? (e.data as any).activeIndex : 0]?.url;
          r && t.push({
            id: `${e.id}-box-active`,
            url: r
          });
        }
      }
      const i = new Set([`promptNode`, `imageNode`, `imageBoxNode`, `videoNode`, `sd2VideoNode`, `discountVideoNode`, `gridSplitNode`, `gridMergeNode`, `cropNode`, `urlToImageNode`, `fileToUrlNode`, `panoramaNode`, `videoExtractNode`]);
      (e?.data as any)?.text && !i.has(e.type) && n.push({
        id: e.id,
        label: e?.type === `audioNode` ? `听音断句结果` : (e.data as any).label || `文本节点`,
        text: (e.data as any).text
      });
    });
    return {
      images: t,
      texts: n
    };
  })();

  useEffect(() => {
    l.prompt !== undefined && l.prompt !== f && p(l.prompt);
  }, [l.prompt]);

  useEffect(() => {
    l.aspectRatio !== undefined && l.aspectRatio !== m && h(l.aspectRatio);
  }, [l.aspectRatio]);

  useEffect(() => {
    l.customSize !== undefined && l.customSize !== v && y(l.customSize);
  }, [l.customSize]);

  useEffect(() => {
    if (l.videoModel && !T) {
      const t = l.videoModel.split(`
`)[0].trim();
      E(t);
      updateNodeData(id, {
        selectedModel: t
      });
    }
  }, [l.videoModel, T, id, updateNodeData]);

  useEffect(() => {
    l.selectedModel && l.selectedModel !== T && E(l.selectedModel);
  }, [l.selectedModel]);

  useEffect(() => {
    if (l.videoDurations && !C) {
      const t = l.videoDurations.split(`
`)[0].trim();
      w(t);
      updateNodeData(id, {
        selectedSeconds: t
      });
    }
  }, [l.videoDurations, C, id, updateNodeData]);

  useEffect(() => {
    l.selectedSeconds && l.selectedSeconds !== C && w(l.selectedSeconds);
  }, [l.selectedSeconds]);

  useEffect(() => {}, [l.videoUrl, l.loading]);

  const fe = () => {
    if (!f.trim() && W.images.length === 0 && W.texts.length === 0) {
      l.onShowToast?.(`请输入提示词或连接参考节点`);
      return;
    }
    l.onGenerateVideo?.(id, f, x, b, T, C, le);
  };

  const pe = async (e: React.MouseEvent) => {
    if (e.stopPropagation(), l.videoUrl) try {
      if (l.onShowToast?.(`开始下载视频...`), typeof chrome < `u` && chrome.downloads) chrome.downloads.download({
        url: l.videoUrl,
        filename: `yimao/video-${Date.now()}.mp4`,
        saveAs: false
      });
      else {
        const e = await (await fetch(l.videoUrl)).blob();
        const t = window.URL.createObjectURL(e);
        const n = document.createElement(`a`);
        n.href = t;
        n.download = `video-${Date.now()}.mp4`;
        document.body.appendChild(n);
        n.click();
        window.URL.revokeObjectURL(t);
        document.body.removeChild(n);
      }
    } catch (e) {
      console.error(`Download failed:`, e);
      l.onShowToast?.(`下载失败，请重试`);
      window.open(l.videoUrl, `_blank`);
    }
  };

  const me = async (t: React.ChangeEvent<HTMLInputElement>) => {
    const n = t.target.files?.[0];
    if (!n) return;
    t.target.value = ``;
    try {
      const t = await urlifyAsset(n, {
        subfolder: `canvas/upload`,
        preferThumbnail: true,
        thumbMaxDim: 480,
        thumbQuality: 75
      });
      if (t.url && /^https?:\/\//i.test(t.url) && l.onAddImage) {
        l.onAddImage(id, t.url);
        return;
      }
    } catch (e) {
      console.warn(`[VideoNode] urlifyAsset failed, fallback to base64:`, e);
    }
    const r = new FileReader();
    r.onload = t => {
      const n = t.target?.result;
      l.onAddImage && l.onAddImage(id, n as string);
    };
    r.readAsDataURL(n);
  };

  const G = ((e: string | undefined) => {
    if (!e) return null;
    const t = e.match(/^(\d+(?:\.\d+)?)\s*[:：]\s*(\d+(?:\.\d+)?)$/);
    if (!t) return null;
    const n = parseFloat(t[1]);
    const r = parseFloat(t[2]);
    return !n || !r ? null : n / r;
  })(x);

  const he = G !== null;
  const ge = he && G ? Math.round(360 * Math.sqrt(G)) : null;
  const _e = he && G ? Math.round(360 / Math.sqrt(G)) : null;
  const K = useRef(_e);
  const ve = useRef<number | null>(null);
  const [ye, be] = useState<number | null>(null);

  useEffect(() => {
    const t = K.current;
    K.current = _e;
    if (ve.current !== null && (cancelAnimationFrame(ve.current), ve.current = null), ge === null || _e === null) {
      be(null);
      setNodes(t => t.map(t => {
        if (t.id !== id || t.style?.height !== undefined) return t;
        const n = 420 - ((t.style?.width ?? t.width ?? 360) as number);
        return {
          ...t,
          width: 420,
          height: 420,
          style: {
            ...t.style,
            width: 420,
            height: 420
          },
          position: {
            x: t.position.x - n / 2,
            y: t.position.y
          }
        };
      }));
      return;
    }
    const n = getNode(id);
    const r = n?.style?.width ?? n?.width ?? 360;
    const i = n?.position.x ?? 0;
    const a = n?.position.y ?? 0;
    const o = t ?? _e;
    const l = ge;
    const u = _e;
    if (t === null || Math.round(r) === l && Math.round(o) === u) {
      be(null);
      setNodes(t => t.map(t => {
        if (t.id !== id) return t;
        const n = t.style?.width ?? t.width ?? 360;
        if (Math.round(n) === l && t.style?.height === undefined) return t;
        const r = l - n;
        const i = {
          ...t.style,
          width: l
        };
        delete (i as any).height;
        return {
          ...t,
          width: l,
          height: undefined,
          style: i,
          position: {
            x: t.position.x - r / 2,
            y: t.position.y
          }
        };
      }));
      return;
    }
    const d = (e: number) => 1 - (1 - e) ** 3;
    const f = a + o;
    const p = i + r / 2;
    const m = performance.now();
    const h = (t: number) => {
      const n = Math.min(1, (t - m) / 360);
      const i = d(n);
      const a = r + (l - r) * i;
      const c = o + (u - o) * i;
      be(c);
      setNodes(t => t.map(t => {
        if (t.id !== id) return t;
        const n = {
          ...t.style,
          width: a
        };
        delete (n as any).height;
        return {
          ...t,
          width: a,
          height: undefined,
          style: n,
          position: {
            x: p - a / 2,
            y: f - c
          }
        };
      }));
      if (n < 1) {
        ve.current = requestAnimationFrame(h);
      } else {
        ve.current = null;
        be(null);
        setNodes(t => t.map(t => {
          if (t.id !== id) return t;
          const n = {
            ...t.style,
            width: l
          };
          delete (n as any).height;
          return {
            ...t,
            width: l,
            height: undefined,
            style: n,
            position: {
              x: p - l / 2,
              y: f - u
            }
          };
        }));
      }
    };
    ve.current = requestAnimationFrame(h);
    return () => {
      ve.current !== null && (cancelAnimationFrame(ve.current), ve.current = null);
    };
  }, [ge, _e, id]);

  const xe = he ? ye === null ? G ? {
    aspectRatio: String(G)
  } : undefined : {
    height: ye
  } : undefined;

  return (
    <div className={`relative flex flex-col items-center group/node w-full min-w-[160px] min-h-[160px] ${he ? `h-auto` : `h-full`} ${selected ? `z-50` : `z-10`}`}>
      <NodeTitle
        id={id}
        data={data as any}
        defaultTitle={`普通视频`}
        icon={<Video size={11} className={`text-gray-500`} />}
      />
      {!l.loading && (
        <div className={`absolute -top-12 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none group-hover/node:pointer-events-auto nodrag pb-4`}>
          <div className={`flex items-center gap-1 px-3 py-2 bg-[#1c1c1c]/90 backdrop-blur-md border border-[#333] rounded-full shadow-lg`}>
            {W.images.length === 0 && (
              <button
                className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`}
                title={`上传参考图`}
                onClick={e => {
                  e.stopPropagation();
                  j.current?.click();
                }}
              >
                <Upload size={14} />
              </button>
            )}
            {l.videoUrl && (
              <Fragment>
                <button
                  className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`}
                  title={`全屏播放`}
                  onClick={e => {
                    e.stopPropagation();
                    O(true);
                  }}
                >
                  <Maximize2 size={14} />
                </button>
                <button
                  className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`}
                  title={`下载`}
                  onClick={pe}
                >
                  <Download size={14} />
                </button>
                <DownloadUrlButton
                  url={l.videoUrl}
                  fallbackExt={`mp4`}
                  onToast={e => l.onShowToast?.(e)}
                />
                {l.onDelete && (
                  <button
                    className={`p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-md`}
                    title={`删除`}
                    onClick={e => {
                      e.stopPropagation();
                      l.onDelete?.();
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </Fragment>
            )}
          </div>
        </div>
      )}
      <ResizeController
        visible={!!selected}
        minWidth={160}
        minHeight={160}
        keepAspectRatio={he}
      />
      <input
        type={`file`}
        ref={j}
        style={{
          display: `none`
        }}
        accept={`image/*`}
        onChange={me}
      />
      <div
        className={`relative bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl transition-colors duration-300 cursor-pointer group/display flex flex-col w-full
            ${he ? `` : `flex-1`}
            ${selected ? `border-[#555]` : `border-[#333] hover:border-[#444]`}
        `}
        style={xe}
        onClick={() => {
          H(!V);
          updateNodeData(id, {
            expanded: !V
          });
        }}
      >
        <div className={`flex items-center justify-center absolute inset-0 ${l.videoUrl ? `` : `bg-[#121212]`}`}>
          {l.videoUrl && (
            <Fragment>
              {(() => {
                const t = u && (l.thumbnailUrl || l.imageAvailable) ? l.thumbnailUrl || buildThumbnailUrl(l.videoUrl, d) : null;
                const n = getVideoPosterUrl(l.videoUrl);
                return t ? (
                  <img
                    src={t}
                    alt={`video poster`}
                    loading={`lazy`}
                    decoding={`async`}
                    draggable={false}
                    className={`max-w-full w-full h-full object-contain block ${l.loading ? `opacity-50 blur-sm` : ``}`}
                    onError={t => {
                      const r = t.currentTarget;
                      n && r.src !== n ? r.src = n : updateNodeData(id, {
                        imageAvailable: false
                      });
                    }}
                  />
                ) : (
                  <video
                    src={l.videoUrl}
                    poster={l.thumbnailUrl}
                    preload={l.thumbnailUrl ? `auto` : `metadata`}
                    className={`max-w-full w-full h-full object-contain block ${l.loading ? `opacity-50 blur-sm` : ``}`}
                    controls={false}
                    autoPlay={false}
                    muted={false}
                  />
                );
              })()}
              {!l.loading && (
                <div className={`absolute inset-0 flex items-center justify-center pointer-events-none`}>
                  <button
                    className={`w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center opacity-70 hover:opacity-100 hover:bg-black/70 transition-all nodrag pointer-events-auto`}
                    title={`播放视频`}
                    onClick={e => {
                      e.stopPropagation();
                      O(true);
                    }}
                  >
                    <Play className={`text-white w-6 h-6`} />
                  </button>
                </div>
              )}
            </Fragment>
          )}
          {l.loading && (
            <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-500 z-10 overflow-hidden bg-[#121212]`}>
              {(W.images[0] || l.thumbnailUrl) && (
                <div
                  className={`absolute inset-0 bg-cover bg-center opacity-30 blur-xl scale-110`}
                  style={{
                    backgroundImage: `url(${l.thumbnailUrl || W.images[0].url})`
                  }}
                />
              )}
              <div
                className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer`}
                style={{
                  transform: `skewX(-20deg)`
                }}
              />
              <div className={`relative z-10 flex flex-col items-center gap-2`}>
                <LoadingSpinner size={32} />
                <span className={`text-xs font-mono tracking-wider text-white/80`}>
                  {!l.progress || l.progress === 0 ? `生成中...` : `生成中... ${l.progress}%`}
                </span>
                <button
                  onClick={t => {
                    t.stopPropagation();
                    l.onStop?.(id);
                  }}
                  className={`mt-2 bg-[#222]/80 hover:bg-[#333] border border-[#444] text-gray-400 hover:text-gray-200 px-3 py-1 rounded-full text-[10px] flex items-center gap-1.5 transition-colors backdrop-blur-sm`}
                >
                  <Square size={10} fill={`currentColor`} />
                  停止
                </button>
              </div>
            </div>
          )}
          {!l.videoUrl && !l.loading && !l.errorMessage && (
            <div className={`flex flex-col items-center justify-center absolute inset-0 bg-[#151515] pointer-events-none`}>
              <Video size={80} className={`text-gray-700`} strokeWidth={1.2} />
            </div>
          )}
          {l.errorMessage && !l.loading && (
            <div className={`absolute inset-0 flex flex-col items-center justify-center gap-3 text-red-500 z-10 bg-[#1a1a1a] p-4 text-center`}>
              <AlertCircle size={32} />
              <div className={`text-xs font-medium max-w-full break-words`}>
                {l.errorMessage}
              </div>
            </div>
          )}
        </div>
      </div>
      <CustomHandle
        type={`target`}
        position={Position.Left}
      />
      <CustomHandle
        type={`source`}
        position={Position.Right}
      />
      {(() => {
        const t = (
          <div className={`space-y-3`}>
            <div className={`flex flex-col gap-2 mb-2`}>
              {(W.images.length > 0 || W.texts.length > 0 || se.length > 0) && (
                <div className={`flex flex-wrap gap-2 mb-1`}>
                  {W.images.map((t, n) => (
                    <div key={`img-${n}`} className={`w-10 h-10 rounded-md overflow-hidden border border-[#444] relative group bg-black`} title={`连线图片`}>
                      <img src={t.url} alt={`Ref`} loading={`lazy`} decoding={`async`} className={`w-full h-full object-cover`} />
                      <div
                        className={`absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all`}
                        onClick={n => {
                          n.stopPropagation();
                          setEdges(n => n.filter(n => !(n.target === id && n.source === t.id)));
                        }}
                      >
                        <X size={10} className={`text-white`} />
                      </div>
                    </div>
                  ))}
                  {se.map((t: any, n: number) => (
                    <div key={`ctx-${n}`} className={`w-10 h-10 rounded-md overflow-hidden border border-blue-500/50 relative group bg-black`} title={`通过 @ 选中的素材`}>
                      {t.type.startsWith(`image`) ? (
                        <img src={t.url} loading={`lazy`} decoding={`async`} className={`w-full h-full object-cover opacity-80`} />
                      ) : t.type.startsWith(`video`) ? (
                        <video src={t.url} preload={`metadata`} className={`w-full h-full object-cover opacity-80`} />
                      ) : (
                        <div className={`w-full h-full bg-[#222] flex items-center justify-center p-1`}>
                          <FileText size={12} className={`text-gray-400`} />
                        </div>
                      )}
                      <div className={`absolute inset-0 bg-blue-500/10 pointer-events-none`} />
                      <div
                        className={`absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all`}
                        onClick={t => {
                          t.stopPropagation();
                          const r = se.filter((e: any, t: number) => t !== n);
                          ce(r);
                          updateNodeData(id, {
                            selectedContextResources: r
                          });
                        }}
                      >
                        <X size={10} className={`text-white`} />
                      </div>
                    </div>
                  ))}
                  {W.texts.map((e, t) => (
                    <div key={`txt-${t}`} className={`h-8 px-2 bg-[#2a2a2a] border border-[#444] rounded flex items-center gap-1 text-[10px] text-gray-300 hover:bg-[#333] hover:border-blue-500 hover:text-blue-400 transition-colors cursor-help group/text`} title={e.text}>
                      <FileText size={10} />
                      <span className={`max-w-[80px] truncate`}>{e.label}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className={`flex items-start gap-2`}>
                <div className={`flex-1 nodrag relative`}>
                  <PromptTextarea
                    ref={M}
                    className={`w-full bg-transparent text-[15px] text-gray-200 outline-none leading-relaxed placeholder-gray-600 font-sans custom-scrollbar nodrag nowheel nopan`}
                    style={{
                      width: (data as any).inputWidth ? `${(data as any).inputWidth}px` : undefined,
                      height: (data as any).inputHeight ? `${(data as any).inputHeight}px` : `80px`,
                      minHeight: `80px`,
                      overflow: `auto`
                    }}
                    placeholder={`描述你想要的视频内容 (输入 @ 调出素材)...`}
                    value={f}
                    onChange={t => {
                      if (p(t.target.value), updateNodeData(id, {
                        prompt: t.target.value
                      }), t.target.value.endsWith(`@`) ? re(true) : t.target.value.includes(`@`) || re(false), !(data as any).inputHeight || (data as any).inputHeight <= 200) {
                        const t = M.current;
                        requestAnimationFrame(() => {
                          if (t) {
                            t.style.height = `auto`;
                            const n = Math.max(80, Math.min(t.scrollHeight, 200));
                            t.style.height = n + `px`;
                            updateNodeData(id, {
                              inputHeight: n
                            });
                          }
                        });
                      }
                    }}
                    onKeyDown={e => {
                      e.key === `Enter` && (e.ctrlKey || e.metaKey) && fe();
                    }}
                    autoFocus={V}
                    onWheel={e => e.stopPropagation()}
                  />
                  {ne && (
                    <div className={`absolute bottom-full left-0 mb-1 z-[100]`} onWheel={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                      <ResourcePickerPopup
                        resources={ie}
                        onSelect={t => {
                          const n = f.lastIndexOf(`@`);
                          const r = n >= 0 ? f.substring(0, n) + f.substring(n + 1) : f;
                          if (t.type === `text`) {
                            const n = r + (t.url || ``);
                            p(n);
                            updateNodeData(id, {
                              prompt: n
                            });
                          } else {
                            const n = [...se, t];
                            ce(n);
                            updateNodeData(id, {
                              selectedContextResources: n
                            });
                            p(r);
                            updateNodeData(id, {
                              prompt: r
                            });
                          }
                          re(false);
                        }}
                        onClose={() => re(false)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className={`flex items-center justify-between pt-2 border-t border-[#2a2a2a] nodrag`}>
              <div className={`flex items-center gap-1.5 overflow-visible`}>
                <div className={`relative nodrag flex items-center`} ref={B}>
                  <button
                    className={`flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer max-w-[120px]`}
                    onClick={e => {
                      e.stopPropagation();
                      z(!R);
                    }}
                    title={`选择比例和时长`}
                  >
                    <Settings size={12} className={`opacity-70`} />
                    <span className={`truncate`}>
                      {m === `custom` ? `自定义` : Eo.find(e => e.value === m)?.label || m || `16:9`} · {C}s
                    </span>
                  </button>
                  {R && (
                    <div className={`absolute bottom-full left-0 mb-1 w-56 bg-[#222] border border-[#333] rounded-lg shadow-xl p-3 z-50 flex flex-col gap-3 max-h-72 overflow-y-auto custom-scrollbar nowheel nopan nodrag`} onClick={e => e.stopPropagation()}>
                      <div>
                        <div className={`text-[10px] text-gray-500 mb-2 px-1`}>比例 / 分辨率</div>
                        <div className={`flex flex-wrap gap-1.5 mb-3`}>
                          {Eo.map(t => (
                            <button
                              key={t.value}
                              className={`px-3 py-1.5 text-[11px] rounded-md transition-colors ${m === t.value ? `bg-[#444] text-white` : `bg-[#1c1c1c] text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`}
                              onClick={() => {
                                h(t.value);
                                updateNodeData(id, {
                                  aspectRatio: t.value
                                });
                                Q.setConfig(Z.VIDEO_SIZE, t.value);
                              }}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                        {m === `custom` && (
                          <div className={`bg-[#1c1c1c] p-2 rounded border border-[#333] mb-2 flex flex-col gap-2`}>
                            <div className={`flex items-center gap-2`}>
                              <span className={`text-[10px] text-gray-500 w-10`}>比例:</span>
                              <input
                                type={`text`}
                                value={g}
                                onChange={e => _(e.target.value)}
                                placeholder={`如 16:9`}
                                className={`flex-1 bg-[#121212] border border-[#444] rounded px-2 py-1 text-[11px] text-gray-200 outline-none focus:border-blue-500`}
                              />
                            </div>
                            <div className={`flex items-center gap-2`}>
                              <span className={`text-[10px] text-gray-500 w-10`}>尺寸:</span>
                              <input
                                type={`text`}
                                value={v}
                                onChange={t => {
                                  y(t.target.value);
                                  updateNodeData(id, {
                                    customSize: t.target.value
                                  });
                                }}
                                placeholder={`如 1280x720 或 720p`}
                                className={`flex-1 bg-[#121212] border border-[#444] rounded px-2 py-1 text-[11px] text-gray-200 outline-none focus:border-blue-500`}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      {l.videoDurations && (
                        <div>
                          <div className={`text-[10px] text-gray-500 mb-2 px-1`}>时长 (秒)</div>
                          <div className={`flex flex-wrap gap-1.5`}>
                            {l.videoDurations.split(`
`).map(e => e.trim()).filter(e => e !== ``).map((t, n) => (
                              <button
                                key={n}
                                className={`px-3 py-1.5 text-[11px] rounded-md transition-colors ${C === t ? `bg-[#444] text-white` : `bg-[#1c1c1c] text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`}
                                onClick={() => {
                                  w(t);
                                  updateNodeData(id, {
                                    selectedSeconds: t
                                  });
                                  Q.setConfig(Z.VIDEO_SECONDS, t);
                                }}
                              >
                                {t}s
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {!!(l.videoModel && l.videoModel.split(`
`).filter(e => e.trim() !== ``).length > 0) && (
                  <div className={`relative nodrag flex items-center`} ref={F}>
                    <div className={`w-[1px] h-3 bg-[#444] mr-1.5`} />
                    <button
                      className={`flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer`}
                      onClick={e => {
                        e.stopPropagation();
                        P(!N);
                      }}
                      title={T ? `${T}（${isBuiltinModel(T) ? `内置` : `第三方`}）` : `选择模型`}
                    >
                      {T && (
                        <span className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border ${isBuiltinModel(T) ? `bg-white/10 text-white/90 border-white/30` : `bg-gray-500/15 text-gray-400 border-gray-500/40`}`}>
                          {isBuiltinModel(T) ? `内置` : `三方`}
                        </span>
                      )}
                      <span className={`whitespace-nowrap`}>{T || `选择模型`}</span>
                    </button>
                    {N && (
                      <div className={`absolute bottom-full left-0 mb-1 min-w-[17rem] w-max max-w-[29rem] bg-[#222] border border-[#333] rounded-lg shadow-xl p-2 z-50 block max-h-60 overflow-y-auto custom-scrollbar nowheel nopan nodrag`} onClick={e => e.stopPropagation()}>
                        {(() => {
                          const t = l.videoModel.split(`
`).map(e => e.trim()).filter(e => e !== ``);
                          const n = t.filter(e => isBuiltinModel(e));
                          const r = t.filter(e => !isBuiltinModel(e));
                          const i = (t: string, n: number, r: boolean) => {
                            const i = r ? getModelInputCost(t) : null;
                            const o = r ? getModelOutputCost(t) : null;
                            const s = getModelButtonStyle(t, T === t);
                            return (
                              <button
                                key={`${r ? `b` : `o`}-${n}`}
                                className={s.className}
                                disabled={s.disabled}
                                onClick={() => {
                                  s.disabled || (E(t), updateNodeData(id, {
                                    selectedModel: t
                                  }), Q.setConfig(Z.VIDEO_MODEL, t), P(false));
                                }}
                                title={s.title}
                              >
                                <span className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border ${r ? `bg-white/10 text-white/90 border-white/30` : `bg-gray-500/15 text-gray-400 border-gray-500/40`}`}>
                                  {r ? `内置` : `三方`}
                                </span>
                                <span className={`flex-1 whitespace-nowrap`}>{t}</span>
                                {i !== null && (
                                  <span className={`shrink-0 inline-flex items-center gap-0.5 text-[10px] text-orange-400 tabular-nums`}>
                                    <Zap className={`w-2.5 h-2.5`} strokeWidth={2.5} />
                                    <span>{formatTokenCost(i)}{o ? `/${o}` : ``}</span>
                                  </span>
                                )}
                              </button>
                            );
                          };
                          return (
                            <Fragment>
                              {n.length > 0 && (
                                <Fragment>
                                  <div className={`text-[10px] text-blue-300 mb-1 px-1 flex items-center gap-1`}>
                                    <span>✨</span>
                                    <span>内置模型</span>
                                    <span
                                      className={`ml-auto text-white/90 hover:text-white cursor-pointer whitespace-nowrap`}
                                      onClick={e => {
                                        e.stopPropagation();
                                        window.dispatchEvent(new CustomEvent(`mutiwindow-open-builtin-settings`));
                                        P(false);
                                      }}
                                      title={`查看内置模型详情`}
                                    >
                                      详情 ›
                                    </span>
                                  </div>
                                  {n.map((e, t) => i(e, t, true))}
                                </Fragment>
                              )}
                              {r.length > 0 && (
                                <Fragment>
                                  {n.length > 0 && <div className={`h-px bg-[#333] my-1.5`} />}
                                  <div className={`text-[10px] text-gray-500 mb-1 px-1`}>第三方 API</div>
                                  {r.map((e, t) => i(e, t, false))}
                                </Fragment>
                              )}
                            </Fragment>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}
                <div className={`relative nodrag flex items-center`} ref={ee}>
                  <div className={`w-[1px] h-3 bg-[#444] mr-1.5`} />
                  <button
                    className={`flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer max-w-[80px]`}
                    onClick={e => {
                      e.stopPropagation();
                      L(!I);
                    }}
                    title={`请求格式`}
                  >
                    <span className={`truncate`}>
                      {le === `auto` ? `自动格式` : le === `json` ? `JSON` : `FormData`}
                    </span>
                  </button>
                  {I && (
                    <div className={`absolute bottom-full left-0 mb-1 w-32 bg-[#222] border border-[#333] rounded-lg shadow-xl p-2 z-50 block nodrag`} onClick={e => e.stopPropagation()}>
                      <div className={`text-[10px] text-gray-500 mb-2 px-1`}>请求格式</div>
                      {[
                        { label: `自动检测`, value: `auto` },
                        { label: `FormData`, value: `formdata` },
                        { label: `JSON`, value: `json` }
                      ].map(t => (
                        <button
                          key={t.value}
                          className={`w-full block mb-1 last:mb-0 text-left px-2 py-1.5 text-[11px] rounded-md transition-colors truncate ${le === t.value ? `bg-[#333] text-white` : `text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`}
                          onClick={() => {
                            ue(t.value);
                            updateNodeData(id, {
                              apiFormat: t.value
                            });
                            L(false);
                          }}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <PresetPromptsButton
                  category={`video`}
                  presetPrompts={l.presetPrompts || []}
                  onApply={t => {
                    const n = f ? `${f}, ${t}` : t;
                    p(n);
                    updateNodeData(id, {
                      prompt: n
                    });
                  }}
                  onToast={e => l.onShowToast?.(e)}
                />
              </div>
              <div className={`flex items-center gap-3 flex-shrink-0 ml-2`}>
                {l.loading ? (
                  <div
                    className={`flex items-center bg-red-500/10 rounded-full p-1 pl-3 border border-red-500/30 hover:border-red-500/50 transition-colors cursor-pointer group/btn`}
                    onClick={t => {
                      t.stopPropagation();
                      l.onStop?.(id);
                    }}
                  >
                    <div className={`flex items-center gap-1 mr-3 text-xs text-red-400 group-hover/btn:text-red-300`}>停止</div>
                    <button className={`bg-red-500/20 text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-red-500/30 transition-colors`}>
                      <Square size={10} fill={`currentColor`} />
                    </button>
                  </div>
                ) : (
                  <div
                    className={`flex items-center bg-[#2a2a2a] rounded-full p-1 pl-3 border border-[#333] hover:border-gray-500 transition-colors cursor-pointer group/btn`}
                    onClick={e => {
                      e.stopPropagation();
                      fe();
                    }}
                  >
                    {T && isBuiltinModel(T) && getModelInputCost(T) !== null && (
                      <div className={`flex items-center gap-0.5 mr-2 text-[11px] text-orange-400 tabular-nums`}>
                        <Zap className={`w-3 h-3`} strokeWidth={2.5} />
                        <span>{formatTokenCost(getModelInputCost(T) || 0)}{getModelOutputCost(T) ? `/${getModelOutputCost(T)}` : ``}</span>
                      </div>
                    )}
                    <div className={`flex items-center gap-1 mr-3 text-xs text-gray-300 group-hover/btn:text-white`}>生成</div>
                    <button className={`bg-white text-black w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors`}>
                      <Send size={14} strokeWidth={3} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

        return (
          <Fragment>
            <div
              className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-[#1c1c1c] rounded-2xl border border-[#333] shadow-2xl min-w-[500px] w-max max-w-[920px] transition-all duration-300 origin-top z-50
                ${V ? `opacity-100 scale-100 p-4 overflow-visible` : `opacity-0 scale-95 pointer-events-none h-0 p-0 border-0 overflow-hidden`}
              `}
              onClick={e => e.stopPropagation()}
            >
              {!k && t}
              {V && !k && (
                <InputResizeHandle
                  targetRef={M}
                  onRequestFullscreen={() => A(true)}
                  onResizeEnd={(t, n) => updateNodeData(id, {
                    inputWidth: t,
                    inputHeight: n
                  })}
                />
              )}
            </div>
            <FullscreenEditorModal
              open={k}
              title={`编辑提示词 - 普通视频`}
              onClose={() => A(false)}
            >
              {t}
            </FullscreenEditorModal>
          </Fragment>
        );
      })()}
      {D && l.videoUrl && (
        createPortal(
          <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md`} onClick={() => O(false)}>
            <button className={`absolute top-6 right-6 p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors z-50`} onClick={() => O(false)}>
              <X size={32} />
            </button>
            <video
              src={l.videoUrl}
              className={`max-w-[95vw] max-h-[95vh] object-contain shadow-2xl rounded-lg outline-none`}
              controls={true}
              autoPlay={true}
              onClick={e => e.stopPropagation()}
            />
          </div>,
          document.body
        )
      )}
    </div>
  );
}

export default memo(VideoNode);