// TODO(全局, 无需 import): data, selected, updateNodeData, handleType, b, x, r, videoUrl, videoName, n, errorMessage, i, fps, o, maxSize, colors, u, speed, f, loading, progress, resultInfo, startTime, m, g, endTime, v, onProgress, width, height, frameCount, size, display, l, s, p
import _cmp__Component8 from './_Component8.jsx';
import _cmp__Component9 from './_Component9.jsx';
import _cmp__Component12 from './_Component12.jsx';
import _cmp_ic from './ic.jsx';
import { id, We, t, Lt, Qt, dc, S, h, ac, _, y, c, a, X, C, oc, sc, cc, d, lc, uc, D, w, T, E, _Component49, _Component0, _Component17, _n, _Component43 } from './shared.js';
import * as _shared from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
var fc = Z.memo(({
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
    let t = dc(Array.isArray(x) ? x : x ? [x] : []);
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
    ac(i.videoUrl).then(t => {
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
      let n = await _cmp_ic(t, {
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
  const Component1465 = `input`;
  const Component1466 = `span`;
  const Component1467 = `button`;
  const Component1468 = `span`;
  const Component1469 = `div`;
  const Component1470 = `option`;
  const Component1471 = `select`;
  const Component1472 = `label`;
  const Component1473 = `option`;
  const Component1474 = `select`;
  const Component1475 = `label`;
  const Component1476 = `option`;
  const Component1477 = `select`;
  const Component1478 = `label`;
  const Component1479 = `option`;
  const Component1480 = `select`;
  const Component1481 = `label`;
  const Component1482 = `div`;
  const Component1483 = `span`;
  const Component1484 = `input`;
  const Component1485 = `input`;
  const Component1486 = `span`;
  const Component1487 = `div`;
  const Component1488 = `span`;
  const Component1489 = `span`;
  const Component1490 = `span`;
  const Component1491 = `span`;
  const Component1492 = `span`;
  const Component1493 = `div`;
  const Component1494 = `button`;
  const Component1495 = `button`;
  const Component1496 = `div`;
  const Component1497 = `div`;
  const Component1498 = `div`;
  const Component1499 = `div`;
  return <Component1499 className={`relative group/node w-full h-full min-w-[300px] min-h-[200px]`}>
      <_cmp__Component8 id={e} data={t} defaultTitle={`视频转GIF`} icon={<_Component49 size={11} className={`text-gray-500`} />} floating={true} />
      <_cmp__Component9 visible={!!n} minWidth={300} minHeight={200} />
      <Component1498 className={`w-full h-full bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl transition-all duration-300 flex flex-col drag-handle cursor-move ${n ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`}>
        <_cmp__Component12 type={`target`} position={X.Left} />
        <Component1465 type={`file`} ref={a} style={{
        display: `none`
      }} accept={`video/*`} onChange={C} />
        <Component1497 className={`flex-1 p-3 flex flex-col gap-2.5`}>
          {!D && <Component1467 onClick={() => {
          return a.current?.click();
        }} className={`nodrag flex flex-col items-center justify-center gap-1.5 py-3 rounded-lg border border-dashed border-[#3a3a3a] text-gray-500 hover:text-blue-400 hover:border-blue-500/50 transition-colors`}>
              <_Component0 size={20} />
              <Component1466 className={`text-[11px]`}>{`上传视频 或 左侧连接视频节点`}</Component1466>
            </Component1467>}
          {i.errorMessage && <Component1469 className={`flex items-center gap-1.5 text-[11px] text-red-400`}>
              <_Component17 size={13} className={`shrink-0`} />
              <Component1468 className={`break-words`}>{i.errorMessage}</Component1468>
            </Component1469>}
          <Component1482 className={`grid grid-cols-4 gap-2`}>
            <Component1472 className={`nodrag flex flex-col gap-1 text-[10px] text-gray-500`}>
              {`清晰度`}
              <Component1471 value={c} onChange={e => {
              return l(Number(e.target.value));
            }} className={`nodrag bg-[#222] border border-[#333] rounded px-1.5 py-1 text-[11px] text-gray-200 outline-none focus:border-[#555]`}>
                {oc.map(e => {
                return <Component1470 value={e} key={e}>
                      {e}
                      {`p`}
                    </Component1470>;
              })}
              </Component1471>
            </Component1472>
            <Component1475 className={`nodrag flex flex-col gap-1 text-[10px] text-gray-500`}>
              {`帧率`}
              <Component1474 value={o} onChange={e => {
              return s(Number(e.target.value));
            }} className={`nodrag bg-[#222] border border-[#333] rounded px-1.5 py-1 text-[11px] text-gray-200 outline-none focus:border-[#555]`}>
                {sc.map(e => {
                return <Component1473 value={e} key={e}>
                      {e}
                      {` fps`}
                    </Component1473>;
              })}
              </Component1474>
            </Component1475>
            <Component1478 className={`nodrag flex flex-col gap-1 text-[10px] text-gray-500`}>
              {`速度`}
              <Component1477 value={f} onChange={e => {
              return p(Number(e.target.value));
            }} className={`nodrag bg-[#222] border border-[#333] rounded px-1.5 py-1 text-[11px] text-gray-200 outline-none focus:border-[#555]`}>
                {cc.map(e => {
                return <Component1476 value={e.value} key={e.value}>
                      {e.label}
                    </Component1476>;
              })}
              </Component1477>
            </Component1478>
            <Component1481 className={`nodrag flex flex-col gap-1 text-[10px] text-gray-500`}>
              {`色彩`}
              <Component1480 value={u} onChange={e => {
              return d(Number(e.target.value));
            }} className={`nodrag bg-[#222] border border-[#333] rounded px-1.5 py-1 text-[11px] text-gray-200 outline-none focus:border-[#555]`}>
                {lc.map(e => {
                return <Component1479 value={e.value} key={e.value}>
                      {e.label}
                    </Component1479>;
              })}
              </Component1480>
            </Component1481>
          </Component1482>
          {m > 0 && <Component1487 className={`nodrag flex items-center gap-2 text-[10px] text-gray-400`}>
              <Component1483 className={`shrink-0`}>{`裁剪`}</Component1483>
              <Component1484 type={`range`} min={0} max={m} step={0.1} value={g} onChange={e => {
            return _(Math.min(parseFloat(e.target.value), v - 0.1));
          }} className={`nodrag flex-1 accent-blue-500`} />
              <Component1485 type={`range`} min={0} max={m} step={0.1} value={v} onChange={e => {
            return y(Math.max(parseFloat(e.target.value), g + 0.1));
          }} className={`nodrag flex-1 accent-blue-500`} />
              <Component1486 className={`shrink-0 tabular-nums w-20 text-right`}>
                {g.toFixed(1)}
                {`-`}
                {v.toFixed(1)}
                {`s`}
              </Component1486>
            </Component1487>}
          {i.resultInfo && <Component1493 className={`text-[10px] text-gray-400 flex items-center gap-2 flex-wrap`}>
              <Component1488>
                {i.resultInfo.width}
                {`×`}
                {i.resultInfo.height}
              </Component1488>
              <Component1489>{`·`}</Component1489>
              <Component1490>
                {i.resultInfo.frameCount}
                {` 帧`}
              </Component1490>
              <Component1491>{`·`}</Component1491>
              <Component1492 className={`text-blue-400`}>{uc(i.resultInfo.size)}</Component1492>
            </Component1493>}
          <Component1496 className={`mt-auto flex items-center gap-2`}>
            {D && <Component1494 onClick={() => {
            return a.current?.click();
          }} className={`nodrag flex items-center justify-center h-8 w-8 rounded-md text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] transition-colors`} title={`重新上传视频`}>
                <_Component0 size={14} />
              </Component1494>}
            <Component1495 onClick={w} disabled={T || !D} className={`nodrag flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md text-[12px] font-medium bg-white text-[#141414] hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}>
              {T ? <Q.Fragment>
                  <_n size={13} className={`animate-spin`} />
                  {` 生成中 `}
                  {i.progress || 0}
                  {`%`}
                </Q.Fragment> : <Q.Fragment>
                  <_Component43 size={13} />
                  {` `}
                  {E ? `重新免费生成` : `免费生成`}
                </Q.Fragment>}
            </Component1495>
          </Component1496>
        </Component1497>
        <_cmp__Component12 type={`source`} position={X.Right} id={`main-output`} />
      </Component1498>
    </Component1499>;
});
export default fc;