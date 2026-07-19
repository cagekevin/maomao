// ============================================================
// VideoExtractNode - 视频抽帧节点
// 原版函数名: Ns (L16031-L16603)
// ============================================================
import { memo, useState, useRef, useEffect, useMemo } from 'react';
import { Position, useReactFlow, useHandleConnections } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import {
  Film,
  Upload,
  Video,
  Copy,
  AlertCircle,
  Loader2,
  Settings,
  Zap,
} from 'lucide-react';
import NodeTitle from './NodeTitle';
import CustomHandle from './CustomHandle';
import ResizeController from './ResizeController';

// ====== Node Data Interface ======

interface VideoExtractNodeData {
  videoUrl?: string;
  videoName?: string;
  mode?: string;
  intervalSec?: number;
  frameCount?: number;
  sensitivity?: number;
  hiddenIndices?: number[];
  allExtractedImages?: string[];
  extractedImages?: string[];
  loading?: boolean;
  progress?: number;
  errorMessage?: string;
  onExtractFrames?: () => void;
  onShowToast?: (msg: string) => void;
  [key: string]: unknown;
}

interface AppNode {
  id: string;
  data: Record<string, unknown>;
}

// ====== Component ======

function VideoExtractNode({ id, data, selected }: NodeProps<AppNode>) {
  const { updateNodeData, getNodes, getEdges } = useReactFlow();
  const s = data as unknown as VideoExtractNodeData;
  const c = useRef<HTMLInputElement>(null);
  const [l, u] = useState<File | null>(null);
  const [d, f] = useState(false);
  const [p, m] = useState(s.mode || `count`);
  const [h, g] = useState(s.intervalSec || 2);
  const [_, v] = useState(s.frameCount || 9);
  const [y, b] = useState(s.sensitivity || 30);
  const [x] = useState(s.hiddenIndices || []);
  const S = useRef<HTMLVideoElement>(null);
  const [C, w] = useState(0);
  const [T, E] = useState(0);

  useEffect(() => {
    updateNodeData(id, {
      mode: p,
      intervalSec: h,
      frameCount: _,
      sensitivity: y,
      hiddenIndices: x
    });
  }, [p, h, _, y, x, id, updateNodeData]);

  const O = useHandleConnections({ type: 'target' });
  const k = useMemo(() => O.map(e => e.source), [O]);
  const A = useRef<string>(``);

  useEffect(() => {
    if (l) return;
    const t = Array.isArray(k) ? k : k ? [k] : [];
    let n = ``;
    for (const e of t) {
      if (e?.data) {
        if ((e.data as any).videoUrl && typeof (e.data as any).videoUrl == `string`) {
          n = (e.data as any).videoUrl;
          break;
        }
        if ((e.data as any).imageUrl && typeof (e.data as any).imageUrl == `string`) {
          const t = (e.data as any).imageUrl;
          if (t.startsWith(`data:video/`) || /\.(mp4|webm|mov|ogg)($|\?)/i.test(t)) {
            n = t;
            break;
          }
        }
        if ((e.data as any).text && typeof (e.data as any).text == `string`) {
          const t = (e.data as any).text.match(/(https?:\/\/[^\s"'`<>]+)|(data:(audio|video)\/[^\s"']+)/i);
          if (t) {
            n = t[0];
            break;
          }
        }
      }
    }
    if (n && n !== A.current) {
      A.current = n;
      let t = `connected_video.mp4`;
      if (n.startsWith(`data:video/`)) {
        t = `base64_video.mp4`;
      } else {
        try {
          const e = new URL(n);
          const r = e.pathname.split(`/`).pop();
          t = r && r.includes(`.`) ? r + e.search : n;
        } catch {
          t = n;
        }
      }
      updateNodeData(id, {
        videoUrl: n,
        videoName: t,
        errorMessage: undefined
      });
    } else if (!n && A.current) {
      A.current = ``;
      if (!l) {
        updateNodeData(id, {
          videoUrl: undefined,
          videoName: undefined
        });
      }
    }
  }, [k, l, id, updateNodeData]);

  useEffect(() => {
    updateNodeData(id, {
      onExtractFrames: N
    });
  }, [l, p, h, _, y]);

  const j = (t: React.ChangeEvent<HTMLInputElement>) => {
    const n = t.target.files?.[0];
    if (!n) return;
    u(n);
    const r = URL.createObjectURL(n);
    (s as any).videoUrl = r;
    (s as any).videoName = n.name;
    updateNodeData(id, {
      videoUrl: r,
      videoName: n.name,
      errorMessage: undefined,
      extractedImages: undefined,
      progress: 0
    });
    t.target.value = ``;
  };

  const M = async () => {
    const t = S.current;
    if (t) try {
      const n = document.createElement(`canvas`);
      const r = n.getContext(`2d`, {
        willReadFrequently: true
      });
      if (!r) throw Error(`Canvas not supported`);
      let a = t.videoWidth;
      let o = t.videoHeight;
      if (a === 0 || o === 0) throw Error(`Video dimensions not available`);
      if (a > 800 || o > 800) {
        if (a > o) {
          o = Math.round(o * 800 / a);
          a = 800;
        } else {
          a = Math.round(a * 800 / o);
          o = 800;
        }
      }
      n.width = a;
      n.height = o;
      r.drawImage(t, 0, 0, a, o);
      const c = n.toDataURL(`image/jpeg`, .8);
      const l = [...(s.allExtractedImages || []), c];
      updateNodeData(id, {
        allExtractedImages: l,
        extractedImages: l
      });
      s.onShowToast?.(`已截取当前帧`);
    } catch (e) {
      console.error(`Manual capture failed:`, e);
      s.onShowToast?.(`截取失败，可能是跨域限制或视频未就绪`);
    }
  };

  const N = async () => {
    let t = ``;
    if (l) {
      t = URL.createObjectURL(l);
    } else {
      const n = getEdges();
      const r = getNodes();
      const i = n.filter(t => t.target === id);
      for (const e of i) {
        const n = r.find(t => t.id === e.source);
        if (n) {
          if ((n.data as any).videoUrl && typeof (n.data as any).videoUrl == `string`) {
            const e = (n.data as any).videoUrl;
            if (e.startsWith(`data:audio/`) || e.startsWith(`data:video/`) || /\.(mp3|wav|ogg|m4a|mp4|webm|mov)($|\?)/i.test(e)) {
              t = e;
              break;
            }
          }
          if ((n.data as any).imageUrl && typeof (n.data as any).imageUrl == `string`) {
            const e = (n.data as any).imageUrl;
            if (e.startsWith(`data:video/`) || /\.(mp4|webm|mov|ogg)($|\?)/i.test(e)) {
              t = e;
              break;
            }
          }
          if ((n.data as any).text && typeof (n.data as any).text == `string`) {
            const e = (n.data as any).text.match(/(https?:\/\/[^\s"'`<>]+)|(data:(audio|video)\/[^\s"']+)/i);
            if (e) {
              t = e[0];
              break;
            }
          }
        }
      }
    }
    if (!t) {
      s.onShowToast?.(`请先上传视频或连接包含视频的节点`);
      return;
    }
    updateNodeData(id, {
      loading: true,
      errorMessage: undefined,
      progress: 0,
      extractedImages: []
    });
    try {
      const n = document.createElement(`video`);
      n.src = t;
      n.crossOrigin = `anonymous`;
      n.muted = true;
      n.playsInline = true;
      await new Promise<void>((e, t) => {
        n.onloadedmetadata = () => e();
        n.onerror = t;
      });
      const r = n.duration;
      if (!r || isNaN(r) || r === 1 / 0) throw Error(`无法获取视频时长`);
      const a = document.createElement(`canvas`);
      const o = a.getContext(`2d`, {
        willReadFrequently: true
      });
      if (!o) throw Error(`Canvas 2D ctx not supported`);
      let c = n.videoWidth;
      let l = n.videoHeight;
      if (c > 800 || l > 800) {
        if (c > l) {
          l = Math.round(l * 800 / c);
          c = 800;
        } else {
          c = Math.round(c * 800 / l);
          l = 800;
        }
      }
      a.width = c;
      a.height = l;
      const u = async (e: number) => new Promise<string>(t => {
        const r = () => {
          n.removeEventListener(`seeked`, r);
          o.drawImage(n, 0, 0, c, l);
          t(a.toDataURL(`image/jpeg`, .8));
        };
        n.addEventListener(`seeked`, r);
        n.currentTime = e;
      });
      const d: number[] = [];
      if (p === `count`) {
        const e = Math.max(1, _);
        const t = r / (e + 1);
        for (let n = 1; n <= e; n++) d.push(n * t);
      } else if (p === `interval`) {
        const e = Math.max(.5, h);
        for (let t = e; t < r; t += e) d.push(t);
      } else if (p === `first_last`) {
        d.push(0);
        d.push(Math.max(0, r - .1));
      } else if (p === `manual`) {
        s.onShowToast?.(`手动模式请直接在上方播放器中截取`);
        return;
      } else if (p === `smart`) {
        const t = document.createElement(`canvas`);
        t.width = 16;
        t.height = 16;
        const a = t.getContext(`2d`, {
          willReadFrequently: true
        });
        if (!a) throw Error(`Canvas 2D ctx not supported`);
        const o = async (e: number) => new Promise<Uint8ClampedArray>(t => {
          const r = () => {
            n.removeEventListener(`seeked`, r);
            a.drawImage(n, 0, 0, 16, 16);
            t(a.getImageData(0, 0, 16, 16).data);
          };
          n.addEventListener(`seeked`, r);
          n.currentTime = e;
        });
        let s = null;
        const c = 195840 * (.01 + .24 * ((100 - y) / 100) ** 2);
        for (let t = .5; t < r; t += .5) {
          updateNodeData(id, {
            progress: Math.round(t / r * 50)
          });
          const n = await o(t);
          if (s) {
            let e = 0;
            for (let t = 0; t < n.length; t += 4) {
              e += Math.abs(n[t] - s[t]);
              e += Math.abs(n[t + 1] - s[t + 1]);
              e += Math.abs(n[t + 2] - s[t + 2]);
            }
            if (e > c) {
              d.push(t);
              t += 1;
              s = await o(t);
              continue;
            }
          }
          s = n;
        }
      }
      if (d.length === 0 && p === `smart`) d.push(r / 2);
      const f: string[] = [];
      for (let t = 0; t < d.length; t++) {
        updateNodeData(id, {
          progress: 50 + Math.round(t / d.length * 50)
        });
        const n = await u(d[t]);
        f.push(n);
        updateNodeData(id, {
          extractedImages: [...f]
        });
      }
      updateNodeData(id, {
        loading: false,
        progress: 100,
        allExtractedImages: f,
        extractedImages: f,
        hiddenIndices: [],
        imageUrl: undefined
      });
      s.onShowToast?.(`抽帧完成！共提取 ${f.length} 张图片`);
      n.src = ``;
      n.load();
    } catch (t) {
      console.error(`Frame extraction failed:`, t);
      updateNodeData(id, {
        loading: false,
        errorMessage: (t as Error).message || `抽帧失败，可能是视频格式或跨域限制`
      });
    }
  };

  const P = async (e: React.MouseEvent) => {
    if (e.stopPropagation(), !s.extractedImages || s.extractedImages.length === 0) {
      s.onShowToast?.(`没有提取出的图片可复制`);
      return;
    }
    try {
      const e = {
        type: `mutiwindow-images`,
        images: s.extractedImages
      };
      const t = JSON.stringify(e);
      try {
        await navigator.clipboard.writeText(t);
      } catch {
        localStorage.setItem(`mutiwindow-clipboard`, t);
      }
      s.onShowToast?.(`已复制 ${s.extractedImages.length} 张图片`);
    } catch {
      s.onShowToast?.(`复制失败`);
    }
  };

  return (
    <div className={`relative group/node w-full h-full min-w-[280px] ${p === `manual` ? `min-h-[380px]` : `min-h-[220px]`}`}>
      <NodeTitle
        id={id}
        data={data as any}
        defaultTitle={`视频抽帧`}
        icon={<Film size={11} className={`text-gray-500`} />}
      />
      <ResizeController
        visible={!!selected}
        minWidth={280}
        minHeight={p === `manual` ? 380 : 220}
      />
      <div className={`w-full h-full bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl transition-all duration-300 flex flex-col ${selected ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`}>
        <CustomHandle
          type={`target`}
          position={Position.Left}
        />
        <input
          type={`file`}
          ref={c}
          style={{
            display: `none`
          }}
          accept={`video/*`}
          onChange={j}
        />
        <div className={`flex-1 flex flex-col overflow-hidden relative`}>
          <div className={`flex-1 bg-[#111] p-4 overflow-y-auto relative border-b border-[#2a2a2a] custom-scrollbar nowheel nopan nodrag flex flex-col gap-4`}>
            {s.allExtractedImages && s.allExtractedImages.length > 0 && (
              <button
                onClick={e => P(e)}
                className={`absolute top-2 right-2 z-10 text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 px-2 py-1 rounded bg-[#222]/90 hover:bg-[#333] transition-colors`}
              >
                <Copy size={12} /> 复制全部
              </button>
            )}
            {s.errorMessage && (
              <div className={`flex flex-col items-center justify-center h-full gap-2 text-red-400 p-4 text-center`}>
                <AlertCircle size={24} />
                <span className={`text-xs break-words`}>{s.errorMessage}</span>
              </div>
            )}
            {p === `manual` && s.videoUrl && !s.errorMessage && (
              <div className={`flex flex-col gap-3 bg-[#1a1a1a] p-3 rounded-lg border border-[#333] flex-shrink-0`}>
                <video
                  ref={S}
                  src={s.videoUrl}
                  crossOrigin={`anonymous`}
                  className={`w-full aspect-video bg-black rounded`}
                  onLoadedMetadata={e => w(e.currentTarget.duration)}
                  onTimeUpdate={e => E(e.currentTarget.currentTime)}
                  playsInline={true}
                  muted={true}
                />
                <div className={`flex items-center gap-2 text-xs`}>
                  <button
                    onClick={() => {
                      S.current && (S.current.currentTime = Math.max(0, S.current.currentTime - .033));
                    }}
                    className={`px-2 py-1.5 bg-[#2a2a2a] rounded-md hover:bg-[#333] text-gray-300 transition-colors`}
                    title={`后退1帧`}
                  >
                    -1帧
                  </button>
                  <input
                    type={`range`}
                    min={`0`}
                    max={C || 100}
                    step={`0.01`}
                    value={T}
                    onChange={e => {
                      S.current && (S.current.currentTime = Number(e.target.value));
                    }}
                    className={`flex-1 accent-white min-w-0`}
                  />
                  <button
                    onClick={() => {
                      S.current && (S.current.currentTime = Math.min(C, S.current.currentTime + .033));
                    }}
                    className={`px-2 py-1.5 bg-[#2a2a2a] rounded-md hover:bg-[#333] text-gray-300 transition-colors`}
                    title={`前进1帧`}
                  >
                    +1帧
                  </button>
                  <button
                    onClick={M}
                    className={`px-4 py-1.5 bg-white hover:bg-gray-200 rounded-md text-black font-medium ml-2 flex-shrink-0 flex items-center gap-1.5 shadow-sm transition-colors`}
                  >
                    <Zap size={14} />截取
                  </button>
                </div>
              </div>
            )}
            {!s.errorMessage && s.allExtractedImages && s.allExtractedImages.length > 0 ? (
              <div className={`flex flex-col h-full gap-3`}>
                <div className={`flex justify-between items-center px-1`}>
                  <span className={`text-xs text-gray-400 font-medium`}>
                    已提取 {s.allExtractedImages.length} 帧 (当前生效 {s.extractedImages?.length || 0} 帧)
                  </span>
                </div>
                <div className={`grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-3 auto-rows-max`}>
                  {s.allExtractedImages.map((e, t) => x.includes(t) ? null : (
                    <div key={t} className={`aspect-video bg-black rounded-lg border relative group/img border-[#333] overflow-hidden`}>
                      <img src={e} loading={`lazy`} decoding={`async`} className={`w-full h-full object-cover`} />
                      <div className={`absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-3`}>
                        <button
                          onClick={t => {
                            t.stopPropagation();
                            try {
                              const t = JSON.stringify({
                                type: `mutiwindow-images`,
                                images: [e]
                              });
                              try {
                                navigator.clipboard.writeText(t);
                              } catch {
                                localStorage.setItem(`mutiwindow-clipboard`, t);
                              }
                              s.onShowToast?.(`已复制当前帧，请在空白处粘贴 (Ctrl+V)`);
                            } catch {
                              s.onShowToast?.(`复制失败`);
                            }
                          }}
                          className={`p-2 bg-[#222] hover:bg-white rounded-full text-gray-300 hover:text-black transition-all shadow-lg`}
                          title={`复制为新节点 (Ctrl+V粘贴)`}
                        >
                          <Copy size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : !s.errorMessage && !(p === `manual` && s.videoUrl) ? (
              <div className={`flex items-center justify-center h-full min-h-[120px]`}>
                {s.loading ? (
                  <div className={`flex flex-col items-center gap-3`}>
                    <Loader2 size={24} className={`animate-spin text-gray-400`} />
                    <span className={`text-xs text-gray-400`}>正在处理... {s.progress}%</span>
                    <div className={`w-32 h-1 bg-[#333] rounded-full overflow-hidden`}>
                      <div className={`h-full bg-white transition-all duration-300`} style={{ width: `${s.progress}%` }} />
                    </div>
                  </div>
                ) : (
                  <span className={`text-xs text-gray-500`}>等待提取</span>
                )}
              </div>
            ) : null}
          </div>
          <div className={`p-4 bg-[#1a1a1a] flex flex-col gap-4 nodrag border-t border-[#2a2a2a]`}>
            {s.videoUrl ? (
              <div className={`w-full flex items-center justify-between bg-[#111] rounded-lg px-3 py-2.5 border border-[#333]`}>
                <div className={`flex items-center gap-2 overflow-hidden`}>
                  <Video size={16} className={`text-gray-400 flex-shrink-0`} />
                  <span className={`text-xs text-gray-300 truncate`} title={s.videoName}>
                    {s.videoName || `已连接视频`}
                  </span>
                </div>
                <button
                  onClick={() => c.current?.click()}
                  className={`text-xs text-gray-400 hover:text-white flex-shrink-0 ml-2 px-3 py-1.5 bg-[#222] rounded-md hover:bg-[#333] transition-colors`}
                >
                  替换视频
                </button>
              </div>
            ) : (
              <div
                onClick={() => c.current?.click()}
                className={`w-full py-6 rounded-xl border-2 border-dashed border-[#333] bg-[#111] hover:bg-[#1a1a1a] hover:border-[#555] flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors`}
              >
                <div className={`p-3 bg-[#222] rounded-full`}>
                  <Upload size={18} className={`text-gray-400`} />
                </div>
                <span className={`text-xs text-gray-400 font-medium`}>点击上传视频或连接节点</span>
              </div>
            )}
            {d && (
              <div className={`flex flex-col gap-4 bg-[#111] border border-[#333] rounded-lg p-4 mt-1`}>
                <div className={`flex flex-col gap-2`}>
                  <label className={`text-[11px] text-gray-400 font-medium`}>抽帧模式</label>
                  <select
                    value={p}
                    onChange={e => m(e.target.value)}
                    className={`w-full bg-[#222] border border-[#333] rounded-md px-3 py-2 text-xs text-gray-200 outline-none focus:border-white transition-colors`}
                  >
                    <option value={`count`}>固定数量 (均匀分布)</option>
                    <option value={`interval`}>等距抽帧 (间隔秒数)</option>
                    <option value={`smart`}>智能转场检测</option>
                    <option value={`first_last`}>首尾帧 (第一帧和最后一帧)</option>
                    <option value={`manual`}>手动截取 (拖动轨道截取)</option>
                  </select>
                </div>
                {p === `count` && (
                  <div className={`flex flex-col gap-2`}>
                    <label className={`text-[11px] text-gray-400 font-medium`}>提取总张数</label>
                    <input
                      type={`number`}
                      min={`1`}
                      max={`100`}
                      value={_}
                      onChange={e => v(Number(e.target.value))}
                      className={`w-full bg-[#222] border border-[#333] rounded-md px-3 py-2 text-xs text-gray-200 outline-none focus:border-white transition-colors`}
                    />
                  </div>
                )}
                {p === `interval` && (
                  <div className={`flex flex-col gap-2`}>
                    <label className={`text-[11px] text-gray-400 font-medium`}>间隔秒数 (秒)</label>
                    <input
                      type={`number`}
                      min={`0.5`}
                      max={`3600`}
                      step={`0.5`}
                      value={h}
                      onChange={e => g(Number(e.target.value))}
                      className={`w-full bg-[#222] border border-[#333] rounded-md px-3 py-2 text-xs text-gray-200 outline-none focus:border-white transition-colors`}
                    />
                  </div>
                )}
                {p === `smart` && (
                  <div className={`flex flex-col gap-2`}>
                    <div className={`flex justify-between`}>
                      <label className={`text-[11px] text-gray-400 font-medium`}>检测敏感度</label>
                      <span className={`text-[11px] text-gray-500`}>{y}</span>
                    </div>
                    <input
                      type={`range`}
                      min={`1`}
                      max={`100`}
                      value={y}
                      onChange={e => b(Number(e.target.value))}
                      className={`w-full accent-white`}
                    />
                    <span className={`text-[10px] text-gray-500`}>数值越高越容易触发截图</span>
                  </div>
                )}
              </div>
            )}
            <div className={`flex justify-between items-center mt-1`}>
              <button
                className={`px-2.5 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${d ? `text-white bg-[#333]` : `text-gray-400 hover:bg-[#333] hover:text-white`}`}
                onClick={() => f(!d)}
                title={`参数配置`}
              >
                <Settings size={14} />
                <span className={`text-xs font-medium`}>{d ? `收起配置` : `配置`}</span>
              </button>
              {p !== `manual` && (
                <button
                  className={`px-5 py-2 rounded-full text-xs font-medium flex items-center gap-2 transition-all ${!s.videoUrl || s.loading ? `bg-[#2a2a2a] text-gray-500 cursor-not-allowed` : `bg-white text-black hover:bg-gray-200 shadow-md`}`}
                  onClick={e => {
                    e.stopPropagation();
                    s.videoUrl && !s.loading ? N() : s.videoUrl || s.onShowToast?.(`请先上传或连接视频`);
                  }}
                >
                  {s.loading ? `正在处理...` : `开始处理`}
                  <Zap size={14} />
                </button>
              )}
            </div>
          </div>
          <CustomHandle
            type={`source`}
            position={Position.Right}
            id={`main-output`}
          />
        </div>
      </div>
    </div>
  );
}

export default memo(VideoExtractNode);