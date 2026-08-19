// TODO(全局, 无需 import): data, selected, updateNodeData, handleType, b, x, r, videoUrl, videoName, n, errorMessage, i, fps, o, maxSize, colors, u, speed, f, loading, progress, resultInfo, startTime, m, g, endTime, v, onProgress, width, height, frameCount, size, display, l, s, p
import _cmp_Ti from './Ti.jsx';
import _cmp_Ei from './Ei.jsx';
import _cmp__Component10 from './_Component10.jsx';
import _cmp_Tc from './Tc.jsx';
import { id, We, t, Lt, Qt, Mc, S, h, Ec, _, y, c, a, X, C, Dc, Oc, kc, d, Ac, jc, D, w, T, E, _Component48, _Component8, _Component16, _n, _Component42 } from './shared.js';
import * as _shared from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
var Nc = Z.memo(({
  id: e,
  data: t,
  selected: n
}) => {
  let {
    updateNodeData: r
  } = We();
  let i = t;
  let a = Z.useRef(null);
  let [o, s] = Z.useState(t.fps || 10);
  let [c, l] = Z.useState(t.maxSize || 480);
  let [u, d] = Z.useState(t.colors || 256);
  let [f, p] = Z.useState(t.speed || 1);
  let [m, h] = Z.useState(0);
  let [g, _] = Z.useState(0);
  let [v, y] = Z.useState(0);
  let b = Lt({
    handleType: `target`
  });
  let x = Qt(Z.useMemo(() => {
    return b.map(e => {
      return e.source;
    });
  }, [b]));
  let S = Z.useRef(``);
  Z.useEffect(() => {
    let t = Mc(Array.isArray(x) ? x : x ? [x] : []);
    if (t && t !== S.current) {
      S.current = t;
      let n = `connected_video.mp4`;
      try {
        let e = new URL(t).pathname.split(`/`).pop();
        if (e && e.includes(`.`)) {
          n = e;
        }
      } catch {}
      r(e, {
        videoUrl: t,
        videoName: n,
        errorMessage: undefined
      });
    } else if (!t && S.current) {
      S.current = ``;
      r(e, {
        videoUrl: undefined,
        videoName: undefined
      });
    }
  }, [x, e, r]);
  Z.useEffect(() => {
    if (!i.videoUrl) {
      h(0);
      return;
    }
    let e = false;
    Ec(i.videoUrl).then(t => {
      if (!e && !!t) {
        h(t);
        _(0);
        y(t);
      }
    }).catch(() => {});
    return () => {
      e = true;
    };
  }, [i.videoUrl]);
  Z.useEffect(() => {
    r(e, {
      fps: o,
      maxSize: c,
      colors: u,
      speed: f
    });
  }, [o, c, u, f, e, r]);
  let C = t => {
    let n = t.target.files?.[0];
    if (!n) {
      return;
    }
    let r = URL.createObjectURL(n);
    i.onAddImage?.(e, r);
    t.target.value = ``;
  };
  let w = Z.useCallback(async () => {
    let t = i.videoUrl;
    if (!t) {
      i.onShowToast?.(`请先上传视频或连接包含视频的节点`);
      return;
    }
    r(e, {
      loading: true,
      progress: 0,
      errorMessage: undefined,
      resultInfo: undefined
    });
    try {
      let n = await _cmp_Tc(t, {
        fps: o,
        maxSize: c,
        colors: u,
        speed: f,
        startTime: m ? g : 0,
        endTime: m ? v : undefined,
        onProgress: t => {
          return r(e, {
            progress: Math.round(t * 100)
          });
        }
      });
      let a = URL.createObjectURL(n.blob);
      r(e, {
        loading: false,
        progress: 100,
        resultInfo: {
          width: n.width,
          height: n.height,
          frameCount: n.frameCount,
          size: n.size
        }
      });
      i.onSpawnImageNode?.(e, a, `GIF`);
    } catch (t) {
      r(e, {
        loading: false,
        errorMessage: t?.message || `GIF 生成失败`
      });
      i.onShowToast?.(t?.message || `GIF 生成失败`);
    }
  }, [i.videoUrl, o, c, u, f, g, v, m, e, r, i]);
  let T = !!i.loading;
  let E = !!i.resultInfo;
  let D = !!i.videoUrl;
  const Component1487 = `input`;
  const Component1488 = `span`;
  const Component1489 = `button`;
  const Component1490 = `span`;
  const Component1491 = `div`;
  const Component1492 = `option`;
  const Component1493 = `select`;
  const Component1494 = `label`;
  const Component1495 = `option`;
  const Component1496 = `select`;
  const Component1497 = `label`;
  const Component1498 = `option`;
  const Component1499 = `select`;
  const Component1500 = `label`;
  const Component1501 = `option`;
  const Component1502 = `select`;
  const Component1503 = `label`;
  const Component1504 = `div`;
  const Component1505 = `span`;
  const Component1506 = `input`;
  const Component1507 = `input`;
  const Component1508 = `span`;
  const Component1509 = `div`;
  const Component1510 = `span`;
  const Component1511 = `span`;
  const Component1512 = `span`;
  const Component1513 = `span`;
  const Component1514 = `span`;
  const Component1515 = `div`;
  const Component1516 = `button`;
  const Component1517 = `button`;
  const Component1518 = `div`;
  const Component1519 = `div`;
  const Component1520 = `div`;
  const Component1521 = `div`;
  return <Component1521 className={`relative group/node w-full h-full min-w-[300px] min-h-[200px]`}>
      <_cmp_Ti id={e} data={t} defaultTitle={`视频转GIF`} icon={<_Component48 size={11} className={`text-gray-500`} />} floating={true} />
      <_cmp_Ei visible={!!n} minWidth={300} minHeight={200} />
      <Component1520 className={`w-full h-full bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl transition-all duration-300 flex flex-col drag-handle cursor-move ${n ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`}>
        <_cmp__Component10 type={`target`} position={X.Left} />
        <Component1487 type={`file`} ref={a} style={{
        display: `none`
      }} accept={`video/*`} onChange={C} />
        <Component1519 className={`flex-1 p-3 flex flex-col gap-2.5`}>
          {!D && <Component1489 onClick={() => {
          return a.current?.click();
        }} className={`nodrag flex flex-col items-center justify-center gap-1.5 py-3 rounded-lg border border-dashed border-[#3a3a3a] text-gray-500 hover:text-blue-400 hover:border-blue-500/50 transition-colors`}>
              <_Component8 size={20} />
              <Component1488 className={`text-[11px]`}>{`上传视频 或 左侧连接视频节点`}</Component1488>
            </Component1489>}
          {i.errorMessage && <Component1491 className={`flex items-center gap-1.5 text-[11px] text-red-400`}>
              <_Component16 size={13} className={`shrink-0`} />
              <Component1490 className={`break-words`}>{i.errorMessage}</Component1490>
            </Component1491>}
          <Component1504 className={`grid grid-cols-4 gap-2`}>
            <Component1494 className={`nodrag flex flex-col gap-1 text-[10px] text-gray-500`}>
              {`清晰度`}
              <Component1493 value={c} onChange={e => {
              return l(Number(e.target.value));
            }} className={`nodrag bg-[#222] border border-[#333] rounded px-1.5 py-1 text-[11px] text-gray-200 outline-none focus:border-[#555]`}>
                {Dc.map(e => {
                return <Component1492 value={e} key={e}>
                      {e}
                      {`p`}
                    </Component1492>;
              })}
              </Component1493>
            </Component1494>
            <Component1497 className={`nodrag flex flex-col gap-1 text-[10px] text-gray-500`}>
              {`帧率`}
              <Component1496 value={o} onChange={e => {
              return s(Number(e.target.value));
            }} className={`nodrag bg-[#222] border border-[#333] rounded px-1.5 py-1 text-[11px] text-gray-200 outline-none focus:border-[#555]`}>
                {Oc.map(e => {
                return <Component1495 value={e} key={e}>
                      {e}
                      {` fps`}
                    </Component1495>;
              })}
              </Component1496>
            </Component1497>
            <Component1500 className={`nodrag flex flex-col gap-1 text-[10px] text-gray-500`}>
              {`速度`}
              <Component1499 value={f} onChange={e => {
              return p(Number(e.target.value));
            }} className={`nodrag bg-[#222] border border-[#333] rounded px-1.5 py-1 text-[11px] text-gray-200 outline-none focus:border-[#555]`}>
                {kc.map(e => {
                return <Component1498 value={e.value} key={e.value}>
                      {e.label}
                    </Component1498>;
              })}
              </Component1499>
            </Component1500>
            <Component1503 className={`nodrag flex flex-col gap-1 text-[10px] text-gray-500`}>
              {`色彩`}
              <Component1502 value={u} onChange={e => {
              return d(Number(e.target.value));
            }} className={`nodrag bg-[#222] border border-[#333] rounded px-1.5 py-1 text-[11px] text-gray-200 outline-none focus:border-[#555]`}>
                {Ac.map(e => {
                return <Component1501 value={e.value} key={e.value}>
                      {e.label}
                    </Component1501>;
              })}
              </Component1502>
            </Component1503>
          </Component1504>
          {m > 0 && <Component1509 className={`nodrag flex items-center gap-2 text-[10px] text-gray-400`}>
              <Component1505 className={`shrink-0`}>{`裁剪`}</Component1505>
              <Component1506 type={`range`} min={0} max={m} step={0.1} value={g} onChange={e => {
            return _(Math.min(parseFloat(e.target.value), v - 0.1));
          }} className={`nodrag flex-1 accent-blue-500`} />
              <Component1507 type={`range`} min={0} max={m} step={0.1} value={v} onChange={e => {
            return y(Math.max(parseFloat(e.target.value), g + 0.1));
          }} className={`nodrag flex-1 accent-blue-500`} />
              <Component1508 className={`shrink-0 tabular-nums w-20 text-right`}>
                {g.toFixed(1)}
                {`-`}
                {v.toFixed(1)}
                {`s`}
              </Component1508>
            </Component1509>}
          {i.resultInfo && <Component1515 className={`text-[10px] text-gray-400 flex items-center gap-2 flex-wrap`}>
              <Component1510>
                {i.resultInfo.width}
                {`×`}
                {i.resultInfo.height}
              </Component1510>
              <Component1511>{`·`}</Component1511>
              <Component1512>
                {i.resultInfo.frameCount}
                {` 帧`}
              </Component1512>
              <Component1513>{`·`}</Component1513>
              <Component1514 className={`text-blue-400`}>{jc(i.resultInfo.size)}</Component1514>
            </Component1515>}
          <Component1518 className={`mt-auto flex items-center gap-2`}>
            {D && <Component1516 onClick={() => {
            return a.current?.click();
          }} className={`nodrag flex items-center justify-center h-8 w-8 rounded-md text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] transition-colors`} title={`重新上传视频`}>
                <_Component8 size={14} />
              </Component1516>}
            <Component1517 onClick={w} disabled={T || !D} className={`nodrag flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md text-[12px] font-medium bg-white text-[#141414] hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}>
              {T ? <Q.Fragment>
                  <_n size={13} className={`animate-spin`} />
                  {` 生成中 `}
                  {i.progress || 0}
                  {`%`}
                </Q.Fragment> : <Q.Fragment>
                  <_Component42 size={13} />
                  {` `}
                  {E ? `重新免费生成` : `免费生成`}
                </Q.Fragment>}
            </Component1517>
          </Component1518>
        </Component1519>
        <_cmp__Component10 type={`source`} position={X.Right} id={`main-output`} />
      </Component1520>
    </Component1521>;
});
export default Nc;