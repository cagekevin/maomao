// TODO(全局, 无需 import): data, selected, updateNodeData, getNodes, getEdges, r, prompt, f, maxDuration, m, pauseGap, g, handleType, v, n, o, p, audioUrl, audioName, errorMessage, onGenerateAudio, x, l, i, chunks, s, loading, Uint8Array, u, type, signal, text, display, b, minHeight
import _cmp__Component8 from './_Component8.jsx';
import _cmp_Bn from './Bn.jsx';
import _cmp__Component12 from './_Component12.jsx';
import _cmp_Si from './Si.jsx';
import { id, We, e, Qt, Lt, y, a, js, X, _, h, d, Ot, _Component17, _Component7, _Component13, _Component0, K, _Component25 } from './shared.js';
import * as _shared from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
var Ms = Z.memo(({
  id: e,
  data: t,
  selected: n
}) => {
  let {
    updateNodeData: r,
    getNodes: i,
    getEdges: a
  } = We();
  let o = t;
  let s = Z.useRef(null);
  let [c, l] = Z.useState(null);
  let [u, d] = Z.useState(false);
  let [f, p] = Z.useState(t.prompt || `请输出简体中文。`);
  let [m, h] = Z.useState(t.maxDuration || 10);
  let [g, _] = Z.useState(t.pauseGap || 0.3);
  Z.useEffect(() => {
    r(e, {
      prompt: f,
      maxDuration: m,
      pauseGap: g
    });
  }, [f, m, g, e, r]);
  let v = Qt(Lt({
    handleType: `target`
  }).map(e => {
    return e.source;
  }));
  let y = Z.useRef(``);
  Z.useEffect(() => {
    if (c) {
      return;
    }
    let t = Array.isArray(v) ? v : v ? [v] : [];
    let n = ``;
    for (let e of t) {
      if (e?.data) {
        if (e.data.videoUrl && typeof e.data.videoUrl == `string`) {
          let t = e.data.videoUrl;
          if (t.startsWith(`data:audio/`) || t.startsWith(`data:video/`) || /\.(mp3|wav|ogg|m4a|mp4|webm|mov)($|\?)/i.test(t)) {
            n = t;
            break;
          }
        }
        if (e.data.imageUrl && typeof e.data.imageUrl == `string`) {
          let t = e.data.imageUrl;
          if (t.startsWith(`data:audio/`) || t.startsWith(`data:video/`) || /\.(mp3|wav|ogg|m4a|mp4|webm|mov)($|\?)/i.test(t)) {
            n = t;
            break;
          }
        }
        if (e.data.text && typeof e.data.text == `string`) {
          let t = e.data.text.match(/(https?:\/\/[^\s"'`<>]+)|(data:(audio|video)\/[^\s"']+)/i);
          if (t) {
            n = t[0];
            break;
          }
        }
      }
    }
    if (n && n !== y.current) {
      y.current = n;
      let t = `connected_audio.mp3`;
      if (n.startsWith(`data:audio/`)) {
        t = `base64_audio.mp3`;
      } else {
        try {
          let e = new URL(n);
          let r = e.pathname.split(`/`).pop();
          if (r && r.length > 0 && r !== `/` && r.includes(`.`)) {
            t = r + e.search;
          } else {
            t = n;
          }
        } catch {
          t = n;
        }
      }
      o.audioUrl = n;
      o.audioName = t;
      p(e => {
        return e;
      });
      r(e, {
        audioUrl: n,
        audioName: t,
        errorMessage: undefined
      });
    } else if (!n && y.current) {
      y.current = ``;
      if (!c) {
        r(e, {
          audioUrl: undefined,
          audioName: undefined
        });
      }
    }
  }, [v, c, e, r]);
  Z.useEffect(() => {
    r(e, {
      onGenerateAudio: x
    });
  }, [c, o.audioApiUrl, o.audioApiKey, o.audioModel, f, m, g]);
  let b = t => {
    let n = t.target.files?.[0];
    if (!n) {
      return;
    }
    l(n);
    let i = URL.createObjectURL(n);
    o.audioUrl = i;
    o.audioName = n.name;
    p(e => {
      return e;
    });
    r(e, {
      audioUrl: i,
      audioName: n.name,
      errorMessage: undefined,
      chunks: undefined
    });
    t.target.value = ``;
  };
  let x = async () => {
    let t = c;
    if (!t) {
      let n = a();
      let o = i();
      let s = n.filter(t => {
        return t.target === e;
      });
      let c = ``;
      for (let e of s) {
        let t = o.find(t => {
          return t.id === e.source;
        });
        if (t) {
          if (t.data.audioUrl && typeof t.data.audioUrl == `string`) {
            c = t.data.audioUrl;
            break;
          }
          if (t.data.videoUrl && typeof t.data.videoUrl == `string`) {
            let e = t.data.videoUrl;
            if (e.startsWith(`data:audio/`) || e.startsWith(`data:video/`) || /\.(mp3|wav|ogg|m4a|mp4|webm|mov)($|\?)/i.test(e)) {
              c = e;
              break;
            }
          }
          if (t.data.imageUrl && typeof t.data.imageUrl == `string`) {
            let e = t.data.imageUrl;
            if (e.startsWith(`data:audio/`) || e.startsWith(`data:video/`) || /\.(mp3|wav|ogg|m4a|mp4|webm|mov)($|\?)/i.test(e)) {
              c = e;
              break;
            }
          }
          if (t.data.text && typeof t.data.text == `string`) {
            let e = t.data.text.match(/(https?:\/\/[^\s"'`<>]+)|(data:(audio|video)\/[^\s"']+)/i);
            if (e) {
              c = e[0];
              break;
            }
          }
        }
      }
      if (c) {
        r(e, {
          loading: true,
          errorMessage: `正在下载音频...`
        });
        try {
          if (c.startsWith(`data:audio/`) || c.startsWith(`data:video/`)) {
            let n = c.split(`,`);
            let i = n[0].match(/:(.*?);/);
            let a = i ? i[1] : `audio/mpeg`;
            let o = atob(n[1]);
            let s = o.length;
            let l = new Uint8Array(s);
            while (s--) {
              l[s] = o.charCodeAt(s);
            }
            let u = `media_generated.${a.split(`/`)[1] || `mp3`}`;
            t = new File([l], u, {
              type: a
            });
            r(e, {
              audioUrl: URL.createObjectURL(t),
              audioName: u
            });
          } else {
            let n = new AbortController();
            let i = setTimeout(() => {
              return n.abort();
            }, 180000);
            let a = await fetch(c, {
              signal: n.signal
            });
            clearTimeout(i);
            if (!a.ok) {
              throw Error(`下载失败: ${a.status}`);
            }
            let o = await a.blob();
            let s = c.split(`/`).pop() || `audio.mp3`;
            t = new File([o], s, {
              type: o.type || `audio/mpeg`
            });
            r(e, {
              audioUrl: URL.createObjectURL(t),
              audioName: s
            });
          }
        } catch (t) {
          r(e, {
            loading: false,
            errorMessage: t.name === `AbortError` ? `音频下载超时 (3分钟)` : `音频下载失败: ${t.message}`
          });
          return;
        }
      }
    }
    if (!t) {
      o.onShowToast?.(`请先上传音频文件或连接包含音频URL的节点`);
      return;
    }
    if (!o.audioApiUrl || !o.audioApiKey) {
      r(e, {
        errorMessage: `请在设置中配置听音 API Key`
      });
      return;
    }
    r(e, {
      loading: true,
      errorMessage: undefined
    });
    try {
      let n = await js(t, o.audioApiUrl, o.audioApiKey, o.audioModel || `whisper-1`, f, m, g);
      r(e, {
        loading: false,
        chunks: n,
        text: JSON.stringify(n, null, 2)
      });
      o.onShowToast?.(`听音断句完成！`);
    } catch (t) {
      console.error(`Audio processing failed:`, t);
      r(e, {
        loading: false,
        errorMessage: t.message || `处理失败，请重试`
      });
    }
  };
  const Component1061 = `span`;
  const Component1062 = `input`;
  const Component1063 = `button`;
  const Component1064 = `div`;
  const Component1065 = `div`;
  const Component1066 = `span`;
  const Component1067 = `div`;
  const Component1068 = `span`;
  const Component1069 = `div`;
  const Component1070 = `span`;
  const Component1071 = `button`;
  const Component1072 = `div`;
  const Component1073 = `pre`;
  const Component1074 = `div`;
  const Component1075 = `div`;
  const Component1076 = `div`;
  const Component1077 = `span`;
  const Component1078 = `div`;
  const Component1079 = `div`;
  const Component1080 = `video`;
  const Component1081 = `audio`;
  const Component1082 = `div`;
  const Component1083 = `span`;
  const Component1084 = `div`;
  const Component1085 = `label`;
  const Component1086 = `input`;
  const Component1087 = `div`;
  const Component1088 = `label`;
  const Component1089 = `input`;
  const Component1090 = `div`;
  const Component1091 = `label`;
  const Component1092 = `input`;
  const Component1093 = `div`;
  const Component1094 = `div`;
  const Component1095 = `div`;
  const Component1096 = `span`;
  const Component1097 = `button`;
  const Component1098 = `button`;
  const Component1099 = `div`;
  const Component1100 = `div`;
  const Component1101 = `div`;
  const Component1102 = `div`;
  return <Component1102 className={`relative flex flex-col group/node transition-all w-[360px] ${n ? `z-50` : `z-10`}`}>
      <_cmp__Component8 id={e} data={t} defaultTitle={`听音断句`} icon={<Component1061 className={`text-gray-500`}>{`🎙️`}</Component1061>} />
      <Component1062 type={`file`} ref={s} style={{
      display: `none`
    }} accept={`audio/*,video/*`} onChange={b} />
      {o.audioUrl && <Component1065 className={`absolute -top-12 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none group-hover/node:pointer-events-auto nodrag pb-4`}>
          <Component1064 className={`flex items-center gap-1 px-3 py-2 bg-[#1c1c1c]/90 backdrop-blur-md border border-[#333] rounded-full shadow-lg`}>
            <_cmp_Bn url={o.audioUrl} fallbackExt={`mp3`} size={13} onToast={e => {
          return o.onShowToast?.(e);
        }} />
            <Component1063 className={`p-1.5 text-gray-400 hover:text-red-400 hover:bg-[#333] rounded-md`} onClick={() => {
          l(null);
          r(e, {
            audioUrl: undefined,
            audioName: undefined,
            chunks: undefined,
            errorMessage: undefined
          });
        }} title={`清除`}>
              <Ot size={14} />
            </Component1063>
          </Component1064>
        </Component1065>}
      <Component1101 className={`relative bg-[#1c1c1c] rounded-xl overflow-visible border shadow-xl transition-all duration-300 flex flex-col
          ${n ? `border-[#555]` : `border-[#333] hover:border-[#444]`}
        `} style={{
      minHeight: `160px`
    }}>
        <_cmp__Component12 type={`target`} position={X.Left} />
        <_cmp__Component12 type={`source`} position={X.Right} />
        <Component1076 className={`flex-1 p-3 overflow-y-auto bg-[#1a1a1a] custom-scrollbar relative min-h-[80px] max-h-[160px] rounded-t-xl`}>
          {o.loading && <Component1067 className={`absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-500 bg-[#1a1a1a]/80 backdrop-blur-sm z-10`}>
              <_cmp_Si size={24} />
              <Component1066 className={`text-xs`}>{`处理中...`}</Component1066>
            </Component1067>}
          {o.errorMessage && !o.loading ? <Component1069 className={`text-red-400 text-[10px] p-2 border border-red-500/30 rounded bg-red-500/10 flex items-start gap-1.5`}>
              <_Component17 size={12} className={`mt-0.5 flex-shrink-0`} />
              <Component1068 className={`break-all leading-tight`}>{o.errorMessage}</Component1068>
            </Component1069> : o.chunks ? <Component1074 className={`flex flex-col gap-1 nodrag`}>
              <Component1072 className={`flex justify-between items-center`}>
                <Component1070 className={`text-[10px] text-gray-500`}>
                  {`处理结果 (`}
                  {o.chunks.length}
                  {` 句)`}
                </Component1070>
                <Component1071 onClick={e => {
              e.stopPropagation();
              if (o.chunks) {
                navigator.clipboard.writeText(JSON.stringify(o.chunks, null, 2));
                o.onShowToast?.(`JSON 已复制到剪贴板`);
              }
            }} className={`text-[10px] flex items-center gap-1 text-gray-400 hover:text-white transition-colors`}>
                  <_Component7 size={10} />
                  {` 复制 JSON`}
                </Component1071>
              </Component1072>
              <Component1073 className={`text-[10px] text-gray-400 font-mono whitespace-pre-wrap break-all nodrag select-text mt-1`}>
                {JSON.stringify(o.chunks, null, 2)}
              </Component1073>
            </Component1074> : <Component1075 className={`flex items-center justify-center h-full text-gray-500 text-xs mt-8`}>{`等待上传并处理...`}</Component1075>}
        </Component1076>
        <Component1100 className={`p-3 bg-[#1a1a1a] flex flex-col gap-3 nodrag border-t border-[#2a2a2a] rounded-b-xl relative z-10`} onClick={e => {
        return e.stopPropagation();
      }}>
          {o.audioUrl ? <Component1082 className={`w-full flex flex-col gap-2 bg-[#111] p-2 rounded-lg border border-[#333]`}>
              <Component1079 className={`flex items-center justify-between`}>
                <Component1078 className={`flex items-center gap-2 overflow-hidden`}>
                  <_Component13 size={14} className={`text-green-500 flex-shrink-0`} />
                  <Component1077 className={`text-xs text-gray-300 truncate`} title={o.audioName}>
                    {o.audioName}
                  </Component1077>
                </Component1078>
              </Component1079>
              {o.audioUrl.match(/\.(mp4|webm|mov|ogg)($|\?)/i) || o.audioUrl.startsWith(`data:video/`) ? <Component1080 src={o.audioUrl} controls={true} className={`w-full h-24 object-contain outline-none nodrag bg-black rounded`} /> : <Component1081 src={o.audioUrl} controls={true} className={`w-full h-8 outline-none nodrag`} />}
            </Component1082> : <Component1084 className={`w-full py-4 rounded-lg border border-dashed border-[#444] bg-[#111] hover:bg-[#1a1a1a] hover:border-[#666] flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors group/upload`} onClick={() => {
          return s.current?.click();
        }}>
              <_Component0 size={16} className={`text-gray-500 group-hover/upload:text-green-500 transition-colors`} />
              <Component1083 className={`text-[10px] text-gray-500`}>{`点击上传音视频或连接含音频的节点`}</Component1083>
            </Component1084>}
          {u && <Component1095 className={`flex flex-col gap-3 bg-[#111] border border-[#333] rounded p-3 mt-1 animate-fade-in nodrag`}>
              <Component1087 className={`flex flex-col gap-1.5`}>
                <Component1085 className={`text-[10px] text-gray-400`}>{`提示词 (Prompt)`}</Component1085>
                <Component1086 type={`text`} className={`w-full bg-[#222] border border-[#333] rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500`} value={f} onChange={e => {
              return p(e.target.value);
            }} placeholder={`请输出简体中文。`} />
              </Component1087>
              <Component1094 className={`flex gap-2`}>
                <Component1090 className={`flex flex-col gap-1.5 flex-1`}>
                  <Component1088 className={`text-[10px] text-gray-400`}>{`换气停顿 (秒)`}</Component1088>
                  <Component1089 type={`number`} step={`0.1`} min={`0`} className={`w-full bg-[#222] border border-[#333] rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500`} value={g} onChange={e => {
                return _(parseFloat(e.target.value) || 0.3);
              }} />
                </Component1090>
                <Component1093 className={`flex flex-col gap-1.5 flex-1`}>
                  <Component1091 className={`text-[10px] text-gray-400`}>{`强制熔断 (秒)`}</Component1091>
                  <Component1092 type={`number`} step={`1`} min={`1`} className={`w-full bg-[#222] border border-[#333] rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500`} value={m} onChange={e => {
                return h(parseFloat(e.target.value) || 10);
              }} />
                </Component1093>
              </Component1094>
            </Component1095>}
          <Component1099 className={`flex justify-between items-center mt-1`}>
            <Component1097 className={`p-1.5 rounded flex items-center gap-1 transition-colors ${u ? `text-blue-400 bg-[#333]` : `text-gray-400 hover:bg-[#333]`}`} onClick={e => {
            e.stopPropagation();
            d(!u);
          }} title={`参数配置`}>
              <K size={14} />
              <Component1096 className={`text-[10px]`}>{u ? `收起配置` : `配置`}</Component1096>
            </Component1097>
            <Component1098 className={`px-4 py-1.5 rounded-full text-xs flex items-center gap-1.5 transition-all ${o.audioUrl ? o.loading ? `bg-blue-600/50 text-white cursor-wait` : `bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20` : `bg-[#333] text-gray-500 cursor-not-allowed`}`} onClick={x} disabled={!o.audioUrl || o.loading}>
              {o.loading ? <Q.Fragment>
                  <_Component25 size={12} className={`animate-spin`} />
                  {`处理中...`}
                </Q.Fragment> : <Q.Fragment>
                  <_Component13 size={12} />
                  {`开始断句`}
                </Q.Fragment>}
            </Component1098>
          </Component1099>
        </Component1100>
      </Component1101>
    </Component1102>;
});
export default Ms;