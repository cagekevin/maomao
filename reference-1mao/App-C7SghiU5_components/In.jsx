// TODO(全局, 无需 import): task, useThumbnail, onRefresh, onDelete, onRerun, onFullscreen, onToast, selectable, selected, onToggleSelect, v, n, t, detail, id, taskId, _taskSnapshot, i, b, width, height, duration, isFinite, m, p, w, type, status, channelName, modelName, prompt, createdAt, errorMsg, requestData, responseData, resultUrl, o, url, mediaType, thumbnailUrl, x, c, s, l, j, ee, alert, d, u
import _cmp_Ln from "./Ln.jsx";
import { Fn, e, _, Mn, Nn, Pn, g, En, Dn, M, Ve, a, S, C, jn, An, kn, k, D, A, N, On, I, F, _Component25, _Component4, O, T, _Component26, _Component6, _Component17, _Component27 } from "./shared.js";
import * as _shared from "./shared.js";
import * as G from "react";
var In = ({
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
  let [u, d] = G.useState(false);
  let [p, m] = G.useState(false);
  let g = G.useRef(null);
  let [_, v] = G.useState(() => {
    return Fn(e.mediaMeta);
  });
  let b = G.useCallback(t => {
    v(n => {
      let r = Fn({
        ...n,
        ...t
      });
      window.dispatchEvent(new CustomEvent(`mutiwindow-update-task-meta`, {
        detail: {
          id: e.id,
          taskId: e.taskId,
          meta: r,
          _taskSnapshot: e
        }
      }));
      return r;
    });
  }, [e.id, e.taskId, e]);
  G.useEffect(() => {
    if (_.width && _.height && !Mn.has(_.width)) {
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
    if (t && Mn.has(t) && (!n || n <= t)) {
      t = undefined;
      n = undefined;
    }
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
    } else if (e.mediaMeta?.width && Mn.has(e.mediaMeta.width)) {
      b({
        width: undefined,
        height: undefined
      });
    }
  }, [e.requestData, e.responseData, e.customRawResponse, e.mediaMeta, _.width, _.height, b]);
  let x = G.useCallback(e => {
    if (_.width && _.height) {
      return;
    }
    let t = e.currentTarget.currentSrc || e.currentTarget.src || ``;
    if (Nn.test(t) || Pn.test(t)) {
      return;
    }
    let n = e.currentTarget.naturalWidth;
    let r = e.currentTarget.naturalHeight;
    if (!!n && !!r && (!Mn.has(n) || !(r <= n))) {
      b({
        width: n,
        height: r
      });
    }
  }, [_.width, _.height, b]);
  let S = G.useCallback(e => {
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
  G.useEffect(() => {
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
  let w = En[e.type] || En.custom;
  let E = w.icon;
  let D = e.status === `running` || e.status === `pending`;
  let k = G.useMemo(() => {
    if (Dn.has(e.type) || !e.channelName) {
      return `内置`;
    } else {
      if (!(e.channelName === `内置`)) {
        e.channelName;
      }
      return e.channelName;
    }
  }, [e.type, e.channelName]);
  let A = G.useCallback(async () => {
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
  let j = G.useCallback(() => {
    i?.(e);
    m(false);
  }, [e, i]);
  let ee = G.useCallback(() => {
    r(e.id);
    m(false);
  }, [e.id, r]);
  let M = G.useCallback(t => {
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
  let N = G.useMemo(() => {
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
        const Component331 = `img`;
        const Component332 = `div`;
        const Component333 = `div`;
        return <Component333 className={`relative w-full h-32 overflow-hidden rounded-md`}>
            <Component331 draggable={true} onDragStart={M} src={t ? Ve(i, {
            width: 400,
            thumbnailUrl: e.thumbnailUrl
          }) : i} loading={`lazy`} decoding={`async`} className={`${n} w-full h-full`} onClick={() => {
            return a({
              url: i,
              type: `image`
            });
          }} onLoad={x} onError={e => {
            let t = e.currentTarget;
            if (t.src !== i) {
              t.src = i;
              return;
            }
            t.parentElement.style.display = `none`;
          }} />
            {_.width && _.height && <Component332 className={`absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/50 text-[10px] text-white/70 pointer-events-none`}>
                {_.width}
                {`x`}
                {_.height}
              </Component332>}
          </Component333>;
      }
      if (e.customOutputType === `video` && i) {
        const Component334 = `video`;
        const Component335 = `div`;
        const Component336 = `div`;
        return <Component336 className={`relative w-full h-32 overflow-hidden rounded-md bg-black`}>
            <Component334 draggable={true} onDragStart={M} src={r} poster={t ? e.thumbnailUrl : undefined} className={`${n} w-full h-full`} controls={false} muted={true} loop={true} playsInline={true} preload={`metadata`} onLoadedMetadata={S} onMouseEnter={e => {
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
            {_.duration ? <Component335 className={`absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/50 text-[10px] text-white/70 pointer-events-none flex items-center gap-1`}>
                <I size={10} className={`opacity-70`} />
                {C(_.duration)}
              </Component335> : <I size={16} className={`text-white/70 drop-shadow-md absolute bottom-1.5 right-1.5 pointer-events-none`} />}
          </Component336>;
      }
      if (e.customOutputType === `audio` && i) {
        const Component337 = `audio`;
        return <Component337 src={r} className={`w-full`} controls={true} />;
      }
      if (e.customOutputType === `text`) {
        const Component338 = `div`;
        return <Component338 className={`w-full max-h-28 overflow-y-auto text-xs text-gray-300 custom-scrollbar whitespace-pre-wrap cursor-grab active:cursor-grabbing px-1`} draggable={true} onDragStart={M}>
            {typeof e.customResultData == `object` ? JSON.stringify(e.customResultData) : e.customResultData}
          </Component338>;
      }
      if (!i) {
        return null;
      }
    }
    if (e.type === `text` && e.resultUrl) {
      const Component339 = `div`;
      return <Component339 className={`w-full text-xs text-gray-400 cursor-grab active:cursor-grabbing hover:text-gray-200 transition-colors px-1`} draggable={true} onDragStart={M} onClick={() => {
        return a({
          url: e.resultUrl,
          type: `text`
        });
      }}>{`点击查看 / 拖入画布`}</Component339>;
    }
    if ((e.type === `image` || e.type === `rhWebapp` && (!e.customOutputType || e.customOutputType === `image`)) && e.resultUrl && !r(e.resultUrl) && !/\.(flac|mp3|wav|ogg|m4a|aac|opus|wma|aiff)(\?|$)/i.test(e.resultUrl) && !/\.(txt|md|json)(\?|$)/i.test(e.resultUrl)) {
      let r = e.resultUrl;
      const Component340 = `img`;
      const Component341 = `div`;
      const Component342 = `div`;
      return <Component342 className={`relative w-full h-32 overflow-hidden rounded`}>
          <Component340 draggable={true} onDragStart={M} src={t ? Ve(r, {
          width: 400,
          thumbnailUrl: e.thumbnailUrl
        }) : r} loading={`lazy`} decoding={`async`} className={`${n} w-full h-full object-cover`} onClick={() => {
          return a({
            url: r,
            type: `image`
          });
        }} onLoad={x} onError={e => {
          let t = e.currentTarget;
          if (t.src !== r) {
            t.src = r;
            return;
          }
          t.parentElement.style.display = `none`;
        }} />
          {_.width && _.height && <Component341 className={`absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/50 text-[10px] text-white/70 pointer-events-none`}>
              {_.width}
              {`x`}
              {_.height}
            </Component341>}
        </Component342>;
    }
    if (r(e.resultUrl)) {
      const Component343 = `video`;
      const Component344 = `div`;
      const Component345 = `div`;
      return <Component345 className={`relative w-full h-32 overflow-hidden rounded bg-black`}>
          <Component343 draggable={true} onDragStart={M} src={e.resultUrl} poster={t ? e.thumbnailUrl : undefined} className={`${n} w-full h-full object-contain`} muted={true} loop={true} playsInline={true} preload={`metadata`} onLoadedMetadata={S} onMouseEnter={e => {
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
          {_.duration ? <Component344 className={`absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/50 text-[10px] text-white/70 pointer-events-none flex items-center gap-1`}>
              <I size={10} className={`opacity-70`} />
              {C(_.duration)}
            </Component344> : <I size={16} className={`text-white/70 drop-shadow-md absolute bottom-1.5 right-1.5 pointer-events-none`} />}
        </Component345>;
    }
    if (/\.(flac|mp3|wav|ogg|m4a|aac|opus|wma|aiff)(\?|$)/i.test(e.resultUrl)) {
      const Component346 = `audio`;
      const Component347 = `div`;
      return <Component347 className={`relative w-full h-16 bg-[#111] flex flex-col items-center justify-center gap-2 border border-[#333] rounded-md overflow-hidden`}>
          <Component346 src={e.resultUrl} controls={true} preload={`metadata`} className={`w-[90%] h-8`} />
        </Component347>;
    }
    if (/\.(txt|md|json)(\?|$)/i.test(e.resultUrl)) {
      const Component348 = `div`;
      return <Component348 className={`w-full text-xs text-gray-400 cursor-grab active:cursor-grabbing hover:text-gray-200 transition-colors px-1 h-12 flex items-center border border-[#333] bg-[#1a1a1a] rounded px-2`} draggable={true} onDragStart={M} onClick={() => {
        return a({
          url: e.resultUrl,
          type: `text`
        });
      }}>{`点击查看文本文件 / 拖入画布`}</Component348>;
    }
    if (e.thumbnailUrl || e.resultUrl) {
      let r = e.resultUrl || e.thumbnailUrl || ``;
      const Component349 = `img`;
      const Component350 = `div`;
      return <Component350 className={`relative w-full h-32 overflow-hidden rounded`}>
          <Component349 draggable={true} onDragStart={M} src={t ? Ve(r, {
          width: 400,
          thumbnailUrl: e.thumbnailUrl
        }) : r} loading={`lazy`} decoding={`async`} className={`${n} w-full h-full object-cover`} onClick={() => {
          return a({
            url: r,
            type: `image`
          });
        }} onLoad={x} onError={e => {
          let t = e.currentTarget;
          if (r && t.src !== r) {
            t.src = r;
          }
        }} />
        </Component350>;
    }
    const Component351 = `div`;
    return <Component351 className={`w-full h-16 flex items-center justify-center text-gray-600 text-[11px] gap-2`}>
        <I size={14} className={`opacity-40`} />
        {`无预览`}
      </Component351>;
  }, [e, t, M, a]);
  const Component352 = `input`;
  const Component353 = `div`;
  const Component354 = `span`;
  const Component355 = `span`;
  const Component356 = `div`;
  const Component357 = `span`;
  const Component358 = `span`;
  const Component359 = `div`;
  const Component360 = `span`;
  const Component361 = `span`;
  const Component362 = `button`;
  const Component363 = `button`;
  const Component364 = `button`;
  const Component365 = `span`;
  const Component366 = `button`;
  const Component367 = `span`;
  const Component368 = `button`;
  const Component369 = `span`;
  const Component370 = `button`;
  const Component371 = `div`;
  const Component372 = `span`;
  const Component373 = `button`;
  const Component374 = `div`;
  const Component375 = `div`;
  const Component376 = `div`;
  const Component377 = `div`;
  const Component378 = `div`;
  const Component379 = `div`;
  const Component380 = `div`;
  const Component381 = `div`;
  const Component382 = `div`;
  const Component383 = `div`;
  const Component384 = `button`;
  const Component385 = `div`;
  const Component386 = `div`;
  const Component387 = `span`;
  const Component388 = `button`;
  const Component389 = `div`;
  const Component390 = `div`;
  return <Component390 className={`relative px-3 py-4 border-b border-white/10 last:border-b-0 group transition-colors ${c ? `bg-blue-500/10` : ``}`} onClick={() => {
    return s && l?.(e.id);
  }}>
      <Component377 className={`flex items-center gap-2 mb-1.5 relative z-20`}>
        {s && <Component353 className={`flex-shrink-0 mr-1`}>
            <Component352 type={`checkbox`} checked={c} readOnly={true} className={`w-3.5 h-3.5 rounded bg-[#1c1c1c] border-[#444] text-blue-500 focus:ring-0 cursor-pointer`} />
          </Component353>}
        <Component356 className={`flex items-center gap-1.5 flex-shrink-0`}>
          <Component354 className={`w-1.5 h-1.5 rounded-full ${jn(e.status)}`} />
          <Component355 className={`text-[11px] font-medium ${An(e.status)}`}>{kn(e)}</Component355>
        </Component356>
        <Component357 className={`w-1 h-1 rounded-full bg-gray-600 flex-shrink-0`} />
        <Component359 className={`flex items-center gap-1 text-gray-400 flex-shrink-0`}>
          <E size={11} />
          <Component358 className={`text-[11px]`}>{w.label}</Component358>
        </Component359>
        {e.modelName && <Component360 className={`text-[11px] text-gray-400 truncate min-w-0 flex-1`} title={`${k} · ${typeof e.modelName == `string` ? e.modelName : JSON.stringify(e.modelName)}`}>
            {`· `}
            {typeof e.modelName == `string` ? e.modelName : JSON.stringify(e.modelName)}
          </Component360>}
        {!e.modelName && <Component361 className={`flex-1 min-w-0`} />}
        <Component376 className={`flex items-center gap-1 flex-shrink-0 text-gray-500`}>
          {e.prompt && <Component362 onClick={t => {
          t.stopPropagation();
          let n = typeof e.prompt == `string` ? e.prompt : JSON.stringify(e.prompt);
          navigator.clipboard.writeText(n).then(() => {
            return o?.(`提示词已复制`);
          });
        }} className={`hover:text-gray-200 p-0.5 rounded transition-colors mr-1`} title={`复制提示词`}>
              <F size={11} />
            </Component362>}
          {D && <_Component25 size={11} className={`animate-spin text-blue-400`} />}
          {(e.status === `running` || e.status === `pending` || e.status === `failed`) && (e.type === `video` || e.type === `sd2Video` || e.type === `discountVideo` || e.type === `rhWebapp`) && <Component363 onClick={() => {
          return n(e);
        }} className={`hover:text-gray-200 p-0.5 rounded transition-colors`} title={`刷新状态`}>
                <_Component4 size={11} />
              </Component363>}
          <Component375 className={`relative`} ref={g}>
            <Component364 onClick={e => {
            e.stopPropagation();
            m(e => {
              return !e;
            });
          }} className={`hover:text-gray-200 p-0.5 rounded transition-colors cursor-pointer`} title={`更多操作`}>
              <O size={13} />
            </Component364>
            {p && <Component374 className={`absolute right-0 top-5 z-30 min-w-[140px] bg-[#1c1c1c] rounded-md shadow-2xl ring-1 ring-white/10 p-1 nodrag nowheel`} onClick={e => {
            return e.stopPropagation();
          }}>
                {i && <Component366 className={`w-full text-left px-2 py-1.5 text-[11px] text-gray-300 hover:bg-white/5 rounded flex items-center gap-2`} onClick={j}>
                    <T size={11} className={`text-gray-400`} />
                    <Component365>{`再来一次`}</Component365>
                  </Component366>}
                <Component368 className={`w-full text-left px-2 py-1.5 text-[11px] text-gray-300 hover:bg-white/5 rounded flex items-center gap-2`} onClick={t => {
              t.stopPropagation();
              n(e);
              m(false);
            }}>
                  <_Component4 size={11} className={`text-gray-400`} />
                  <Component367>{`刷新状态`}</Component367>
                </Component368>
                <Component370 className={`w-full text-left px-2 py-1.5 text-[11px] text-gray-300 hover:bg-white/5 rounded flex items-center gap-2`} onClick={A}>
                  <F size={11} className={`text-gray-400`} />
                  <Component369>{`复制任务信息`}</Component369>
                </Component370>
                <Component371 className={`h-[1px] bg-white/10 my-1`} />
                <Component373 className={`w-full text-left px-2 py-1.5 text-[11px] text-red-400 hover:bg-white/5 rounded flex items-center gap-2`} onClick={ee}>
                  <_Component26 size={11} />
                  <Component372>{`删除`}</Component372>
                </Component373>
              </Component374>}
          </Component375>
        </Component376>
      </Component377>
      {e.prompt && <Component378 className={`text-sm text-gray-100 line-clamp-2 leading-snug mb-1.5`} title={typeof e.prompt == `string` ? e.prompt : JSON.stringify(e.prompt)}>
          {typeof e.prompt == `string` ? e.prompt : JSON.stringify(e.prompt)}
        </Component378>}
      <Component379 className={`text-[10px] text-gray-500 mb-2 relative z-10`}>
        {new Date(e.createdAt).toLocaleString()}
      </Component379>
      {D && <Component381 className={`w-full h-1 bg-white/5 rounded-full overflow-hidden mb-2 relative z-10`}>
          <Component380 className={`h-full ${jn(e.status)} transition-all duration-300 ease-out`} style={{
        width: `${Math.max(5, e.progress || 0)}%`
      }} />
        </Component381>}
      {e.errorMsg && <Component383 className={`text-[10px] text-red-400 break-words mb-2 relative z-10 bg-red-500/10 border border-red-500/20 p-1.5 rounded cursor-pointer hover:bg-red-500/20 transition-colors`} onClick={t => {
      t.stopPropagation();
      alert(`任务错误详情:\n\n${typeof e.errorMsg == `object` ? JSON.stringify(e.errorMsg, null, 2) : e.errorMsg}`);
    }} title={`点击查看完整错误信息`}>
          <Component382 className={`line-clamp-2`}>
            {`⚠️ `}
            {typeof e.errorMsg == `object` ? JSON.stringify(e.errorMsg) : e.errorMsg}
          </Component382>
        </Component383>}
      {e.status === `completed` && <Component386 className={`relative mb-2`}>
          {N}
          {e.resultUrl && <Component385 className={`absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity`}>
              <Component384 onClick={async t => {
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
                <_Component6 size={12} />
              </Component384>
            </Component385>}
        </Component386>}
      <Component388 className={`text-[11px] text-gray-300 hover:text-white inline-flex items-center gap-1 px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-full transition-colors`} onClick={() => {
      return d(e => {
        return !e;
      });
    }}>
        {u ? <_Component17 size={12} /> : <_Component27 size={12} />}
        <Component387>{u ? `收起详情` : `展开请求/响应数据`}</Component387>
      </Component388>
      {u && <Component389 className={`flex flex-col gap-2 mt-2`}>
          <_cmp_Ln title={`请求数据`} code={On(e.requestData)} emptyHint={`(无请求数据)`} />
          <_cmp_Ln title={`响应数据`} code={On(e.responseData ?? e.customRawResponse)} emptyHint={`(无响应数据)`} />
        </Component389>}
    </Component390>;
};
export default In;