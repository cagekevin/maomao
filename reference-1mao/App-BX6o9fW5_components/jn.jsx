// TODO(全局, 无需 import): task, useThumbnail, onRefresh, onDelete, onRerun, onFullscreen, onToast, selectable, selected, onToggleSelect, v, n, t, detail, taskId, i, b, width, height, duration, isFinite, m, p, w, id, type, status, channelName, modelName, prompt, createdAt, errorMsg, requestData, responseData, resultUrl, o, url, mediaType, x, c, s, l, j, alert, d, u
import _cmp_Mn from "./Mn.jsx";
import { e, _, g, Tn, En, N, a, S, C, An, kn, On, O, D, A, M, P, Dn, _Component25, I, _Component26, _Component3, _Component27, E, _Component28, _Component5, _Component16, _Component29 } from "./shared.js";
import * as _shared from "./shared.js";
import * as W from "react";
var jn = ({
  task: e,
  useThumbnail: t,
  onRefresh: n,
  onDelete: r,
  onRerun: i,
  onFullscreen: a,
  onToast: o,
  selectable: s,
  selected: c,
  onToggleSelect: l
}) => {
  let [u, d] = W.useState(false);
  let [p, m] = W.useState(false);
  let g = W.useRef(null);
  let [_, v] = W.useState(e.mediaMeta || {});
  let b = W.useCallback(t => {
    v(n => {
      let r = {
        ...n,
        ...t
      };
      window.dispatchEvent(new CustomEvent(`mutiwindow-update-task-meta`, {
        detail: {
          taskId: e.id,
          meta: r
        }
      }));
      return r;
    });
  }, [e.id]);
  W.useEffect(() => {
    if (e.mediaMeta?.width && e.mediaMeta?.duration) {
      return;
    }
    let t;
    let n;
    let r;
    try {
      if (e.requestData) {
        let i = typeof e.requestData == `string` ? JSON.parse(e.requestData) : e.requestData;
        if (i.width) {
          t = parseInt(i.width);
        }
        if (i.height) {
          n = parseInt(i.height);
        }
        if (i.video_length) {
          r = parseInt(i.video_length);
        }
      }
      let i = e.responseData || e.customRawResponse;
      if (i) {
        let e = typeof i == `string` ? JSON.parse(i) : i;
        if (e.width) {
          t = parseInt(e.width);
        }
        if (e.height) {
          n = parseInt(e.height);
        }
        if (e.duration) {
          r = parseFloat(e.duration);
        }
        if (e.data?.duration) {
          r = parseFloat(e.data.duration);
        }
        if (e.data?.width) {
          t = parseInt(e.data.width);
        }
        if (e.data?.height) {
          n = parseInt(e.data.height);
        }
      }
    } catch {}
    if (t || n || r) {
      b({
        ...(t ? {
          width: t
        } : {}),
        ...(n ? {
          height: n
        } : {}),
        ...(r ? {
          duration: r
        } : {})
      });
    }
  }, [e.requestData, e.responseData, e.customRawResponse, e.mediaMeta, b]);
  let x = W.useCallback(e => {
    if (_.width && _.height) {
      return;
    }
    let t = e.currentTarget.naturalWidth;
    let n = e.currentTarget.naturalHeight;
    if (t && n) {
      b({
        width: t,
        height: n
      });
    }
  }, [_.width, _.height, b]);
  let S = W.useCallback(e => {
    if (_.duration) {
      return;
    }
    let t = e.currentTarget.duration;
    if (t && isFinite(t)) {
      b({
        duration: t
      });
    }
  }, [_.duration, b]);
  let C = e => {
    if (!e || !isFinite(e)) {
      return ``;
    }
    let t = Math.floor(e / 60);
    let n = Math.floor(e % 60);
    return `${t.toString().padStart(2, `0`)}:${n.toString().padStart(2, `0`)}`;
  };
  W.useEffect(() => {
    if (!p) {
      return;
    }
    let e = e => {
      if (g.current && !g.current.contains(e.target)) {
        m(false);
      }
    };
    let t = window.setTimeout(() => {
      return window.addEventListener(`mousedown`, e);
    }, 0);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener(`mousedown`, e);
    };
  }, [p]);
  let w = Tn[e.type] || Tn.custom;
  let T = w.icon;
  let D = e.status === `running` || e.status === `pending`;
  let O = W.useMemo(() => {
    if (En.has(e.type) || !e.channelName) {
      return `内置`;
    } else {
      if (!(e.channelName === `内置`)) {
        e.channelName;
      }
      return e.channelName;
    }
  }, [e.type, e.channelName]);
  let A = W.useCallback(async () => {
    let t = {
      id: e.id,
      taskId: e.taskId,
      type: e.type,
      status: e.status,
      channelName: e.channelName,
      modelName: e.modelName,
      prompt: e.prompt,
      createdAt: new Date(e.createdAt).toISOString(),
      errorMsg: e.errorMsg,
      requestData: e.requestData,
      responseData: e.responseData ?? e.customRawResponse,
      resultUrl: e.resultUrl
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(t, null, 2));
      o?.(`任务信息已复制`);
    } catch {
      o?.(`复制失败`);
    }
    m(false);
  }, [e, o]);
  let j = W.useCallback(() => {
    i?.(e);
    m(false);
  }, [e, i]);
  let M = W.useCallback(() => {
    r(e.id);
    m(false);
  }, [e.id, r]);
  let N = W.useCallback(t => {
    let n = e.type === `custom` ? e.customResultData : e.resultUrl;
    let r = e.type === `video` || e.type === `sd2Video` || e.type === `discountVideo` ? `video` : e.type === `text` || e.customOutputType === `text` ? `text` : e.customOutputType === `audio` ? `audio` : `image`;
    if (!n) {
      t.preventDefault();
      return;
    }
    let i = typeof n == `string` ? n : JSON.stringify(n);
    t.dataTransfer.effectAllowed = `copy`;
    t.dataTransfer.setData(`text/uri-list`, i);
    t.dataTransfer.setData(`text/plain`, i);
    t.dataTransfer.setData(`application/x-mutiwindow-task`, JSON.stringify({
      url: i,
      mediaType: r,
      taskId: e.id,
      prompt: e.prompt
    }));
  }, [e]);
  let P = W.useMemo(() => {
    if (e.status !== `completed`) {
      return null;
    }
    let n = `w-full h-32 object-cover rounded-md bg-black/20 cursor-grab active:cursor-grabbing`;
    let r = t => {
      if (!t) {
        return false;
      }
      let n = t.trim().replace(/`/g, ``);
      if (e.type === `video` || e.type === `sd2Video` || e.type === `discountVideo` || e.type === `rhWebapp` && e.customOutputType === `video`) {
        return true;
      }
      let r = n.split(`?`)[0].split(`.`).pop()?.toLowerCase() || ``;
      return [`mp4`, `webm`, `mov`, `mkv`, `avi`].includes(r);
    };
    if ((e.type === `custom` || e.type === `rhWebapp`) && e.customResultData) {
      let r = typeof e.customResultData == `string` ? e.customResultData.trim() : ``;
      let i = /^(https?:|data:|blob:)/i.test(r);
      if (e.customOutputType === `image` && i) {
        let i = r;
        const Component329 = `img`;
        const Component330 = `div`;
        const Component331 = `div`;
        return <Component331 className={`relative w-full h-32 overflow-hidden rounded-md`}>
            <Component329 draggable={true} onDragStart={N} src={t && e.thumbnailUrl || i} loading={`lazy`} decoding={`async`} className={`${n} w-full h-full`} onClick={() => {
            return a({
              url: i,
              type: `image`
            });
          }} onLoad={x} onError={e => {
            e.currentTarget.parentElement.style.display = `none`;
          }} />
            {_.width && _.height && <Component330 className={`absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/50 text-[10px] text-white/70 pointer-events-none`}>
                {_.width}
                {`x`}
                {_.height}
              </Component330>}
          </Component331>;
      }
      if (e.customOutputType === `video` && i) {
        const Component332 = `video`;
        const Component333 = `div`;
        const Component334 = `div`;
        return <Component334 className={`relative w-full h-32 overflow-hidden rounded-md bg-black`}>
            <Component332 draggable={true} onDragStart={N} src={r} poster={t ? e.thumbnailUrl : undefined} className={`${n} w-full h-full`} controls={false} muted={true} loop={true} playsInline={true} preload={`metadata`} onLoadedMetadata={S} onMouseEnter={e => {
            e.currentTarget.play().catch(() => {});
          }} onMouseLeave={e => {
            e.currentTarget.pause();
            e.currentTarget.currentTime = 0;
          }} onClick={() => {
            return a({
              url: r,
              type: `video`
            });
          }} onError={e => {
            e.currentTarget.parentElement.style.display = `none`;
          }} />
            {_.duration ? <Component333 className={`absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/50 text-[10px] text-white/70 pointer-events-none flex items-center gap-1`}>
                <_Component25 size={10} className={`opacity-70`} />
                {C(_.duration)}
              </Component333> : <_Component25 size={16} className={`text-white/70 drop-shadow-md absolute bottom-1.5 right-1.5 pointer-events-none`} />}
          </Component334>;
      }
      if (e.customOutputType === `audio` && i) {
        const Component335 = `audio`;
        return <Component335 src={r} className={`w-full`} controls={true} />;
      }
      if (e.customOutputType === `text`) {
        const Component336 = `div`;
        return <Component336 className={`w-full max-h-28 overflow-y-auto text-xs text-gray-300 custom-scrollbar whitespace-pre-wrap cursor-grab active:cursor-grabbing px-1`} draggable={true} onDragStart={N}>
            {typeof e.customResultData == `object` ? JSON.stringify(e.customResultData) : e.customResultData}
          </Component336>;
      }
      if (!i) {
        return null;
      }
    }
    if (e.type === `text` && e.resultUrl) {
      const Component337 = `div`;
      return <Component337 className={`w-full text-xs text-gray-400 cursor-grab active:cursor-grabbing hover:text-gray-200 transition-colors px-1`} draggable={true} onDragStart={N} onClick={() => {
        return a({
          url: e.resultUrl,
          type: `text`
        });
      }}>{`点击查看 / 拖入画布`}</Component337>;
    }
    if ((e.type === `image` || e.type === `rhWebapp` && (!e.customOutputType || e.customOutputType === `image`)) && e.resultUrl && !r(e.resultUrl) && !/\.(flac|mp3|wav|ogg|m4a|aac|opus|wma|aiff)(\?|$)/i.test(e.resultUrl) && !/\.(txt|md|json)(\?|$)/i.test(e.resultUrl)) {
      let r = e.resultUrl;
      const Component338 = `img`;
      const Component339 = `div`;
      const Component340 = `div`;
      return <Component340 className={`relative w-full h-32 overflow-hidden rounded`}>
          <Component338 draggable={true} onDragStart={N} src={t && e.thumbnailUrl || r} loading={`lazy`} decoding={`async`} className={`${n} w-full h-full object-cover`} onClick={() => {
          return a({
            url: r,
            type: `image`
          });
        }} onLoad={x} onError={e => {
          e.target.parentElement.style.display = `none`;
        }} />
          {_.width && _.height && <Component339 className={`absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/50 text-[10px] text-white/70 pointer-events-none`}>
              {_.width}
              {`x`}
              {_.height}
            </Component339>}
        </Component340>;
    }
    if (r(e.resultUrl)) {
      const Component341 = `video`;
      const Component342 = `div`;
      const Component343 = `div`;
      return <Component343 className={`relative w-full h-32 overflow-hidden rounded bg-black`}>
          <Component341 draggable={true} onDragStart={N} src={e.resultUrl} poster={t ? e.thumbnailUrl : undefined} className={`${n} w-full h-full object-contain`} muted={true} loop={true} playsInline={true} preload={`metadata`} onLoadedMetadata={S} onMouseEnter={e => {
          e.currentTarget.play().catch(() => {});
        }} onMouseLeave={e => {
          e.currentTarget.pause();
          e.currentTarget.currentTime = 0;
        }} onClick={() => {
          return a({
            url: e.resultUrl,
            type: `video`
          });
        }} onError={e => {
          e.target.parentElement.style.display = `none`;
        }} />
          {_.duration ? <Component342 className={`absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/50 text-[10px] text-white/70 pointer-events-none flex items-center gap-1`}>
              <_Component25 size={10} className={`opacity-70`} />
              {C(_.duration)}
            </Component342> : <_Component25 size={16} className={`text-white/70 drop-shadow-md absolute bottom-1.5 right-1.5 pointer-events-none`} />}
        </Component343>;
    } else if (/\.(flac|mp3|wav|ogg|m4a|aac|opus|wma|aiff)(\?|$)/i.test(e.resultUrl)) {
      const Component344 = `audio`;
      const Component345 = `div`;
      return <Component345 className={`relative w-full h-16 bg-[#111] flex flex-col items-center justify-center gap-2 border border-[#333] rounded-md overflow-hidden`}>
          <Component344 src={e.resultUrl} controls={true} preload={`metadata`} className={`w-[90%] h-8`} />
        </Component345>;
    } else if (/\.(txt|md|json)(\?|$)/i.test(e.resultUrl)) {
      const Component346 = `div`;
      return <Component346 className={`w-full text-xs text-gray-400 cursor-grab active:cursor-grabbing hover:text-gray-200 transition-colors px-1 h-12 flex items-center border border-[#333] bg-[#1a1a1a] rounded px-2`} draggable={true} onDragStart={N} onClick={() => {
        return a({
          url: e.resultUrl,
          type: `text`
        });
      }}>{`点击查看文本文件 / 拖入画布`}</Component346>;
    } else if (e.thumbnailUrl) {
      const Component347 = `img`;
      const Component348 = `div`;
      const Component349 = `div`;
      return <Component349 className={`relative w-full h-32`}>
          <Component347 src={t ? e.thumbnailUrl : e.resultUrl || e.thumbnailUrl} className={`${n} w-full h-full`} draggable={true} onDragStart={N} onLoad={x} onError={e => {
          e.target.style.display = `none`;
        }} />
          {_.width && _.height && <Component348 className={`absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/50 text-[10px] text-white/70 pointer-events-none`}>
              {_.width}
              {`x`}
              {_.height}
            </Component348>}
        </Component349>;
    } else {
      const Component350 = `div`;
      return <Component350 className={`w-full h-16 flex items-center justify-center text-gray-600 text-[11px] gap-2`}>
          <_Component25 size={14} className={`opacity-40`} />
          {`无预览`}
        </Component350>;
    }
  }, [e, t, N, a]);
  const Component351 = `input`;
  const Component352 = `div`;
  const Component353 = `span`;
  const Component354 = `span`;
  const Component355 = `div`;
  const Component356 = `span`;
  const Component357 = `span`;
  const Component358 = `div`;
  const Component359 = `span`;
  const Component360 = `span`;
  const Component361 = `button`;
  const Component362 = `button`;
  const Component363 = `button`;
  const Component364 = `span`;
  const Component365 = `button`;
  const Component366 = `span`;
  const Component367 = `button`;
  const Component368 = `span`;
  const Component369 = `button`;
  const Component370 = `div`;
  const Component371 = `span`;
  const Component372 = `button`;
  const Component373 = `div`;
  const Component374 = `div`;
  const Component375 = `div`;
  const Component376 = `div`;
  const Component377 = `div`;
  const Component378 = `div`;
  const Component379 = `div`;
  const Component380 = `div`;
  const Component381 = `div`;
  const Component382 = `div`;
  const Component383 = `button`;
  const Component384 = `div`;
  const Component385 = `div`;
  const Component386 = `span`;
  const Component387 = `button`;
  const Component388 = `div`;
  const Component389 = `div`;
  return <Component389 className={`relative px-3 py-4 border-b border-white/10 last:border-b-0 group transition-colors ${c ? `bg-blue-500/10` : ``}`} onClick={() => {
    return s && l?.(e.id);
  }}>
      <Component376 className={`flex items-center gap-2 mb-1.5 relative z-20`}>
        {s && <Component352 className={`flex-shrink-0 mr-1`}>
            <Component351 type={`checkbox`} checked={c} readOnly={true} className={`w-3.5 h-3.5 rounded bg-[#1c1c1c] border-[#444] text-blue-500 focus:ring-0 cursor-pointer`} />
          </Component352>}
        <Component355 className={`flex items-center gap-1.5 flex-shrink-0`}>
          <Component353 className={`w-1.5 h-1.5 rounded-full ${An(e.status)}`} />
          <Component354 className={`text-[11px] font-medium ${kn(e.status)}`}>{On(e)}</Component354>
        </Component355>
        <Component356 className={`w-1 h-1 rounded-full bg-gray-600 flex-shrink-0`} />
        <Component358 className={`flex items-center gap-1 text-gray-400 flex-shrink-0`}>
          <T size={11} />
          <Component357 className={`text-[11px]`}>{w.label}</Component357>
        </Component358>
        {e.modelName && <Component359 className={`text-[11px] text-gray-400 truncate min-w-0 flex-1`} title={`${O} · ${typeof e.modelName == `string` ? e.modelName : JSON.stringify(e.modelName)}`}>
            {`· `}
            {typeof e.modelName == `string` ? e.modelName : JSON.stringify(e.modelName)}
          </Component359>}
        {!e.modelName && <Component360 className={`flex-1 min-w-0`} />}
        <Component375 className={`flex items-center gap-1 flex-shrink-0 text-gray-500`}>
          {e.prompt && <Component361 onClick={t => {
          t.stopPropagation();
          let n = typeof e.prompt == `string` ? e.prompt : JSON.stringify(e.prompt);
          navigator.clipboard.writeText(n).then(() => {
            return o?.(`提示词已复制`);
          });
        }} className={`hover:text-gray-200 p-0.5 rounded transition-colors mr-1`} title={`复制提示词`}>
              <I size={11} />
            </Component361>}
          {D && <_Component26 size={11} className={`animate-spin text-blue-400`} />}
          {(e.status === `running` || e.status === `pending` || e.status === `failed`) && (e.type === `video` || e.type === `sd2Video` || e.type === `discountVideo` || e.type === `rhWebapp`) && <Component362 onClick={() => {
          return n(e);
        }} className={`hover:text-gray-200 p-0.5 rounded transition-colors`} title={`刷新状态`}>
                <_Component3 size={11} />
              </Component362>}
          <Component374 className={`relative`} ref={g}>
            <Component363 onClick={e => {
            e.stopPropagation();
            m(e => {
              return !e;
            });
          }} className={`hover:text-gray-200 p-0.5 rounded transition-colors cursor-pointer`} title={`更多操作`}>
              <_Component27 size={13} />
            </Component363>
            {p && <Component373 className={`absolute right-0 top-5 z-30 min-w-[140px] bg-[#1c1c1c] rounded-md shadow-2xl ring-1 ring-white/10 p-1 nodrag nowheel`} onClick={e => {
            return e.stopPropagation();
          }}>
                {i && <Component365 className={`w-full text-left px-2 py-1.5 text-[11px] text-gray-300 hover:bg-white/5 rounded flex items-center gap-2`} onClick={j}>
                    <E size={11} className={`text-gray-400`} />
                    <Component364>{`再来一次`}</Component364>
                  </Component365>}
                <Component367 className={`w-full text-left px-2 py-1.5 text-[11px] text-gray-300 hover:bg-white/5 rounded flex items-center gap-2`} onClick={t => {
              t.stopPropagation();
              n(e);
              m(false);
            }}>
                  <_Component3 size={11} className={`text-gray-400`} />
                  <Component366>{`刷新状态`}</Component366>
                </Component367>
                <Component369 className={`w-full text-left px-2 py-1.5 text-[11px] text-gray-300 hover:bg-white/5 rounded flex items-center gap-2`} onClick={A}>
                  <I size={11} className={`text-gray-400`} />
                  <Component368>{`复制任务信息`}</Component368>
                </Component369>
                <Component370 className={`h-[1px] bg-white/10 my-1`} />
                <Component372 className={`w-full text-left px-2 py-1.5 text-[11px] text-red-400 hover:bg-white/5 rounded flex items-center gap-2`} onClick={M}>
                  <_Component28 size={11} />
                  <Component371>{`删除`}</Component371>
                </Component372>
              </Component373>}
          </Component374>
        </Component375>
      </Component376>
      {e.prompt && <Component377 className={`text-sm text-gray-100 line-clamp-2 leading-snug mb-1.5`} title={typeof e.prompt == `string` ? e.prompt : JSON.stringify(e.prompt)}>
          {typeof e.prompt == `string` ? e.prompt : JSON.stringify(e.prompt)}
        </Component377>}
      <Component378 className={`text-[10px] text-gray-500 mb-2 relative z-10`}>
        {new Date(e.createdAt).toLocaleString()}
      </Component378>
      {D && <Component380 className={`w-full h-1 bg-white/5 rounded-full overflow-hidden mb-2 relative z-10`}>
          <Component379 className={`h-full ${An(e.status)} transition-all duration-300 ease-out`} style={{
        width: `${Math.max(5, e.progress || 0)}%`
      }} />
        </Component380>}
      {e.errorMsg && <Component382 className={`text-[10px] text-red-400 break-words mb-2 relative z-10 bg-red-500/10 border border-red-500/20 p-1.5 rounded cursor-pointer hover:bg-red-500/20 transition-colors`} onClick={t => {
      t.stopPropagation();
      alert(`任务错误详情:\n\n${typeof e.errorMsg == `object` ? JSON.stringify(e.errorMsg, null, 2) : e.errorMsg}`);
    }} title={`点击查看完整错误信息`}>
          <Component381 className={`line-clamp-2`}>
            {`⚠️ `}
            {typeof e.errorMsg == `object` ? JSON.stringify(e.errorMsg) : e.errorMsg}
          </Component381>
        </Component382>}
      {e.status === `completed` && <Component385 className={`relative mb-2`}>
          {P}
          {e.resultUrl && <Component384 className={`absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity`}>
              <Component383 onClick={async t => {
          t.stopPropagation();
          try {
            let t = await (await fetch(e.resultUrl)).blob();
            let n = window.URL.createObjectURL(t);
            let r = document.createElement(`a`);
            r.href = n;
            r.download = `result-${e.id}.${e.type === `image` ? `png` : `mp4`}`;
            document.body.appendChild(r);
            r.click();
            document.body.removeChild(r);
            setTimeout(() => {
              return window.URL.revokeObjectURL(n);
            }, 1000);
          } catch {
            window.open(e.resultUrl, `_blank`);
          }
        }} className={`p-1.5 bg-black/50 backdrop-blur text-white/80 rounded hover:text-white`} title={`下载结果`}>
                <_Component5 size={12} />
              </Component383>
            </Component384>}
        </Component385>}
      <Component387 className={`text-[11px] text-gray-300 hover:text-white inline-flex items-center gap-1 px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-full transition-colors`} onClick={() => {
      return d(e => {
        return !e;
      });
    }}>
        {u ? <_Component16 size={12} /> : <_Component29 size={12} />}
        <Component386>{u ? `收起详情` : `展开请求/响应数据`}</Component386>
      </Component387>
      {u && <Component388 className={`flex flex-col gap-2 mt-2`}>
          <_cmp_Mn title={`请求数据`} code={Dn(e.requestData)} emptyHint={`(无请求数据)`} />
          <_cmp_Mn title={`响应数据`} code={Dn(e.responseData ?? e.customRawResponse)} emptyHint={`(无响应数据)`} />
        </Component388>}
    </Component389>;
};
export default jn;