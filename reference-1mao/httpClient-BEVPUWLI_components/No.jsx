// TODO(全局, 无需 import): resources, onSelect, onClose, className, o, i, f, n, p, u, r, s, l, g, m
import _cmp_Mo from './Mo.jsx';
import { e, t, c, d, a, h, Me } from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
export default function No({
  resources: e,
  onSelect: t,
  onClose: n,
  className: r = ``
}) {
  let [i, a] = Z.useState(`all`);
  let [o, s] = Z.useState(`materials`);
  let [c, l] = Z.useState(``);
  let [u, d] = Z.useState(1);
  let f = o === `generated` ? `tasks` : `migrated`;
  let p = e.filter(e => {
    if (i === `favorite` && !e.isFavorite) {
      return false;
    }
    let t = (e.folder || ``).trim().replace(/^[/\\]+|[/\\]+$/g, ``);
    if (t !== f && !t.startsWith(`${f}/`) && !t.startsWith(`${f}\\`) && e.name !== f) {
      return false;
    }
    let n = c ? `${f}/${c}` : f;
    return t === n || t === n.replace(/\//g, `\\`);
  });
  p.sort((e, t) => {
    let n = new Date(e.timestamp || 0).getTime();
    return new Date(t.timestamp || 0).getTime() - n;
  });
  let m = Math.ceil(p.length / 16);
  let h = p.slice((u - 1) * 16, u * 16);
  let g = e => {
    return e.type === `audio` || e.type?.startsWith(`audio`) || /\.(flac|mp3|wav|ogg|m4a|aac|opus|wma|aiff)(\?|$)/i.test(e.url || ``);
  };
  const Component357 = `button`;
  const Component358 = `button`;
  const Component359 = `div`;
  const Component360 = `button`;
  const Component361 = `button`;
  const Component362 = `div`;
  const Component363 = `button`;
  const Component364 = `div`;
  const Component365 = `div`;
  const Component366 = `span`;
  const Component367 = `button`;
  const Component368 = `div`;
  const Component369 = `div`;
  const Component370 = `video`;
  const Component371 = `div`;
  const Component372 = `img`;
  const Component373 = `div`;
  const Component374 = `span`;
  const Component375 = `div`;
  const Component376 = `video`;
  const Component377 = `polygon`;
  const Component378 = `svg`;
  const Component379 = `div`;
  const Component380 = `div`;
  const Component381 = `path`;
  const Component382 = `circle`;
  const Component383 = `circle`;
  const Component384 = `svg`;
  const Component385 = `span`;
  const Component386 = `div`;
  const Component387 = `img`;
  const Component388 = `span`;
  const Component389 = `div`;
  const Component390 = `div`;
  const Component391 = `div`;
  const Component392 = `div`;
  const Component393 = `button`;
  const Component394 = `span`;
  const Component395 = `button`;
  const Component396 = `div`;
  const Component397 = `div`;
  return <Component397 className={`w-72 bg-[#222] border border-[#444] rounded-lg shadow-2xl z-[100] flex flex-col overflow-hidden ${r}`} onClick={e => {
    return e.stopPropagation();
  }} onWheel={e => {
    return e.stopPropagation();
  }}>
      <Component365 className={`flex items-center justify-between p-1 border-b border-[#333] bg-[#1a1a1a]`}>
        <Component359 className={`flex gap-1`}>
          <Component357 className={`px-3 py-1 rounded text-xs font-bold ${o === `materials` ? `bg-[#333] text-white` : `text-gray-500 hover:text-gray-300`}`} onClick={() => {
          s(`materials`);
          l(``);
          d(1);
        }}>{`素材`}</Component357>
          <Component358 className={`px-3 py-1 rounded text-xs font-bold ${o === `generated` ? `bg-[#333] text-white` : `text-gray-500 hover:text-gray-300`}`} onClick={() => {
          s(`generated`);
          l(``);
          d(1);
        }}>{`生成`}</Component358>
        </Component359>
        <Component364 className={`flex items-center gap-2`}>
          <Component362 className={`flex bg-[#111] rounded p-0.5`}>
            <Component360 className={`px-2 py-0.5 rounded-[4px] text-[10px] ${i === `all` ? `bg-[#333] text-white` : `text-gray-500`}`} onClick={() => {
            a(`all`);
            d(1);
          }}>{`全部`}</Component360>
            <Component361 className={`px-2 py-0.5 rounded-[4px] text-[10px] ${i === `favorite` ? `bg-[#333] text-white` : `text-gray-500`}`} onClick={() => {
            a(`favorite`);
            d(1);
          }}>{`收藏`}</Component361>
          </Component362>
          <Component363 className={`text-gray-500 hover:text-white pr-1`} onClick={n}>{`×`}</Component363>
        </Component364>
      </Component365>
      {c && <Component368 className={`px-2 py-1 bg-[#1a1a1a] border-b border-[#333]`}>
          <Component367 onClick={() => {
        let e = c.split(`/`);
        e.pop();
        l(e.join(`/`));
        d(1);
      }} className={`flex items-center gap-1 bg-[#2a2a2a] hover:bg-[#333] text-gray-300 hover:text-white px-2 py-0.5 rounded text-[10px] font-bold transition-colors`}>
            <Component366 className={`text-sm mb-0.5 leading-none`}>{`‹`}</Component366>
            {c.split(`/`).pop()}
          </Component367>
        </Component368>}
      <Component392 className={`p-2 h-48 overflow-y-auto custom-scrollbar`}>
        {p.length === 0 ? <Component369 className={`text-center text-gray-500 text-xs py-10`}>{`当前目录为空`}</Component369> : <Component391 className={`grid grid-cols-4 gap-1.5`}>
            {h.map(n => {
          return <Component390 className={`aspect-square bg-[#111] rounded border border-[#333] hover:border-blue-500 cursor-pointer overflow-hidden relative group flex flex-col items-center justify-center`} onClick={() => {
            if (n.type === `folder`) {
              l(c ? `${c}/${n.name}` : n.name || ``);
              d(1);
            } else {
              t(n);
            }
          }} title={n.pageTitle || n.name || `素材`} key={n.id}>
                  {n.type === `folder` ? <Q.Fragment>
                      <Component373 className={`absolute inset-0 p-1 grid grid-cols-2 gap-0.5 overflow-hidden opacity-40 mix-blend-screen pointer-events-none`}>
                        {e.filter(e => {
                  return e.type !== `folder` && e.folder === `${f}${n.folder ? `/${n.folder}` : ``}/${n.name}`;
                }).sort((e, t) => {
                  return (t.timestamp || 0) - (e.timestamp || 0);
                }).slice(0, 3).map(e => {
                  if (e.type?.startsWith(`video`)) {
                    return <Component370 src={e.url} className={`w-full h-full object-cover rounded-[1px]`} key={e.id} />;
                  } else {
                    if (e.type?.startsWith(`text`)) {
                      return <Component371 className={`w-full h-full bg-[#111] rounded-[1px] text-[3px] text-gray-500 overflow-hidden break-all`} key={e.id}>
                                    {e.url.substring(0, 10)}
                                    {`...`}
                                  </Component371>;
                    } else {
                      return <Component372 src={e.url} className={`w-full h-full object-cover rounded-[1px]`} key={e.id} />;
                    }
                  }
                })}
                      </Component373>
                      <Me size={24} className={`text-orange-400 opacity-80 z-10 drop-shadow-md`} strokeWidth={1.5} />
                      <Component374 className={`text-[8px] text-gray-400 mt-1 w-full text-center truncate px-1 z-10 drop-shadow-md`}>
                        {n.name}
                      </Component374>
                    </Q.Fragment> : n.type === `text` ? <Component375 className={`p-1 text-[8px] text-gray-400 break-all overflow-hidden h-full w-full bg-[#1a1a1a]`}>
                      <_cmp_Mo url={n.url} />
                    </Component375> : n.type.startsWith(`video/`) || n.type === `video` ? <Q.Fragment>
                      <Component376 src={n.url} className={`w-full h-full object-cover bg-black`} />
                      <Component380 className={`absolute inset-0 flex items-center justify-center pointer-events-none`}>
                        <Component379 className={`w-6 h-6 rounded-full bg-black/40 flex items-center justify-center border border-white/20 backdrop-blur-sm`}>
                          <Component378 width={`12`} height={`12`} viewBox={`0 0 24 24`} fill={`white`} stroke={`white`} strokeWidth={`2`} strokeLinecap={`round`} strokeLinejoin={`round`} className={`ml-0.5`}>
                            <Component377 points={`5 3 19 12 5 21 5 3`} />
                          </Component378>
                        </Component379>
                      </Component380>
                    </Q.Fragment> : g(n) ? <Component386 className={`w-full h-full bg-gradient-to-b from-[#1d2230] to-[#0e0f12] flex flex-col items-center justify-center gap-1`}>
                      <Component384 width={`20`} height={`20`} viewBox={`0 0 24 24`} fill={`none`} stroke={`#60a5fa`} strokeWidth={`2`} strokeLinecap={`round`} strokeLinejoin={`round`}>
                        <Component381 d={`M9 18V5l12-2v13`} />
                        <Component382 cx={`6`} cy={`18`} r={`3`} />
                        <Component383 cx={`18`} cy={`16`} r={`3`} />
                      </Component384>
                      <Component385 className={`text-[8px] text-blue-300/70`}>{`音频`}</Component385>
                    </Component386> : <Component387 src={n.url} className={`w-full h-full object-cover bg-black`} />}
                  {n.type !== `folder` && <Component389 className={`absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity`}>
                      <Component388 className={`text-[10px] text-white`}>{`选择`}</Component388>
                    </Component389>}
                </Component390>;
        })}
          </Component391>}
      </Component392>
      {m > 1 && <Component396 className={`flex items-center justify-between p-1.5 border-t border-[#333] bg-[#1a1a1a]`}>
          <Component393 disabled={u === 1} onClick={() => {
        return d(e => {
          return Math.max(1, e - 1);
        });
      }} className={`text-[10px] px-2 py-0.5 bg-[#333] rounded disabled:opacity-30 text-gray-300`}>{`上一页`}</Component393>
          <Component394 className={`text-[10px] text-gray-500`}>
            {u}
            {` / `}
            {m}
          </Component394>
          <Component395 disabled={u === m} onClick={() => {
        return d(e => {
          return Math.min(m, e + 1);
        });
      }} className={`text-[10px] px-2 py-0.5 bg-[#333] rounded disabled:opacity-30 text-gray-300`}>{`下一页`}</Component395>
        </Component396>}
    </Component397>;
}